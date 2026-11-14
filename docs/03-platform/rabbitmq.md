# RabbitMQ

## Topology

| Loại | Tên | Thuộc tính |
|---|---|---|
| Virtual host | `/tutormatching` | tách app |
| Topic exchange | `tutormatching.events` | durable, not auto-delete |
| Queue | `notification.booking-events.v1` | durable quorum queue |
| Bindings | `booking.confirmed.v1`, `booking.cancelled.v1` | exact topic keys |
| Retry exchange | `tutormatching.retry` | durable direct/topic |
| Retry queue | `notification.booking-events.retry.30s` | TTL 30000, DLX về events/original route |
| DLX | `tutormatching.dlx` | durable direct |
| DLQ | `notification.booking-events.dlq` | durable quorum/classic theo resource |

Topology được khai báo idempotent lúc service start hoặc definitions file. Nếu thuộc tính queue khác hiện có, startup fail rõ thay vì xóa/recreate có mất message.

## User và quyền

- `scheduling_publisher`: configure hạn chế nếu cần declare, write `tutormatching.events`, read none.
- `notification_consumer`: read/ack notification queue, write retry/DLX cần thiết, configure topology theo policy.
- Admin credential chỉ management, không dùng app.
- Password secret; guest không remote; management UI loopback/dev.

## Publisher

- Persistent `delivery_mode=2`, JSON, messageId=eventId, mandatory publish, publisher confirms.
- Channel không share concurrent sai cách; reconnect/topology declare với backoff.
- Outbox row chỉ set published sau confirm. Confirm timeout coi trạng thái unknown và retry -> có thể duplicate.
- Unroutable mandatory message là lỗi/alert, không đánh dấu published.

## Consumer

- Manual ACK sau DB commit; prefetch 20 bắt đầu, tune theo latency.
- Duplicate xử lý qua `processed_events`; ACK không effect.
- Lỗi transient: reject/NACK không requeue loop; publish/route retry 30s với attempt header do app kiểm soát.
- Tối đa 5 attempt hoặc thời gian 15 phút; sau đó DLQ + alert.
- Invalid JSON/schema/version/payload quá lớn đi DLQ ngay với reason, không retry.

Không tin header attempt từ producer tùy ý; consumer chuẩn hóa/giới hạn. Preserve eventId/correlation/trace khi retry; messageId retry có thể giữ eventId và retry metadata riêng.

## Ordering

RabbitMQ không cung cấp global ordering. Notification phải chịu event duplicate/out-of-order. Booking cancellation projection thắng confirmation cũ theo occurredAt/business state; confirmation đến sau không hồi sinh reminder đã cancel. Không tăng số consumer/partition mà giả định ordering per booking nếu chưa thiết kế consistent hashing.

## Payload và contract

Max 256 KiB; baseline event nhỏ <10 KiB. Event envelope/routing tại [event catalog](../01-architecture/event-catalog.md). Không gửi PII/secret. Breaking event tạo routing `.v2`, queue/binding mới hoặc consumer dual-support trong migration window.

## Health và metrics

Readiness publisher/consumer kiểm connection+channel và topology passive declare. Metrics: publish confirm latency/failure/unroutable, consumer ack/nack, redelivery, queue ready/unacked, consumer count, retry/DLQ depth, connection churn. Alert queue tăng liên tục, consumer=0, DLQ>0, oldest age vượt SLO.

## DLQ runbook tóm tắt

1. Dừng replay tự động; xem count, routing, reason/header và sample đã redacted.
2. Sửa consumer/schema/data hoặc xác nhận message không hợp lệ.
3. Replay vào original exchange bằng công cụ giữ messageId/eventId, rate giới hạn; inbox đảm bảo idempotent.
4. Xác minh queue/DLQ/notifications/metrics; không purge trước khi lưu evidence và được owner đồng ý.

