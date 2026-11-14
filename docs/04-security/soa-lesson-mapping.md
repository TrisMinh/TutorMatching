# Đối chiếu nội dung Service Security môn SOA

## Phần 1 — Bản chất kiến trúc và biên giới

Ba rủi ro phía sau Gateway là nghe lén/sửa thông điệp, giả danh caller và vượt quyền/di chuyển ngang. TutorMatching thêm TLS/mTLS, caller allowlist, RSA JWT và owner checks. Khi một service bị chiếm quyền, attacker vẫn có thể dùng quyền được cấp cho chính nó; không nói “mạng nội bộ an toàn tuyệt đối”. Xem [threat model](threat-model.md).

## Phần 2 — Authentication, Authorization, transport/message

### Tình huống 1: GET tài khoản/booking theo ID

JWT hợp lệ hoàn thành authentication, chưa đủ authorization. Alice đổi ID Bob gây BOLA nếu service không kiểm owner. Trong dự án: query booking gắn `sub` với StudentUserId/TutorUserId, thông báo gắn recipient, course gắn tutor owner; test user khác nhận 404/403. Phải kiểm ở service đích, không chỉ ẩn nút UI.

### Tình huống 2: Transfer và không thể phủ nhận

TLS bảo vệ bí mật và toàn vẹn trên kết nối nếu xác thực certificate/key và protocol đúng. Nó không chứng minh người dùng chủ động phê duyệt đúng from/to/amount. Bài toán chối bỏ cần ràng buộc chữ ký của chủ thể với nội dung giao dịch, quản lý khóa/xác nhận, thời gian và chứng cứ được bảo quản tin cậy. Giá trị pháp lý còn phụ thuộc quy trình và pháp luật; không tự suy từ có chữ ký kỹ thuật.

Dự án chưa có Transfer/payment và chưa ký bằng khóa người dùng. Chữ ký event hiện là của Scheduling: dùng cho source authenticity/integrity giữa service, **không** gắn nhãn non-repudiation của học sinh.

### Tình huống 3: Gateway/ESB trung gian

Gateway định tuyến L7 cần giải mã TLS tại nơi xử lý HTTP; L4 TLS passthrough không bắt buộc giải mã tại trạm đó. Dự án có cả hai: ingress HAProxy L7 terminate TLS, các pool nội bộ TCP passthrough giữ certificate caller end-to-end.

Quản trị viên/mã độc ở điểm terminate có thể thấy plaintext trong process. Message-level encryption như JWE/XML Encryption chỉ che nội dung khỏi trung gian **không có khóa giải mã**; XML/JSON signature bảo vệ nguồn/toàn vẹn, không tự mã hóa. WS-Security là bộ cơ chế cho SOAP, không phải yêu cầu bắt buộc đổi REST sang SOAP.

Chấp nhận overhead message-level để có bảo vệ xuyên nhiều hop, qua lưu trữ/queue và độc lập từng transport. Dự án áp chữ ký event qua broker, chưa áp encryption payload. Đích xử lý hoặc máy giữ khóa bị chiếm quyền vẫn là giới hạn.

## Phần 3 — Identity và token

### Tình huống 4: mỗi service tự có username/password

Làm phân mảnh danh tính, lặp chính sách xác thực/khôi phục/thu hồi và tăng coupling về credential. Dự án chỉ Identity có password; Tutor/Student giữ profile tham chiếu UserId. Đây là identity tập trung, chưa phải một OIDC/SSO provider đầy đủ. Identity tập trung cũng là mục tiêu tấn công/điểm gián đoạn; thiết kế availability và bảo vệ khóa vẫn cần.

### Tình huống 5: JWT

API xác minh chữ ký bằng public key đã tin cậy cùng issuer/audience/exp, nên không cần kiểm lại mật khẩu mỗi request. Payload JWT ký đọc được; signature không cản lập trình viên đưa secret vào payload, phải ngăn bằng thiết kế schema/review/test.

Thu hồi ngay: Redis lưu revoked family và cutoff user, mọi API kiểm sau signature. Admin disable và logout đã có kiểm thử. Đây là đánh đổi tính phi trạng thái thuần túy để có kiểm soát phiên tức thời; Redis lỗi thì fail closed. Chi tiết tại [revocation](token-revocation.md).

## Phần 4 — Giao tiếp và audit

### Tình huống 6: service/background gọi service

Service account là danh tính máy/workload, không phải dùng chung user người thật. HTTP nội bộ hiện dùng chứng thư workload với caller scope; các endpoint hiện có còn nhận ngữ cảnh JWT người dùng. Tác vụ nền outbox/consumer dùng tài khoản Scheduling/Notification riêng và mTLS tới RabbitMQ; không mượn JWT học sinh chạy background.

mTLS xác thực hai đầu kết nối, là nền tảng workload identity; authorization vẫn quyết định caller nào được làm gì. Không claim đã triển khai OAuth client-credentials hoặc SPIFFE nếu chưa có.

### Tình huống 7: log chứa password nhưng thiếu user/time

Vi phạm tối thiểu hóa dữ liệu, bảo vệ credential và khả năng truy vết. Audit của dự án có actor, UTC time, service/caller, action/target, outcome và trace, loại body/query/header chứa secret, bảo vệ chain bằng HMAC. Cần external immutable storage/quy trình evidence để nâng mức bảo đảm; file cục bộ không tự đủ giá trị pháp lý. Xem [audit](security-audit.md).

## Phân biệt với instance/retry

Ba Scheduling + load balancing hỗ trợ availability; idempotency/outbox/rollback hỗ trợ tính đúng khi lỗi. Chúng không thay JWT, mTLS, authorization, revocation hoặc audit. Hai nhóm được viết thành [các chương platform riêng](../03-platform/instances-load-balancing.md).
