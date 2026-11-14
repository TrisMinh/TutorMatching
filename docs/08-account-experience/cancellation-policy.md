# Chính sách hủy booking

Tutor chọn số giờ báo trước **0, 6, 12, 24 hoặc 48** trong Settings, mặc định 12. Không có thanh toán/tiền phạt trong dự án, vì vậy chính sách là hạn được phép hủy, không phải cam kết hoàn tiền.

## Snapshot thay vì đọc lại chính sách hiện tại

Khi tạo Redis hold, Scheduling đọc policy từ Identity và lưu vào metadata hold (TTL 5 phút). Response hold có cancellationNoticeHours/cancellationDeadlineUtc để frontend hiển thị trước xác nhận. Confirm lấy policy từ hold và ghi vào booking. Đổi policy trong lúc giữ chỗ hoặc sau khi đặt không thay đổi cam kết đã hiển thị.

Booking cũ được migration thêm mặc định 12 giờ, khớp nội dung policy đã có trên UI. Thời điểm deadline = StartAtUtc − CancellationNoticeHours. Thời gian lưu và so sánh ở UTC; UI ghi rõ múi giờ khi trình bày.

## Quy tắc backend

- Chỉ Student/Tutor là participant mới được hủy; user khác 403.
- Student được hủy đến hết deadline; sau deadline 409 và booking/outbox không đổi.
- Tutor có thể hủy trước khi buổi học bắt đầu, cần lý do và phát sự kiện thông báo cho hai bên.
- Buổi đã bắt đầu không được hủy bởi cả hai bên.
- Booking đã Cancelled trả thành công khi hủy lại bởi participant, không phát thêm sự kiện.
- Lý do bắt buộc 1–300 ký tự; cột database đã tăng lên 300 để validation khớp storage.

Hủy và outbox cùng SaveChanges transaction; notification consumer hủy reminder chưa gửi. SMTP đã chấp nhận email thì không thể thu hồi. Đây là policy booking 1–1; không giả định course enrollment có cùng thao tác hủy.

UI Student hiển thị policy/deadline của booking; nút hủy khóa khi deadline qua. Backend vẫn kiểm tra độc lập, không dựa vào đồng hồ trình duyệt. Chính sách không tự dịch giờ học khi có conflict.

## Kiểm tra

`verify-account-features.mjs` giữ slot khi policy=12, đổi Tutor policy về 0 trước confirm, xác nhận booking vẫn 12; Student hủy muộn bị từ chối, Tutor hủy được và lặp hủy không tạo trạng thái mới.
