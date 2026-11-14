# Scheduling Service

## Trách nhiệm và ranh giới

Scheduling là Core Domain: suy ra slot 60 phút, tạo hold độc quyền, xác nhận booking, chống chồng lấn cho Tutor và Student, hủy booking, cung cấp relationship query và phát integration event qua outbox. Service không sở hữu profile, credential hoặc việc gửi notification.

## Mô hình miền

### TimeSlot value object

- `StartAtUtc`, `EndAtUtc`; UTC; `End = Start + 60 phút`; start minute 00/30, second=0.
- Range nửa mở `[start,end)`: 10:00-11:00 không conflict 11:00-12:00.
- Không tạo slot bắt đầu trong quá khứ; booking horizon mặc định 90 ngày.

### Booking aggregate

Fields: `Id`, `StudentId`, `StudentUserId`, `TutorId`, `TutorUserId`, `SubjectId`, `StartAtUtc`, `EndAtUtc`, `Status`, confirmation/cancellation audit, `CreatedAtUtc`, `UpdatedAtUtc`, `Version`, `SourceHoldId`.

Behavior:

- `ConfirmFromHold`: chỉ tạo mới; kiểm TimeSlot, participants và hold binding.
- `Cancel(actorUserId, reasonCode)`: chỉ participant; `Confirmed -> Cancelled`; gọi lặp không tạo event mới.
- Booking không trở lại Confirmed; reschedule là cancel + hold/booking mới.
- Domain event được chuyển thành immutable outbox event trong cùng transaction.

## Cơ sở dữ liệu SchedulingDb

Enable `btree_gist`. Schema cốt lõi:

```sql
CREATE TABLE bookings (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL,
  student_user_id uuid NOT NULL,
  tutor_id uuid NOT NULL,
  tutor_user_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  start_at_utc timestamptz NOT NULL,
  end_at_utc timestamptz NOT NULL,
  slot_range tstzrange GENERATED ALWAYS AS
    (tstzrange(start_at_utc, end_at_utc, '[)')) STORED,
  status varchar(20) NOT NULL CHECK (status IN ('Confirmed','Cancelled')),
  source_hold_id uuid NOT NULL UNIQUE,
  confirmed_at_utc timestamptz NOT NULL,
  cancelled_at_utc timestamptz,
  cancelled_by_user_id uuid,
  cancellation_reason varchar(50),
  created_at_utc timestamptz NOT NULL,
  updated_at_utc timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CHECK (end_at_utc = start_at_utc + interval '60 minutes')
);
ALTER TABLE bookings ADD CONSTRAINT no_tutor_overlap
  EXCLUDE USING gist (tutor_id WITH =, slot_range WITH &&)
  WHERE (status = 'Confirmed');
ALTER TABLE bookings ADD CONSTRAINT no_student_overlap
  EXCLUDE USING gist (student_id WITH =, slot_range WITH &&)
  WHERE (status = 'Confirmed');
```

`outbox_messages`: `id uuid PK`, aggregate_type/id, event_type/version, routing_key, payload `jsonb`, correlation/causation/trace, occurred, published, attempt_count, next_attempt, locked, last_error (redacted). Index pending `(published_at_utc, next_attempt_at_utc, occurred_at_utc)`.

Query indexes: participant/status/start; tutor/status/start; upcoming. Không dùng FK xuyên service.

## Redis hold

### Key và value

- Slot lock: `sched:hold:v1:tutor:{tutorId}:{startEpoch}`.
- Student lock: `sched:hold:v1:student:{studentId}:{startEpoch}`.
- Metadata: `sched:hold:v1:id:{holdId}`.
- TTL mọi key 300 giây; key hash-tag có thể bổ sung nếu dùng Redis Cluster để Lua cùng slot.

Metadata JSON: holdId, studentId/userId, tutorId/userId, subjectId, start/end, created/expired. API trả `holdToken`, là random 256-bit hoặc signed opaque token; Redis chỉ lưu hash để log/DB leak không dùng được.

### Lua create atomic

Một script nhận ba keys, payload và TTL. Nếu slot/student key tồn tại trả conflict; ngược lại `SET ... NX PX 300000` cả ba trong cùng script và trả success. Không dùng chuỗi lệnh SET riêng. Release script chỉ DEL nếu metadata holdId/tokenHash/owner khớp; không cho client xóa hold người khác.

**Giới hạn:** Student lock theo exact start chưa ngăn overlapping start 30 phút. Vì slot cố định và grid 30 phút, script phải kiểm cả các candidate start có thể overlap (`start-30`, `start`, `start+30`) cho tutor và student, hoặc dùng sorted-set + Lua range query. DB constraints vẫn là lớp cuối.

## Luồng tạo hold

1. JWT role Student; resolve Student profile bằng internal API/cache an toàn.
2. Validate time/horizon/subject; gọi Tutor validate-slot với timeout.
3. Query SchedulingDb không có confirmed overlap cho tutor/student để fail sớm.
4. Chạy Redis Lua atomic; conflict trả 409 với `retryAfterSeconds` tối đa TTL còn lại.
5. Trả `holdId`, one-time `holdToken`, `expiresAtUtc`; không log token.

Nếu DB/Tutor/Redis unavailable trả 503. Không tạo hold khi không kiểm được invariant.

## Luồng xác nhận transaction

1. Validate JWT Student và hold token; lấy metadata, constant-time compare hash, kiểm owner/payload/TTL.
2. Bắt đầu PostgreSQL transaction Read Committed; insert Booking Confirmed và OutboxMessage.
3. Exclusion violation PostgreSQL (`23P01`) -> rollback và 409 `SCHEDULING_SLOT_CONFLICT`.
4. Commit; release Redis hold compare-and-delete best-effort.
5. Trả 201 + Location. Nếu retry cùng `sourceHoldId` và cùng owner, trả 200 booking hiện có; khác payload trả 409.

Không delete hold trước commit. Không publish RabbitMQ bên trong request transaction.

## API

### GET `/api/v1/slots/available`

Student; query `tutorId`, `subjectId`, `fromUtc`, `toUtc` tối đa 7 ngày. Lấy Tutor availability rồi trừ confirmed bookings; có thể loại active holds cho UX nhưng kết quả chỉ là snapshot. Trả slot + `generatedAtUtc`; client vẫn phải tạo hold.

### POST `/api/v1/bookings/holds`

```json
{ "tutorId":"uuid", "subjectId":"uuid", "startAtUtc":"2026-11-15T02:00:00Z" }
```

201 `{ holdId, holdToken, startAtUtc, endAtUtc, expiresAtUtc }`; 409 held/booked; 422 invalid availability.

### POST `/api/v1/bookings`

Body `{ holdId, holdToken }`; Student only. 201/200 idempotent; 409 expired/mismatch/conflict. Expired hold dùng code `SCHEDULING_HOLD_EXPIRED`.

### GET `/api/v1/bookings`

Student/Tutor/Admin; filter range/status, pagination; service tự filter participant theo JWT sub. Admin có explicit policy.

### GET `/api/v1/bookings/{id}`

Participant/Admin; không participant trả 403/404 theo anti-enumeration.

### DELETE `/api/v1/bookings/{id}`

Participant; optional reasonCode allow-list. 204, idempotent. Transaction update + BookingCancelled outbox. Policy demo cho hủy đến trước start; nếu cần cutoff sau này ADR.

### Internal

- `POST /internal/v1/slots/query`: batch <=100 tutors, 7 days.
- `GET /internal/v1/relationships/tutors/{tutorUserId}/students/{studentId}`: Student Service only.

## Outbox publisher

BackgroundService mỗi 500ms hoặc wake signal:

1. Claim tối đa 100 row pending bằng transaction `FOR UPDATE SKIP LOCKED` và lease.
2. Publish persistent message đến `tutormatching.events` với mandatory + publisher confirms.
3. Khi confirm, set `published_at_utc`; khi lỗi tăng attempt, exponential backoff 1s..5m + jitter.
4. Alert row quá 10 attempts/15 phút; không tự xóa. Duplicate publish được consumer xử lý.

## Biến môi trường

`ConnectionStrings__SchedulingDb`, `Redis__ConnectionString`, `Redis__HoldTtlSeconds=300`, `RabbitMq__Host`, `RabbitMq__VirtualHost=/tutormatching`, `RabbitMq__Username`, `RabbitMq__Password`, `RabbitMq__Exchange=tutormatching.events`, `Services__TutorBaseUrl`, `Services__StudentBaseUrl`, JWT/service-auth/OTEL variables, `Scheduling__SlotMinutes=60`, `Scheduling__GridMinutes=30`, `Scheduling__MaxHorizonDays=90`.

## Migration và Health

Migration tạo extension, bookings, exclusion constraints, outbox và indexes. Readiness kiểm SchedulingDb, Redis PING và RabbitMQ connection/channel; service có thể đọc booking khi RabbitMQ down nhưng readiness đỏ để không nhận mutation mới nếu outbox backlog policy yêu cầu. Liveness chỉ process.

## Kiểm thử bắt buộc

- Domain: slot length/grid/range; actor cancel; idempotent cancel.
- Redis integration: Lua atomic; TTL; wrong owner/token release; overlap grid; Redis restart.
- PostgreSQL integration: exclusion tutor/student; adjacent slots allowed; cancelled row không block; sourceHold unique.
- Concurrency: 20 confirm cùng tutor slot -> 1 created, 19 idempotent/conflict; hai tutors nhưng cùng student overlap -> 1; different non-overlap -> cả hai.
- Outbox: booking+event atomic; publisher restart; confirm timeout gây duplicate an toàn; poison row alert.
- API/security: 401/403/409/422/503; hold theft/replay/mismatch/expiry; participant ownership; range/page limits.

