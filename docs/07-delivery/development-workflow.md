# Quy trình phát triển

## Nhánh và PR

Nhánh `service/feature-short-name` hoặc `docs/...`; commit nhỏ, không commit secret/build output. PR mô tả behavior/contract/schema/config, test evidence, migration/rollback và ảnh hưởng owner khác. Ít nhất một reviewer; contract/event/gateway cần reviewer consumer/platform.

## Contract first

Trước code: cập nhật OpenAPI/event example, error codes, DB decision, auth matrix và test. Breaking change bị CI diff chặn. Publisher/consumer thay cùng PR hoặc compatibility window v1/v2.

## Local loop

1. Start dependency cần thiết bằng Compose profile.
2. Apply migration owner service; chạy service/test độc lập.
3. Unit -> integration -> API contract.
4. Build image, health, route qua Gateway.
5. Chạy vertical E2E và xem trace/log không lộ secret.

## CI stages

Format/analyzer/secret scan -> restore/build warnings-as-errors -> unit/architecture -> integration Testcontainers -> OpenAPI/event diff -> image/SBOM/vulnerability -> Compose E2E/security smoke -> artifact docs/test reports.

## Migration ownership

Chỉ service owner tạo/sửa migration. Không sửa migration đã deploy; tạo migration bù. PR nêu lock/duration/backfill/rollback. Migration job chạy trước app theo expand/contract.

## Review checklist

Boundary đúng; invariant ở Domain+DB; auth owner; timeout/idempotency; telemetry; config documented; test race/error; no PII/secret; docs/diagram cập nhật. Reviewer không approve chỉ vì happy path chạy.

