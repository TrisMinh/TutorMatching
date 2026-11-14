# Reminder/Cron Service và tác vụ chạy nền

## Service độc lập

Notification API có database riêng, BookingEventConsumer và ReminderWorker. Nó chạy độc lập với Scheduling trong Compose. Worker là BackgroundService của .NET, không cần thêm một cron container chỉ để đủ tên gọi.

## Cách lập reminder

Scheduling commit booking/outbox; publisher đưa event BookingConfirmed lên RabbitMQ. Notification consumer apply inbox/projector trong transaction, tạo notification cho hai người tham gia và ReminderSchedule loại OneHour. Thời điểm dự kiến là startAtUtc − 1 giờ; nếu mốc đó đã qua thì đặt due ngay.

X trong đề hiện được chọn **1 giờ**. Chưa có UI/config tùy ý nhiều mốc, không ghi đã triển khai cả 24 giờ nếu code chỉ tạo OneHour.

## Vòng quét

Worker chạy mỗi 15 giây. Nó chọn reminder đến hạn, còn Pending hoặc Processing với lease hết hạn, và đến nextAttemptAtUtc. SQL `FOR UPDATE SKIP LOCKED` claim từng bản ghi; giữ transaction qua lần gửi có deadline 10 giây, sau đó lưu Sent/Failed và DeliveryAttempt.

Không claim hàng loạt rồi đợi quá lâu khiến lease hết hạn trước khi gửi. Có cơ chế cạnh tranh giữa nhiều worker, nhưng Compose hiện chạy Notification **1 instance** theo quy mô demo.

## Retry, hủy, xử lý trùng

- Gửi lỗi: tăng Attempts, backoff hữu hạn; tối đa 5 lần rồi Failed.
- Consumer dùng event ID/inbox để duplicate event không tạo thêm notification/reminder.
- Advisory lock theo booking và kiểm cancellation xử lý hai event Confirmed/Cancelled đến ngược thứ tự; confirmed đến muộn không tái sinh reminder đã hủy.
- Hủy không thu hồi email đã được SMTP chấp nhận. Crash sau SMTP accept nhưng trước commit có thể gửi email lặp; không hứa exactly-once cho hệ thống bên ngoài.

## Độ trễ và giới hạn demo

Polling 15 giây nghĩa là nhắc gần thời điểm due, có thêm độ trễ scheduler/SMTP/retry, không phải hard realtime. SMTP dùng Mailpit, không gửi email production; địa chỉ demo từ recipient ID. Không cần điện thoại/SMS/payment để đạt yêu cầu đề.

Khi chấm có thể xem ReminderSchedule/DeliveryAttempt ở database, queue/consumer ở RabbitMQ và email ở Mailpit. Unit tests kiểm idempotency, cancellation, reminder state; integration multi-worker dùng database tạm và email sender kiểm thử để kiểm mỗi reminder được claim đúng một lần.
