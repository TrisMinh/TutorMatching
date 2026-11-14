# HTTPS, mTLS và danh tính service

## Đường đi trong secure Docker

Trình duyệt → HTTPS Nginx `3443` → HTTPS HAProxy `8443` → mTLS Gateway `8443` → các pool TCP nội bộ → mTLS API `8443`. HttpClient trong Gateway/Tutor/Scheduling dùng chứng thư riêng của service và giữ JWT người dùng khi nghiệp vụ cần.

Các pool nội bộ **TLS passthrough**: HAProxy cân bằng kết nối TCP, không giải mã/chuyển chứng thư caller thành một header có thể giả. API nhận chứng thư thực sự của Gateway/Tutor/Scheduling qua TLS handshake. Ingress là tầng HTTP nên giải mã request để định tuyến rồi tạo kết nối TLS mới tới Gateway.

## Một chiều và hai chiều

- HTTPS một chiều: client xác thực server bằng CA, hostname và thời hạn cert; server không nhất thiết biết danh tính máy gọi.
- mTLS: server còn yêu cầu và xác minh chứng thư client. Cả hai phía phải có private key tương ứng; copy public cert không đủ.
- Sau mTLS vẫn cần authorization: một chứng thư hợp lệ không có quyền gọi mọi endpoint. `RequireServiceCaller` áp danh tính workload theo CN của leaf cert do local CA cấp, cộng JWT đã xác thực.

## Kiểm tra thực tế

Kestrel dùng TLS 1.2/1.3, yêu cầu client certificate, dựng chain tới CA được cấu hình riêng và kiểm EKU client authentication. Outbound HttpClient kiểm hostname, chain CA, EKU server authentication và CN server mong đợi. Không dùng callback `return true`, không tắt kiểm certificate để vượt lỗi.

| Endpoint nội bộ | Caller được phép |
|---|---|
| Student `/internal/v1/students/by-user/{userId}` | scheduling |
| Tutor `/internal/v1/tutors/{id}/availability` | scheduling |
| Scheduling `/internal/v1/slots/query` | gateway |

Caller identity không đọc từ `X-Service-Identity` hay `X-Client-Cert`. Ingress xóa các header này và chặn đường dẫn internal. Test cố giả header Scheduling bằng cert Gateway vẫn bị 403.

## Health và cổng

- API HTTP `8080` chỉ cho health probes; request nghiệp vụ qua HTTP bị 426. Điều này không mở một API nội bộ HTTP song song để bypass mTLS.
- HTTP ingress `127.0.0.1:8080` và frontend `127.0.0.1:3000` là ngoại lệ tương thích demo localhost, chưa bị loại. Luồng từ proxy tới API vẫn mTLS.
- HTTPS frontend/API dùng `3443/8443`; stats `8404` chỉ loopback. Không có ý nghĩa “mọi cổng 8080 ở mọi vị trí đều như nhau”.

## Mô hình chứng thư và giới hạn

Local CA RSA 3072 bit, leaf cert RSA 2048 bit có hiệu lực 90 ngày. Ba Scheduling dùng cùng logical service identity và cert, không phải ba SPIFFE identity riêng. CA private key chỉ ở host, không mount vào container; mỗi workload chỉ có leaf private key của mình. Docker administrator vẫn có thể đọc host/volume.

Hiện chưa có CRL/OCSP, auto-renew hay service mesh. Việc nghi lộ leaf key cần cô lập workload, đổi khóa/cert và triển khai lại trust phù hợp; không tuyên bố thu hồi certificate tức thời đã được tự động hóa. Script không tự cài CA vào trust store Windows. Trình duyệt chưa tin CA sẽ cảnh báo; cần thiết lập trust có kiểm soát hoặc dùng CA được tin cậy khi triển khai thật.

TLS bảo vệ từng kết nối; dữ liệu có thể xuất hiện dạng plaintext trong bộ nhớ Gateway/đích xử lý. Xem [message-level security](messaging-security.md) để phân biệt với chữ ký/encryption từng thông điệp.
