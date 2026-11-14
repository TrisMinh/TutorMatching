# JWT và phân quyền

## Thông số chuẩn

| Thuộc tính | Giá trị |
|---|---|
| Algorithm | HS256 cho demo |
| Issuer | `tutormatching.identity` |
| Audience | `tutormatching.api` |
| Access token | 15 phút |
| Refresh token | 7 ngày, opaque, rotate mỗi lần |
| Clock skew | 30 giây |
| Signing key | >=32 random bytes, environment/secret store |

Mọi Gateway/service cấu hình `ValidateIssuer=true`, `ValidateAudience=true`, `ValidateLifetime=true`, `ValidateIssuerSigningKey=true`, `RequireSignedTokens=true`, algorithm allow-list HS256. Không decode token rồi tin claim nếu signature chưa hợp lệ.

## Claims

| Claim | Ý nghĩa | Quy tắc |
|---|---|---|
| `sub` | User UUID | Bắt buộc; parse UUID; resource identity. |
| `role` | Student/Tutor/Admin | Bắt buộc; exact case policy. |
| `jti` | Token UUID | Audit/revocation extension. |
| `iss`,`aud`,`iat`,`nbf`,`exp` | JWT standard | Bắt buộc và validate. |

Email/profile không đưa vào access token baseline để tránh stale/PII. Không dùng client-supplied `userId` thay `sub`.

## Authorization model

1. **Authentication:** token hợp lệ -> ClaimsPrincipal.
2. **Role/policy:** endpoint yêu cầu Student/Tutor/Admin hoặc service scope.
3. **Resource authorization:** owner/participant được service sở hữu dữ liệu truy vấn bằng `sub`.
4. **Domain authorization:** action hợp lệ với trạng thái resource.

Gateway thực hiện 1-2 để giảm tải; service lặp 1-4. Internal network không bỏ auth.

## Policy chuẩn

- `StudentOnly`, `TutorOnly`, `AdminOnly`, `AuthenticatedUser`.
- `BookingParticipant`: Scheduling load Booking và so `studentUserId/tutorUserId` với `sub`, Admin chỉ khi endpoint ghi rõ.
- `ProfileOwner`: Tutor/Student map userId chính chủ.
- Service policy: audience `tutormatching-internal`, `client_id`, scope như `tutor.validate-slot`; tách signing/client credential nếu có thể.

## 401 và 403

- 401: thiếu/malformed/expired/wrong signature/issuer/audience; `WWW-Authenticate: Bearer`; không nói token sai phần nào cho attacker.
- 403: đã xác thực nhưng sai role/owner/action. Với resource dễ enumeration, endpoint có thể trả 404 nhất quán; quyết định ghi trong service spec.

## Refresh và logout

Access token stateless hết hạn tự nhiên. Refresh token lưu hash, rotate one-time, revoke family khi reuse. Logout revoke refresh session/family; access token hiện tại có thể còn tối đa 15 phút. Nếu cần revoke tức thì, thêm deny-list theo `jti` bằng ADR vì tăng dependency.

## Key rotation

HS256 baseline yêu cầu coordinated rotation: hỗ trợ `current` và `previous` key với key ID trong thời gian <= access token lifetime; phát token bằng current, validate cả hai, sau window bỏ previous. Không log/key commit. Production ưu tiên RS256/ES256 với JWKS và key ID.

## Kiểm thử

- Token hợp lệ ở Gateway và từng service.
- Wrong issuer/audience/signature/algorithm (`none`, RS/HS confusion), expired/not-before, clock skew boundary.
- Missing/duplicate/malformed sub/role.
- Student A đọc/hủy Booking B; Tutor sửa profile khác; Student gửi role Admin.
- Refresh concurrent/reuse/revoked/expired; key rotation window.

