# Baseline công nghệ

## Phiên bản chuẩn

| Thành phần | Baseline | Ghi chú |
|---|---:|---|
| .NET SDK / Runtime | 10.0 | Pin bằng `global.json`; container dùng tag 10.0 cụ thể. |
| ASP.NET Core / EF Core | 10.0 | Cùng major với runtime. |
| PostgreSQL | 17 | Dùng `btree_gist` cho exclusion constraint Scheduling. |
| Redis | 7.4 | Key TTL, Lua script; không dùng làm durable store. |
| RabbitMQ | 3.13 management | AMQP 5672, management 15672 chỉ mở dev. |
| YARP | Phiên bản tương thích .NET 10 | Pin trong central package management. |
| React | 19 | TypeScript, chỉ gọi Gateway. |
| Docker Compose | Compose Specification hiện hành | Không phụ thuộc `version:` cũ. |
| OpenTelemetry | Bản tương thích .NET 10 | OTLP exporter; console exporter ở dev. |
| Test | xUnit, FluentAssertions, Testcontainers | Integration test dùng container thật. |

## Quy ước solution

```text
TutorMatching.slnx
Directory.Build.props
Directory.Packages.props
global.json
src/
  Gateway/Gateway.Api/
  Services/<Service>/<Service>.Api/
  Services/<Service>/<Service>.Application/
  Services/<Service>/<Service>.Domain/
  Services/<Service>/<Service>.Infrastructure/
tests/
  <Service>.UnitTests/
  <Service>.IntegrationTests/
  ArchitectureTests/
deploy/compose/
docs/
```

Không tạo shared Domain/Entity/DbContext. Chỉ chia sẻ building blocks không chứa nghiệp vụ: `ProblemDetails`, correlation headers, event envelope primitives và test utilities. Mỗi shared package cần owner, version và kiểm thử tương thích.

## Chuẩn code và dữ liệu

- Nullable reference types, implicit usings, analyzers và warnings-as-errors trong CI.
- JSON camelCase; enum gửi dạng chuỗi; unknown enum phải bị validation từ chối.
- UUID v4 do application tạo; PostgreSQL kiểu `uuid`.
- Thời gian dùng `DateTimeOffset` ở boundary, `timestamptz` trong PostgreSQL, UTC `Z` trên wire.
- EF migration nằm trong Infrastructure của service sở hữu database.
- OpenAPI được sinh và diff trong CI; breaking change phải có ADR/version mới.
- Log là JSON structured; không log password, token, connection string, cookie hay PII không cần thiết.

## Môi trường

| Environment | Mục đích | Đặc điểm |
|---|---|---|
| Local | `dotnet run`, dependency bằng Compose | Host port được mở có chọn lọc. |
| Compose | Tích hợp và demo | Tất cả app chạy container; chỉ Gateway và UI public. |
| Test | Integration/CI | Database/broker cô lập qua Testcontainers; dữ liệu disposable. |
| Production-like | Hardening nâng cao | TLS ở reverse proxy, secret store, backup và observability thật. |

