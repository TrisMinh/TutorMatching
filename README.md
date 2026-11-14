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
`npm run build`. Khi Docker stack đang chạy, dùng `npm run test:e2e:live` để
kiểm tra đăng ký, đăng nhập, đăng xuất và route guard qua Gateway thật. Toàn bộ font, ảnh và SVG Figma được lưu cục bộ trong
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
./scripts/start-ha.ps1
docker compose -f compose.yaml -f compose.ha.yaml ps
postman collection run "postman/collections/TutorMatching Smoke"
```

Cấu hình trên chạy **3 instance Scheduling; Identity, Tutor, Student, Notification và Gateway mỗi loại 1 instance** (tổng 8 API/Gateway), điều phối và kiểm tra sức khỏe qua HAProxy. Xem [instance](docs/03-platform/instances-load-balancing.md) và [retry/rollback](docs/03-platform/retry-rollback-recovery.md). Bảng trạng thái: `http://localhost:8404/stats`. Secure deployment cần đủ ba file compose như mô tả bên dưới.

**Secure deployment hiện hành dùng ba file** `compose.yaml`, `compose.ha.yaml`, `compose.security.yaml`; `start-ha.ps1` đã xử lý cả PKI và broker provisioning, cần Python + cryptography. Frontend HTTPS: `https://localhost:3443`, API HTTPS: `https://localhost:8443`; HTTP cũ chỉ giữ trên loopback cho demo. Đọc [các chương Service Security](docs/04-security/README.md), [báo cáo instance](docs/03-platform/instances-load-balancing.md), [retry/rollback](docs/03-platform/retry-rollback-recovery.md) và [secure runbook](docs/05-operations/secure-docker-runbook.md). Khóa RSA được sinh riêng; JWT_SIGNING_KEY trong baseline không phải private key dùng bởi secure profile.

Sau khi các health check hoàn tất, mở giao diện tại `http://localhost:3000`.
Nginx chuyển tiếp `/api/*` tới Gateway nên frontend và API chạy cùng origin;
Gateway vẫn có thể truy cập trực tiếp tại `http://localhost:8080`.

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
