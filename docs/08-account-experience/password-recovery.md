# Quên và đặt lại mật khẩu

## Luồng người dùng

1. Nhập email ở Forgot password; frontend POST `/api/v1/auth/forgot-password`.
2. Response 202 có thông điệp chung, không xác nhận email có tài khoản hay không. Account không tồn tại/disabled không nhận email. Gửi lại trong 60 giây không tạo thêm email.
3. Identity gửi SMTP tới email thật của account, URL cố định từ `Frontend:Origin` + `/auth/reset-password?token=...`. Không tin Host header hoặc redirect URL do caller nhập.
4. Mở link, nhập mật khẩu và xác nhận. POST `/api/v1/auth/reset-password` gồm token/password. Thành công hiện Password updated; đăng nhập lại bằng mật khẩu mới.

## Token và transaction

Token random 32 byte (256 bit), database chỉ lưu SHA256 hash, hiệu lực 30 phút. Latest successful request vô hiệu hóa token trước. Token đã dùng/hết hạn/sai trả 400. Mật khẩu dài 12–128 ký tự; hash theo ASP.NET PasswordHasher.

Reset khóa hàng account trên PostgreSQL. Thay password, đánh dấu token đã dùng và revoke toàn bộ refresh sessions trong cùng transaction. Hai request dùng một token đồng thời chỉ một request thành công. Login/refresh cùng khóa account để tránh tạo refresh hợp lệ bằng credential cũ chen vào reset. Access JWT đã phát vẫn có thể dùng đến khi hết hạn (15 phút); không có revocation Redis trong nhánh đồ án.

Forgot password giữ transaction qua SMTP timeout 4 giây (nhỏ hơn timeout request 5 giây của browser): lỗi gửi rollback token mới và trả 503, UI hiển thị lỗi để thử lại; không báo đã gửi khi SMTP lỗi. SMTP không tham gia transaction database: nếu SMTP đã nhận mà commit thất bại, email có thể chứa link không dùng được, người dùng cần yêu cầu lại. Không tuyên bố distributed exactly-once.

Không trả token trong API response, không ghi token vào log. Frontend loại query khỏi address bar sau khi đọc token, đặt referrer no-referrer; Nginx không ghi access log của đường dẫn reset. Reload trang sau khi query đã bị loại cần mở lại link email. SessionStorage chỉ giữ email để hỗ trợ resend, không giữ reset token.

## SMTP demo và cấu hình

Compose cấu hình Identity dùng `Email:Host=mailpit`, port 1025, From local. Xem email tại http://localhost:8025. Đây là SMTP sink phục vụ demo, không chuyển email ra Internet. Để gửi thật cần cấu hình SMTP host/port, EnableSsl và Username/Password cho Identity và Notification; secret nằm ngoài Git. `FRONTEND_ORIGIN` đặt URL nơi người dùng mở link.

## Kiểm chứng

- Unit/API tests: token expired/used, password cũ không dùng được, refresh bị revoke, version settings.
- Integration `verify-account-features.mjs`: đọc email thật trong Mailpit, cooldown, unknown account 202, password validation và hai reset đồng thời 204/400.
- Playwright: nhập email, mở link Mailpit, đổi mật khẩu qua UI, đăng nhập mới thành công, replay link bị từ chối.

Các kiểm tra tạo account fixture riêng; không đổi mật khẩu tài khoản demo của người dùng.
