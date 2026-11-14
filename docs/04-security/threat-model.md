# Threat model và biên giới bảo vệ

## Tài sản cần bảo vệ

Mật khẩu/hash, access/refresh/hold token, private key, hồ sơ học sinh, lịch học, quyền sở hữu lớp, enrollment, trạng thái booking và tính tin cậy của thông báo. Audit log cũng là dữ liệu cần giới hạn quyền đọc vì chứa định danh và thời điểm hoạt động.

## Các biên giới

1. Trình duyệt → Nginx/HAProxy: dữ liệu ngoài hệ thống, không tin role/userId/header tự khai.
2. Gateway → API: vẫn là một biên giới bảo mật. Gateway không cấp quyền thay cho service sở hữu dữ liệu.
3. API → API: yêu cầu chứng thư workload hợp lệ và caller được phép, đồng thời giữ ngữ cảnh JWT người dùng cho các endpoint nội bộ hiện có.
4. API → PostgreSQL/Redis/RabbitMQ: có tài khoản và phạm vi quyền riêng; không dùng mạng nội bộ làm bằng chứng xác thực.
5. Broker/log/file/backup: dữ liệu tồn tại sau khi request đã kết thúc, cần kiểm soát quyền và khả năng sửa/replay.

## Rủi ro sau Gateway và biện pháp

| Rủi ro | Ví dụ TutorMatching | Control thực tế |
|---|---|---|
| Nghe lén/sửa request nội bộ | Lấy JWT hoặc thay userId khi Scheduling gọi Student | TLS có kiểm CA, hostname và danh tính server; mTLS client |
| Giả mạo service | Container lạ gọi `/internal/v1/students/by-user/{id}` | Kestrel yêu cầu cert; endpoint chỉ chấp nhận caller Scheduling |
| Vượt quyền tài nguyên | Student A đổi bookingId thành của B | Scheduling query theo ID **và** người tham gia từ `sub` |
| Di chuyển ngang | Tutor bị chiếm quyền dùng khóa JWT chung giả Admin | Identity giữ RSA private key; API khác chỉ có public key |
| Lạm dụng cache | Gateway sửa hold hoặc xóa thu hồi phiên | ACL Redis theo username, key pattern và quyền đọc/ghi |
| Giả/sửa/replay event | Thay StudentUserId trong event qua broker | RSA-PSS signature, publisher permissions, inbox event ID |
| Mất truy vết/lộ secret qua log | Log request body chứa refreshToken | Audit metadata allowlist, HMAC chain, không ghi body/query/header |

## Khi một service bị chiếm quyền

Attacker có thể đọc dữ liệu, credential và private material **được cấp cho chính service đó**, dùng các quyền caller của nó, đánh cắp JWT đang đi qua process hoặc gây DoS. mTLS không làm process đã bị chiếm quyền trở nên đáng tin. Thiết kế hiện tại giảm phạm vi lan truyền: không có JWT private key trong Tutor/Student/Scheduling/Notification/Gateway; không có CA private key trong container; broker/cache có quyền riêng.

Hạn chế còn lại: API đang chung các mạng Docker; PostgreSQL chưa có network policy riêng cho từng cặp API/DB và chưa TLS. Người có quyền Docker/host có thể đọc volume và secrets, thay container hoặc lấy khóa. Đây không phải sandbox chống host administrator.

## Các giả định để báo cáo đúng

- Host và nơi giữ CA/private key được bảo vệ; đồng hồ UTC đồng bộ.
- Local CA và cert 90 ngày dành cho demo, chưa có hệ thống tự cấp/thu hồi chứng thư production.
- Không có payment/Core Banking trong domain hiện tại. Các ví dụ chuyển tiền được đối chiếu về kiến trúc, không tuyên bố đã triển khai ngân hàng hay tuân thủ pháp lý.
