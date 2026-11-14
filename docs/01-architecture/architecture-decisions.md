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

**Đã supersede trong secure profile bởi ADR 013.** Nội dung sau giữ lại làm lịch sử.

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

## ADR 013 Service Security và deployment hiện hành

**Quyết định:** Secure Docker dùng RS256, Identity giữ private key riêng, các API chỉ verify bằng public key. HTTP giữa workload dùng mTLS và caller allowlist, internal HAProxy dùng TLS passthrough. Logout/access revocation dựa trên Redis TLS/ACL; Identity có quyền ghi trạng thái thu hồi, các API khác chỉ đọc. Broker dùng mTLS/tài khoản riêng, Scheduling ký event, Notification verify trước inbox. Audit metadata có HMAC chain trong persistent volume.

**Đánh đổi:** Không còn xác thực hoàn toàn phi trạng thái vì API kiểm Redis; cache lỗi thì fail closed. Local CA chưa auto-renew/CRL, local audit chưa immutable/legal evidence, chưa OIDC/SSO hoặc chữ ký người dùng. HTTP demo chỉ loopback vẫn được giữ, PostgreSQL/SMTP chưa TLS. Không gọi đây là security production hoàn chỉnh.

**Instance:** 3 Scheduling, mỗi API khác và Gateway 1; tổng 8. Không tạo thêm service hoặc replica chỉ vì thêm security. Xem [báo cáo security](../04-security/README.md), [instance](../03-platform/instances-load-balancing.md), [recovery](../03-platform/retry-rollback-recovery.md) và [runbook](../05-operations/secure-docker-runbook.md).

