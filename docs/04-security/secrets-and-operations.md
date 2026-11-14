# Secrets, PKI, ACL và vận hành

## Tách private material

`scripts/init-security.py` sinh idempotent vào thư mục `.security/` được bỏ qua ở **Git và Docker build context**. Không in credential, không tự cài host trust, không thay khóa đã tồn tại mỗi lần chạy.

| Nơi giữ | Nội dung | Container được nhận |
|---|---|---|
| `.security/ca` | CA cert + CA private key | Không container nào nhận CA private key |
| `.security/public` | CA cert, JWT public key, producer cert | Các API/proxy cần verify |
| `.security/identity` | JWT private key + leaf cert/key + runtime/audit key | Chỉ Identity |
| `.security/{service}` | Leaf private key, credential/phạm vi của chính service, audit key | Chỉ workload tương ứng |
| `.security/redis` | TLS material, ACL hash file, health/operator secret | Redis |
| `.security/rabbitmq` | TLS material, operator provisioning material | RabbitMQ |

Mount read-only không làm key bí mật trước chính process đã được cấp nó. Trên host Windows cần hạn chế ACL NTFS của thư mục secrets/backup; `chmod` không thay thế kiểm soát NTFS. Khi chạy Linux cần kiểm tra UID/GID và quyền file cho user container Redis/RabbitMQ. Không sửa quyền thành world-readable để chữa lỗi.

## PostgreSQL credentials

Mỗi context có một mật khẩu random riêng, đặt trong runtime JSON của **chính API đó**. `configure-databases.py` đổi password của role đã có bằng SQL qua stdin/local administrative socket, không in SQL/secret và không xóa volume. Giá trị demo cũ trong environment bootstrap không còn đăng nhập được database đã provision secure. API khác không được nhận password database của Identity.

`start-ha.ps1` đưa datastore lên trước, provision DB/broker credentials rồi mới khởi động API; điều này tránh deadlock startup khi runtime JSON có password mới nhưng database còn password cũ. Khi rotation làm đổi runtime material phải recreate/restart API, không chỉ sửa bind file.

Các role hiện còn là owner/superuser bootstrap của từng PostgreSQL demo, chưa tách migration role và runtime DML-only. Database vẫn chung data network và chưa TLS. Đây là các giới hạn cần xử lý trước production; credential riêng không thay network policy hay phân quyền SQL chi tiết. Probe dùng password Student thử `SELECT 1` ở Identity và phải thất bại, không ghi dữ liệu.

## Redis TLS và ACL (chi tiết)

Secure Redis chỉ nghe TLS 6380; plaintext port tắt. Client kiểm CA, hostname Redis và certificate server. Redis xác thực username/password riêng từng service, không dùng client cert ở lớp Redis hiện tại.

| User | Phạm vi |
|---|---|
| Identity | đọc/ghi `security:revoked:*` |
| Scheduling | đọc revocation; đọc/ghi `booking:*`, global schedule-write lock |
| Tutor | đọc revocation; đọc/ghi global schedule-write lock |
| Student/Notification/Gateway | chỉ đọc revocation |
| Health | connection + PING |
| Operator | quản trị; secret không cấp cho API |

ACL khai báo cả command và key read/write pattern. Một số command connection/INFO và metadata StackExchange.Redis được cho phép để client discovery hoạt động; không vì một lỗi permission mà chuyển API sang `+@all ~*`. Account default bị tắt; quyền nội bộ của default vẫn giữ để Redis replay AOF cũ đúng cách, không cho anonymous login.

Redis dùng AOF/volume hiện có. Không dùng FLUSHDB trong test trên stack thật. Credential mới không được in từ `docker compose config` hoặc `docker inspect`; chỉ kiểm tra boolean/role/quyền, không dump environment.

## Rotation và incident response

1. Xác định loại lộ: JWT signing key, workload leaf, broker/cache credential hay host/CA. Cô lập nguồn lộ và giữ bằng chứng.
2. Thu hồi phiên/account khi cần. Đổi JWT key chỉ trong Identity và public verification material của các API; thực hiện rollout phù hợp. Chưa hỗ trợ tự overlap nhiều key.
3. Đổi workload certificate cần cập nhật CA/pin/trust, restart consumer phù hợp và đối chiếu retry queue có signature cũ. CRL/OCSP và auto-renew chưa được triển khai.
4. Đổi broker/cache credential bằng provisioning có kiểm soát, kiểm kết nối rồi loại credential cũ; bảo vệ bản backup có credential.
5. Không xóa log, migration hoặc volume để “rollback security”. Rollback image phải tương thích protocol, key và dữ liệu đang dùng.

Local CA có hiệu lực 1 năm, leaf 90 ngày. Script hiện không tự gia hạn cert đã tồn tại. Phải theo dõi expiry, chuẩn bị rotation trước hạn; production nên dùng PKI/secret manager có lifecycle chuẩn. Không đưa private key vào báo cáo. Chỉ đưa fingerprint công khai nếu cần minh họa.

## Control bổ sung và giới hạn

- API có `nosniff`, no-referrer, no-store, CSP chống embedding; frontend có CSP/X-Frame-Options. Auth throttle hiện 120 request/phút theo IP mà Identity nhìn thấy; sau proxy đây có thể là IP Gateway, nên là giới hạn chia sẻ, chưa phải distributed/user-aware rate limit production.
- Password dùng ASP.NET Core PasswordHasher (salt và thuật toán/cost do thư viện/config thực tế quyết định); không dùng SHA-256 để hash mật khẩu. SHA-256 dùng cho token entropy cao là trường hợp khác.
- PostgreSQL password đã được đổi sang random per-context, nhưng chưa vault, TLS hay runtime DML-only; SMTP vẫn là sink demo. Cần bổ sung trước production. Docker network riêng không đủ thay các lớp này.
- JWT trình duyệt còn ở JS storage; CSP giảm bề mặt nhưng không triệt tiêu XSS. BFF/HttpOnly cookie, MFA, lockout/adaptive throttling và kiểm thử xâm nhập độc lập là bước tiếp theo, không ghi là đã làm.
