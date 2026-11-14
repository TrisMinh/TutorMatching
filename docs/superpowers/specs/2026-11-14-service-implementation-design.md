# TutorMatching Service Implementation Design

## Intent

Biến bộ đặc tả hiện có thành một workspace .NET 10 chạy được, gồm Gateway và năm microservice có database riêng, Redis hold, RabbitMQ outbox/inbox, JWT, Docker Compose và kiểm thử tự động. Đồng thời biến danh mục PlantUML thành các trang Markdown chứa Mermaid để GitHub hiển thị trực tiếp.

## Goals

- Một solution duy nhất, source nằm trong `src/`, test trong `tests/`.
- Identity, Tutor, Student, Scheduling và Notification có API, persistence, health checks và OpenAPI riêng.
- Gateway là public entry point; service không đọc database của nhau.
- Booking dùng Redis hold 300 giây, PostgreSQL constraint là lớp bảo vệ cuối, event đi qua transactional outbox.
- Docker Compose khởi động toàn bộ data plane và application plane.
- Unit, integration và smoke test chứng minh các luồng chính.

## Non-goals

- UI React hoàn chỉnh, Kubernetes, cloud deployment và payment không thuộc lát cắt này.
- Không thêm pending tutor approval; booking xác nhận ngay từ hold hợp lệ.
- Không dùng shared database hoặc distributed transaction.

## Approach

Chọn vertical-slice microservices trong một monorepo. Mỗi service giữ Domain, Application và Infrastructure trong cùng project host để bản đầu dễ chạy, nhưng thư mục theo feature và interface vẫn giữ boundary để có thể tách assembly sau. Các contract dùng record riêng theo service; event integration dùng package `BuildingBlocks` nhỏ, không chia sẻ domain model.

Mermaid là định dạng hiển thị trực tiếp trong Markdown trên GitHub; PlantUML tiếp tục là nguồn sơ đồ chi tiết và được syntax-check. Năm trang Markdown phân nhóm Architecture, Domain, Data, Sequence và State/Infrastructure.

## API and data choices

- .NET 10 minimal APIs, EF Core 10, Npgsql 10, YARP, FluentValidation where request validation is non-trivial.
- JWT HS256 demo: issuer `tutormatching.identity`, audience `tutormatching.api`, access 15 phút, refresh 7 ngày.
- PostgreSQL 17 database-per-service; migrations nằm cùng service.
- Redis Lua atomic hold TTL 300 giây.
- RabbitMQ topic exchange, publisher confirms, manual consumer ACK, inbox idempotency.
- RFC 9457 Problem Details, UTC timestamps, UUID identifiers, `/health/live`, `/health/ready`.

## Verification

`dotnet restore`, `dotnet build`, `dotnet test`, Docker Compose config validation, migration/application startup, health probes và Postman/Newman smoke collection. Các test domain/application được viết trước implementation tương ứng.

