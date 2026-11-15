# Báo cáo đồ án — Scheduling & Time Constraints

Đây là bản tập trung vào **Hướng 4**: tìm khoảng trống, giữ chỗ, xử lý lịch trùng, API Composition và reminder chạy nền. Bảo mật cơ bản vẫn giữ để dữ liệu của các tài khoản không bị đọc/sửa tùy ý; không yêu cầu triển khai PKI hay secret provisioning để chấm demo.

| Chương | Nội dung |
|---|---|
| [Yêu cầu và phạm vi](requirements-and-scope.md) | Đối chiếu ba tiêu chí bắt buộc, 4 core service và phần đã giản lược |
| [Thuật toán lập lịch](scheduling-algorithms.md) | Slot rỗng, overlap, UTC, hold, tranh chấp và ràng buộc database |
| [API Composition](api-composition.md) | Gateway lấy thông tin Tutor và lịch Scheduling, hợp nhất trả frontend |
| [Reminder/background jobs](reminder-jobs.md) | Polling DB, claim, gửi trước một giờ, retry và tránh gửi trùng |
| [Demo và kiểm chứng](demo-and-verification.md) | Khởi chạy, dữ liệu, kịch bản chấm điểm và test |

Đọc thêm [instance và điều phối](../03-platform/instances-load-balancing.md), [retry/rollback/recovery](../03-platform/retry-rollback-recovery.md), [JWT cơ bản](../04-security/jwt-and-authorization.md).

## Hai nhánh có mục đích khác nhau

- `feat/scheduling-coursework`: bản gọn để học/chấm demo, 3 Scheduling và mỗi API khác/Gateway 1, Docker Compose + `.env`.
- [feat/advanced-service-security](https://github.com/TrisMinh/TutorMatching/tree/feat/advanced-service-security): lưu nguyên bản mở rộng RSA/mTLS, revocation Redis, signed event và audit HMAC. Không cần những lớp này để đáp ứng ba điều kiện tối thiểu của đề.

Nhánh gọn giữ UI, course/enrollment, booking, lịch và dữ liệu demo; không phải quay lại bản frontend sơ khai. Không mô tả môi trường HTTP/HMAC cục bộ này là cấu hình ngân hàng hay production security.
