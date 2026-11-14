# Secret và bảo vệ dữ liệu

## Phân loại

| Loại | Ví dụ | Xử lý |
|---|---|---|
| Secret | JWT key, DB/Rabbit password, SMTP credential, refresh/hold token | Không log/commit; secret store/env; rotate. |
| Sensitive PII | Email, display name, learning goal | Least privilege, TLS, retention, redaction. |
| Internal | Booking IDs/times, metrics chi tiết | Auth, scoped access, không public index. |
| Public | Tutor active public profile/subjects | Vẫn validate và chống mass update. |

## Cấp secret

- Local: `.env.local` bị gitignore, tạo từ `.env.example` placeholder; ưu tiên `dotnet user-secrets` khi chạy host.
- Compose demo: environment file ngoài Git hoặc Docker secrets-style mounted file; không đặt giá trị thật trong YAML.
- CI: secret variables masked/protected; không echo command/env dump.
- Production-like: managed secret store; workload identity nếu có.

## Tên secret chuẩn

`JWT_SIGNING_KEY`, `IDENTITY_DB_PASSWORD`, `TUTOR_DB_PASSWORD`, `STUDENT_DB_PASSWORD`, `SCHEDULING_DB_PASSWORD`, `NOTIFICATION_DB_PASSWORD`, `RABBITMQ_DEFAULT_PASS`, `SMTP_PASSWORD`. .NET mapping dùng `Jwt__SigningKey` hoặc file/config provider, không tồn tại hai tên mâu thuẫn trong cùng environment.

## Rotation

- JWT: current/previous key theo quy trình tại JWT doc; rotate ngay khi nghi lộ.
- DB/Rabbit: tạo credential mới, deploy consumers, xác minh, revoke cũ; không đổi tất cả cùng lúc nếu không có rollback.
- Refresh/hold token: random mỗi lần và hash at rest; không thể “rotate” token đã phát, chỉ revoke/expire.
- Ghi owner, ngày tạo, ngày rotation, phạm vi và nơi dùng trong inventory ngoài secret value.

## Data protection

- TLS cho traffic ngoài host; production-like TLS/validated cert cho DB/Redis/RabbitMQ nếu đi qua network không tin cậy.
- PostgreSQL volume/backup encryption do platform; secret không nằm trong backup plaintext logs.
- Password hash bằng ASP.NET Core PasswordHasher IdentityV3,
  PBKDF2-HMAC-SHA512, 210.000 vòng; per-user salt/parameters do library quản lý;
  rehash-on-login khi cost tăng.
- Token hash SHA-256 vì token có entropy cao; không dùng SHA-256 cho password.
- Application log redaction bằng key allow/deny list và test snapshot.

## Privacy và retention

Chỉ thu dữ liệu cần cho use case. Không đưa email/learning goal vào event nếu userId đủ. Export/delete workflow chưa thuộc bản đầu nhưng schema phải cho truy vết owner. Hard-delete cần workflow xuyên service; không cascade thủ công database khác. Retention cụ thể tại data ownership và backup docs.

## Khi nghi lộ secret

1. Không dán secret vào issue/chat/log; xác định phạm vi và dừng phát tán.
2. Rotate/revoke secret, session/token liên quan; giới hạn ingress nếu cần.
3. Tìm usage qua audit không in value; kiểm log/commit/image/artifact.
4. Nếu đã commit, rotate trước rồi làm sạch lịch sử theo quy trình repository; xóa Git không làm secret cũ an toàn.
5. Ghi incident timeline, impact, fix và prevention.

## Kiểm tra CI

Secret scanner trên commit/history PR, `.env` deny rule, image layer inspection, log redaction tests, config startup validation đảm bảo placeholder/missing/short key làm service fail fast.

