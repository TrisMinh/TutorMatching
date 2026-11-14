# Docker Compose

## Mục tiêu

Một lệnh dựng được UI, Gateway, 5 service và dependencies với healthcheck, volume, network, env rõ ràng. Compose dùng cho local/integration/demo, không phải production orchestrator.

## Cấu trúc file đề xuất

```text
deploy/compose/
  compose.yml                 core apps + dependencies
  compose.debug.yml           host ports, Mailpit UI, management UI
  .env.example                placeholder, không secret
  init/                       DB init chỉ local
```

Chạy từ repo root:

```bash
docker compose -f deploy/compose/compose.yml --env-file .env.local up --build -d
docker compose -f deploy/compose/compose.yml ps
docker compose -f deploy/compose/compose.yml logs -f gateway scheduling-service notification-service
```

## Service graph

```text
web -> gateway -> five services
identity-service -> identity-db
tutor-service -> tutor-db
student-service -> student-db
scheduling-service -> scheduling-db + redis + rabbitmq + tutor/student REST
notification-service -> notification-db + rabbitmq + mailpit
```

`depends_on: condition: service_healthy` chỉ hỗ trợ startup, không thay retry/reconnect. App phải chịu dependency restart.

## Pattern service app

```yaml
scheduling-service:
  build:
    context: ../..
    dockerfile: src/Services/Scheduling/Scheduling.Api/Dockerfile
  environment:
    ASPNETCORE_URLS: http://+:8080
    ConnectionStrings__SchedulingDb: ${SCHEDULING_DB_CONNECTION}
    Redis__ConnectionString: redis:6379
    RabbitMq__Host: rabbitmq
    RabbitMq__VirtualHost: /tutormatching
    RabbitMq__Username: ${RABBITMQ_APP_USER}
    RabbitMq__Password: ${RABBITMQ_APP_PASSWORD}
    Jwt__Issuer: tutormatching.identity
    Jwt__Audience: tutormatching.api
    Jwt__SigningKey: ${JWT_SIGNING_KEY}
  expose: ["8080"]
  networks: [backend, data]
  depends_on:
    scheduling-db: { condition: service_healthy }
    redis: { condition: service_healthy }
    rabbitmq: { condition: service_healthy }
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:8080/health/ready"]
    interval: 10s
    timeout: 3s
    retries: 10
    start_period: 20s
  restart: unless-stopped
  security_opt: ["no-new-privileges:true"]
```

Runtime Dockerfile cài `curl` tối thiểu và healthcheck dùng
`curl --fail --silent http://localhost:8080/health/ready`; image scan phải bao gồm
package này. Không giả định tool tồn tại nếu Dockerfile chưa cài.

## Dependency health

- PostgreSQL: `pg_isready -U <user> -d <db>`.
- Redis: `redis-cli ping` có auth nếu ACL.
- RabbitMQ: `rabbitmq-diagnostics -q ping` và `check_running`.
- Mailpit: HTTP health nếu image hỗ trợ.
- App: `/health/ready`; liveness dành orchestrator/diagnostic.

## Volume

Named volumes cho 5 DB và RabbitMQ. Redis không cần volume baseline. Source mount không dùng trong demo image; dev watch profile riêng. Backup output mount vào thư mục explicit ngoài volume.

## Startup và migration

Migration job per service chạy sau DB healthy và trước app, dùng cùng image với
command `dotnet <Service>.Api.dll --migrate`; exit 0 mới cho app start. Seed chỉ
Development flag. Không chạy 5 app tự migrate đồng thời.

## Profiles

- Default: public web/gateway; internal expose only.
- `debug`: publish service 8081-8085, DB 54321-54325, Redis/Rabbit/Mailpit/management loopback.
- `observability`: collector/dashboard nếu triển khai.

## Lệnh vận hành

```bash
docker compose up --build -d
docker compose ps
docker compose logs --since=10m <service>
docker compose restart notification-service
docker compose down
```

Không dùng `down -v`, `volume rm`, `system prune` trong quy trình thường. Reset dữ liệu là destructive, phải backup/confirm target và chỉ local.

## Definition of healthy demo

Gateway 8080 và Web 3000 reachable; 5 app readiness healthy; 5 DB, Redis, Rabbit healthy; queue declared; migrations current; seed dev idempotent; E2E register->availability->hold->confirm->notification pass sau restart Notification.

