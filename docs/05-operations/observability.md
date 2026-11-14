# Observability

## Mục tiêu

Một request phải truy được từ Gateway qua REST, transaction/outbox, RabbitMQ consumer đến notification worker mà không log secret. Dùng OpenTelemetry, W3C Trace Context, structured JSON logs và metrics có cardinality giới hạn.

## Log schema

Mọi log có `timestamp`, `level`, `service.name`, `environment`, `message`, `traceId`, `spanId`, `correlationId`, `event.name`, `http.route`, `http.method`, `http.status_code`, `duration_ms`. Khi có nghiệp vụ, thêm UUID cần thiết như bookingId/eventId nhưng không dùng làm metric label.

Không log password, Authorization/JWT, refresh/hold token, connection string, cookie, broker/SMTP credential, raw request body hoặc learningGoal/email nếu không cần. Error log có exception type/stack nội bộ, response không có stack.

## Trace

- Gateway tạo/nhận `traceparent`; service dùng ASP.NET/HttpClient/EF/Redis/Rabbit instrumentation.
- Span chính: `auth.login`, `tutor.search`, `scheduling.hold.create`, `scheduling.booking.confirm`, `outbox.publish`, `notification.consume`, `reminder.deliver`.
- Event mang traceparent/correlation/causation; consumer tạo consumer span link/parent đúng semantics.
- Sampling Development 100%; production-like head sampling 10% và always sample error/critical path khi backend hỗ trợ.

## Metrics và SLI

| Nhóm | Metric |
|---|---|
| HTTP RED | request count, error rate, duration histogram theo service/route/status class |
| Booking | hold create/conflict/expired, confirm success/conflict, DB exclusion violation |
| Outbox | pending count, oldest age, publish attempts/failures |
| RabbitMQ | queue ready/unacked, consumer count, redelivery, DLQ depth |
| Reminder | due/claimed/sent/failed, delivery latency |
| Dependencies | DB pool/wait/query, Redis latency/error/memory/eviction, Rabbit confirm latency |

Không label theo userId/bookingId/eventId/email. Baseline SLO demo: health >=99% trong buổi demo; booking confirm p95 <1s không tính cold start; outbox-to-notification p95 <10s; DLQ=0.

## Alert baseline

- Service readiness đỏ >2 phút; error rate >5%/5m; p95 vượt 2s/10m.
- Outbox oldest >60s hoặc pending tăng 10m.
- Rabbit consumer=0 >2m, DLQ>0, queue oldest >60s.
- Redis eviction >0/memory >80%; DB pool wait/deadlock/backup age quá ngưỡng.
- Alert phải có service, environment, dashboard và runbook link; không chứa secret/PII.

## Health semantics

`/health/live` chỉ process/deadlock cơ bản. `/health/ready` kiểm dependency cần để nhận traffic với timeout ngắn. Response public chỉ status; detail internal. Health probe không chạy query nặng và không tạo dữ liệu.

