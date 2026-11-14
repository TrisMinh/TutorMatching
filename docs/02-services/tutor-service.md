# Tutor Service

## Trách nhiệm và ranh giới

Tutor sở hữu hồ sơ gia sư, catalog subject dùng cho tìm kiếm, quan hệ tutor-subject và availability. Service không giữ password, hold hoặc booking. Availability chỉ nói Tutor sẵn sàng; Scheduling quyết định slot cuối sau khi trừ booking/hold.

## Mô hình miền

### TutorProfile aggregate

Fields: `Id`, `UserId`, `DisplayName`, `Bio`, `ExperienceYears`, `AvatarUrl`, `Status`, `CreatedAtUtc`, `UpdatedAtUtc`, `Version`.

Children: `TutorSubject(SubjectId, ProficiencyLevel)` và `AvailabilityWindow(Id, StartAtUtc, EndAtUtc)`. Invariant:

- `UserId` unique và lấy từ JWT `sub`, không nhận từ body.
- DisplayName 2-100, bio tối đa 2000, experience 0-80, avatar HTTPS/relative allow-list.
- Subject không trùng; subject phải Active.
- Availability ở tương lai khi tạo, start/end ở mốc 30 phút, duration >= 60 phút, không chồng nhau.
- Update dùng ETag/version; stale update trả 412.

## Cơ sở dữ liệu TutorDb

| Bảng | Cột và constraint chính |
|---|---|
| `tutor_profiles` | `id uuid PK`, `user_id uuid UNIQUE`, display_name varchar(100), bio varchar(2000), experience_years smallint check 0..80, avatar_url varchar(500), status check Draft/Active/Suspended, timestamps, version int |
| `subjects` | `id uuid PK`, `code varchar(50) UNIQUE`, `name varchar(120)`, `is_active bool`, timestamps |
| `tutor_subjects` | `(tutor_id, subject_id) PK`, proficiency check Beginner/Intermediate/Advanced/Expert; FKs nội bộ |
| `availability_windows` | `id uuid PK`, `tutor_id FK`, start/end `timestamptz`, generated `slot_range tstzrange`, check end>start |

Enable `btree_gist`; exclusion constraint `EXCLUDE USING gist (tutor_id WITH =, slot_range WITH &&)` trên availability. Index search: active status, subject join subject_id+tutor_id, display name trigram chỉ khi cần. Không lưu booked flag tại TutorDb.

## API

### GET `/api/v1/tutors`

Student/Admin; query `subjectId`, `availableFromUtc`, `availableToUtc`, `page`, `pageSize`, `sort`. Service lọc profile/subject/availability thô; Gateway/Scheduling loại booking. Response item:

```json
{
  "id": "uuid", "displayName": "Nguyen Van A", "bio": "...",
  "experienceYears": 4, "avatarUrl": "/media/...",
  "subjects": [{ "subjectId": "uuid", "code": "MATH", "name": "Toán" }],
  "version": 3
}
```

Không trả email/userId public. Sort allow-list `displayName`, `experienceYears`, `createdAtUtc`.

### GET `/api/v1/tutors/{tutorId}`

Authenticated; 200 public profile, 404 nếu không Active trừ owner/Admin.

### GET/PUT `/api/v1/tutors/me`

Tutor only. GET tìm theo JWT sub. PUT tạo/cập nhật allow-listed fields và subjects; `If-Match: "3"`; 200 + ETag mới. Không cho status Suspended hoặc userId từ body.

### GET `/api/v1/tutors/{tutorId}/availability`

Authenticated; range bắt buộc, tối đa 31 ngày, chỉ trả window. Không tuyên bố slot chắc chắn còn trống.

### PUT `/api/v1/tutors/me/availability`

Tutor only; replace toàn bộ window trong range quản lý, transaction và version. Body tối đa 200 windows. Conflict nội bộ trả 409 `TUTOR_AVAILABILITY_OVERLAP`.

### POST `/internal/v1/tutors/{id}/validate-slot`

Chỉ Scheduling gọi qua private network và truyền nguyên JWT Student; Tutor Service
xác thực Student role. Input `{ subjectId,startAtUtc,endAtUtc }`; trả
`{ tutorExists,isActive,teachesSubject,isWithinAvailability,version }`. Endpoint
không kiểm booking và Gateway không expose route này.

## Phân quyền

- Tutor chỉ sửa profile/availability khớp JWT sub.
- Student/Admin được search/đọc active profile.
- Internal endpoint yêu cầu JWT Student hợp lệ được truyền từ request gốc và chỉ
  tồn tại trên private route; v1 chưa có service credential riêng.
- Suspended tutor không xuất hiện search và không validate slot mới.

## Cache

V1 không cache Tutor read model. Chỉ bổ sung cache sau khi đo và có ADR;
correctness không được phụ thuộc cache.

## Biến môi trường

`ConnectionStrings__TutorDb`, `Jwt__Issuer`, `Jwt__Audience`,
`Jwt__SigningKey`, `Search__MaxPageSize=100`,
`Availability__MaxRangeDays=31`, `OTEL_EXPORTER_OTLP_ENDPOINT` cùng biến ASP.NET
chuẩn.

## Migration

1. extensions `btree_gist` (và `pg_trgm` nếu bật search); tables/check/index.
2. seed subject catalog có GUID cố định, code stable; upsert idempotent Development/Test.
3. exclusion constraint trong SQL migration; integration test phải chứng minh constraint hoạt động.

## Health

Liveness không dependency. Readiness kiểm TutorDb; nếu cache optional lỗi vẫn ready nhưng metric/log degraded.

## Kiểm thử bắt buộc

- Domain: field bounds, duplicate subject, invalid/aligned/overlapping availability.
- Integration: unique userId, exclusion constraint dưới concurrent insert, replace transaction rollback, search indexes/migration.
- API: owner/other tutor 403, Student update 403, invalid ETag 412, inactive tutor 404, paging max, malicious sort/filter 400.
- Contract: validate-slot schema và timeout behavior với Scheduling.

