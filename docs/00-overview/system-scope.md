# Phạm vi hệ thống TutorMatching

## Mục tiêu

TutorMatching cho phép học sinh tìm gia sư theo môn và thời gian, giữ một slot trong thời gian ngắn, xác nhận lịch học không trùng, hủy lịch và nhận thông báo. Gia sư quản lý hồ sơ, môn dạy và lịch khả dụng. Bản đầu ưu tiên tính đúng đắn của booking, phân quyền và khả năng chạy lặp lại bằng Docker Compose.

## Tác nhân

| Tác nhân | Khả năng chính |
|---|---|
| Anonymous | Đăng ký, đăng nhập, làm mới token. |
| Student | Quản lý hồ sơ, tìm tutor/slot, tạo hold, xác nhận/hủy booking của mình, đọc thông báo. |
| Tutor | Quản lý hồ sơ và availability, xem/hủy booking liên quan, xem hồ sơ student có booking với mình. |
| Admin | Xem/quản lý tài khoản ở mức demo, đọc trạng thái hệ thống; không sửa booking trực tiếp. |
| Background worker | Phát outbox event, xử lý notification event, lên lịch và gửi reminder. |

## Use case bắt buộc

1. Đăng ký tài khoản Student hoặc Tutor; đăng nhập nhận access/refresh token.
2. Tutor cập nhật hồ sơ, môn dạy và các cửa sổ availability không chồng nhau.
3. Student lọc tutor theo subject và ngày, xem slot 60 phút còn trống.
4. Student tạo hold độc quyền 5 phút cho một tutor/time slot.
5. Student xác nhận bằng hold token; hệ thống chống trùng cho cả Tutor và Student.
6. Student hoặc Tutor liên quan hủy booking; event hủy được phát sau commit.
7. Notification tạo thông báo in-app, email development và reminder trước 24 giờ, 1 giờ.
8. Admin/owner kiểm tra health, log, trace, queue, retry/DLQ và backup/restore.

## Quy tắc nghiệp vụ cố định

- Slot có độ dài đúng 60 phút, bắt đầu ở mốc phút `00` hoặc `30`; có thể thay đổi sau bằng ADR.
- Hold hết hạn sau 300 giây tính từ lúc Redis tạo key thành công.
- Một hold gắn với `holdId`, `studentId`, `tutorId`, `startAtUtc`, `endAtUtc`; người khác không thể dùng lại.
- Booking có trạng thái `Confirmed` hoặc `Cancelled`. `Held` là trạng thái tạm trong Redis, không phải row Booking.
- Booking `Confirmed` không được chồng lấn với booking `Confirmed` khác của cùng tutor hoặc cùng student.
- Hủy không xóa dữ liệu; ghi `cancelledAtUtc`, `cancelledByUserId`, `cancellationReason`.
- Mọi authorization theo tài nguyên phải kiểm tra tại service sở hữu dữ liệu, không chỉ tại Gateway.

## Ngoài phạm vi bản đầu

- Xác thực hai bước (2FA) và xóa tài khoản: đã loại khỏi yêu cầu theo quyết định người dùng, không nằm trong backlog.

- Thanh toán, hóa đơn, hoàn tiền.
- Video call, chat thời gian thực.
- AI recommendation, xếp hạng phức tạp.
- Gia sư duyệt booking, recurring booking, waitlist.
- Kubernetes, cloud production, Consul, service mesh, gRPC/GraphQL.
- SMS thật; email production chỉ được bổ sung khi có provider và secret hợp lệ.

## Tiêu chí thành công

- `docker compose up --build` khởi động đầy đủ và tất cả readiness health xanh.
- Hai request đồng thời cho cùng hoặc overlapping slot tạo tối đa một booking.
- Tắt Notification không làm request booking thất bại; message được xử lý sau khi service khởi động lại.
- Token sai/hết hạn trả 401; sai role/owner trả 403; conflict trả 409; rate limit trả 429.
- Một thành viên mới chạy được luồng E2E từ tài liệu trong dưới 30 phút sau khi có image/dependency cache.

