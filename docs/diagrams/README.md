# Sơ đồ kiến trúc và kỹ thuật

Các trang Markdown dưới đây chứa Mermaid và hiển thị thành sơ đồ trực tiếp trên GitHub. Các tệp PlantUML là nguồn song song có độ chi tiết tương đương, dùng để kiểm tra cú pháp và xuất SVG khi cần. Tên component, database, route, event và state phải khớp giữa hai định dạng.

## Danh mục

| Nhóm | Sơ đồ hiển thị trong Markdown | PlantUML nguồn |
|---|---|---|
| Kiến trúc | [architecture.md](architecture.md) | `system-context`, `container-architecture`, `deployment-compose`, `ddd-context-map` |
| Domain | [domain.md](domain.md) | `identity-domain`, `tutor-domain`, `student-domain`, `scheduling-domain`, `notification-domain` |
| Dữ liệu | [data.md](data.md) | `database-erd` và 5 file `*-database-schema` |
| Tuần tự | [sequences.md](sequences.md) | `login-sequence`, `search-sequence`, `booking-sequence`, `cancel-sequence`, `notification-sequence` |
| Trạng thái và hạ tầng | [state-and-infrastructure.md](state-and-infrastructure.md) | `booking-state`, `rabbitmq-topology`, `redis-hold-flow`, `request-tracing` |

## Kiểm tra và xuất PlantUML

Nếu có PlantUML CLI:

```bash
plantuml -checkonly docs/diagrams/*.puml
plantuml -tsvg -o rendered docs/diagrams/*.puml
```

Hoặc Docker, pin version thay vì `latest` trong CI:

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace plantuml/plantuml:1.2025.4 \
  -checkonly docs/diagrams/*.puml
docker run --rm -v "$PWD:/workspace" -w /workspace plantuml/plantuml:1.2025.4 \
  -tsvg -o rendered docs/diagrams/*.puml
```

Output `rendered/` là artifact, không phải nguồn chỉnh sửa. CI phải fail khi syntax lỗi. Khi sửa tên route/event/port/schema, tìm toàn repo và cập nhật cả Markdown lẫn `.puml`.

Physical schema chi tiết:

- `identity-database-schema.puml`
- `tutor-database-schema.puml`
- `student-database-schema.puml`
- `scheduling-database-schema.puml`
- `notification-database-schema.puml`

