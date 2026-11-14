# Kiểm chứng service security

## Kết quả đã quan sát — 14/11/2026

| Phạm vi | Kết quả |
|---|---|
| .NET solution | 55 test passed; các test DB có guard được chạy riêng như dưới |
| PostgreSQL integration thật | 2 OutboxRecoveryTests + 1 MultiInstanceRecoveryTests passed, database tạm riêng |
| Browser qua HTTPS 3443 | 6 live tests passed; enrollment replay được chạy lại riêng sau khi che credential trong lỗi probe |
| Security integration | RS256/tamper, role/BOLA, cert/caller + JWT, revoke cả 3 Scheduling, revoke-all, Admin disable đều passed |
| Cache outage | Dừng Redis → direct API 503; sau restart access hợp lệ phục hồi, token revoked vẫn 401 |
| Datastore permissions | Chỉ Identity ghi revoke; reader/hold scope bị từ chối; destructive commands kiểm bằng ACL DRYRUN; credential Student bị IdentityDb từ chối |
| Messaging | Booking Confirmed/Cancelled mới đi qua signed outbox, mTLS broker, consumer và tới notification của participant |
| Failover | Scheduling 3 replica: hard crash, 36 request survivors, rejoin; hold và committed booking được xử lý bởi replica khác |
| Audit snapshot | HMAC/schema của 35 stream, 8.026 entry đã được xác minh tại snapshot cuối; actor login và result booking ID đã được kiểm tra, không in định danh |
| Dữ liệu cũ | 95 confirmed bookings, 0 course-booking conflicts sau cleanup fixture |

Số stream/entry audit tăng theo hoạt động và recreation; đó là snapshot, không phải ngưỡng cố định hay benchmark. Các output chứa credential đã không được đưa vào tài liệu; phiên browser fixture cũ được thu hồi khi cleanup.

## Phân biệt bằng chứng

Unit, mock, integration với PostgreSQL/RabbitMQ thật và pentest độc lập là các mức khác nhau. Kết quả local không phải chứng nhận an toàn production.

```powershell
dotnet test TutorMatching.slnx
```

- AsymmetricTokenTests: public-key verify RS256; wrong key, HS/RS confusion bị từ chối.
- WorkloadSecurityTests: CA/service/hostname-error checks; signature đúng và các trường hợp thay body/ID/routing key/chữ ký.
- SecurityAuditTests: loại body/query/auth secrets; restart kiểm chain; sửa record gây integrity failure.
- Identity/API/domain tests: login/role/refresh/session. Legacy development key trong unit test không phải bằng chứng Docker đã mTLS.

OutboxRecoveryTests và MultiInstanceRecoveryTests có environment guard. Nếu chưa đặt TEST_SCHEDULING_DB/TEST_NOTIFICATION_DB, chúng không thực hiện database test thật dù runner báo passed. Cần chạy riêng với connection hợp lệ; chúng tạo database tên ngẫu nhiên rồi xóa đúng database đó. Không đặt TEST_REDIS_CONNECTION vào Redis app vì test cũ có FLUSHDB.

Lệnh tái tạo với credential secure hiện hành: `python scripts/verify-database-recovery.py`. Helper tạo proxy loopback cổng ngẫu nhiên, truyền secret qua environment không in ra, chạy đúng test filter rồi dừng proxy trong finally. Không phải mở cổng database cố định hay sửa password về demo để chạy test.

## Docker security probes

```powershell
node scripts/verify-security.mjs
node scripts/verify-security.mjs --cache-failure
```

HTTPS dùng CA được chỉ định, không tắt TLS validation. Script kiểm:

1. HTTPS ingress/frontend và browser security headers.
2. RS256, sửa role trong JWT → 401; role sai → 403.
3. Ingress chặn internal route.
4. API không có client certificate bị từ chối ở TLS.
5. Cert Gateway + header giả Scheduling vẫn 403 ở Student internal lookup.
6. Cert Scheduling thiếu JWT → 401, đúng cert + JWT → 200.
7. Logout chặn token còn hạn trực tiếp ở cả ba Scheduling, không chỉ ở Gateway.
8. Refresh đã revoke → 401; revoke-all chặn phiên khác.
9. User thường không disable account; Admin disable chặn cả access/login của target.
10. Student B không đọc booking Student A bằng cách đổi ID.
11. Flag cache-failure: Redis dừng → 503; reconnect phục hồi, token revoked vẫn 401 sau restart.

Fixture Admin/target dùng password ngẫu nhiên và email prefix riêng; promote qua bootstrap test, không mở public Admin registration. Finally revoke phiên, xóa đúng fixture account và dừng proxy tạm. Không in credential/token.

## Instance và messaging

`python scripts/verify-datastore-permissions.py` kiểm quyền thực tế: API khác không ghi được revoked keys, Identity ghi được, Student không đọc hold; lệnh phá hủy cache chỉ được kiểm bằng **ACL DRYRUN**, không thực thi FLUSHDB. Script kiểm permission regex của hai broker account và chỉ tạo/xóa một key probe ngẫu nhiên có TTL.

`verify-ha.mjs` kiểm Scheduling=3, còn lại=1, crash/survivor/rejoin. `verify-tutor-workflow.mjs` với HA_CHAOS kiểm shared hold và post-commit replay trên replica khác, rồi chờ Confirmed/Cancelled notifications từ broker. Secure deployment dùng signed event + mTLS RabbitMQ + inbox, không chỉ đọc outbox.

Kiểm `rabbitmqctl list_connections user ssl`, `list_queues ...`; API healthy chưa chứng minh consumer hoạt động. Unit test tamper kiểm verifier; chưa chèn poison event vào queue thật để tránh làm bẩn DLQ.

## Audit evidence

Browser HTTPS tests dùng CA cho phần Node và pin public key của đúng web cert cho Chromium; không sửa trust store hệ điều hành. Từ root, đặt `NODE_EXTRA_CA_CERTS` thành đường dẫn tuyệt đối `.security/public/ca.crt`, `TUTORMATCHING_LOCAL_CERT_SPKI` từ `.security/public/browser-spki.txt`, `TUTORMATCHING_WEB_URL=https://localhost:3443`, rồi chạy live tests trong thư mục web. SPKI pin là trust có chủ đích cho cert demo, không phải bằng chứng cert đã được public CA tin cậy. `verify-security.mjs` kiểm CA/hostname thật bằng Node HTTPS riêng.

Trace/debug log của framework test có thể chứa Authorization header; không đưa trace raw vào báo cáo. Cleanup thu hồi phiên fixture, bản log/audit nộp báo cáo cần ẩn dữ liệu định danh và secret. Lỗi probe enrollment được thay bằng thông báo không kèm credential.

Copy audit volume vào `.superpowers/security-evidence/audit`, chạy `python scripts/verify-audit.py`. Chỉ in số stream/entry và chain/schema pass, không đưa log raw có định danh lên Git. Tamper test sửa bản sao unit-test, không sửa stream vận hành.

## Giới hạn

Chưa pentest toàn bộ, benchmark tải, chứng minh OIDC/SSO/MFA, non-repudiation người dùng, key rotation zero downtime hay SMTP exactly-once. Giữ output đã ẩn secret khi báo cáo; trạng thái chính thức và giới hạn ở [security index](README.md).
