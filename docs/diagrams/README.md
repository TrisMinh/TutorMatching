# Sơ đồ PlantUML

Thư mục này là nguồn chuẩn cho sơ đồ kiến trúc. Tên component, database, route, event và state phải khớp tài liệu Markdown. `_style.puml` là palette dùng chung: nền sáng, xanh đậm, cam nhấn Scheduling/Core Domain; không dùng màu làm tín hiệu duy nhất.

## Danh mục

| Nhóm | File |
|---|---|
| Kiến trúc | `system-context`, `container-architecture`, `deployment-compose`, `ddd-context-map` |
| Domain | `identity-domain`, `tutor-domain`, `student-domain`, `scheduling-domain`, `notification-domain` |
| Dữ liệu | `database-erd` ownership overview; 5 file `*-database-schema` physical detail |
| Sequence | `login-sequence`, `search-sequence`, `booking-sequence`, `cancel-sequence`, `notification-sequence` |
| State/infra | `booking-state`, `rabbitmq-topology`, `redis-hold-flow`, `request-tracing` |

## Render

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

