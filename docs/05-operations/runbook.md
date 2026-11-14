# Runbook vận hành

## Khởi động và xác minh

1. Tạo `.env.local` từ example và sinh secret random; không commit.
2. `docker compose -f deploy/compose/compose.yml --env-file .env.local up --build -d`.
3. `docker compose ps`; chờ tất cả healthy.
4. Gọi Gateway `/health/live`; kiểm từng readiness qua network/debug profile.
5. Kiểm migration current, Rabbit topology/consumer, outbox pending=0, DLQ=0.
6. Chạy smoke E2E: login, availability, hold, confirm, notification.

## Chẩn đoán chuẩn

Thu thập theo thứ tự: thời điểm/environment -> user-visible code/status/traceId -> Gateway log -> owner service trace -> dependency metrics/log -> dữ liệu bằng read-only query. Không dump env/token/body. Dùng `docker compose logs --since=15m <service>` và correlation ID.

## Service readiness đỏ

1. Xem health component internal và log startup/config validation.
2. Kiểm DNS/port/credential riêng, không đổi ngẫu nhiên nhiều config.
3. DB: `pg_isready`, pool/lock/migration; Redis: PING/memory; Rabbit: diagnostics/topology.
4. Khôi phục dependency/restart service nếu client không reconnect; chạy smoke.
5. Nếu migration lỗi, không sửa schema tay; restore/rollback migration theo owner.

## Booking conflict tăng

Phân biệt conflict nghiệp vụ hợp lệ với lỗi. Xem metric hold conflict/exclusion, sample trace, Redis PTTL và Booking range. Không xóa lock nếu chưa xác minh owner/TTL. Nếu stale key, kiểm Lua/release/clock; DB vẫn authoritative. Test concurrency trước deploy fix.

## Redis unavailable/restart

Tạo hold trả 503; confirmed booking vẫn an toàn. Khôi phục Redis, xác minh PING/memory/noeviction, restart Scheduling nếu reconnect thất bại, tạo hold mới. Không phục hồi hold cũ từ DB.

## RabbitMQ hoặc Notification down

Booking vẫn commit + outbox. Khôi phục broker/consumer; xác minh publisher confirm, outbox oldest giảm, queue drain, duplicate không tạo notification đôi. Nếu DLQ>0 làm theo RabbitMQ runbook; không purge.

## Outbox backlog

Kiểm broker connection/confirm/unroutable, pending last_error/attempt redacted, exchange/binding. Sửa nguyên nhân, cho publisher resume có rate; consumer idempotent. Không set `published_at` thủ công nếu chưa xác nhận message.

## Database lock/pool exhaustion

Xem active/waiting query, lock tree, transaction age và pool metrics. Hủy query chỉ khi biết owner/tác động; sửa long transaction/N+1/pool sizing. Không tăng max_connections như fix đầu tiên. Ghi evidence và chạy load/concurrency regression.

## Restart order

Dependencies -> migration jobs -> Identity/Tutor/Student -> Scheduling -> Notification -> Gateway -> Web. Thực tế app phải reconnect không phụ thuộc order; order này giảm noise. Sau restart luôn health + E2E + queue/outbox check.

## Shutdown

`docker compose down` giữ volume. Trước bảo trì chờ request/worker lease hoặc graceful timeout; consumer dừng nhận rồi finish/abandon an toàn. Không dùng `down -v` trong thao tác bình thường.

