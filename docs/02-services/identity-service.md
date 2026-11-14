# Identity Service

## Trách nhiệm và ranh giới

Identity quản lý account, credential, role, email verification ở mức chuẩn bị, access token và refresh-token rotation. Service không lưu Tutor/Student profile, subject, booking hoặc notification. `userId` trong JWT là định danh xuyên hệ thống.

## Cấu trúc project

```text
Identity.Api          Controllers, auth middleware, DTO, health
Identity.Application Register/Login/Refresh/Revoke/GetMe use cases
Identity.Domain      UserAccount, RefreshSession, EmailAddress, Role
Identity.Infrastructure EF Core, password hasher, JWT signer, repositories
```

Domain không tham chiếu ASP.NET Core, EF Core hoặc JWT library. Application dùng `IUserRepository`, `IPasswordHasher`, `ITokenIssuer`, `IUnitOfWork`, `IClock`.

## Mô hình miền

### UserAccount

- `Id`, `Email`, `NormalizedEmail`, `PasswordHash`, `Role`, `Status`, `CreatedAtUtc`, `UpdatedAtUtc`, `LastLoginAtUtc`, `Version`.
- `Register`: chỉ Student/Tutor; Admin được seed/admin command riêng.
- `VerifyPassword`: dùng ASP.NET Core `PasswordHasher` IdentityV3,
  PBKDF2-HMAC-SHA512, `IterationCount=210000`; không phân biệt lỗi email và mật
  khẩu ở response; rehash-on-login khi policy tăng.
- `Disable/Enable`: disabled account không login/refresh.
- `ChangeRole`: chỉ admin flow; không có trong profile DTO.

### RefreshSession

- Mỗi refresh token là 256-bit random opaque value; DB chỉ lưu SHA-256 hash.
- Có `FamilyId`, `ReplacedByTokenId`, `RevokedAtUtc`, `ExpiresAtUtc`.
- Refresh hợp lệ sẽ revoke token cũ và tạo token mới trong cùng transaction.
- Phát hiện token cũ bị reuse: revoke toàn family, trả 401 và audit event.

## Cơ sở dữ liệu IdentityDb

| Bảng/cột | Kiểu/constraint |
|---|---|
| `user_accounts.id` | `uuid` PK |
| `email` | `varchar(320)` original display |
| `normalized_email` | `varchar(320)` unique, not null |
| `password_hash` | `text` not null |
| `role` | `varchar(20)` check Student/Tutor/Admin |
| `status` | `varchar(20)` check Active/Disabled |
| timestamps | `timestamptz`, not null |
| `version` | `integer`, optimistic concurrency |
| `refresh_sessions.id` | `uuid` PK |
| `user_id` | FK nội bộ -> user_accounts, index |
| `token_hash` | `char(64)` unique |
| `family_id` | `uuid`, index |
| expiry/revoke/replace | `timestamptz`, `uuid` nullable |
| `security_audit_events` | id, user_id nullable, event_type, ip_hash, user_agent_hash, occurred_at |

Index: unique normalized email; `(user_id, expires_at_utc)`; `(family_id, revoked_at_utc)`. Không lưu raw refresh token, access token hoặc IP nguyên bản nếu không có policy.

## API `/api/v1/auth`

### POST `/register` Anonymous

```json
{ "email": "student@example.com", "password": "correct horse battery staple", "role": "Student" }
```

201 trả `{ "userId", "email", "role" }`. Validation: email hợp lệ; password 12-128 ký tự và không nằm trong breached/common-password list nếu tích hợp; role chỉ Student/Tutor. Email trùng trả 409 `IDENTITY_EMAIL_EXISTS`. Không tự tạo profile; frontend gọi service tương ứng sau đăng ký hoặc workflow orchestration riêng.

### POST `/login` Anonymous

Request `{ "email", "password" }`. 200:

```json
{
  "accessToken": "jwt",
  "accessTokenExpiresAtUtc": "2026-11-14T03:15:00Z",
  "refreshToken": "opaque-secret",
  "refreshTokenExpiresAtUtc": "2026-11-21T03:00:00Z",
  "tokenType": "Bearer"
}
```

Sai credential/disabled trả 401 cùng `IDENTITY_INVALID_CREDENTIALS`. Rate limit theo IP+normalized email; log không chứa password/token.

### POST `/refresh` Anonymous với refresh token

Request `{ "refreshToken": "..." }`; rotate một lần. Token expired/revoked/reused trả 401. Hai request song song: transaction/row lock cho phép đúng một request thành công.

### POST `/revoke` Authenticated

Revoke current refresh token hoặc family; 204 và idempotent.

### GET `/me` Authenticated

Trả `{ "userId", "email", "role", "status" }`; không trả hash/session.

## JWT

- HS256, secret >= 32 random bytes; issuer `tutormatching.identity`; audience `tutormatching.api`.
- Access token 15 phút; refresh 7 ngày; clock skew 30 giây.
- Claims: `sub=userId`, `role`, `jti`, `iss`, `aud`, `iat`, `nbf`, `exp`; không đưa email nếu không cần.
- Key từ `Jwt__SigningKey`; production-like dùng secret store và quy trình rotation. Chi tiết tại [JWT](../04-security/jwt-and-authorization.md).

## Phân quyền

| Action | Anonymous | Student/Tutor/Admin | Điều kiện |
|---|---:|---:|---|
| Register/Login/Refresh | Có | Có | Rate limited; refresh cần secret hợp lệ. |
| Me/Revoke | Không | Có | `sub` phải tồn tại và Active. |
| Admin account management | Không | Admin | Endpoint riêng khi triển khai; audit bắt buộc. |

## Biến môi trường

`ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_URLS`, `ConnectionStrings__IdentityDb`,
`Jwt__Issuer`, `Jwt__Audience`, `Jwt__SigningKey`,
`Jwt__AccessTokenMinutes=15`, `Jwt__RefreshTokenDays=7`,
`Jwt__ClockSkewSeconds=30`, `PasswordHashing__IterationCount=210000`,
`OTEL_EXPORTER_OTLP_ENDPOINT`.

## Migration và seed

Migration đầu tạo three tables/index/check constraints. Seed Development tạo một account mỗi role bằng password từ secret/dev setup, không hard-code trong migration. Migration command: `dotnet ef database update --project Identity.Infrastructure --startup-project Identity.Api`.

## Health

- `/health/live`: process và DI cơ bản, không gọi DB.
- `/health/ready`: `SELECT 1` IdentityDb và kiểm signing key cấu hình hợp lệ; không tạo token.

## Kiểm thử bắt buộc

- Unit: normalize email, role guard, disabled account, refresh state transitions.
- Integration: unique email race; login success/failure; refresh rotation và reuse; concurrent refresh chỉ một success; DB migration.
- API/security: token issuer/audience/signature/expiry; missing token 401; role claim tamper; mass assignment không đổi role; login rate limit 429.
- Không assertion trực tiếp vào hash format ngoài verify API để cho phép nâng algorithm.

