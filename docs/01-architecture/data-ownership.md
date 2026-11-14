# Quyền sở hữu dữ liệu

## Ma trận nguồn chân lý

| Dữ liệu | Owner | Store | Bên khác truy cập bằng |
|---|---|---|---|
| Account, credential, role, refresh session | Identity | IdentityDb | JWT, Identity API cần thiết. |
| Tutor profile, subject, availability | Tutor | TutorDb | Tutor REST API. |
| Student profile, education, goal, interest | Student | StudentDb | Student REST API có authorization. |
| Hold | Scheduling | Redis | Scheduling API; không đọc key trực tiếp. |
| Booking, outbox | Scheduling | SchedulingDb | Scheduling REST/event. |
| Notification, reminder, delivery, inbox | Notification | NotificationDb | Notification REST API. |

Không tạo foreign key xuyên database. UUID từ service khác là external reference, được validation qua contract ở thời điểm cần thiết.

## Dữ liệu sao chép

- JWT chứa `sub`, `role`, `jti`, không chứa profile mutable.
- Booking snapshot giữ `subjectId`, time range; không copy name/email.
- Notification có thể snapshot template data tối thiểu để nội dung đã gửi có thể audit; PII phải có retention/redaction.
- Read composition không tạo nguồn chân lý mới tại Gateway.

## Nhất quán và transaction

- ACID chỉ trong một service database.
- Scheduling transaction: insert Booking + OutboxMessage; Redis key được delete best-effort sau commit, TTL là cleanup cuối.
- Notification transaction: insert ProcessedEvent + Notification/Reminder; ACK sau commit.
- Không dùng distributed transaction giữa PostgreSQL, Redis và RabbitMQ.

## Xóa và retention

- Account disable không cascade xóa cross-service; phát event riêng nếu triển khai privacy workflow.
- Booking giữ tối thiểu theo yêu cầu báo cáo/demo; bản đầu không hard-delete.
- Outbox published giữ 7 ngày rồi batch purge; unprocessed không purge.
- ProcessedEvent giữ ít nhất bằng message retention + replay window, đề xuất 30 ngày.
- Log 14 ngày local/demo; Notification/DeliveryAttempt 90 ngày hoặc theo policy được phê duyệt.

## Backup scope

Mỗi database backup/restore riêng nhưng recovery hệ thống phải ghi nhận độ lệch. SchedulingDb quan trọng nhất; Redis không backup cho hold; RabbitMQ durable queue không thay database backup. Sau restore, publisher/consumer idempotency phải cho phép replay an toàn.

## Cấm

- Dùng chung DbContext/entity package.
- Join SQL qua foreign data wrapper/dblink.
- Đọc trực tiếp Redis hold từ Gateway hoặc service khác.
- Sửa role qua Student/Tutor DTO.
- Ghi event business chỉ sau commit bằng lời gọi trực tiếp mà không outbox.

