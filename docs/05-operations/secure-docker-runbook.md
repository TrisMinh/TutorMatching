# Runbook Docker security và instance

## Khởi động

Máy hiện tại: Windows/PowerShell, Docker Compose hỗ trợ `!reset`/`!override`, Python 3 + `cryptography`. .NET 10/Node dùng cho test. Không đưa private key vào image.

```powershell
python -c "import cryptography; print(cryptography.__version__)"
./scripts/start-ha.ps1
```

Script sinh `.security` idempotent, validate compose, đưa datastore lên, provision password DB riêng từng context và broker account/topology, rồi build/start API với readiness. API healthy kiểm DB/cache, không thay bằng chứng queue/consumer end-to-end. Không dump runtime JSON/secret khi xem lỗi.

| Địa chỉ | Mục đích |
|---|---|
| `https://localhost:3443` | Frontend HTTPS |
| `https://localhost:8443` | API HTTPS ingress |
| `http://127.0.0.1:3000`, `:8080` | Tương thích HTTP localhost, không phải HTTPS-only production |
| `http://127.0.0.1:8404/stats` | HAProxy |
| `http://127.0.0.1:15672` | Broker management, operator password đã đổi |
| `http://127.0.0.1:8025` | Mailpit demo |

Browser chưa tin local CA sẽ cảnh báo. Kiểm fingerprint/nguồn CA rồi thiết lập trust theo quy trình máy; script không tự thêm root CA vào OS. Production cần domain/cert phù hợp, bỏ HTTP compatibility, xem lại HSTS, network policy, TLS DB/SMTP và secrets.

## Kiểm tra

```powershell
docker compose -f compose.yaml -f compose.ha.yaml -f compose.security.yaml ps
node scripts/verify-security.mjs
python scripts/verify-datastore-permissions.py
node scripts/verify-ha.mjs
$env:HA_CHAOS='1'
node scripts/verify-tutor-workflow.mjs
Remove-Item Env:HA_CHAOS
node scripts/cleanup-scheduling-audit.mjs
node scripts/audit-schedule.mjs
```

Probes có fixture/proxy riêng và cleanup trong finally. HA test hard-kill một Scheduling rồi restore restart policy. `verify-security.mjs --cache-failure` còn dừng Redis tạm thời để kiểm fail-closed/persistence; chỉ chạy khi đã cho phép làm gián đoạn stack kiểm thử.

```powershell
docker compose -f compose.yaml -f compose.ha.yaml -f compose.security.yaml exec -T rabbitmq rabbitmqctl list_connections user ssl
docker compose -f compose.yaml -f compose.ha.yaml -f compose.security.yaml exec -T rabbitmq rabbitmqctl list_queues name consumers messages_ready messages_unacknowledged
```

Scheduling/Notification dùng user riêng, `ssl=true`; queue booking-events.v1 có consumer. Scheduling mở connection ngắn theo batch nên không nhất thiết thấy trong một snapshot; kiểm thêm log đã lọc và workflow nhận notification mới tạo/hủy để chứng minh signature + inbox thực tế.

## Xử lý lỗi

- Luôn giữ **ba file compose**. Chỉ baseline/HA có thể trở về HTTP/credential/topology khác.
- Bind config không tự reload process. Đổi HAProxy/Nginx/Redis phải restart đúng component rồi kiểm; `up` với container unchanged chưa chắc đọc file mới.
- TLS lỗi: kiểm CA/CN/SAN/EKU, file mount và expiry; không bật callback luôn true.
- Redis NOPERM: đối chiếu command/key scope, không cấp tất cả quyền cho API. Default user tắt đăng nhập nhưng cần quyền nội bộ để replay AOF. Không xóa AOF/FLUSHDB chữa lỗi.
- Rabbit ACCESS_REFUSED: provision và kiểm resource permissions. Consumer secure không tự declare topology; không cấp publish events cho Notification chỉ để lách DLX.
- Event không tới: xem outbox attempt, broker connection, signature/DLQ, inbox; không xóa booking đã commit.
- Audit integrity lỗi: giữ bằng chứng, cô lập và đối chiếu; không xóa dòng rồi báo đã sửa.

## Dừng và rollback

Dùng stop/start khi cần giữ volume. Không `down -v`. Compose không tự rollback image; image cũ phải tương thích RSA/TLS/ACL/account/schema hiện hành. Chưa có automatic rolling rollback. Rollback nghiệp vụ khác rollback deployment: xem [recovery](../03-platform/retry-rollback-recovery.md).

Chỉ Scheduling có ba instance; các service/datastore còn lại đơn node. CA/keys host chưa thay KMS/HSM, certificate lifecycle chưa tự động, audit chưa WORM; DB/SMTP và browser token storage còn việc trước production. Giữ nguyên giới hạn khi báo cáo.
