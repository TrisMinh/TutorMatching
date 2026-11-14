# TutorMatching

Nền tảng ghép cặp gia sư và học sinh theo khung giờ, thiết kế theo Microservices và Domain-Driven Design trên .NET 10.

## Tài liệu triển khai

Bắt đầu tại [Bộ tài liệu kỹ thuật](docs/README.md). Bộ tài liệu bao gồm:

- phạm vi, quyết định kiến trúc, DDD và contract dùng chung;
- đặc tả Identity, Tutor, Student, Scheduling và Notification;
- PostgreSQL, Redis, RabbitMQ, YARP, JWT, Docker Compose, cổng và biến môi trường;
- security, observability, runbook, backup/recovery, test và Postman;
- [24 sơ đồ Mermaid hiển thị trực tiếp trong Markdown](docs/diagrams/README.md),
  kèm nguồn PlantUML, cho kiến trúc, domain, physical database schema,
  sequence, state và hạ tầng.

Nguồn thiết kế ban đầu được lưu tại `docs/TutorMatching_BaoCaoThietKe_HoanThien.docx`. Tài liệu Markdown là baseline triển khai đã chốt; nếu khác nhau, ưu tiên các quyết định trong `docs/01-architecture/architecture-decisions.md`.

## Baseline

.NET 10, ASP.NET Core, EF Core, YARP, React, PostgreSQL 17, Redis 7.4, RabbitMQ 3.13 và Docker Compose. API public đi qua Gateway tại `http://localhost:8080`; Web tại `http://localhost:3000`.

## Chạy backend

Sao chép `.env.example` thành `.env`, thay `JWT_SIGNING_KEY`, rồi chạy:

```powershell
docker compose up --build -d
docker compose ps
postman collection run "postman/collections/TutorMatching Smoke"
```

Gateway public ở `http://localhost:8080`. RabbitMQ Management ở
`http://localhost:15672`, Mailpit ở `http://localhost:8025`. Muốn mở cổng các
service và datastore chỉ trên loopback để debug:

```powershell
docker compose -f compose.yaml -f compose.debug.yaml up --build -d
```

Solution gồm Gateway và 5 service độc lập: Identity, Tutor, Student,
Scheduling, Notification. Mỗi service sở hữu PostgreSQL riêng; Scheduling dùng
Redis cho hold nguyên tử và outbox RabbitMQ; Notification consume idempotent và
gửi email qua SMTP.

## Kiểm thử cục bộ

```powershell
dotnet build TutorMatching.slnx
dotnet test TutorMatching.slnx --no-build
docker compose -f compose.yaml -f compose.debug.yaml config --quiet
postman collection lint "postman/collections/TutorMatching Smoke" --fail-severity warning
```

