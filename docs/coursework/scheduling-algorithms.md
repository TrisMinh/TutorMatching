# Thuật toán lập lịch và ràng buộc thời gian

## Biểu diễn thời gian

Lưu và trao đổi timestamp theo UTC; client/Gateway chuyển ngày theo timezone được chọn. Availability là khoảng có ngày cụ thể. Slot học dài 60 phút, giờ bắt đầu theo lưới 30 phút. Dùng khoảng nửa mở `[start, end)` để hai buổi 09:00–10:00 và 10:00–11:00 được phép sát nhau.

Hai khoảng A/B trùng khi `A.start < B.end && B.start < A.end`. Không dùng điều kiện chỉ so giờ bắt đầu hoặc coi hai endpoint bằng nhau là overlap.

## Tìm khoảng trống

Gateway SlotComposer nhận availability từ Tutor và booked slots từ Scheduling:

1. Cắt availability theo ngày UTC tương ứng timezone và cửa sổ truy vấn.
2. Làm tròn start lên mốc 00/30 phút nếu cần.
3. Sinh candidate 60 phút, tăng start mỗi 30 phút, không vượt end availability.
4. Loại candidate overlap booking đã Confirmed bằng công thức trên.
5. Distinct và sort tăng dần, gắn tên/profile Tutor rồi trả frontend.

Với C candidate và B booking, bước lọc hiện O(C×B). Có giới hạn page/range/batch nên phù hợp demo. Không gọi đây là interval tree; nếu tải lớn mới cân nhắc sweep-line/sorted interval hoặc indexed availability queries. Course conflict còn được kiểm tra ở flow đặt lịch phía service; kết quả search không phải cam kết slot còn trống đến lúc confirm.

## Giữ chỗ và xác nhận

Redis hold TTL 5 phút chứa user/tutor/slot, token hash và các lock key liên quan. Lua tạo các khóa theo một thao tác nguyên tử; hai người tranh cùng slot không đồng thời giữ được nó. Token raw chỉ trả cho người tạo; các lần xác nhận phải dùng cùng hold ID/token.

Confirm kiểm role Student, owner hold, thời hạn, token và availability/conflicts hiện hành. PostgreSQL transaction ghi booking và outbox cùng nhau. Database có exclusion constraint chống trùng theo Tutor và Student, không dựa hoàn toàn vào frontend hay Redis.

## Ba lớp chống đụng lịch

1. Kiểm tra nghiệp vụ trong Tutor/Scheduling đối với course/enrollment và booking của người liên quan.
2. Global Redis schedule-write lock phối hợp thao tác qua hai service, fail closed khi khóa bận/cache lỗi.
3. Transaction + ràng buộc PostgreSQL là lớp chốt chống confirmed booking overlap khi có cạnh tranh.

Không “dịch giờ” một booking đã đăng ký để tránh đụng độ. Lịch thật bị trùng phải từ chối bằng conflict và yêu cầu chọn giờ khác; cách bố trí card trên UI chỉ là trình bày.

## Retry và lỗi

Nếu commit xong nhưng mất response, replay cùng proof trả đúng booking đã có; owner/token sai vẫn bị từ chối. Lỗi trước commit rollback cả booking/outbox. Hold expired không tự biến thành booking. Hủy booking kiểm participant và trạng thái; lặp lệnh hủy là idempotent.

Khóa global TTL 2 phút/request timeout 45 giây; process chết khi đang giữ khóa có thể tạm chặn ghi đến khi TTL hết. Xem [recovery](../03-platform/retry-rollback-recovery.md) để trình bày giới hạn thay vì hứa failover tức thời.
