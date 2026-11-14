# Notification Service

## Trách nhiệm và ranh giới

Notification consume booking events, tạo thông báo in-app và reminder, gửi qua in-app/SMTP development, lưu trạng thái delivery và cung cấp API đọc/mark read. Service không quyết định booking và không làm request xác nhận booking chờ việc gửi.

## Mô hình miền

### Notification

Fields: `Id`, `RecipientUserId`, `BookingId`, `Type`, `Title`, `Body`, `Status(Unread/Read)`, `CreatedAtUtc`, `ReadAtUtc`, `SourceEventId`. `MarkRead` chỉ owner và idempotent.

### ReminderSchedule

Fields: booking/recipient/type (`Before24Hours`, `Before1Hour`), `ScheduledForUtc`, `Status(Pending,Processing,Sent,Cancelled,Failed)`, lease, attempts. Unique theo booking+recipient+type. Event đến sau scheduled time: không tạo reminder quá hạn; vẫn tạo confirmation.

### DeliveryAttempt

Ghi channel, providerMessageId, attempt, status, started/completed, errorCode sanitized. Không lưu raw credential/provider payload có PII dư thừa.

## Cơ sở dữ liệu NotificationDb

| Bảng | Constraint/index |
|---|---|
| `processed_events` | `event_id uuid PK`, event_type/version, processed_at; inbox idempotency |
| `notifications` | id PK, recipient_user_id, booking_id, type, title/body, status, source_event_id, timestamps; unique `(source_event_id,recipient_user_id,type)`; index recipient/status/created desc |
| `reminder_schedules` | id PK, booking/recipient/type, scheduled, status, lease_until, attempts, next_attempt, last_error; unique booking/recipient/type; due index |
| `delivery_attempts` | id PK, notification/reminder FK nội bộ, channel, attempt_no, status, provider ID, error, timestamps; unique target/channel/attempt |

## RabbitMQ consumer

- Queue `notification.booking-events.v1`, quorum/durable; prefetch 20; manual ACK.
- Validate content type, max 256 KiB, envelope fields, supported type/version trước xử lý.
- Transaction: insert ProcessedEvent, tạo 2 participant notifications và reminder rows/cancel pending reminders, commit, ACK.
- Duplicate eventId: ACK. Cùng booking event khác eventId vẫn bị business unique constraint kiểm; log anomaly và ACK/DLQ theo loại.
- Transient DB/provider không nằm consumer provider path: NACK/retry. Invalid schema/unsupported version: reject vào DLQ kèm metric, không loop vô hạn.

Consumer không gửi email trực tiếp; chỉ ghi work. Điều này giữ ACK transaction ngắn và restart-safe.

## Xử lý event

### BookingConfirmed

- Tạo `BookingConfirmed` notification cho Student và Tutor.
- Tạo reminder 24h và 1h cho cả hai nếu `scheduledForUtc > now + safetyWindow(2 phút)`.
- Body dùng template version cố định; lấy locale/profile qua projection/provider sau nếu cần, không block core consumer.

### BookingCancelled

- Tạo `BookingCancelled` notification cho cả hai.
- Atomic update Pending/Processing-not-sent reminders thành Cancelled; worker kiểm trạng thái lại trước send.
- Nếu cancellation đến trước confirmation do replay/out-of-order, upsert cancellation và không tạo reminder; confirmation đến sau phải nhận biết booking cancelled projection để không hồi sinh reminder.

## Reminder worker

Mỗi 15 giây:

1. Transaction claim tối đa 100 due rows `FOR UPDATE SKIP LOCKED`, set Processing + lease 2 phút.
2. Tạo/đảm bảo Notification row và DeliveryAttempt Pending, commit.
3. Gửi channel ngoài transaction với timeout 10 giây.
4. Update Sent; transient failure schedule exponential retry 1m, 5m, 15m, tối đa 5; permanent -> Failed.
5. Worker khác có thể reclaim lease hết hạn. Unique constraints ngăn duplicate record; provider idempotency key dùng reminder ID.

## Kênh

- In-app bắt buộc: tạo row là delivery thành công logic.
- Email Development: SMTP Mailpit `mailpit:1025`, không auth/TLS trong private
  network; địa chỉ demo được suy ra thành
  `{recipientUserId}@demo.tutormatching.local`; management UI host 8025 chỉ dev.
- Production provider ngoài phạm vi; adapter `INotificationSender` phải nhận idempotency key và cancellation token.

## API

### GET `/api/v1/notifications`

Authenticated; luôn filter `recipientUserId = JWT sub`; query status/type/page/pageSize; newest first. Không nhận recipient ID từ client.

### PATCH `/api/v1/notifications/{id}/read`

Owner only; 204 idempotent. Non-owner 404 để chống enumeration.

### PATCH `/api/v1/notifications/read-all`

Owner; optional `beforeUtc`; 204, batch update có giới hạn/range.

Không có public endpoint tạo notification tùy ý.

## Phân quyền và dữ liệu

- JWT authenticated cho API, resource owner bắt buộc.
- RabbitMQ credential chỉ consume queue và publish retry/DLX theo topology cần thiết.
- Template không chứa secret; title/body tránh PII nhạy cảm trong log.
- V1 không cần email thật trong event hoặc projection; chỉ dùng địa chỉ demo suy
  ra từ userId. Provider production phải có ADR về recipient projection và consent.

## Biến môi trường

`ConnectionStrings__NotificationDb`, RabbitMQ variables, `RabbitMq__Queue=notification.booking-events.v1`, `RabbitMq__Prefetch=20`, `Worker__PollSeconds=15`, `Worker__BatchSize=100`, `Worker__LeaseSeconds=120`, `Delivery__MaxAttempts=5`, `Smtp__Host=mailpit`, `Smtp__Port=1025`, JWT/OTEL variables.

## Migration và Health

Migration tạo inbox, notifications, reminders, attempts và unique/due indexes. Readiness kiểm NotificationDb và RabbitMQ consumer connectivity; SMTP/Mailpit degraded không làm consumer mất event nhưng readiness policy có thể báo degraded qua custom health detail. Liveness không dependency.

## Kiểm thử bắt buộc

- Consumer integration: confirmed/cancelled, duplicate event, duplicate business event, unsupported version, DB rollback trước ACK, restart redelivery.
- Out-of-order: cancelled trước confirmed không tạo/hồi sinh reminder.
- Worker: due claim bằng SKIP LOCKED; hai worker không gửi hai lần; lease expiry; timeout/retry/permanent; provider idempotency.
- API: owner filter, non-owner 404, pagination, read idempotent, JWT invalid.
- RabbitMQ: retry hữu hạn, DLQ poison message, prefetch/manual ACK, service restart giữ message.

