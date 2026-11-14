# Identity tập trung và JWT bất đối xứng

## Thiết kế và lý do

Chỉ Identity lưu tài khoản, password hash và refresh session. Tutor/Student có bảng hồ sơ nghiệp vụ tham chiếu UserId; đó không phải các bảng username/password xác thực độc lập. Tách dữ liệu hồ sơ không vi phạm Identity tập trung.

Trước đây các API dùng chung khóa HS256: một API bị lộ secret có thể ký JWT giả cho API khác. Cấu hình secure thay bằng **RS256**: Identity giữ RSA private key 3072 bit, mỗi API/Gateway chỉ nhận public key. Verify bằng public key không cho phép ký token.

| Thông số | Cấu hình thực tế |
|---|---|
| Thuật toán secure | RS256, pin `ValidAlgorithms` |
| Issuer / Audience | `tutormatching.identity` / `tutormatching.api` |
| Access / refresh | 15 phút / 7 ngày |
| Clock skew | 30 giây |
| `kid` | SHA-256 của public-key SPKI, base64url |
| Refresh storage | SHA-256 của token ngẫu nhiên 32 byte; không lưu bản raw |

Các profile Development/unit test cũ còn hỗ trợ HS256; `Jwt.RequireAsymmetric=true` và public-key file trong secure Docker làm cấu hình thiếu RSA thất bại ngay, không fallback HS256. Không chấp nhận HMAC dùng public PEM làm secret hoặc token `alg=none`.

## Luồng đăng nhập

1. Identity tra email chuẩn hóa, kiểm trạng thái và password hash bằng ASP.NET Core PasswordHasher.
2. Khóa row account khi cập nhật đăng nhập để hai request đồng thời không gây optimistic-concurrency error.
3. Phát access token có `sub`, `email`, `role`, `jti`, `sid`, `issued_ms`, issuer/audience/nbf/exp. `sid` là refresh-token family; `issued_ms` phục vụ cutoff thu hồi toàn người dùng.
4. Lưu refresh hash cùng family trong database; gửi token pair cho client.
5. Các API tự kiểm signature/issuer/audience/lifetime, sau đó kiểm revocation, role và owner.

Không đưa mật khẩu, token khác hay learning goal vào JWT. **JWT ký không mã hóa payload**; email và claims hiện đọc được nên cần coi là dữ liệu tối thiểu được công khai cho bên giữ token, không dùng làm kho thông tin nhạy cảm.

## Identity không đồng nghĩa SSO đầy đủ

Hiện là một dịch vụ Identity tự xây dựng cho ứng dụng này, không phải một OAuth2/OIDC provider đầy đủ: chưa có authorization-code + PKCE, discovery/JWKS chuẩn, consent, liên kết nhiều ứng dụng hoặc federated SSO. Không ghi “đã có SSO” trong báo cáo. Nếu nhiều ứng dụng hoặc login bên ngoài trở thành yêu cầu, tích hợp IdP chuẩn thay vì tự mở rộng protocol tùy ý.

Identity hiện một instance theo cấu hình đã thống nhất. Nó có thể trở thành điểm gián đoạn cho login/refresh. API không cần query mật khẩu mỗi request, nhưng kiểm revocation phụ thuộc Redis; vì vậy không mô tả authentication là hoàn toàn độc lập hạ tầng.

## Bằng chứng và vận hành khóa

- Code: `JwtOptions`, `JwtKeyMaterial`, `TokenService`, `ServiceDefaultsExtensions`.
- Test: `AsymmetricTokenTests` xác nhận public-key verification, wrong key và HS/RS confusion bị từ chối; `verify-security.mjs` sửa role trong JWT rồi kiểm 401 trên Docker.
- Key hiện load khi process khởi động; chưa có vòng current/previous key tự động. Đổi key cần rollout có kế hoạch và kiểm login/refresh. Không tuyên bố đã kiểm thử rotation không gián đoạn.
- Xem [quản lý secrets](secrets-and-operations.md) và [thu hồi phiên](token-revocation.md).
