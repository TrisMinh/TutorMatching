# TutorMatching

Nền tảng ghép cặp gia sư và học sinh theo khung giờ, gồm React 19 frontend và
hệ thống microservices .NET 10 theo Domain-Driven Design.

## Frontend

UI Figma `MPcAyOhuvLXtl3yeUVNHpd` được triển khai tại
[`src/Web/TutorMatching.Web`](src/Web/TutorMatching.Web/README.md).

```powershell
cd src/Web/TutorMatching.Web
npm install
npm run dev
```

Kiểm tra frontend bằng `npm run test:run`, `npm run test:visual` và
`npm run build`. Toàn bộ font, ảnh và SVG Figma được lưu cục bộ trong
`public/assets/figma`.

## Backend và tài liệu kỹ thuật

Bắt đầu tại [Bộ tài liệu kỹ thuật](docs/README.md). Solution gồm Gateway và năm
service độc lập: Identity, Tutor, Student, Scheduling và Notification. Mỗi
service sở hữu PostgreSQL riêng; Scheduling dùng Redis cho booking hold và
outbox RabbitMQ; Notification consume idempotent và gửi email qua SMTP.

Baseline: .NET 10, ASP.NET Core, EF Core, YARP, PostgreSQL 17, Redis 7.4,
RabbitMQ 3.13 và Docker Compose. API public đi qua Gateway tại
`http://localhost:8080`.

Sao chép `.env.example` thành `.env`, thay `JWT_SIGNING_KEY`, rồi chạy:

```powershell
docker compose up --build -d
docker compose ps
postman collection run "postman/collections/TutorMatching Smoke"
```

Muốn mở cổng service và datastore trên loopback để debug:

```powershell
docker compose -f compose.yaml -f compose.debug.yaml up --build -d
```

## Kiểm thử backend

```powershell
dotnet build TutorMatching.slnx
dotnet test TutorMatching.slnx --no-build
docker compose -f compose.yaml -f compose.debug.yaml config --quiet
postman collection lint "postman/collections/TutorMatching Smoke" --fail-severity warning
```
