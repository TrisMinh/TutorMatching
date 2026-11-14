# Kiến trúc hệ thống

## Kiểu kiến trúc

TutorMatching dùng microservices theo bounded context. React gọi duy nhất YARP Gateway. Gateway xác thực lớp biên, rate limit, route và thực hiện một composition endpoint mỏng. Mỗi service xác thực lại JWT và sở hữu nghiệp vụ, dữ liệu, migration, health check, Dockerfile.

```text
Browser -> React -> YARP Gateway -> Identity / Tutor / Student / Scheduling / Notification
                                  -> REST nội bộ qua Docker DNS
Scheduling -> SchedulingDb + Redis + Outbox -> RabbitMQ -> Notification -> NotificationDb
Mỗi service còn lại -> PostgreSQL database riêng
```

## Thành phần và trách nhiệm

| Thành phần | Trách nhiệm | Không được làm |
|---|---|---|
| React Web | UI, giữ access token trong memory, gọi Gateway | Gọi trực tiếp service/database; chứa secret. |
| Gateway | TLS boundary trong môi trường triển khai, route, JWT edge validation, CORS, rate limit, composition | Chứa domain rule hoặc ghi database nghiệp vụ. |
| Identity | Account, credential, role, access/refresh token | Lưu Tutor/Student profile. |
| Tutor | Tutor profile, subject, availability | Quyết định booking. |
| Student | Student profile, education/goal/interest | Lưu credential hoặc booking. |
| Scheduling | Slot, hold, conflict, booking lifecycle, outbox | Query database service khác; gửi email đồng bộ. |
| Notification | Consume event, in-app notification, reminder, delivery history | Làm request booking chờ. |
| PostgreSQL | Durable business state | Chia schema/user giữa service. |
| Redis | Atomic hold TTL, idempotency ngắn hạn | Là nguồn chân lý booking. |
| RabbitMQ | Durable asynchronous event transport | Là nơi lưu lịch sử nghiệp vụ lâu dài. |

## Trust boundary

- Public: host ports của UI và Gateway. RabbitMQ Management, PostgreSQL, Redis chỉ mở loopback trong local profile.
- Gateway đến service: private `backend` network; vẫn truyền JWT và W3C trace headers.
- Service đến database/broker: private `data` network; credential riêng, least privilege.
- Internal endpoint không được coi là an toàn chỉ vì ở private network; service-to-service action dùng user token hoặc service credential rõ ràng.

## Luồng đọc và ghi

- Profile CRUD đi thẳng Gateway -> owner service -> owner database.
- Search composition: Gateway lấy Tutor candidates, gọi Scheduling batch availability, ghép theo `tutorId`, trả snapshot có thể eventual-consistent.
- Hold: Scheduling xác minh request và availability snapshot, chạy Redis Lua atomic, trả opaque `holdToken`.
- Confirm: Scheduling validate token/key, transaction insert Booking + OutboxMessage; DB constraint là lớp bảo vệ cuối.
- Notification: outbox publisher phát event; consumer ghi inbox + notification/reminders trong một transaction rồi ACK.

## Availability và failure

- REST nội bộ: connect timeout 2 giây, tổng timeout 5 giây; GET có thể retry tối đa 2 lần với jitter khi lỗi transient; mutation không retry nếu thiếu idempotency key.
- Composition trả 503 nếu Tutor hoặc Scheduling core dependency lỗi; không trả danh sách “trống” gây hiểu sai.
- RabbitMQ hoặc Notification lỗi không rollback booking đã commit; outbox sẽ retry.
- Redis lỗi: không tạo hold mới, trả `503 dependency_unavailable`; booking đã xác nhận vẫn đọc/hủy được.
- Database của service lỗi: readiness service đỏ; Gateway trả 503 cho route đó.

## Scale và tính nhất quán

Service stateless có thể scale ngang. Redis script và DB constraints đảm bảo correctness khi nhiều Scheduling replica. Outbox/worker claim row bằng `FOR UPDATE SKIP LOCKED`. Event delivery là at-least-once; consumer bắt buộc idempotent. Không hứa distributed transaction.

