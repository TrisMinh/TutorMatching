# Đối chiếu yêu cầu và phạm vi

## Ba điều kiện bắt buộc

| Yêu cầu đề bài | Triển khai |
|---|---|
| Một API Gateway đứng trước hệ thống | YARP Gateway; Nginx/HAProxy chuyển tiếp API qua Gateway, không cho frontend gọi trực tiếp từng core service |
| Tối thiểu bốn core microservice | Tutor, Student, Scheduling, Notification là bốn core; Identity bổ sung đăng nhập |
| Chung nền tảng Docker Compose | compose.yaml + compose.ha.yaml chạy frontend, Gateway, 5 API, PostgreSQL riêng từng context, Redis, RabbitMQ, Mailpit |

HAProxy là thành phần điều phối trước/giữa các pool, không phải một API Gateway nghiệp vụ thứ hai. Vẫn chỉ có một YARP Gateway instance trong bản demo.

## Mapping service theo đề tài

| Vai trò đề bài | Service | Dữ liệu/logic chính |
|---|---|---|
| Provider/Resource | Tutor | Hồ sơ gia sư, môn, dated availability, course và enrollment |
| Consumer | Student | Hồ sơ học sinh và mục tiêu/môn quan tâm |
| Scheduling | Scheduling | Kiểm tra thời gian, giữ chỗ Redis, confirm/cancel booking, outbox |
| Reminder/Cron | Notification | In-app notifications, reminder database, worker quét định kỳ và gửi email |
| Hỗ trợ | Identity | Password hash, JWT, refresh rotation |

Notification chạy thành service riêng; không nhét vòng quét reminder vào frontend hoặc Scheduling API. Các service sở hữu database riêng, liên lạc HTTP/event thay vì đọc chéo bảng SQL.

## Giữ lại để bảo vệ tính đúng

JWT và role Student/Tutor, owner/participant checks, password hashing, refresh rotation, validation thời gian và database constraints. Giữ transaction/outbox/idempotency vì chúng trực tiếp phục vụ yêu cầu xử lý lịch trùng và lỗi giữa chừng.

## Bỏ khỏi nhánh nộp đồ án

PKI/CA, RSA JWT, mTLS, Redis TLS/ACL revocation, account provisioning tự động cho broker/database, chữ ký event, audit HMAC/WORM-oriented reports, Admin disable/revoke-all chuyên sâu. Bản mở rộng được giữ nguyên trên nhánh advanced-service-security trước khi giản lược.

Không xóa bốn core service, API composition, dữ liệu cũ hoặc tính năng lịch để giảm số dòng code. Giữ 3 Scheduling theo cấu hình người dùng đã chọn; các thành phần khác một instance.

## Giới hạn cần nói khi bảo vệ

Reminder là polling mỗi 15 giây, không phải hard realtime. Slot cố định 60 phút, bắt đầu theo lưới 30 phút. Access token còn hạn có thể tiếp tục dùng sau logout đến khi hết hạn; nhánh này chỉ revoke refresh. HTTP/HMAC/shared Docker network dành cho demo local. Không có payment, Core Banking, OIDC SSO hay đảm bảo non-repudiation người dùng.
