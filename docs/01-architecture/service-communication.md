# Giao tiếp giữa các service

## Ma trận cho phép

| Caller | Callee | Giao thức | Mục đích |
|---|---|---|---|
| Gateway | Identity | REST | Auth routes, current identity. |
| Gateway | Tutor | REST | Tutor search/detail/profile. |
| Gateway | Student | REST | Student profile. |
| Gateway | Scheduling | REST | Slot/booking và search batch. |
| Gateway | Notification | REST | Notification của user. |
| Scheduling | Tutor | REST internal | Xác minh tutor/subject/availability tại hold. |
| Student | Scheduling | REST internal | Xác minh Tutor có booking với Student khi đọc profile. |
| Scheduling outbox | RabbitMQ | AMQP | `booking.confirmed.v1`, `booking.cancelled.v1`. |
| Notification | RabbitMQ | AMQP consumer | Tạo notification/reminder. |

Mọi đường khác bị cấm cho đến khi có ADR. Không service gọi database/cache của service khác.

## REST resilience

- Base URL từ config, ví dụ `http://tutor-service:8080`.
- Connect timeout 2 giây, request timeout 5 giây, cancellation token xuyên call chain.
- Retry GET tối đa 2 lần cho network/502/503/504 với exponential backoff + jitter; không retry 4xx.
- Circuit breaker mở sau ngưỡng lỗi được đo; response bên ngoài là 503 Problem Details có dependency code.
- Không tạo chain quá 2 service hops sau Gateway trong synchronous request.

## Batch contract

Composition không gọi N+1. Scheduling cung cấp:

`POST /internal/v1/slots/query`

```json
{
  "tutorIds": ["uuid"],
  "fromUtc": "2026-11-15T00:00:00Z",
  "toUtc": "2026-11-16T00:00:00Z"
}
```

Giới hạn 100 tutor/request, range tối đa 7 ngày. Response nhóm theo tutorId; thiếu tutor trả mảng rỗng có reason, không âm thầm drop ID.

## Authentication nội bộ

- Tất cả internal call v1 là user-driven và truyền nguyên JWT user để downstream
  kiểm role/owner. Scheduling truyền JWT Student khi validate slot; Student truyền
  JWT Tutor khi xác minh relationship.
- Gateway không expose `/internal`; Docker network giảm bề mặt tấn công nhưng
  không thay authentication.
- V1 không có client-credentials/service token. Background worker không gọi API
  nội bộ. Nếu xuất hiện system call mới, phải có ADR và flow cấp service identity.
- Không dùng header `X-User-Id` không ký làm nguồn danh tính.

## Correlation và trace

Gateway nhận/tạo `traceparent` và correlation ID. Mỗi outgoing HTTP/AMQP inject trace context. Event envelope mang `correlationId`, `causationId` và W3C `traceparent`; consumer tạo consumer span và không tái sử dụng producer span ID.

## Contract compatibility

- REST: consumer-driven contract cho route nội bộ trọng yếu; additive fields phải được consumer bỏ qua an toàn.
- Event: routing key có version; field hiện có không đổi nghĩa/type; field mới optional; breaking schema tạo `.v2` và chạy song song trong migration window.
- Contract owner cập nhật docs, schema fixture và tests trong cùng PR.

