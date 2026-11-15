# Đăng ký và xác minh email

Luồng: đăng ký chọn Student/Tutor → nhận mã email → nhập mã 6 số → đăng nhập. Đăng nhập không chọn vai trò: backend lấy vai trò đã đăng ký từ tài khoản để phát JWT và frontend mở đúng dashboard.

## API

- `POST /api/v1/auth/register` với `{email,password,role}`: chỉ cho `Student` hoặc `Tutor`, password 12–128 ký tự. Trả `201` với `status: PendingVerification` sau khi gửi mã thành công. `409` nếu email đã tồn tại; `503` nếu SMTP lỗi và transaction PostgreSQL được rollback. Không trả mã hay JWT trong response.
- `POST /api/v1/auth/verify-email` với `{email,code}`: mã gồm đúng 6 chữ số, hết hạn sau 10 phút, tối đa 5 lần sai. Trả `200` sau khi chuyển tài khoản sang Active và xóa mã; sai/hết hạn/đã dùng trả `400`. Không phát JWT tự động.
- `POST /api/v1/auth/resend-verification` với `{email}`: `202` với thông báo chung; tài khoản pending phải chờ ít nhất 60 giây giữa các lần gửi (`429` khi gửi quá sớm). Mã mới thay mã cũ và đặt lại số lần thử; SMTP lỗi trả `503` và giữ mã trước đó.
- `POST /api/v1/auth/login` với `{email,password}`: đúng mật khẩu nhưng chưa xác minh trả `403` và `code: email_verification_required`; frontend mở bước xác minh. Sai mật khẩu/disabled trả `401`. Vai trò lấy từ database, không nhận từ màn đăng nhập.

Mã được sinh bằng bộ sinh số mật mã, chỉ lưu HMAC SHA-256 gắn với user ID và khóa server. Không lưu mã rõ trong database. Các thao tác verify/resend được tuần tự hóa bằng row lock PostgreSQL; endpoint dùng auth rate limiter. Migration chỉ thêm bảng `email_verifications`, không sửa mật khẩu hay tài khoản Active đã tồn tại. Người dùng có tài khoản cũ tiếp tục đăng nhập bình thường.

## Email và kiểm chứng

Dùng cấu hình `EMAIL_PROVIDER` hiện có. `mailpit` đưa thư vào `http://localhost:8025`; `gmail` gửi SMTP thật bằng `GMAIL_USERNAME` và `GMAIL_APP_PASSWORD` trong `.env`. Việc xác minh địa chỉ email không phải đăng nhập Google OAuth.

Script seed và smoke test tạo email giả phải chạy ở chế độ Mailpit; không gửi các tài khoản fixture ra Gmail. Postman Smoke có bước đọc Mailpit và xác minh trước đăng nhập. Màn xác minh cho phép nhập, dán mã 6 số, gửi lại, hiển thị lỗi và quay về đăng nhập sau khi thành công.

Thử thủ công: chọn vai trò khi đăng ký bằng email nhận được, lấy mã trong hộp thư, xác minh rồi đăng nhập. Thử đăng nhập trước xác minh, mã sai, mã dùng lại và gửi lại quá sớm để kiểm tra các trường hợp lỗi. `rebuild.cmd` áp dụng migration tự động và giữ dữ liệu trong volume.
