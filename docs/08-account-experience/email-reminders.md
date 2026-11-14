# Email reminder cho booking và course

## Người nhận và nội dung

`SmtpEmailSender` lấy email, trạng thái account và Settings từ Identity qua endpoint nội bộ có workload JWT. Không còn dựng email từ UUID. Trước SMTP, sender kiểm tra lịch còn tồn tại/active, người nhận đúng participant/enrollment và giờ bắt đầu còn ở tương lai. Email có tên khóa/loại buổi học, ngày giờ GMT+07 Vietnam và link dashboard theo vai trò.

Tắt EmailReminders hoặc disabled account làm reminder chuyển Cancelled, không đánh dấu Sent. Tắt in-app notifications độc lập với email. Email khôi phục mật khẩu không chịu opt-out reminder.

## Booking

BookingConfirmed được consume qua inbox/outbox như trước; hai participant có reminder OneHour. Due=start−1 giờ, hoặc ngay nếu đặt sát giờ. Sender đọc lại Scheduling trước gửi: booking bị hủy/đã bắt đầu thì bỏ qua. Không gửi nhắc quá khứ khi consumer xử lý backlog.

## Course

`CourseReminderSync` chạy trong Notification service, polling 30 giây, lấy session bắt đầu trong một giờ tới từ Tutor API nội bộ. Tutor trả recipient là instructor và học sinh enrolled; Notification không truy vấn chéo Tutor database. Nó tạo reminder CourseOneHour, dùng session UUID làm reference và unique(session,recipient,type) chống tạo trùng qua nhiều chu kỳ/replica. Metadata nguồn ghi processed_events trong cùng transaction với reminder.

Trước gửi, sender hỏi lại Tutor về session và recipient; enrollment không còn hoặc session bị xóa thì hủy reminder. Query discovery giới hạn 1.000 session/lần, phù hợp demo; production quy mô lớn cần pagination/event-driven discovery. Chưa hỗ trợ người dùng tự chọn nhiều mốc nhắc.

## Claim, retry và giới hạn

ReminderWorker polling 15 giây, claim từng hàng FOR UPDATE SKIP LOCKED và giữ transaction tới khi gửi SMTP có timeout 10 giây. Lỗi directory/source/SMTP dùng backoff, tối đa 5 lần rồi Failed; có delivery_attempts. Course discovery lỗi sẽ thử lại ở chu kỳ kế tiếp.

Độ trễ có thể gồm 30 giây discovery + 15 giây delivery + network/retry; không hard realtime. Khi toàn service ngừng tới sau giờ bắt đầu, không gửi email nhắc đã muộn. Nếu SMTP nhận email nhưng worker chết trước commit, có thể gửi trùng; không có exactly-once email. Mailpit chỉ nhận local, cần cấu hình SMTP thật để phát ra Internet.

## Kiểm chứng

`node scripts/verify-account-features.mjs` tạo lịch tương lai trên account fixture, đợi email qua SMTP/Mailpit, kiểm tra đúng người nhận booking/course, instructor và email opt-out. Không sửa giờ hệ thống hoặc ngày học demo để ép worker chạy.
