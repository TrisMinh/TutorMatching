# Chiến lược kiểm thử

## Test pyramid

| Level | Công cụ | Phạm vi |
|---|---|---|
| Unit | xUnit, FluentAssertions | Domain invariant, Application orchestration với fake clock/interfaces |
| Architecture | NetArchTest/ArchUnitNET | Domain không phụ thuộc Infrastructure/API; service không reference chéo |
| Integration | Testcontainers PostgreSQL/Redis/RabbitMQ | EF migration/repository/constraint, Lua TTL, outbox, consumer |
| Contract | OpenAPI diff + schema fixtures | REST/event publisher-consumer compatibility |
| API | WebApplicationFactory + real dependencies | auth, validation, status/problem, ownership |
| E2E | Compose + Postman/Playwright/API runner | xuyên Gateway tới notification |
| Concurrency/resilience/security | custom parallel tests, fault/restart, scanners | race, retry, outage, OWASP |

## Quy tắc test

- Test độc lập, clock/UUID deterministic khi cần; không phụ thuộc thứ tự.
- Integration dùng container thật cho semantics; không dùng in-memory DB thay PostgreSQL constraint.
- Mỗi test tạo tenant/data UUID riêng hoặc reset schema an toàn; parallel có kiểm soát.
- Assertion bao gồm state, event/outbox, status/code và không có side effect thừa.

## Ma trận service

- Identity: email unique race, password, JWT parameters, refresh rotation/reuse/concurrent.
- Tutor: availability exclusion, owner/ETag, search/range.
- Student: profile invariant, owner, Tutor relationship fail-closed.
- Scheduling: Lua atomic/TTL/token; DB tutor/student exclusion; hold replay/expired/stolen; outbox atomic/restart.
- Notification: inbox duplicate, out-of-order, ACK after commit, SKIP LOCKED lease/retry/DLQ.
- Gateway: routing/header/CORS/rate/composition timeout/no N+1.

## Critical concurrency tests

Start 20 requests cùng barrier:

1. Same tutor/student/slot: tối đa 1 Booking row/outbox confirmed; response còn lại 200 idempotent hoặc 409.
2. Same tutor, different students overlapping 30 phút: 1 success.
3. Different tutors, same student overlapping: 1 success.
4. Adjacent slot: 2 success.
5. Concurrent refresh same token: 1 success, reuse policy đúng.
6. Two notification workers claim same due rows: mỗi reminder tối đa một provider idempotency key/effect.

## Resilience tests

- Kill Notification: booking 201, outbox/queue giữ, restart tạo notification.
- Rabbit down: booking commit/outbox pending; recover publish.
- Redis restart: hold mất/confirm 409, confirmed booking còn.
- DB restart: readiness đỏ, 503; reconnect sau recover.
- Publisher confirm timeout và consumer crash after DB commit/before ACK: duplicate không double effect.

## Security tests

401 matrix token; 403/404 BOLA; mass assignment; rate 429; CORS; body/page/range; injection/sort allow-list; SSRF URL; log secret scan; management endpoints exposure.

## Command CI đề xuất

```bash
dotnet restore --locked-mode
dotnet build --no-restore -warnaserror
dotnet test tests/*UnitTests --no-build
dotnet test tests/*IntegrationTests --no-build
postman collection run <collection-id-or-path> -e <environment> --bail
docker compose up -d && ./scripts/run-e2e
```

CI lưu TRX/coverage/OpenAPI/container logs khi fail. Merge gate: build/test/contract/security scan xanh; coverage chỉ là signal, không thay test chất lượng.

