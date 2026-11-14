# Docker: ba instance Scheduling, các service khác một instance

> **Secure profile hiện hành:** dùng [báo cáo instance](03-platform/instances-load-balancing.md) và [secure Docker runbook](05-operations/secure-docker-runbook.md), gồm cả `compose.security.yaml`. Các lệnh hai file bên dưới là profile HA cũ, không bao gồm mTLS/ACL/RSA hiện hành.

Stack hiện gồm 3 Scheduling và 1 instance mỗi loại Identity, Tutor, Student, Notification, Gateway: tổng 8 API/Gateway. Frontend, HAProxy và mỗi datastore vẫn chạy 1 container. Frontend ở http://localhost:3000, API ở http://localhost:8080, bảng trạng thái HAProxy ở http://localhost:8404/stats. Dữ liệu và các khóa dùng chung; không lưu trạng thái booking hoặc đăng nhập riêng trong RAM của một instance.

## Chạy và kiểm tra

Từ thư mục gốc:

```powershell
./scripts/start-ha.ps1
docker compose -f compose.yaml -f compose.ha.yaml ps
node scripts/verify-ha.mjs
$env:HA_CHAOS='1'
node scripts/verify-tutor-workflow.mjs
Remove-Item Env:HA_CHAOS
node scripts/cleanup-scheduling-audit.mjs
node scripts/audit-schedule.mjs
```

`verify-ha.mjs` là kiểm thử có chủ đích gây lỗi: tắt tự restart tạm thời trên đúng một container, gửi SIGKILL, kiểm tra các instance còn lại, rồi khởi động và khôi phục chính sách restart trong `finally`. Không chạy kiểm thử này trên production có người dùng thật. Không có lệnh xóa volume. Luôn dùng cả hai file compose để giữ đúng topology đang chạy; lệnh chỉ dùng `compose.yaml` dành cho cấu hình một instance và có thể xung đột cổng với HAProxy đang chạy.

## Điều phối

HAProxy phục vụ cả ingress và các pool nội bộ. Docker DNS được cập nhật động; Scheduling có ba slot không trùng IP, mỗi pool khác có một slot. Thuật toán `leastconn` chọn instance Scheduling khỏe có ít kết nối đang xử lý nhất, chia đều khi bằng nhau. Không dùng sticky session. Health check gọi `/health/ready` mỗi giây; hai lần lỗi liên tiếp loại instance, hai lần thành công đưa lại vào pool. Probe kiểm tra database và Redis ở các API cần Redis.

| Cổng nội bộ HAProxy | Pool |
| --- | --- |
| 8080 | 1 Gateway |
| 8081 | 1 Identity |
| 8082 | 1 Tutor |
| 8083 | 1 Student |
| 8084 | 3 Scheduling |
| 8085 | 1 Notification |

Chỉ 8080 được public. 8404 chỉ mở trên loopback. Gateway và những lệnh gọi giữa service đều dùng pool nội bộ, thay vì DNS trực tiếp bỏ qua health check. Nginx phân giải lại địa chỉ ingress khi container được tạo lại. Header `X-Service-Instance` và `X-Gateway-Instance` bật riêng trong cấu hình này giúp xác minh đường đi của request. Mỗi replica giới hạn pool PostgreSQL ở 20 kết nối: ba replica tối đa 60 thay vì mặc định có thể lên 300 trên database giới hạn 100.

HAProxy thử lại tối đa hai lần khi **kết nối TCP thất bại**, chuyển sang server khác. Không tự phát lại POST khi đã gửi mà chưa biết kết quả. Cấu hình tuân theo [hướng dẫn retry của HAProxy](https://www.haproxy.com/documentation/haproxy-configuration-tutorials/reliability/retries/) và [DNS discovery](https://www.haproxy.com/documentation/haproxy-configuration-tutorials/proxying-essentials/dns-resolution/).

## Tiến trình, retry và rollback

| Thời điểm xảy ra lỗi | Hành vi |
| --- | --- |
| Instance chết sau tạo hold | Hold vẫn ở Redis dùng chung; instance khác xác nhận bằng hold ID/token cũ. |
| Lỗi trước commit booking | PostgreSQL rollback cả booking và outbox; không để lại một nửa giao dịch. Client giữ hold để thử lại nếu chưa hết hạn. |
| Commit xong, mất phản hồi hoặc instance chết | Thử lại cùng hold ID/token; instance khác trả booking đã tạo, không thêm bản ghi. |
| Đăng ký khóa lặp lại | Khóa course/student và giao dịch giữ một enrollment, một notice. |
| RabbitMQ gián đoạn | Booking giữ nguyên; outbox lưu công việc, backoff rồi gửi lại. Không hủy booking chỉ vì thông báo chưa gửi. |
| Worker outbox chết giữa chừng | Row lock transaction được giải phóng; worker khác lấy tiếp. Gửi lại cùng event ID được consumer khử trùng. |
| Nhiều consumer xử lý cùng booking | Advisory lock PostgreSQL theo booking giữ tính tuần tự. Sự kiện xác nhận đến sau hủy không tái tạo reminder. |
| Nhiều worker gửi reminder | FOR UPDATE SKIP LOCKED giữ khóa từng bản ghi qua lần gửi tối đa 10 giây và commit; không claim hàng loạt rồi để lease hết hạn khi chưa đến lượt gửi. |
| Refresh đồng thời trên nhiều instance | Khóa transaction theo token family và row lock ngăn tạo hai nhánh refresh. Phát hiện token cũ bị dùng lại sẽ thu hồi cả family. |

Các thao tác hiện tại chỉ ghi một database nghiệp vụ trong mỗi transaction; đọc service khác để kiểm tra điều kiện. Vì vậy dùng local transaction + outbox, không thêm một “Saga rollback” giả để xóa dữ liệu đã commit. Hủy booking là thao tác nghiệp vụ riêng, có quyền hạn và lưu trạng thái Cancelled.

Xem [chi tiết retry](retry-recovery.md) cho ngân sách 3 lần/12 giây, sự kiện hết tám lần thử và lệnh replay có kiểm soát.

## Giới hạn đã biết

- Chỉ Scheduling có dự phòng instance trên một máy Docker. Gateway, Identity, Tutor, Student, Notification, HAProxy và mỗi datastore đều một instance; lỗi ở các thành phần này không có replica thay thế. Đây không phải dự phòng toàn bộ hạ tầng hoặc lỗi toàn máy.
- Không chuyển stack đang thực thi giữa hai process. Phục hồi dựa trên hold, transaction, outbox và event ID đã lưu.
- Nếu process chết khi đang giữ global schedule-write lock, khóa hết hạn sau tối đa hai phút; trong thời gian đó các lệnh ghi fail closed bằng 503. Không hạ TTL tùy tiện vì có thể cho hai giao dịch cùng ghi lịch. Những request khác và các instance còn lại vẫn hoạt động.
- SMTP không cung cấp idempotency key. Nếu máy gửi chết sau khi SMTP đã nhận email nhưng trước commit, email có thể gửi lại; thông báo trong database vẫn được khử trùng theo event ID.
- Docker Compose không cung cấp rolling update/automatic rollback như orchestrator. Khi cập nhật, `up --wait` xác minh readiness nhưng không hứa zero downtime. Quay về image cũ cần dùng tag/digest phát hành đã lưu; không đảo migration database hoặc xóa volume để rollback ứng dụng.

## Bằng chứng kiểm thử

`verify-ha.mjs` xác nhận ba hostname Scheduling và một hostname ở mỗi pool còn lại. Chỉ Scheduling được kiểm thử tắt cưỡng bức một container: phục vụ thêm 36 request bằng hai replica còn lại và xác nhận replica được đưa trở lại. Các service một instance được kiểm tra hoạt động, không tắt chủ đích vì không có replica dự phòng. Script còn kiểm tra refresh đồng thời và đăng ký trùng email.

`HA_CHAOS=1` trong `verify-tutor-workflow.mjs` kiểm tra hold được xác nhận bởi replica khác sau khi replica tạo hold chết, rồi tắt replica đã commit và lấy lại đúng booking bằng proof cũ. `OutboxRecoveryTests` chạy trên database tạm riêng kiểm tra rollback và worker chết; `MultiInstanceRecoveryTests` dùng PostgreSQL thật với ba projector/worker, xác nhận một projection và 14 reminder được nhận đúng một lần bởi email sender kiểm thử. Kiểm thử này không chứng minh exactly-once của SMTP bên ngoài.
