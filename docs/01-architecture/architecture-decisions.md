# Nhật ký quyết định kiến trúc

Mỗi quyết định dưới đây là `Accepted` cho phiên bản đầu. Thay đổi cần ADR mới ghi lý do, tác động dữ liệu/contract, migration và phương án rollback.

## ADR 001 Năm bounded context và database per service

**Quyết định:** Identity, Tutor, Student, Scheduling và Notification là năm service độc lập. Mỗi service có database, user, migration và backup scope riêng. Không foreign key hoặc SQL query xuyên database.

**Lý do:** Phù hợp 5 owner, tách quyền sở hữu nghiệp vụ và cho phép kiểm thử/triển khai độc lập. **Hệ quả:** Dữ liệu hiển thị xuyên context dùng REST composition hoặc event projection và chấp nhận eventual consistency.

## ADR 002 REST đồng bộ và RabbitMQ bất đồng bộ

**Quyết định:** REST dùng khi caller cần kết quả ngay (auth, profile, availability validation); event dùng cho notification và tác vụ không chặn response. REST timeout ngắn, không retry mutation trừ khi có idempotency key.

## ADR 003 Booking xác nhận ngay và slot cố định

**Quyết định:** Student xác nhận hold hợp lệ thì booking chuyển thẳng sang `Confirmed`; không có bước Tutor duyệt. Slot dài 60 phút, start ở phút 00 hoặc 30. **Hệ quả:** State machine nhỏ, demo rõ và tránh pending kéo dài.

## ADR 004 Hold Redis 5 phút

**Quyết định:** Redis tạo hold atomic với TTL 300 giây. Hold là optimization và UX lock; PostgreSQL vẫn kiểm tra conflict khi confirm. Mất Redis làm mất hold chưa xác nhận, không làm mất booking.

## ADR 005 Chống conflict tại PostgreSQL

**Quyết định:** Scheduling dùng `tstzrange` và exclusion constraints cho `tutor_id` và `student_id` trên booking active. Confirm chạy trong transaction; constraint violation ánh xạ 409. **Hệ quả:** Quy tắc đúng cả khi Redis lỗi hoặc có race.

## ADR 006 Transactional Outbox và inbox idempotency

**Quyết định:** Booking và OutboxMessage commit cùng transaction. Publisher dùng `FOR UPDATE SKIP LOCKED`, publisher confirm và đánh dấu sau ACK. Notification có unique `event_id`; duplicate trả ACK mà không tạo lại notification.

## ADR 007 Docker DNS thay Consul

**Quyết định:** Tên service Compose là DNS nội bộ. Consul bị hoãn vì môi trường demo có topology tĩnh. Production discovery là quyết định riêng.

## ADR 008 API Composition tại Gateway

**Quyết định:** Gateway có endpoint BFF mỏng cho màn hình tìm tutor, gọi Tutor và Scheduling song song theo batch. Không chứa quy tắc booking. Nếu composition tăng phức tạp hoặc cần persistence, tách Query service bằng ADR mới.

## ADR 009 JWT HMAC cho demo

**Quyết định:** Identity ký HS256 bằng secret tối thiểu 32 byte từ environment/secret store. Gateway và service cùng validate issuer, audience, signature, lifetime; service vẫn kiểm tra role/owner. Production nên chuyển asymmetric key.

## ADR 010 Kênh notification

**Quyết định:** In-app là kênh bắt buộc. Development email dùng SMTP sink (Mailpit) để demo; SMS và provider production ngoài phạm vi. Reminder trước 24 giờ và 1 giờ, unique theo booking/recipient/type.

## ADR 011 Tutor xem Student liên quan

**Quyết định:** Tutor chỉ xem hồ sơ tối thiểu của Student khi có booking giữa hai
bên. Student Service truyền nguyên JWT Tutor tới internal relationship query của
Scheduling; Gateway không route endpoint này. Không tin `studentId` do client tự
khai.

## ADR 012 Quan sát hệ thống

**Quyết định:** W3C Trace Context, OpenTelemetry, JSON logs, `X-Correlation-ID` tương thích legacy và metrics theo RED/USE. Health endpoint không thay monitoring; readiness kiểm dependency bắt buộc, liveness chỉ kiểm process.

