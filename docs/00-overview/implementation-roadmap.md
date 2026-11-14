# Lộ trình triển khai

## Nguyên tắc

Mỗi giai đoạn tạo một vertical slice chạy và kiểm thử được. Không đợi đến cuối mới ghép Docker, JWT hoặc event. Contract thay đổi phải cập nhật OpenAPI/event schema, consumer và tài liệu trong cùng PR.

## Giai đoạn và exit criteria

| Giai đoạn | Đầu ra | Exit criteria |
|---|---|---|
| 0. Baseline | Repo layout, package pinning, Compose dependency, CI skeleton | Build sạch; PostgreSQL/Redis/RabbitMQ healthy. |
| 1. Identity | Register/login/refresh/me, JWT policy | Unit + integration test; Gateway chuyển token đúng. |
| 2. Profiles | Tutor/Student profile, subject, availability | Ownership test; migration và OpenAPI ổn định. |
| 3. Booking core | Search input, hold, confirm, cancel | Concurrency test chứng minh tối đa một booking. |
| 4. Messaging | Outbox publisher, RabbitMQ, Notification inbox | Restart/duplicate/DLQ test đạt. |
| 5. Composition | Search endpoint tại Gateway | Timeout/partial failure/pagination rõ ràng. |
| 6. Hardening | Security, telemetry, backup, E2E | Toàn bộ test matrix xanh; runbook được diễn tập. |
| 7. Demo | Seed data, Postman, kịch bản | Chạy lại từ máy sạch theo tài liệu. |

## Thứ tự migration

1. Khởi động database container và tạo database/user bằng init script chỉ ở local.
2. Mỗi service chạy migration job/command của chính nó; app không tự migrate khi nhiều replica.
3. Migration phải backward-compatible trong một phiên deploy: expand trước, code chuyển đổi, contract sau.
4. Seed chỉ chạy ở Development và phải idempotent.

## Milestone phối hợp

- M1: chốt route, DTO, event schema, port, health path và owner.
- M2: JWT issuer/audience/claim/lifetime hoạt động xuyên Gateway và service.
- M3: Tutor availability và Student profile sẵn sàng cho Scheduling.
- M4: hold-confirm-cancel chạy độc lập với PostgreSQL + Redis.
- M5: outbox đến Notification qua RabbitMQ, kể cả restart và duplicate.
- M6: Compose/E2E/security/concurrency/backup-restore hoàn tất.

## Definition of Ready cho một task

- Có endpoint/use case và quyền rõ ràng.
- Có schema/index/constraint và migration owner.
- Có expected error/status và observability signal.
- Có test level, fixture và assertion.
- Nếu thay contract, publisher/consumer hoặc frontend đã được xác định.

