# Authentication, Authorization và chống BOLA/IDOR

## Ba câu hỏi độc lập

1. **Bạn là ai?** JWT đã được xác minh mới tạo ClaimsPrincipal.
2. **Bạn có quyền gọi chức năng này không?** Student/Tutor/Admin hoặc caller workload phù hợp.
3. **Bạn có quyền với chính bản ghi này không?** So sánh `sub` với owner/participant/recipient trong database.

JWT hợp lệ không trả lời câu thứ ba. Tình huống Alice sửa `/accounts/{id}` thành tài khoản Bob là BOLA/IDOR nếu chỉ kiểm JWT. UUID khó đoán cũng không phải cơ chế phân quyền.

## Quy tắc đang thực hiện

| Tài nguyên/hành động | Điều kiện tại service |
|---|---|
| Đọc booking | `Id == bookingId` và `StudentUserId == sub || TutorUserId == sub` |
| Xem hồ sơ học sinh qua booking | Tutor role và booking thuộc TutorUserId hiện tại |
| Hủy booking | Người tham gia; reason hợp lệ; booking chưa bắt đầu nếu còn Confirmed |
| Xác nhận lại hold | Student role, đúng StudentUserId và token hash đã lưu |
| Sửa Tutor/Student profile | Profile được tìm bằng `sub`, không chọn userId tùy ý từ body |
| Sửa course | Tutor role và course thuộc tutor profile của caller |
| Enrollment | StudentUserId lấy từ JWT; giao dịch chống duplicate, đầy lớp, trùng lịch |
| Course library | Student chỉ thấy course đã đăng ký; Tutor chỉ thấy course mình dạy |
| Thông báo | RecipientUserId/TutorUserId của người dùng; mark-read cũng kiểm owner |
| Khóa account | Chỉ Admin, qua endpoint được khai báo rõ |

Đối với booking/hồ sơ liên quan, tài nguyên không thuộc caller được trả 404 để tránh xác nhận sự tồn tại. Một số hành động đã tìm bản ghi rồi kiểm quyền trả 403; không dùng khác biệt này làm bằng chứng rằng quyền đã được cấp.

## Phân quyền service nội bộ

Đường dẫn `/internal/` không tạo ra quyền bảo vệ tự động. Secure deployment chặn nó ở ingress, yêu cầu mTLS tại API và áp allowlist cho từng endpoint:

- Student profile lookup: chỉ Scheduling.
- Tutor availability validation: chỉ Scheduling.
- Scheduling slot batch query: chỉ Gateway.

Các endpoint này còn yêu cầu JWT người dùng hợp lệ. Danh tính người dùng và danh tính service không thay thế nhau. API công khai vẫn áp role/owner dù request đến từ một workload có chứng thư hợp lệ.

## Input và tính nhất quán

DTO tách khỏi entity; role Admin không được tạo qua public registration. Các lệnh ghi lịch dùng khóa và ràng buộc database để ngăn bypass bằng request đồng thời. Idempotency xử lý yêu cầu lặp, không cấp thêm quyền: replay booking vẫn phải kiểm owner và proof.

## Kiểm thử cho báo cáo

`verify-security.mjs`: Student gọi Tutor endpoint → 403; sửa role trong JWT → 401; Student B đọc booking của A → 404; user thường khóa account → 403. `verify-tutor-workflow.mjs`: owner/token sai khi confirm replay bị từ chối, user lạ không đọc/hủy booking. Xem [evidence](verification.md); các test này không thay cho audit mọi endpoint hoặc pentest độc lập.
