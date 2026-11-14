# Tham chiếu cấu hình

## Quy tắc

`.NET` dùng key `Section__Property` trong environment. Giá trị secret không có default trong Git. Service fail fast khi thiếu URL/credential/key hoặc khi key placeholder/ngắn. `.env.example` chỉ tên và giá trị không nhạy cảm.

## Dùng chung cho app

| Biến | Required | Default dev | Owner |
|---|---:|---|---|
| `ASPNETCORE_ENVIRONMENT` | Có | `Development` | mỗi app |
| `ASPNETCORE_URLS` | Có | `http://+:8080` | mỗi app |
| `Jwt__Issuer` | Có | `tutormatching.identity` | Identity |
| `Jwt__Audience` | Có | `tutormatching.api` | Identity |
| `Jwt__SigningKey` | Có/secret | none | Identity/platform |
| `Jwt__AccessTokenMinutes` | Identity | `15` | Identity |
| `Jwt__RefreshTokenDays` | Identity | `7` | Identity |
| `Jwt__ClockSkewSeconds` | Có | `30` | Identity/platform |
| `OTEL_SERVICE_NAME` | Có | service name | service owner |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Khi collector | `http://otel-collector:4317` | platform |
| `Logging__LogLevel__Default` | Không | `Information` | platform |

## Connection string

| Service | Biến | Host/DB |
|---|---|---|
| Identity | `ConnectionStrings__IdentityDb` | `identity-db:5432/IdentityDb` |
| Tutor | `ConnectionStrings__TutorDb` | `tutor-db:5432/TutorDb` |
| Student | `ConnectionStrings__StudentDb` | `student-db:5432/StudentDb` |
| Scheduling | `ConnectionStrings__SchedulingDb` | `scheduling-db:5432/SchedulingDb` |
| Notification | `ConnectionStrings__NotificationDb` | `notification-db:5432/NotificationDb` |

Password qua `${*_DB_PASSWORD}` khi Compose xây connection string hoặc toàn connection `${*_DB_CONNECTION}`. Không log resolved value.

## Service-specific

### Identity

`PasswordHashing__IterationCount`, `Security__MaxLoginAttempts`, `Security__LoginWindowSeconds`, `Seed__Enabled=false`.

### Tutor

`Search__MaxPageSize=100`, `Availability__MaxRangeDays=31`, `InternalAuth__Audience=tutormatching-internal`, `InternalAuth__RequiredScope=tutor.validate-slot`.

### Student

`Services__SchedulingBaseUrl=http://scheduling-service:8080`, `Authorization__RelationshipCacheSeconds=30`, `Profiles__MaxInterests=20`, service auth credentials/secret.

### Scheduling

| Biến | Default |
|---|---|
| `Redis__ConnectionString` | `redis:6379` |
| `Redis__HoldTtlSeconds` | `300` |
| `Scheduling__SlotMinutes` | `60` |
| `Scheduling__GridMinutes` | `30` |
| `Scheduling__MaxHorizonDays` | `90` |
| `Services__TutorBaseUrl` | `http://tutor-service:8080` |
| `Services__StudentBaseUrl` | `http://student-service:8080` |
| `Outbox__BatchSize` | `100` |
| `Outbox__PollMilliseconds` | `500` |

### RabbitMQ shared

`RabbitMq__Host=rabbitmq`, `RabbitMq__Port=5672`, `RabbitMq__VirtualHost=/tutormatching`, `RabbitMq__Username`, `RabbitMq__Password`, `RabbitMq__Exchange=tutormatching.events`, `RabbitMq__Queue=notification.booking-events.v1`, `RabbitMq__Prefetch=20`.

### Notification

`Worker__PollSeconds=15`, `Worker__BatchSize=100`, `Worker__LeaseSeconds=120`, `Delivery__MaxAttempts=5`, `Smtp__Host=mailpit`, `Smtp__Port=1025`, SMTP credential khi production provider.

### Gateway

`Cors__AllowedOrigins__0=http://localhost:3000`, `Composition__MaxTutors=100`, `Composition__TimeoutSeconds=7`, rate-limit variables, `ReverseProxy__Clusters__<name>__Destinations__d1__Address` theo DNS table.

## Hạ tầng Compose secret

`IDENTITY_DB_PASSWORD`, `TUTOR_DB_PASSWORD`, `STUDENT_DB_PASSWORD`, `SCHEDULING_DB_PASSWORD`, `NOTIFICATION_DB_PASSWORD`, `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`, `RABBITMQ_APP_USER`, `RABBITMQ_APP_PASSWORD`, `JWT_SIGNING_KEY`.

## Validation startup

Mỗi section bind options với `ValidateDataAnnotations`, custom validation và `ValidateOnStart`. URL phải http/https hợp lệ; durations >0 và có upper bound; JWT key >=32 bytes; production environment từ chối Mailpit/no-auth endpoints và Development seed.

## Ví dụ `.env.example`

```dotenv
JWT_SIGNING_KEY=SET_OUTSIDE_GIT_MINIMUM_32_RANDOM_BYTES
IDENTITY_DB_PASSWORD=SET_OUTSIDE_GIT
TUTOR_DB_PASSWORD=SET_OUTSIDE_GIT
STUDENT_DB_PASSWORD=SET_OUTSIDE_GIT
SCHEDULING_DB_PASSWORD=SET_OUTSIDE_GIT
NOTIFICATION_DB_PASSWORD=SET_OUTSIDE_GIT
RABBITMQ_APP_USER=tutormatching_app
RABBITMQ_APP_PASSWORD=SET_OUTSIDE_GIT
```

Đây là placeholder, không dùng nguyên văn. Startup phải từ chối chuỗi bắt đầu `SET_OUTSIDE_GIT`.

