# Definition of Done

Một service/tính năng hoàn thành khi tất cả mục áp dụng đều đạt:

- Domain/use case/range và non-goal đúng spec; không truy cập DB service khác.
- DTO/OpenAPI/error/status/version cập nhật; event schema/routing/compatibility cập nhật.
- Migration/index/check/unique/concurrency constraint có test PostgreSQL thật và rollback/expand plan.
- Role + resource ownership + mass-assignment + 401/403/404 test.
- Timeout/cancellation/retry/idempotency/failure behavior rõ và test.
- Unit, architecture, integration, contract, API; critical path concurrency/resilience khi liên quan.
- Structured log/trace/metrics/health; không log secret/PII; runbook signal có nghĩa.
- Options validate-on-start; env reference, port, health, Dockerfile/Compose cập nhật.
- Image non-root/hardening baseline, dependency/secret/vulnerability scan đạt gate.
- Chạy độc lập và qua Gateway/Compose; E2E liên quan xanh.
- Docs service/infrastructure/security/test/PlantUML cập nhật cùng PR.
- PR review, CI xanh, không còn dấu nhắc chưa xử lý cho hành vi critical.

## Bằng chứng bàn giao

Link PR/commit, OpenAPI diff, migration name/script, test command/result, E2E traceId, screenshot/metric chỉ khi hữu ích, known limitations có owner/deadline. “Đã test thủ công” không thay automated evidence.

