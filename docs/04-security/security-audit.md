# Audit log bảo mật và giá trị bằng chứng

## Mục tiêu và câu hỏi bắt buộc

Audit phải giúp trả lời: **ai**, service nào gọi, **làm gì**, trên **tài nguyên nào**, **khi nào**, tại service/instance/route nào, kết quả ra sao và làm thế nào nối các chặng trong cùng request. Password xuất hiện trong log là một rò rỉ secret, không phải “log chi tiết tốt”. Thiếu actor/timestamp làm mất khả năng dựng timeline và truy trách nhiệm.

## Schema đã ghi

`SecurityAudit` ghi JSON Lines trong volume `security-audit`, mỗi logical service/container có file riêng. Payload chỉ cho các trường:

| Trường | Mục đích |
|---|---|
| EventId, TimestampUtc | Định danh entry và thời gian UTC |
| Phase | Intent trước pipeline nghiệp vụ, Result sau khi xử lý |
| Service, Instance | Nơi hành động xảy ra |
| ActorId, Role | Người dùng đã xác thực; null cho anonymous/thất bại trước xác thực |
| Caller | CN client certificate thực tế, không lấy từ header tự khai |
| Method, Route, Resource | Hành động, route template và ID đã giới hạn độ dài |
| Status | HTTP outcome; Result lỗi mặc định 500 |
| TraceId | Liên kết các chặng bằng trace context |
| SourceHash | HMAC của địa chỉ nguồn mà server nhìn thấy, không lưu IP raw |

Không ghi request body, query string, Authorization/Cookie header, access/refresh token, password hoặc exception text vào audit payload. Route ID vẫn là dữ liệu cần bảo vệ; allowlist không thay cho chính sách privacy/retention. IP đang phản ánh proxy trực tiếp nếu chưa cấu hình trusted forwarded client IP.

Identity gắn actor sau khi kiểm credential/refresh secret thành công, vì request login ban đầu chưa có ClaimsPrincipal. Result đăng ký ghi target account ID; confirm/replay booking ghi result booking ID, giúp truy vết thao tác tạo mà route chưa có ID. Các giá trị này đến từ code/database, không đọc header/body tự khai; thất bại trước xác thực vẫn có thể có actor null.

## Thời điểm và lỗi ghi log

Middleware chạy sau authentication và trước authorization/handler; các phản hồi 401/403, và trong bản cấu hình hiện tại throttle auth, có thể được ghi outcome. HTTP health được bỏ qua để tránh làm đầy volume. TLS handshake thất bại chưa có HTTP context nên không nằm trong cùng audit stream.

Intent phải append thành công trước khi gọi handler. Nếu ghi Intent lỗi, pipeline không thực thi nghiệp vụ. Result được ghi sau handler; nếu Result lỗi **sau khi nghiệp vụ đã commit**, không thể giả vờ rollback giao dịch đã hoàn thành. Cần theo dõi lỗi log và đối chiếu Intent + trạng thái database. Không tuyên bố audit và database cùng một distributed transaction.

## Chống sửa và giới hạn

Mỗi envelope có `Previous`, chuỗi JSON `Payload` và `Mac`:

`Mac = HMAC-SHA256(serviceAuditKey, Previous + "\n" + Payload)`

File được append với write-through; khi cùng container khởi động lại, code xác minh chain trước khi ghi tiếp. Khóa audit riêng từng service, không dùng JWT private key. `verify-audit.py` xác minh các stream đã copy và schema allowlist mà không in dữ liệu actor.

Đây là **tamper evidence trong phạm vi khóa còn bí mật**, không phải WORM hay bằng chứng pháp lý tự động. Host administrator có thể xóa file, truncate đuôi log hoặc lấy khóa; không có external anchor nên không chứng minh được không thiếu bản ghi cuối. Chưa có collector độc lập, trusted timestamp, chữ ký bởi người dùng hoặc policy lưu trữ pháp lý. Muốn nâng cấp cần kho append-only độc lập, quyền quản trị tách biệt, đồng bộ thời gian và quy trình bảo quản/chứng minh nguồn gốc.

## Thu thập bằng chứng báo cáo

```powershell
New-Item -ItemType Directory -Force .superpowers/security-evidence/audit
docker cp tutormatching-gateway-1:/var/log/tutormatching/. .superpowers/security-evidence/audit/
python scripts/verify-audit.py
```

Volume hiện được dùng chung để lưu các file khác tên; đây không phải phân lập filesystem chống container root. Không đưa bản log có PII hoặc `.security` vào Git/bài báo cáo công khai. Báo cáo nên dùng tổng số entry, schema, test tamper và ví dụ đã ẩn định danh.
