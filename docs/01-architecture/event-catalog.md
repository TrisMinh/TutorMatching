# Danh mục integration event

## Topology chuẩn

- Virtual host: `/tutormatching`.
- Topic exchange: `tutormatching.events`, durable.
- Notification queue: `notification.booking-events.v1`, durable quorum queue.
- Binding: `booking.confirmed.v1`, `booking.cancelled.v1`.
- Retry/DLQ mô tả tại [RabbitMQ](../03-platform/rabbitmq.md).

## Envelope v1

```json
{
  "eventId": "17df8db2-5ac7-4c61-8f41-8835048b1150",
  "eventType": "BookingConfirmed",
  "eventVersion": 1,
  "occurredAtUtc": "2026-11-14T02:00:00Z",
  "producer": "scheduling-service",
  "correlationId": "6d649a33-d302-4a1a-b4e1-45057fcbf53e",
  "causationId": "8b998a39-0c9f-4537-97fe-a8533f68f637",
  "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  "data": {}
}
```

AMQP properties: `message_id=eventId`, `type=eventType`, `content_type=application/json`, `delivery_mode=2`, timestamp UTC. Không chứa email, tên hoặc dữ liệu nhạy cảm; consumer lấy recipient theo user ID/service data.

## BookingConfirmed v1

Routing key `booking.confirmed.v1`.

```json
{
  "bookingId": "uuid",
  "studentId": "uuid",
  "tutorId": "uuid",
  "startAtUtc": "2026-11-15T02:00:00Z",
  "endAtUtc": "2026-11-15T03:00:00Z",
  "subjectId": "uuid",
  "confirmedAtUtc": "2026-11-14T02:00:00Z"
}
```

Notification tạo confirmation cho Student và Tutor, reminder 24h/1h nếu thời điểm còn ở tương lai. Event đến trễ không tạo reminder đã quá hạn.

## BookingCancelled v1

Routing key `booking.cancelled.v1`.

```json
{
  "bookingId": "uuid",
  "studentId": "uuid",
  "tutorId": "uuid",
  "startAtUtc": "2026-11-15T02:00:00Z",
  "endAtUtc": "2026-11-15T03:00:00Z",
  "cancelledAtUtc": "2026-11-14T03:00:00Z",
  "cancelledByUserId": "uuid",
  "reasonCode": "PARTICIPANT_CANCELLED"
}
```

Notification tạo cancellation notification và cancel reminder chưa claim. Không gửi nội dung reason tự do qua event.

## Quy tắc publisher và consumer

- Publisher ghi event payload immutable vào outbox cùng transaction nghiệp vụ.
- Publisher confirm trước khi đánh dấu `publishedAtUtc`; crash có thể phát lặp.
- Consumer bắt đầu DB transaction, insert `ProcessedEvent(eventId)` unique, áp dụng effect, commit rồi ACK.
- Duplicate unique violation: rollback/đọc trạng thái, ACK không tạo effect.
- Lỗi transient: NACK/retry; lỗi poison/schema: sau giới hạn chuyển DLQ và alert.

