# Backup và khôi phục

## Mục tiêu baseline

RPO 24 giờ, RTO 2 giờ cho demo/project. Backup từng PostgreSQL database ở format custom, mã hóa/lưu ngoài Docker volume, checksum và manifest. RabbitMQ definitions được source-control; message durable không thay backup. Redis hold không backup.

## Backup

Cho từng DB: chạy `pg_dump -Fc --no-owner --no-acl`, ghi file `<db>-YYYYMMDD-HHMM.dump`, SHA-256, PostgreSQL version, migration version, service commit, timestamp UTC. Credential qua `.pgpass`/secret environment tạm, không command argument/log.

Lưu tối thiểu 7 daily copies demo và kiểm file non-empty/checksum. Backup Notification/Identity chứa PII/credential hash phải hạn chế access và mã hóa at rest.

## Restore rehearsal

1. Tạo PostgreSQL container/database mới đúng major, role mới.
2. Xác minh checksum; `pg_restore --clean` chỉ vào database test đã xác nhận, hoặc restore database rỗng.
3. Apply migration còn thiếu chỉ khi backup version cũ và procedure đã test.
4. Chạy integrity: table counts/sampling, constraint/index, no pending invalid migration.
5. Khởi động service trỏ DB restore cô lập; smoke read/domain test.
6. Scheduling: kiểm booking/outbox; unpublished outbox được publish, duplicate consumer an toàn.
7. Ghi thời gian và kết quả RPO/RTO.

## Khôi phục hệ thống

Restore các DB về mốc gần nhau nếu có thể. Không giả định distributed snapshot; đối soát external IDs và event lag. Identity restore cũ có thể hồi refresh session đã revoke: cân nhắc revoke toàn session hoặc rotate key theo incident severity. Notification có thể replay event từ Scheduling/outbox nếu retained.

## Kiểm soát destructive

Trước `pg_restore --clean`, drop DB/volume hoặc `compose down -v`: in/ghi rõ absolute environment, database/container/volume, backup path/checksum và người phê duyệt; target production-like phải có change record. Ưu tiên restore vào mới rồi cutover, không overwrite tại chỗ.

