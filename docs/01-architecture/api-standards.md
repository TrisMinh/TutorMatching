# Tiêu chuẩn REST API

## URL và version

- Public API: `/api/v1/<plural-resource>`; lowercase kebab-case cho segment nhiều từ.
- Internal API: `/internal/v1/...`, không expose qua Gateway.
- Health: `/health/live`, `/health/ready`; metrics `/metrics` chỉ private.
- Breaking change cần `/api/v2` hoặc compatibility window; thêm field optional là non-breaking.

## Header chuẩn

| Header | Hướng | Quy tắc |
|---|---|---|
| `Authorization: Bearer <jwt>` | Client -> API | Bắt buộc trừ anonymous route. |
| `traceparent`, `tracestate` | Cả hai | W3C trace propagation; không tự tạo format khác. |
| `X-Correlation-ID` | Cả hai | UUID; Gateway tạo nếu thiếu, service echo; không thay trace ID. |
| `Idempotency-Key` | Client -> mutation được chỉ định | UUID, scope theo user+route, lưu response 24 giờ nếu durable. |
| `If-Match` | Update có concurrency | ETag/version; mismatch trả 412. |

## JSON và thời gian

- `Content-Type: application/json`; UTF-8; camelCase; enum là string.
- UUID chuẩn lowercase có dấu gạch; timestamp UTC dạng `2026-11-14T02:00:00Z`.
- Không gửi money dạng float; nếu sau này có phí, dùng integer minor units + currency.
- Request body có giới hạn 1 MiB mặc định; field string có max length cụ thể.

## Pagination, filter, sort

Request: `?page=1&pageSize=20&sort=-createdAtUtc`; page bắt đầu 1; `pageSize` mặc định 20, tối đa 100. Filter được allow-list, không nhận tên column tùy ý.

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalItems": 0,
  "totalPages": 0
}
```

## Response và lỗi

- 200 đọc/update có body; 201 tạo và `Location`; 202 job async; 204 idempotent action không body.
- 400 syntax/validation; 401 không xác thực; 403 không đủ quyền/owner; 404 không tồn tại hoặc dùng để tránh enumeration khi quy định; 409 conflict; 412 concurrency; 422 semantic rule; 429 rate limit; 503 dependency unavailable.
- Lỗi theo RFC 9457 Problem Details:

```json
{
  "type": "https://docs.tutormatching.local/problems/slot-conflict",
  "title": "Slot is no longer available",
  "status": 409,
  "code": "SCHEDULING_SLOT_CONFLICT",
  "detail": "The tutor or student already has an overlapping booking.",
  "traceId": "00-...",
  "errors": { "startAtUtc": ["Must align to 00 or 30 minutes."] }
}
```

`detail` không lộ stack trace/SQL/secret. `code` ổn định để frontend xử lý; text có thể đổi.

## Validation và authorization

- API layer validate shape/range; Domain bảo vệ invariant; database bảo vệ uniqueness/concurrency.
- DTO dùng allow-list, không bind Entity; trim theo field, không tự thay đổi dữ liệu định danh âm thầm.
- Policy role chỉ là bước đầu; service owner luôn kiểm resource participant/owner.

## Idempotency

- `POST /bookings/confirm` yêu cầu hold token; xác nhận lặp trả booking đã tạo nếu cùng hold/user, 409 nếu payload khác.
- Cancel idempotent; notification event idempotent theo eventId.
- Không retry POST từ Gateway nếu không có cơ chế idempotency được endpoint công bố.

## OpenAPI

Mỗi service xuất `/openapi/v1.json` ở Development/Test. CI lưu artifact, lint và diff breaking change. Mọi operation có `operationId`, auth requirement, request/response example, error codes và pagination schema.

