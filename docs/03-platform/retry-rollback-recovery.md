# Retry, rollback và phục hồi tiến trình

## Retry có chọn lọc

Frontend `resilientFetch`: tối đa 3 lần, timeout 5 giây/lần, ngân sách tổng 12 giây gồm đọc body. Exponential backoff có jitter, tôn trọng Retry-After nếu còn ngân sách. User cancellation dừng retry.

| Thao tác | Retry | Điều kiện |
|---|---|---|
| GET/HEAD | có | Không tạo side effect nghiệp vụ |
| Confirm booking | có | Giữ nguyên holdId/holdToken |
| Enroll course | có | Course + Student từ JWT, insert/notice idempotent |
| Cancel booking | có | Đúng participant; đã Cancelled trả kết quả ổn định |
| Mark-read | có | ID + owner, idempotent |
| Tạo account/hold, sửa profile/course | không mặc định | Không đoán mọi POST/PUT đều repeatable |

Network và 408/429/502/503/504 có thể retry trong allowlist. Quyền, validation, conflict nghiệp vụ không lặp mù quáng. HAProxy retry TCP connect failure, không tự phát lại request đã gửi nhưng chưa biết kết quả.

## Booking và rollback

1. Redis tạo hold với token ngẫu nhiên, hash và các khóa slot.
2. Scheduling kiểm owner, token, availability, conflict.
3. Một transaction PostgreSQL ghi **booking + outbox**.
4. Lỗi trước commit: rollback cả hai; không có booking thiếu event hoặc event thiếu booking.
5. Commit xong nhưng mất response: retry cùng hold/proof trả đúng booking đã tạo; vẫn kiểm owner/hash dù Redis đã xóa hold.
6. Redis cleanup lỗi sau commit được log, TTL dọn sau; không khiến client tưởng booking chưa được tạo.

Hủy booking lưu Cancelled và event trong cùng SaveChanges transaction của EF. Không xóa booking đã commit chỉ vì thông báo gửi chậm.

## Khóa ghi lịch xuyên service

Tutor course/enrollment và Scheduling booking dùng global Redis schedule-write lock, tránh hai snapshot cùng qua kiểm tra rồi ghi trùng. TTL 2 phút; request timeout 45 giây. Lock bận/Redis lỗi trả 503/Retry-After, conflict thật trả 409.

Process chết khi giữ khóa có thể chặn ghi đến lúc TTL hết. Đây là fail-closed để tránh double booking; không khẳng định luôn chuyển node và ghi ngay. Chưa có proof về renewal/fencing để giảm TTL an toàn.

## Outbox và consumer

Ba worker claim từng row bằng `FOR UPDATE SKIP LOCKED` trong transaction. Giữ lock qua publisher confirmation deadline 5 giây, rồi commit metadata. Session chết giải phóng lock; gửi thành công nhưng chưa commit có thể phát lại **cùng event ID**.

Backoff có jitter, tối đa 8 lỗi/event. Event exhausted vẫn unpublished để kiểm tra; sửa nguyên nhân rồi `node scripts/replay-outbox.mjs <event-uuid>`. Script chỉ reset event exhausted/chưa published, không tạo ID mới. Lỗi kết nối broker trước claim không đốt số lần của từng event.

Bản đồ án không ký event ở message level; broker và mạng Docker là hạ tầng demo nội bộ. Inbox + transaction chống duplicate; advisory lock theo booking và kiểm cancellation tránh reminder tái sinh khi event đến ngược thứ tự.

## Vì sao chưa thêm Saga?

Các flow đọc dependency nhưng mỗi lệnh chỉ ghi một database nghiệp vụ: TutorDb cho course/enrollment, SchedulingDb cho booking/outbox. Local transaction + outbox phù hợp. Khi có payment/hoàn tiền/giữ tài nguyên ở nhiều hệ thống độc lập mới thiết kế Saga state machine và compensation cụ thể; compensation không phải tự ý xóa bản ghi cũ.

## Bằng chứng

OutboxRecoveryTests dùng PostgreSQL tạm riêng kiểm rollback, SKIP LOCKED và backend session bị terminate. MultiInstanceRecoveryTests kiểm projector/worker cạnh tranh với email sender kiểm thử. HA_CHAOS kiểm hold/post-commit replay sau khi tắt node. SMTP vẫn có cửa sổ gửi-trước-commit gây email lặp; không có exactly-once ở kênh này.
