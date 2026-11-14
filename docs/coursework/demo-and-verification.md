# Khởi chạy, kiểm thử và demo

## Chạy toàn bộ bằng Docker Compose

Yêu cầu Docker Desktop đang chạy Linux containers. Tại thư mục gốc:

```powershell
Copy-Item .env.example .env
# Đặt JWT_SIGNING_KEY trong .env thành khóa ngẫu nhiên đủ mạnh trước khi chạy.
./scripts/start-ha.ps1
```

Chỉ sao chép `.env` khi chưa tồn tại; không ghi đè cấu hình/password đang dùng của database cũ. Script tự tạo `.env` nếu thiếu, kiểm tra Compose và chạy:

```powershell
docker compose -f compose.yaml -f compose.ha.yaml up -d --build --wait --wait-timeout 240
docker compose -f compose.yaml -f compose.ha.yaml ps
```

Scheduling có 3 replica; Gateway và mỗi service còn lại có 1. `compose.yaml` đơn lẻ là cấu hình 1 replica để phát triển. Không cần PKI, chứng chỉ hay script cấp tài khoản cho bản đồ án.

Frontend: http://localhost:3000; Gateway: http://localhost:8080; HAProxy stats: http://localhost:8404. API service và datastore không publish cổng trực tiếp trong cấu hình demo. Không dùng `down -v` nếu cần giữ dữ liệu.

## Dữ liệu và luồng demo

Kho dữ liệu demo hiện có giữ nguyên các khóa mẫu và phiên học liên kết, không tạo lại lịch giả trên UI. Tài khoản seed: `student01@demo.tutormatching.test`, `tutor01@demo.tutormatching.test`; mật khẩu demo `TutorDemo!2026`. Chỉ dùng cho môi trường cục bộ. Nếu dùng volume mới, chạy seed theo [hướng dẫn dữ liệu](../../scripts/seed-demo.mjs); xem tên script thực tế trong thư mục scripts trước khi chạy.

1. Student tìm tutor theo khung giờ: Gateway ghép thông tin Tutor và booked slots của Scheduling.
2. Giữ slot rồi xác nhận booking. Hai request tranh cùng giờ chỉ một request được thành công; request còn lại nhận conflict.
3. Mở lịch Student/Tutor để thấy cùng booking; đăng ký course để các session xuất hiện đúng ngày giờ.
4. Thử đăng ký course hoặc booking đụng giờ: server từ chối, không tự dịch thời gian.
5. Hủy booking và kiểm tra trạng thái, notification, khả dụng sau hủy.
6. Xem Reminder worker độc lập, outbox/inbox và retry; không sửa ngày giờ database thật chỉ để ép gửi email.

## Kiểm tra có thể chạy lại

```powershell
dotnet test TutorMatching.slnx
node scripts/verify-ha.mjs
node scripts/verify-tutor-workflow.mjs
python scripts/verify-database-recovery.py
node scripts/audit-schedule.mjs
```

Frontend tại `src/Web/TutorMatching.Web`:

```powershell
npm run test:run
npm run test:e2e:live
```

`verify-ha` kiểm tra số instance thực sự phản hồi, hard-kill một Scheduling, kiểm tra hai replica còn lại rồi khởi động lại replica đó trong `finally`. Chỉ chạy trên stack demo cục bộ. `verify-database-recovery` chạy các test rollback/claim worker với PostgreSQL thật qua proxy tạm và dọn proxy khi kết thúc. Test .NET thông thường không tự chứng minh các nhánh tích hợp database nếu chưa cấp biến môi trường; helper này cấp chúng.

Các test có thể tạo fixture riêng; `node scripts/cleanup-scheduling-audit.mjs` dọn đúng fixture theo quy ước của script, sau đó chạy audit lại. Không xóa dữ liệu người dùng để làm test xanh.

## Giới hạn cần trình bày

3 replica giúp API Scheduling tiếp tục nhận request khi một process chết; request đang chạy có thể lỗi và client cần retry cùng idempotency key. Không chuyển stack thực thi trong RAM sang process khác. Transaction đã commit, Redis hold và outbox/inbox dùng chung mới là trạng thái phục hồi. Một database/broker/Gateway vẫn là điểm lỗi đơn trong demo này. Không tuyên bố HA toàn hệ thống hoặc exactly-once SMTP.
