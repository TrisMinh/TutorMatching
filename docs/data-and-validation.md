# Dữ liệu lưu thật và kiểm chứng liên kết

## Máy mới

1. Chạy `setup.cmd` để kiểm tra/cài WSL2, Docker Desktop, Git và Node.js LTS (Node dùng cho script dữ liệu).
2. Mở Docker Desktop, chạy `rebuild.cmd` để build, migration và kiểm tra sức khỏe.
3. Chạy `seed-data.cmd` để nạp tài khoản, hồ sơ, môn học, lịch, booking, khóa học và ghi danh vào database thông qua API nghiệp vụ.
4. Mở `http://localhost:3000`; xem database ở `http://localhost:5050`.

Seed dùng tài khoản `tutor01` đến `tutor18`, `student01` đến `student24`, hậu tố `@demo.tutormatching.test`, mật khẩu `TutorDemo!2026`. Đây là dữ liệu mẫu tổng hợp được lưu và xử lý bằng database thật; không phải hồ sơ của người thật được thu thập. Seed không sửa tài khoản cá nhân.

`seed-data.cmd` tạm dùng Mailpit để xác minh tài khoản mẫu, rồi khôi phục provider trong `.env` bằng `finally`. Tài khoản mẫu tắt email reminders để tránh gửi email fixture ra Gmail. Seed đọc lịch thật để chọn các buổi không chồng nhau và có thể chạy lại; khóa học mỗi đợt được gắn ID theo ngày, đợt đã có được tiếp tục hoàn thiện thay vì tạo trùng.

## Liên kết nghiệp vụ

- Identity lưu vai trò, email đã xác minh và tên đăng ký; đăng nhập trả danh tính đúng tài khoản.
- Student/Tutor giữ hồ sơ theo Identity user ID. Student tự có hồ sơ từ tên đăng ký và dùng được ngay; lớp học, mục tiêu, môn quan tâm đều tùy chọn. Tutor vẫn hoàn thiện hồ sơ trước khi công khai lịch dạy.
- Tutor sở hữu môn dạy, lịch trống và khóa học. Student chọn môn quan tâm và lưu gia sư yêu thích qua Student API/database.
- Lịch đặt học đọc slot từ Gateway API Composition, trừ lịch bận, booking và buổi học khóa học. Giờ chọn trên giao diện là giờ gửi tới API giữ chỗ.
- Review chỉ nhận một hold thật, còn hạn. Confirmation chỉ hiển thị booking đã ghi thành công. Không có đường xác nhận mẫu khi thiếu hold.
- Booking giữ quan hệ Student profile/user, Tutor profile/user, Subject và thời gian. Cả hai vai trò đọc cùng bản ghi, hủy cập nhật lịch và notification.
- Khóa học giữ owner, sessions, capacity, enrollment. Ghi danh/withdraw/close/cancel đi qua API, cập nhật course library, lịch và thông báo.
- Hồ sơ, notification, lịch và booking không dùng fixture làm dữ liệu thay thế khi API lỗi. Trạng thái trống và lỗi được hiển thị riêng.

## Kiểm tra

```powershell
node scripts/verify-data-integrity.mjs
npm --prefix src/Web/TutorMatching.Web run test:run
dotnet test tests/Identity/TutorMatching.Identity.Tests
dotnet test tests/Scheduling/TutorMatching.Scheduling.Tests
```

Báo cáo `.logs/data-integrity.json` kiểm tra tài khoản/hồ sơ, owner khóa học, học viên ghi danh, session, các khóa tham chiếu booking, recipient notification, saved tutors, sức chứa và lịch chồng của Student/Tutor. Không chỉ đếm số dòng.

Các kiểm thử trình duyệt nằm trong `tests/live/registration-verification.spec.ts` và `tests/live/persisted-platform.spec.ts` (thư mục frontend). Chạy với Identity dùng Mailpit cho email kiểm thử; khôi phục `.env`/provider sau khi thử. Postman Smoke cũng có bước nhận và xác minh mã trước login.

## Nhắn tin Student–Tutor

Student mở hồ sơ gia sư → **Message tutor** hoặc vào biểu tượng Messages trên thanh đầu trang. Tutor trả lời trong **Messages**. Lịch sử lưu ở `notification_db`, chỉ hai người tham gia được đọc/gửi; có số tin chưa đọc, đánh dấu đã đọc, phân trang lịch sử và chống gửi trùng khi thử lại. Tab đang mở cập nhật sau mỗi 3 giây, không cần WebSocket hay service thứ sáu.

```powershell
node scripts/verify-messaging.mjs
postman collection run "postman/collections/TutorMatching Messaging"
npm --prefix src/Web/TutorMatching.Web run test:e2e:live -- messaging.spec.ts --workers=1
```

Xem [hợp đồng và phạm vi nhắn tin](messaging-contract.md). Các bài API dùng tài khoản demo, tạo tin nhắn kiểm thử được lưu thật, không gửi tới tài khoản cá nhân. Script kiểm tra phân trang có tạo hơn 50 tin và chịu giới hạn 60 thao tác gửi/phút/tài khoản.

## Phạm vi còn thiếu

Dữ liệu và các luồng được kiểm chứng ở đây là nền tảng đặt lịch/khóa học. Đã có chat văn bản Student–Tutor lưu thật trong Notification service (không thêm service thứ sáu). Dự án chưa có backend thanh toán, đánh giá hoặc phòng gọi video. Những phần chưa có dữ liệu không hiển thị giá, review hay lịch mẫu để giả vờ hoạt động. Việc triển khai công khai vẫn cần tên miền/HTTPS, thông tin gửi thư, sao lưu, giám sát và kiểm thử theo tải thực tế.
