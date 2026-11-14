# YARP API Gateway

## Trách nhiệm

Gateway là public API entry point: route/cluster, JWT edge validation, CORS, rate limit, header normalization, request size, trace/correlation, TLS termination khi triển khai và một search composition mỏng. Gateway không ghi database, không giữ refresh token, không quyết định conflict/ownership.

## Route và cluster

| Public match | Cluster | Destination nội bộ | Auth/rate policy |
|---|---|---|---|
| `/api/v1/auth/{**catch-all}` | identity | `http://identity-service:8080` | Anonymous/Auth; strict login/register limit |
| `/api/v1/tutors/{**catch-all}` | tutor | `http://tutor-service:8080` | JWT trừ public được quyết định; standard |
| `/api/v1/students/{**catch-all}` | student | `http://student-service:8080` | JWT; standard |
| `/api/v1/slots/{**catch-all}` | scheduling | `http://scheduling-service:8080` | Student; search limit |
| `/api/v1/bookings/{**catch-all}` | scheduling | same | JWT; mutation limit |
| `/api/v1/notifications/{**catch-all}` | notification | `http://notification-service:8080` | JWT; standard |
| `/api/v1/search/available-tutors` | local BFF | Tutor + Scheduling batch | Student; search limit |

YARP `AuthorizationPolicy` là defense-in-depth; downstream service áp policy thật. Destination health dùng `/health/ready`; passive + active health không thay Compose healthcheck.

## Transform và header

- Bỏ incoming `X-Forwarded-*`, `X-User-*`, `X-Internal-*`; Gateway tạo forwarded headers từ connection tin cậy.
- Forward `Authorization`, `traceparent`, `tracestate`, baggage allow-list, `X-Correlation-ID`, `Idempotency-Key`.
- Thêm `X-Forwarded-Proto/Host/For`; không thêm user identity header làm authorization source.
- Giới hạn body 1 MiB mặc định, auth 64 KiB; header total và request line theo Kestrel safe defaults.
- Response xóa `Server`, internal host/exception headers; Problem Details được passthrough.

## Timeout và retry

- Route proxy timeout 10 giây; composition mỗi dependency 5 giây, overall 7 giây.
- GET có thể retry 1 lần chỉ network/502/503/504 nếu chưa nhận response; mutation không retry.
- Request abort truyền cancellation downstream.
- Circuit breaker theo cluster; 503 `GATEWAY_DEPENDENCY_UNAVAILABLE`, có traceId, không biến lỗi thành empty result.

## Rate limiting

| Policy | Key | Giá trị baseline |
|---|---|---|
| Login | normalized IP + email hash | 5/phút, queue 0 |
| Register | IP | 3/10 phút |
| Search | user sub | 30/phút, burst 10 |
| Mutation | user sub + route | 20/phút |
| General | user sub hoặc IP | 120/phút |

Trả 429 + `Retry-After`; không log raw email. Distributed limit cần Redis và fail policy được ADR hóa; baseline single Gateway dùng built-in limiter cho demo.

## CORS

Development origins explicit `http://localhost:3000`; production origins từ `Cors__AllowedOrigins__N`. Chỉ methods/headers cần thiết. Không `AllowAnyOrigin` cùng credentials. Access token ưu tiên Authorization header; nếu refresh token chuyển cookie thì bắt buộc Secure, HttpOnly, SameSite và CSRF defense.

## Search composition

`GET /api/v1/search/available-tutors?subjectId=&date=YYYY-MM-DD&timezone=Asia/Ho_Chi_Minh&page=1&pageSize=20`

1. Validate timezone/date/range và JWT Student.
2. Gọi Tutor search để lấy tối đa 100 candidate/page.
3. Gọi Scheduling batch một lần với tutor IDs và UTC day boundaries.
4. Join theo tutorId, chỉ trả tutor có slot; response có `generatedAtUtc` và cảnh báo snapshot.

Không gọi Student. Không tạo hold. Nếu một dependency lỗi trả 503; nếu candidate riêng bị missing, trả diagnostic `partial=false` baseline thay vì partial data. Cache tối đa 15 giây chỉ GET và key gồm subject/date/page; không cache theo token nếu response cá nhân hóa.

## Health và observability

- `/health/live`: process.
- `/health/ready`: route config load; không bắt mọi downstream phải xanh để Gateway ready, nhưng cluster health metrics/endpoint nội bộ thể hiện từng service.
- Span `gateway.proxy`/`gateway.search.compose`, tag route/cluster/status không chứa ID nhạy cảm; metric request duration/count, rate-limit rejection, dependency latency, circuit state.

## Cấu hình tối thiểu

`ReverseProxy__Routes`, `ReverseProxy__Clusters`, `Jwt__Issuer`, `Jwt__Audience`, `Jwt__SigningKey`, `Cors__AllowedOrigins`, `RateLimit__*`, `ForwardedHeaders__KnownProxies`, `Composition__MaxTutors=100`, `Composition__TimeoutSeconds=7`, OTEL variables.

## Kiểm thử

- Route/transform/cluster contract; unknown route 404.
- JWT missing/invalid/expired 401; wrong role edge 403 nhưng downstream vẫn được test.
- Forged forwarded/user headers bị strip.
- CORS allowed/denied, preflight, body limit, 429/Retry-After.
- Composition batch không N+1; timeout/service 5xx -> 503; timezone day boundary; page max.

