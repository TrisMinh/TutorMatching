# Kịch bản End to End

## Dữ liệu chuẩn

Tạo Student A/B, Tutor A/B, Admin; subject Math; Tutor A availability ngày mai 08:00-12:00 UTC-converted; Tutor B riêng. Không dùng ngày cố định đã qua: fixture tính `nowUtc + 2 days`, align 00/30.

## E2E 01 Happy path

1. Register/login Tutor A, Student A; assert JWT claims/lifetime.
2. Tutor A PUT profile + Math + availability; assert ETag.
3. Student search qua Gateway; assert Tutor A và slot snapshot.
4. POST hold; assert 201, TTL xấp xỉ 300s, token không xuất hiện log.
5. POST booking; assert 201 Confirmed, Location, DB booking+outbox atomic.
6. Poll notification tối đa 15s; assert Student/Tutor confirmation một lần; outbox published, queue ACK, DLQ zero.

## E2E 02 Conflict và race

Student A/B tạo/xác nhận cùng Tutor A slot gần đồng thời. Assert tối đa một 201, request kia 409, một Confirmed row và một BookingConfirmed event. Lặp với khác tutor nhưng cùng student overlapping. Adjacent slot phải thành công.

## E2E 03 Hold lỗi

- Token sai/Student B dùng hold A -> 409, không booking.
- Payload mismatch/replay -> deterministic 409 hoặc existing booking theo idempotency rule.
- Chờ TTL (test override ngắn chỉ Test env), confirm -> `SCHEDULING_HOLD_EXPIRED`, tạo hold mới được.

## E2E 04 Authorization

Student B GET/DELETE booking A -> 403/404; Tutor B sửa Tutor A -> 403; Student gửi role/status/userId -> không thay đổi; forged/expired token -> 401; vượt search/login limit -> 429 + Retry-After.

## E2E 05 Cancellation

Participant cancel -> 204, Booking Cancelled, one event, cancellation notification cho cả hai, Pending reminders Cancelled. Cancel lại -> 204 không event/notification mới. Non-participant không cancel.

## E2E 06 Outage và restart

- Stop Notification, confirm booking -> 201; start -> notification eventually once.
- Stop Rabbit, confirm -> booking/outbox pending; start -> publish/consume once.
- Restart consumer after DB commit before ACK (fault hook Test) -> redelivery no duplicate.
- Restart Redis after hold -> confirm expired, DB unchanged.

## E2E 07 Reminder

Test profile rút lịch nhắc còn 2 phút/1 phút hoặc fake clock. Assert worker claim, in-app + Mailpit email, status Sent. Hai worker không double. Provider failure retry 1/5/15m override test; max -> Failed/alert.

Mỗi scenario ghi `traceId`, cleanup dữ liệu riêng và timeout có lý do; polling có deadline, không sleep dài cố định.

