# Service Security — tài liệu báo cáo triển khai

Bộ này mô tả **code và cấu hình Docker đã triển khai**, tách khỏi checklist định hướng trong các tài liệu baseline cũ. Ngày cập nhật: 14/11/2026. Phạm vi là TutorMatching REST/messaging; không gán các đảm bảo của hệ thống ngân hàng cho ứng dụng học tập.

## Trình tự đọc

| Phần báo cáo | Tài liệu |
|---|---|
| Tài sản, biên giới bảo vệ, rủi ro mạng nội bộ | [Threat model](threat-model.md) |
| Identity tập trung, JWT RSA và giới hạn SSO | [Identity và JWT](identity-and-jwt.md) |
| Authentication khác Authorization; chống BOLA/IDOR | [Phân quyền](authorization-and-bola.md) |
| HTTPS, mTLS, danh tính/caller scope | [Transport và service identity](transport-and-service-identity.md) |
| Logout, thu hồi ngay, khóa tài khoản | [Token revocation](token-revocation.md) |
| Bằng chứng ai/làm gì/khi nào; bảo vệ log | [Security audit](security-audit.md) |
| Service account RabbitMQ, TLS và chữ ký sự kiện | [Messaging security](messaging-security.md) |
| Cấp phát/bảo quản/đổi khóa và quyền Redis | [Secrets và vận hành](secrets-and-operations.md) |
| Đối chiếu toàn bộ tình huống môn SOA | [Áp dụng kiến thức đã học](soa-lesson-mapping.md) |
| Kịch bản, lệnh kiểm tra và giới hạn bằng chứng | [Verification](verification.md) |

Instance là phần riêng: [3 Scheduling và điều phối](../03-platform/instances-load-balancing.md), [retry/rollback/recovery](../03-platform/retry-rollback-recovery.md). Hướng dẫn chạy: [secure Docker runbook](../05-operations/secure-docker-runbook.md).

## Trạng thái và giới hạn

- Có RS256, kiểm tra role/owner, mTLS cho HTTP giữa service, HTTPS ingress, Redis TLS/ACL, RabbitMQ mTLS/tài khoản riêng, chữ ký sự kiện, thu hồi phiên qua Redis, audit HMAC và throttle auth cơ bản.
- Scheduling **3** instance; Identity, Tutor, Student, Notification, Gateway **mỗi loại 1**. Không tăng thêm service chỉ để làm báo cáo security.
- HTTPS demo: `https://localhost:3443`; API: `https://localhost:8443`. CA cục bộ chưa tự được trình duyệt tin cậy; script không cài root CA vào Windows.
- HTTP `127.0.0.1:3000/8080` được giữ **chỉ để tương thích demo trên localhost**. Không được mô tả đây là môi trường production HTTPS-only.
- Chưa có OAuth2/OIDC SSO đầy đủ, MFA, KMS/HSM, CRL/OCSP, service mesh, WORM log collector hoặc chữ ký xác nhận giao dịch bằng khóa của học sinh. JWT trình duyệt còn ở session/localStorage; XSS vẫn là rủi ro, chưa chuyển sang BFF/HttpOnly refresh cookie.
- Chữ ký event chứng minh nguồn service và toàn vẹn; **không** chứng minh người dùng không thể chối bỏ giao dịch. Chưa mã hóa payload riêng ở message level.
- Datastore, broker, HAProxy và host vẫn đơn node. PostgreSQL dùng credential sinh riêng từng context nhưng PostgreSQL/SMTP chưa được bổ sung TLS; mạng Docker riêng không đồng nghĩa mã hóa mọi kết nối.

Nguồn nguyên tắc: [OWASP Microservices](https://cheatsheetseries.owasp.org/cheatsheets/Microservices_Security_Cheat_Sheet.html), [REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), [Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html). Không coi việc có Docker, nhiều instance hay JWT là chứng nhận an toàn toàn hệ thống.
