# PostgreSQL

## Topology và quyền sở hữu

Baseline chạy 5 PostgreSQL container để minh họa database-per-service rõ ràng. Có thể dùng một server nhiều database ở môi trường tiết kiệm tài nguyên, nhưng database/user/connection/migration vẫn tách và cấm cross-database grant.

| Container | Database | Role owner/app | Volume |
|---|---|---|---|
| `identity-db` | `IdentityDb` | `identity_app` | `identity_db_data` |
| `tutor-db` | `TutorDb` | `tutor_app` | `tutor_db_data` |
| `student-db` | `StudentDb` | `student_app` | `student_db_data` |
| `scheduling-db` | `SchedulingDb` | `scheduling_app` | `scheduling_db_data` |
| `notification-db` | `NotificationDb` | `notification_app` | `notification_db_data` |

Tên PostgreSQL lowercase thực tế có thể là `identity_db`; connection string là nguồn chuẩn. Không dùng superuser từ application. Migration role có DDL privilege có thể tách khỏi runtime role production-like.

## Connection string

```text
Host=identity-db;Port=5432;Database=IdentityDb;Username=identity_app;Password=<secret>;Pooling=true;Minimum Pool Size=0;Maximum Pool Size=50;Timeout=5;Command Timeout=30;Application Name=identity-service;Include Error Detail=false
```

Mỗi service max pool 50 baseline; tổng pool phải nhỏ hơn `max_connections` sau khi tính replica/migration/admin. Request timeout phải ngắn hơn upstream timeout. Không bật `Include Error Detail` ngoài Development.

## Extension

- Scheduling/Tutor: `btree_gist` để exclusion constraint.
- `pg_trgm` chỉ khi Tutor fuzzy search được triển khai và đo cần thiết.
- UUID application-generated, không bắt buộc `pgcrypto`; nếu dùng `gen_random_uuid()` phải migration bật rõ.

## Migration

- EF Core migration ở service Infrastructure; tên gồm timestamp/ý nghĩa.
- CI tạo database rỗng, apply toàn bộ migration, chạy test; kiểm migration script.
- Runtime app không tự migrate khi start nhiều replica. Compose dùng one-shot `*-migrate` job trước app hoặc lệnh người vận hành.
- Expand/contract: thêm nullable/default safe -> deploy code dual-read/write -> backfill batch -> constraint/not-null -> xóa field ở release sau.
- Migration irreversible hoặc data transform cần backup, dry-run, duration/lock review và rollback plan.

## Constraint và concurrency

Invariant quan trọng phải có DB constraint: unique email/userId/eventId; check enum/range; exclusion booking/availability. Map SQLSTATE có chủ đích (`23505` unique, `23514` check, `23P01` exclusion) sang 409/422; không trả SQL message.

EF optimistic concurrency dùng `version` hoặc xmin có contract rõ; stale update trả 412. Transaction giữ ngắn, không gọi HTTP/Rabbit trong transaction.

## Health và tuning

Readiness `SELECT 1` với timeout 2 giây và pool riêng/nhẹ. Metrics: connections active/idle/wait, transaction duration, query latency, locks/deadlocks, DB size, checkpoint, replication/backup age. Slow query log threshold dev 500ms; production theo đo đạc, redaction parameter.

Autovacuum giữ mặc định ban đầu; index theo query thật. Chạy `EXPLAIN (ANALYZE, BUFFERS)` ở dữ liệu test đủ lớn trước tối ưu. Không tạo index trùng.

## Backup và restore

- Demo: `pg_dump -Fc` từng database hằng ngày/on-demand; lưu ngoài volume container, checksum và timestamp.
- Restore diễn tập vào database/container mới, apply ownership, chạy integrity/E2E read test.
- RPO demo 24h, RTO 2h; production cần policy mới.
- Redis hold không backup; Rabbit queue không thay PostgreSQL backup.

Lệnh mẫu nằm ở backup runbook; không đặt password trên command line/history, dùng `.pgpass`/environment an toàn tạm thời.

## Reset local

`docker compose down` giữ volume. `docker compose down -v` xóa toàn bộ dữ liệu và chỉ chạy khi người dùng chủ động muốn reset; trước đó liệt kê volume/backup. Seed lại bằng migration + development seeder idempotent.

