# Bộ tài liệu kỹ thuật TutorMatching

Báo cáo theo đề bài hiện hành: [Scheduling & Time Constraints](coursework/README.md).
Các file trong `coursework` mô tả phạm vi đã triển khai; các checklist nền tảng bên dưới có thể bao gồm hướng mở rộng.

Đây là tài liệu triển khai chuẩn cho nền tảng ghép cặp gia sư và học sinh theo khung giờ. Một kỹ sư mới phải có thể dùng bộ tài liệu này để tạo solution, database, API, hạ tầng cục bộ, kiểm thử và demo mà không cần tự quyết lại kiến trúc.

Từ **PHẢI**, **KHÔNG ĐƯỢC**, **NÊN** và **CÓ THỂ** mang nghĩa quy chuẩn. Nếu code khác tài liệu, thay đổi phải đi qua ADR và cập nhật đồng thời API hoặc event contract liên quan.

## Đọc theo vai trò

| Vai trò | Bắt đầu tại |
|---|---|
| Thành viên mới | [Phạm vi hệ thống](00-overview/system-scope.md), [Baseline công nghệ](00-overview/technology-baseline.md) |
| Backend owner | [Kiến trúc](01-architecture/system-architecture.md), [API standards](01-architecture/api-standards.md), [Service specs](02-services/) |
| Platform owner | [Gateway](03-platform/api-gateway.md), [Docker Compose](03-platform/docker-compose.md), [Cấu hình](03-platform/configuration-reference.md) |
| Security reviewer | [JWT và phân quyền](04-security/jwt-and-authorization.md), [Hardening](04-security/security-hardening.md) |
| QA | [Test strategy](06-testing/test-strategy.md), [E2E scenarios](06-testing/e2e-scenarios.md) |
| Người demo/vận hành | [Runbook](05-operations/runbook.md), [Sơ đồ](diagrams/README.md) |

[Vòng đời khóa học: trạng thái, ràng buộc, thông báo và kiểm thử](02-services/course-lifecycle.md).

## Account experience đã tích hợp

- [Settings và hiệu lực nghiệp vụ](08-account-experience/settings.md)
- [Quên/đặt lại mật khẩu](08-account-experience/password-recovery.md)
- [Email reminder booking/course](08-account-experience/email-reminders.md)
- [Chính sách hủy booking](08-account-experience/cancellation-policy.md)
- [Bằng chứng kiểm thử các luồng tài khoản](08-account-experience/verification.md)

## Bản đồ tài liệu

- `00-overview`: phạm vi, công nghệ, lộ trình.
- `01-architecture`: kiến trúc, DDD, contract dùng chung, event, quyền sở hữu dữ liệu, ADR.
- `02-services`: đặc tả đầy đủ cho Identity, Tutor, Student, Scheduling, Notification.
- `03-platform`: Gateway, PostgreSQL, Redis, RabbitMQ, Compose, cổng và cấu hình.
- `04-security`: JWT, authorization, hardening, secret và bảo vệ dữ liệu.
- `05-operations`: observability, runbook, backup và khôi phục.
- `06-testing`: chiến lược, kịch bản E2E, Postman.
- `07-delivery`: workflow, Definition of Done, phân công.
- `diagrams`: sơ đồ Mermaid hiển thị trực tiếp trong Markdown và nguồn PlantUML đối chiếu.

## Tài liệu chi tiết

| Chủ đề | Tài liệu |
|---|---|
| Kiến trúc | [System architecture](01-architecture/system-architecture.md), [DDD/domain](01-architecture/domain-model.md), [Communication](01-architecture/service-communication.md), [ADR](01-architecture/architecture-decisions.md) |
| Contract | [API standards](01-architecture/api-standards.md), [Event catalog](01-architecture/event-catalog.md), [Data ownership](01-architecture/data-ownership.md) |
| Service | [Identity](02-services/identity-service.md), [Tutor](02-services/tutor-service.md), [Student](02-services/student-service.md), [Scheduling](02-services/scheduling-service.md), [Notification](02-services/notification-service.md) |
| Platform | [Gateway](03-platform/api-gateway.md), [PostgreSQL](03-platform/postgresql.md), [Redis](03-platform/redis.md), [RabbitMQ](03-platform/rabbitmq.md), [Compose](03-platform/docker-compose.md), [Ports](03-platform/ports-and-networking.md), [Configuration](03-platform/configuration-reference.md) |
| Security | [JWT](04-security/jwt-and-authorization.md), [Hardening](04-security/security-hardening.md), [Secrets](04-security/secrets-and-data-protection.md) |
| Operations | [Observability](05-operations/observability.md), [Runbook](05-operations/runbook.md), [Backup](05-operations/backup-and-recovery.md) |
| Testing | [Strategy](06-testing/test-strategy.md), [E2E](06-testing/e2e-scenarios.md), [Postman](06-testing/postman-guide.md) |
| Delivery | [Workflow](07-delivery/development-workflow.md), [Definition of Done](07-delivery/definition-of-done.md), [Ownership](07-delivery/team-ownership.md) |
| Visual model | [Danh mục sơ đồ](diagrams/README.md) |

## Sơ đồ nên mở cùng tài liệu

- Tổng thể: [system context, container, deployment và DDD context](diagrams/architecture.md).
- Domain: [Identity, Tutor, Student, Scheduling và Notification](diagrams/domain.md).
- Dữ liệu: [ownership ERD và physical schema của 5 database](diagrams/data.md).
- Luồng: [login, search, booking, cancel và notification](diagrams/sequences.md).
- Trạng thái/hạ tầng: [booking state, RabbitMQ, Redis hold và request tracing](diagrams/state-and-infrastructure.md).

## Quyết định nền tảng

- 5 bounded context tương ứng 5 microservice; mỗi service sở hữu database riêng.
- .NET 10, ASP.NET Core, EF Core, PostgreSQL, Redis 7, RabbitMQ 3, YARP, React và Docker Compose.
- Slot cố định 60 phút; hold Redis 5 phút; booking được `Confirmed` ngay khi học sinh xác nhận hold hợp lệ.
- PostgreSQL là nguồn chân lý; chống trùng bằng transaction và exclusion constraint.
- Event được phát qua Transactional Outbox; consumer dùng inbox/idempotency, retry hữu hạn và DLQ.
- Docker Compose DNS là service discovery của bản đầu; không dùng Consul.
- Tất cả API public có tiền tố `/api/v1`; ID là UUID; thời gian là UTC ISO 8601.

## Trình tự bắt tay vào làm

1. Đọc ADR và API/event standards.
2. Tạo repository layout và shared building blocks tối thiểu.
3. Mỗi owner dựng service, database, migration, health check và test độc lập.
4. Ghép Gateway, JWT, Redis, RabbitMQ và Compose.
5. Chạy test matrix, E2E và concurrency trước demo.

