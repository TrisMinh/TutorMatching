# Bảo mật broker và thông điệp

## Hai lớp khác nhau

1. **Transport:** Scheduling/Notification kết nối RabbitMQ qua AMQPS 5671, kiểm CA/hostname/cert server và gửi client certificate. Broker yêu cầu cert client hợp lệ. Plain AMQP 5672 tắt trong secure profile.
2. **Message:** producer ký metadata và body; Notification xác minh trước khi parse/project. Điều này tiếp tục có ý nghĩa sau TLS termination tại broker và trong retry queue.

TLS không ngăn administrator của broker đọc hoặc thay nội dung sau khi kết nối được giải mã. Chữ ký giúp phát hiện thay đổi nhưng **không mã hóa payload khỏi broker**.

## Service account và least privilege

Credential Scheduling và Notification được sinh riêng, không còn cùng dùng account quản trị mặc định:

| Account | Configure | Write | Read |
|---|---|---|---|
| scheduling | exchange `tutormatching.events` | exchange events | không đọc queue |
| notification | không tạo/sửa topology | exchange retry/dlx | queue booking-events.v1 |
| operator | vận hành/provisioning | theo quyền quản trị | theo quyền quản trị |

`configure-broker.py` dựng exchange/queue/binding bằng operator qua management loopback. Consumer secure chỉ passive-check queue và consume, không cần quyền tự khai báo DLX. Đây là lý do không cấp quyền publish events cho Notification chỉ để khai báo retry queue. Account vận hành bị đổi password mặc định sang secret đã sinh; không mount credential operator vào API.

Workload certificate và broker username/password là hai control bổ sung. Chưa dùng cơ chế RabbitMQ EXTERNAL để tự ánh xạ certificate CN thành username; không tuyên bố đã có ràng buộc CN↔username trong broker.

## Chữ ký event

Scheduling ký bằng RSA-PSS/SHA-256 với private key của workload certificate; chỉ Scheduling có key đó. Notification có producer public certificate được cấu hình/pin theo fingerprint và tên Scheduling.

Chuỗi canonical phân cách bằng newline, theo thứ tự:

1. Version cố định `tm-event-v1`.
2. Message/event ID.
3. Event type và event version.
4. Routing key và correlation ID.
5. Signed-at UTC.
6. SHA-256 của **đúng bytes body**.

Headers mang `x-key-id`, `x-signed-at`, `x-signature`. Thay body, event ID, routing key hoặc metadata được ký đều làm verify thất bại. Không nhận thuật toán tùy ý từ message. Retry/DLQ copy các thuộc tính và giữ nguyên event ID/signature; `x-attempt` là metadata vận chuyển, không thay đổi nội dung nghiệp vụ đã ký.

## Verify, replay và failure

Notification secure yêu cầu signature; thiếu/sai signature được xử lý như poison event và chuyển DLQ qua publisher-confirm path. Chỉ sau verify mới tới transaction/inbox projector. Inbox event ID ngăn áp dụng lại cùng sự kiện, còn advisory lock theo booking xử lý concurrency và confirmation đến sau cancellation.

Timestamp được ký nhưng hiện không dùng cửa sổ freshness ngắn: event hợp lệ có thể nằm chờ khi broker ngừng hoạt động. Anti-replay dựa trên durable event identity/inbox, không phải “timestamp mới là đủ”. Không xóa inbox tùy tiện khi còn khả năng nhận lại event cũ.

Trước chuyển đổi từ unsigned sang signed đã kiểm queue không còn message ready/unacked. Không bật fallback nhận unsigned khi gặp lỗi; event legacy còn tồn tại phải được kiểm tra/migrate hoặc giữ DLQ có kiểm soát.

## Những gì chưa được bảo đảm

- Không JWE/field encryption, broker vẫn đọc được payload được phép của nó.
- Service signature không chứng minh người dùng đã tự xác nhận giao dịch; không phải non-repudiation của ngân hàng.
- Producer public cert hiện pin một phiên bản; khi đổi leaf cert phải drain/reconcile retry queue hoặc triển khai key overlap có kiểm soát. Cert hết hạn/đổi key có thể làm message cũ bị DLQ. Chưa tuyên bố rotation tự động không mất gián đoạn.
- SMTP demo vẫn dùng Mailpit; email gửi trước crash nhưng chưa commit có thể lặp. Inbox/message signing không giải quyết exactly-once với SMTP bên ngoài.
