# Instance và thuật toán điều phối Scheduling

## Topology hiện hành

| Thành phần | Instance | Lý do |
|---|---:|---|
| Scheduling API + outbox worker | **3** | Kiểm chứng chia tải, failover và cạnh tranh ghi lịch |
| Identity | 1 | Quy mô demo hiện tại |
| Tutor | 1 | Quy mô demo hiện tại |
| Student | 1 | Quy mô demo hiện tại |
| Notification | 1 | Worker có cơ chế cạnh tranh nhưng không cần chạy dư |
| Gateway | 1 | Ingress ứng dụng |

Tổng **8 API/Gateway**, không phải 18. Nginx, HAProxy, mỗi PostgreSQL, Redis, RabbitMQ và Mailpit mỗi thành phần một container. Ba instance không phải định nghĩa bắt buộc của microservice; là quyết định vận hành theo tải và yêu cầu sẵn sàng. Không gán throughput/SLA khi chưa benchmark.

## Cấu hình có thể tái tạo

```powershell
docker compose -f compose.yaml -f compose.ha.yaml -f compose.security.yaml up -d --build --wait
docker compose -f compose.yaml -f compose.ha.yaml -f compose.security.yaml ps
```

Nên dùng `scripts/start-ha.ps1` để sinh security material và provision broker. `compose.ha.yaml` đặt một replica cho các nhóm khác, chỉ override Scheduling thành ba; secure overlay không tăng replica. Giữ đủ ba file để không vô tình chạy profile thiếu TLS/ACL.

## Thuật toán điều phối

HAProxy dùng **least connections**: chọn server UP có ít kết nối đang xử lý nhất; cân bằng giữa server bằng nhau. Docker DNS cập nhật IP; server-template có 3 slot Scheduling, 1 slot mỗi nhóm khác. Không sticky session.

Secure profile dùng TCP passthrough cho pool nội bộ, giữ mTLS caller tới API đích. Vì vậy điều phối ở **mức kết nối**, không hứa mỗi request luân phiên server. Gateway gọi HTTP/1.1 tới các API, pooled connection lifetime 15 giây; một kết nối có thể được tái sử dụng. Named HttpClient khác có pool riêng.

Health readiness mỗi giây, fall=2/rise=2; thời gian phát hiện còn phụ thuộc timeout check 3 giây. Không gọi đây là failover tức thời. HTTP API chỉ cho health probe; request nghiệp vụ phải mTLS.

## Một Scheduling chết thì sao?

1. Kết nối đang chạy có thể lỗi; không chuyển stack frame sang process khác.
2. Health check loại node; kết nối mới chọn hai node còn lại.
3. Chỉ operation repeatable được retry với ID/proof cũ.
4. PostgreSQL/Redis giữ state dùng chung; worker khác claim outbox khi row lock được giải phóng.
5. Docker restart `unless-stopped` khởi động lại process; readiness thành công đưa nó lại vào pool.

Ba Scheduling dùng cùng SchedulingDb, không có ba database độc lập cần đồng bộ. Pool PostgreSQL giới hạn 20 connections/replica, tối đa 60 từ nhóm Scheduling. Đây là giới hạn tài nguyên, không phải bằng chứng chịu được mọi mức tải.

## Kiểm chứng và giới hạn

`verify-ha.mjs`: số hostname đúng 1/1/1/1/3/1; hard-kill một Scheduling; thêm 36 request qua survivors; node tái nhập. `verify-tutor-workflow.mjs` với HA_CHAOS kiểm hold/replay trên node khác. `verify-security.mjs` kiểm revoke trực tiếp cả ba replica qua mTLS.

Không cố tắt service một instance rồi tuyên bố failover. Gateway, Identity, Tutor, Student, Notification, HAProxy, host và datastore vẫn đơn node. Compose không có automatic rolling update/image rollback. Xem [retry/recovery](retry-rollback-recovery.md) cho lock TTL và transaction.
