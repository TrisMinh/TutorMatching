# Redis

## Vai trò

Redis 7.4 chỉ dùng cho Scheduling hold TTL và, khi có đo đạc, idempotency/cache ngắn hạn. Confirmed Booking luôn ở PostgreSQL. Redis mất dữ liệu chỉ làm mất hold chưa xác nhận; không được làm mất/đổi booking.

## Keyspace

| Key | Value | TTL |
|---|---|---:|
| `sched:hold:v1:id:{holdId}` | JSON metadata + tokenHash | 300s |
| `sched:hold:v1:tutor:{tutorId}:{startEpoch}` | holdId | 300s |
| `sched:hold:v1:student:{studentId}:{startEpoch}` | holdId | 300s |
| `idem:v1:{userId}:{route}:{key}` | request hash + response | 24h khi endpoint hỗ trợ |
| `tutor-cache:v1:{...}` | read projection optional | <=60s |

Tất cả key bắt buộc version/prefix/TTL. Không dùng `KEYS` production; scan theo prefix khi chẩn đoán. Không đưa email/token raw vào key/value.

## Atomic hold Lua

Script create kiểm tất cả tutor/student keys có thể overlap trên grid 30 phút, rồi set lock+metadata với cùng TTL trong một atomic execution. Input đã parse/validate ở application; script vẫn từ chối nếu key tồn tại. Output code cố định: `OK`, `TUTOR_HELD`, `STUDENT_HELD`.

Script release nhận metadata key, expected holdId, owner userId và tokenHash; so sánh rồi xóa tất cả lock thuộc hold. Nếu mismatch trả `NOT_OWNER` và không xóa. Confirm commit trước release; TTL dọn cuối.

Script source được embed/resource, SHA load và fallback EVAL khi `NOSCRIPT`. Integration test chạy Redis thật, không mock semantics.

## Cấu hình

- `appendonly no` baseline vì hold ephemeral; RDB/AOF không cần cho correctness. Nếu shared cache có nhu cầu khác phải ADR.
- `maxmemory 256mb` local; policy `noeviction` để không âm thầm mất hold. Khi full, create hold lỗi 503/metric, không giả success.
- ACL user `scheduling_app` chỉ key patterns cần và commands GET/SET/DEL/PTTL/EVALSHA/EVAL/PING; disable/default password ở production-like.
- Private network; host port chỉ loopback debug; TLS nếu network không tin cậy.

## Client

Connection `redis:6379,abortConnect=false,connectTimeout=2000,syncTimeout=2000`; dùng multiplexer singleton, không tạo per request. Command timeout ngắn. Không blind retry Lua mutation nếu không xác định kết quả; script idempotent theo holdId giúp retry có kiểm soát.

## Failure behavior

- Redis unavailable/timeout/full: tạo hold trả 503 `SCHEDULING_HOLD_STORE_UNAVAILABLE` và readiness Scheduling đỏ; đọc/cancel confirmed booking vẫn có thể hoạt động theo endpoint policy.
- Sau Redis restart: old hold mất; client xác nhận nhận 409 expired và tạo hold mới. DB constraints vẫn ngăn conflict.
- Clock: TTL do Redis monotonic/server expiry; `expiresAtUtc` response là ước lượng từ application clock, không thay `PTTL` khi confirm.

## Quan sát và vận hành

Metrics: connected clients, memory/max, evicted/expired keys, command latency/errors, key count theo prefix (sample), rejected connections, Lua duration. Alert eviction >0, memory >80%, latency p95 >50ms, unavailable.

Debug an toàn:

```text
redis-cli -h 127.0.0.1 -p 6379 PING
redis-cli --scan --pattern 'sched:hold:v1:*' | head
redis-cli PTTL 'sched:hold:v1:id:<holdId>'
```

Không chạy `FLUSHALL/FLUSHDB` trừ local reset đã xác nhận target.

