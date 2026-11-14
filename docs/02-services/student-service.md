# Student Service

## Trách nhiệm và ranh giới

Student sở hữu hồ sơ học sinh, education level, learning goals và subject interests. Service không lưu credential, role hoặc booking. Tutor chỉ xem projection tối thiểu khi Scheduling xác nhận hai bên có booking liên quan.

## Mô hình miền

`StudentProfile` aggregate fields: `Id`, `UserId`, `DisplayName`, `EducationLevel`, `LearningGoal`, `Timezone`, `Status`, timestamps, `Version`; children `StudentSubjectInterest(SubjectId, Priority)`.

Invariant:

- `UserId` lấy từ JWT và unique.
- DisplayName 2-100; LearningGoal tối đa 2000; timezone là IANA ID hợp lệ, mặc định `Asia/Ho_Chi_Minh` nếu user chọn.
- EducationLevel thuộc `Primary`, `LowerSecondary`, `UpperSecondary`, `University`, `Adult`.
- SubjectId unique trong profile; priority 1-5.
- Profile status `Active`/`Suspended`; client không sửa status/userId/version.

## Cơ sở dữ liệu StudentDb

| Bảng | Cột/constraint |
|---|---|
| `student_profiles` | `id uuid PK`, `user_id uuid UNIQUE`, display_name varchar(100), education_level varchar(30) check, learning_goal varchar(2000), timezone varchar(100), status check, timestamps, version int |
| `student_subject_interests` | `(student_id, subject_id) PK`, priority smallint check 1..5, created_at; FK nội bộ student only |

`subject_id` là external reference đến Tutor subject catalog, không foreign key
xuyên DB. PUT profile gọi Tutor internal subject-validation bằng JWT Student; nếu
Tutor unavailable, trả 503 thay vì lưu ID chưa xác minh. Index
`(subject_id, priority)` chỉ tạo khi có query nghiệp vụ sử dụng.

## API

### GET `/api/v1/students/me`

Student only; tìm theo JWT sub. 404 `STUDENT_PROFILE_NOT_FOUND` nếu chưa onboarding.

### PUT `/api/v1/students/me`

Student only; upsert profile. `If-Match` bắt buộc khi đã tồn tại. Body:

```json
{
  "displayName": "Minh Anh",
  "educationLevel": "UpperSecondary",
  "learningGoal": "Ôn thi đại học môn Toán",
  "timezone": "Asia/Ho_Chi_Minh",
  "subjectInterests": [{ "subjectId": "uuid", "priority": 1 }]
}
```

Tạo mới trả 201 + Location/ETag; update trả 200 + ETag. Không nhận role, status, userId.

### GET `/api/v1/students/{studentId}`

- Admin: full non-sensitive profile.
- Tutor: chỉ khi Scheduling trả `hasRelationship=true` cho Tutor user/tutor và student; response tối thiểu gồm displayName, educationLevel, learningGoal, subject interests, không có userId.
- Student khác: 404 để chống enumeration.

### GET `/internal/v1/students/by-user/{userId}`

Scheduling service scope `student.resolve`; trả studentId + active flag để xác minh participant. Không expose Gateway.

## Xác minh quan hệ Tutor-Student

Student Service gọi
`GET /internal/v1/relationships/tutors/{tutorUserId}/students/{studentId}` tại
Scheduling và truyền nguyên JWT Tutor của request gốc. Scheduling so `sub` với
`tutorUserId`, xác thực role Tutor và trả true nếu có Confirmed hoặc Cancelled gần
đây theo retention policy. Timeout 5 giây; cache kết quả allow tối đa 30 giây;
dependency lỗi trả 503, không fail-open.

## Phân quyền

| Endpoint | Role | Resource rule |
|---|---|---|
| `/students/me` GET/PUT | Student | JWT sub là owner. |
| `/students/{id}` | Admin | Full allowed fields. |
| `/students/{id}` | Tutor | Quan hệ booking được Scheduling xác minh. |
| internal resolve | Scheduling client | Scope + private route. |

## Biến môi trường

`ConnectionStrings__StudentDb`, JWT variables,
`Services__SchedulingBaseUrl=http://scheduling-service:8080`,
`Authorization__RelationshipCacheSeconds=30`, `Profiles__MaxInterests=20`, OTEL
variables. Không có service client secret trong v1.

## Migration và seed

Migration tạo profile/interest/check/index; không seed PII. Test fixture tạo profile qua API. Thay đổi enum phải dùng expand/migrate/constraint update, không deploy constraint mới trước code tương thích.

## Health

- Liveness: process.
- Readiness: StudentDb. Scheduling không nằm readiness vì chỉ endpoint Tutor-view phụ thuộc; metric thể hiện dependency state.

## Kiểm thử bắt buộc

- Domain: enum, timezone, length, duplicate/priority interests.
- Integration: userId unique, optimistic concurrency, transaction replace interests, migration.
- API: owner success; Student A không sửa/đọc Student B; role/status mass assignment bị bỏ/từ chối; Tutor relation true/false/timeout; Admin access; 401/403/412.
- Security: ID enumeration, malicious string, log redaction, propagated JWT.

