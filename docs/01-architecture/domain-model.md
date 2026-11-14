# Mô hình miền và ubiquitous language

## Bounded context

| Context | Loại | Aggregate root | Năng lực |
|---|---|---|---|
| Identity and Access | Supporting | `UserAccount`, `RefreshSession` | Xác thực, role, token lifecycle. |
| Tutor Management | Supporting | `TutorProfile` | Hồ sơ, subject, availability. |
| Student Management | Supporting | `StudentProfile` | Hồ sơ, education, learning goal/interest. |
| Scheduling and Matching | Core | `Booking` | Slot, hold confirmation, conflict, cancellation. |
| Notification | Generic/supporting | `Notification`, `ReminderSchedule` | In-app delivery, reminder, delivery tracking. |

## Từ vựng chuẩn

- **AvailabilityWindow:** khoảng Tutor sẵn sàng; chưa trừ booking/hold.
- **TimeSlot:** value object `[startAtUtc, endAtUtc)` dài 60 phút.
- **AvailableSlot:** slot suy ra từ availability sau khi trừ booking active; chỉ là snapshot.
- **Hold:** quyền xác nhận tạm thời trong Redis, TTL 300 giây; không phải Booking.
- **Booking:** lịch học durable giữa một Student và Tutor.
- **Conflict:** hai range nửa mở chồng nhau khi `newStart < existingEnd && newEnd > existingStart`.
- **Participant:** Student hoặc Tutor thuộc Booking.
- **Integration Event:** thông điệp public sau khi transaction commit, khác Domain Event nội bộ.
- **Reminder:** yêu cầu giao thông báo tại `scheduledForUtc`, duy nhất theo booking/recipient/type.

## Invariant

### Identity

- Email chuẩn hóa lowercase/trim và unique.
- Password dùng ASP.NET Core `PasswordHasher` IdentityV3 với
  PBKDF2-HMAC-SHA512, 210.000 vòng; hash tự chứa salt/parameters và được rehash
  khi policy tăng.
- Role chỉ `Student`, `Tutor`, `Admin`; client không tự gán Admin.
- Mỗi refresh token chỉ dùng một lần; reuse làm revoke cả token family.

### Tutor

- Profile owner có `userId` unique.
- Availability `end > start`, không ở quá khứ khi tạo, không chồng nhau, duration bội số 30 phút.
- Subject là catalog ID hợp lệ; không nhận subject name tùy ý làm định danh.

### Student

- Profile owner có `userId` unique.
- Education level thuộc enum được version hóa; learning goal có giới hạn độ dài.
- Tutor chỉ đọc projection tối thiểu khi có quan hệ booking.

### Scheduling

- TimeSlot đúng 60 phút và start minute 00/30.
- `Confirmed` chỉ được tạo từ hold còn hạn, đúng owner và payload.
- Hai Booking Confirmed không chồng cùng tutor hoặc student.
- Chỉ participant/Admin được đọc; chỉ participant được cancel trong bản demo.
- Cancel idempotent: cancel lại cùng booking trả trạng thái hiện tại, không phát event lặp.

### Notification

- Một event chỉ xử lý một lần theo `eventId`.
- Notification unique theo `(sourceEventId, recipientUserId, type)`.
- Reminder unique theo `(bookingId, recipientUserId, reminderType)`.
- Delivery retry không thay đổi nội dung đã chốt và dừng tại giới hạn.

## Context relationship

- Identity công bố `sub`, `role`; không công bố entity hoặc DbContext.
- Tutor và Student là upstream profile providers.
- Scheduling dùng ID xuyên context và REST contract; không giữ bản sao credential/profile đầy đủ.
- Notification downstream của Scheduling event, conformist theo event schema version.
- Gateway là customer của read APIs, không phải owner nghiệp vụ.

