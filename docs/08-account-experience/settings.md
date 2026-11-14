# Settings có lưu và áp dụng nghiệp vụ

## Quyền sở hữu và contract

Identity sở hữu bảng `account_settings`, một hàng cho mỗi UserId. GET/PUT `/api/v1/users/me/settings` lấy user ID từ JWT, không nhận user ID trong payload. Chưa có hàng thì trả mặc định, không ghi ngầm trên GET.

| Thuộc tính | Mặc định | Hiệu lực |
|---|---|---|
| EmailReminders | true | Worker đọc ngay trước gửi; áp dụng booking và course |
| InAppNotifications | true | API danh sách notification và enrollment notice trả rỗng khi tắt; không xóa lịch sử |
| EnrollmentAlerts | true | Tutor có thể ẩn riêng thông báo học sinh đăng ký khóa |
| ProfileVisible | true | Khi tắt, Tutor bị loại khỏi search thường và search slot khả dụng; không xóa hồ sơ/lịch cũ |
| CancellationNoticeHours | 12 | Chỉ Tutor thay đổi; chính sách được chụp vào hold/booking mới |
| Version | 0 | Optimistic concurrency; mỗi lần lưu tăng một |

Student không được đổi chính sách Tutor hoặc ẩn hồ sơ Tutor. Payload stale version trả 409 để tránh hai cửa sổ ghi đè nhau; giao diện giữ lỗi và có Reload settings. Chỉ thông báo đã lưu sau response thành công; Save bị khóa trong lúc tải/lưu hoặc chưa có thay đổi. UI không còn giả vờ lưu các điều khiển auto-accept/marketing/2FA chưa có nghiệp vụ.

## Các service sử dụng

Tutor search, Scheduling hold, Notification list và worker gọi Identity qua `AccountDirectoryClient`, timeout 5 giây. Workload JWT ngắn hạn có role Service và scope identity.directory; endpoint `/internal` không route qua Gateway, user JWT không đủ quyền. Cơ chế này tiếp tục sử dụng HS256 của bản local, không khôi phục PKI/mTLS từ nhánh nâng cao. Identity không khả dụng thì thao tác phụ thuộc thất bại thay vì đoán một chính sách mới.

Profile visibility có nghĩa **xuất hiện trong tìm kiếm**, không có nghĩa xóa đường dẫn hồ sơ công khai. Tắt thông báo không hủy booking/course hay thu hồi email đã gửi. Password recovery là email bảo vệ tài khoản, luôn độc lập với lựa chọn nhận reminder.

## Kiểm tra

- `AccountRecoveryTests`: mặc định, lưu, stale version, Student không sửa policy, user không đọc directory.
- `tests/live/account-features.spec.ts`: Student/Tutor lưu và reload trang vẫn đúng giá trị, kiểm tra responsive.
- `node scripts/verify-account-features.mjs`: profile search và notification preferences có tác dụng qua API thật.
