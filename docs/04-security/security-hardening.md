# Security hardening

> Đây là checklist mục tiêu, không phải mọi control đã hoàn thành. Trạng thái code/Docker và giới hạn: [Service Security](README.md), [bằng chứng kiểm thử](verification.md).

## Threat model ngắn

Tài sản chính: account/token, PII profile, booking integrity, availability, notification content và credentials hạ tầng. Entry points: Gateway/API, auth, uploaded/URL fields, AMQP messages, management UIs, container images và logs. Attacker gồm anonymous, authenticated user vượt quyền, compromised service/container và dependency supply chain.

## OWASP API controls

| Rủi ro | Control | Test |
|---|---|---|
| BOLA | Owner/participant query tại service; ID không phải quyền | Student A với Booking B -> 403/404 |
| Broken auth | Full JWT validation, short access, refresh rotation, rate limit | forged/expired/reuse -> 401 |
| Property authorization | DTO allow-list, không bind Entity | body role/status/userId không đổi state |
| Resource consumption | rate/page/range/body/timeout/concurrency limits | vượt ngưỡng -> 400/413/429 |
| Function authorization | explicit policies, deny by default | Student gọi Admin endpoint -> 403 |
| SSRF | URL allow-list hoặc chỉ lưu relative media ID; HttpClient base fixed | private/metadata URL bị từ chối |
| Misconfiguration | env-specific Swagger/management exposure, secure headers | production profile không public tools |
| Inventory | `/api/v1`, OpenAPI artifact, deprecation policy | route cũ không âm thầm tồn tại |
| Unsafe API consumption | timeout, schema validation, size limit, fail closed | malformed/huge downstream response |

## Input và database

- FluentValidation/API validation cho length/range/enum; Domain invariant; DB constraint là lớp cuối.
- EF parameterization; raw SQL chỉ parameterized và review. Không dùng user input làm table/order expression; sort allow-list.
- Chuẩn hóa email nhưng không “sanitize” text thành HTML; frontend encode output. Nếu hỗ trợ rich text, dùng sanitizer allow-list server-side.
- UUID không chống enumeration; authorization bắt buộc.

## HTTP hardening

- HTTPS ngoài local; HSTS production, redirect ở edge; TLS 1.2+.
- Headers: CSP cho frontend, `X-Content-Type-Options: nosniff`, frame deny/frame-ancestors, Referrer-Policy, Permissions-Policy.
- Không cache auth/PII response ở shared proxy; `Cache-Control: no-store` cho token.
- Swagger/OpenAPI UI chỉ Development hoặc Admin/private; health detail không public.

## Container và dependency

- Multi-stage build, runtime non-root, read-only filesystem khi có thể, drop capabilities, no Docker socket.
- Pin image/package version/digest, vulnerability scan và SBOM trong CI; update cadence.
- Không bake `.env`, source secret hoặc dev certificate vào image.
- Management UIs bind loopback/dev profile; database/Redis/RabbitMQ không public production.

## Logging và audit

Không log Authorization, JWT, refresh token, password, cookie, connection string, SMTP/Rabbit credential, raw hold token. Mask email/IP khi không cần. Security events: login failure aggregate, refresh reuse, account disable, admin action, repeated authorization failure, DLQ/poison. Log immutable enough cho demo, access hạn chế, retention theo policy.

## Abuse và availability

- Login delay/rate limit, generic credential error.
- Search range/page/candidate limits; batch endpoint <=100 IDs.
- Kestrel max request, request timeout, cancellation, DB command timeout/pool caps.
- Rabbit payload max, prefetch, retry hữu hạn, DLQ; no infinite requeue.
- Redis memory policy/ACL; key prefix và TTL bắt buộc.

## Security test gate

Static analyzer/warnings, dependency audit, secret scan, container scan, API authorization matrix, malicious inputs, rate limit, CORS, security headers. Critical/high issue chặn merge; exception cần owner, expiry và mitigation.

