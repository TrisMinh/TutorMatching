# Bằng chứng kiểm thử

Kiểm tra trên nhánh `feat/scheduling-coursework`, Docker Compose với 3 Scheduling, ngày 15/11/2026 (GMT+07).

| Kiểm tra | Kết quả |
|---|---|
| .NET solution tests | 56 passed |
| Frontend Vitest | 89 passed |
| Playwright live toàn bộ website | 32 passed |
| `verify-account-features.mjs` | Settings/version/role, profile visibility, notification opt-out, policy snapshot, SMTP booking/course, email opt-out, cooldown/reset concurrency và refresh revocation passed |
| `verify-tutor-workflow.mjs` | Availability, Tutor isolation, conflict, replay, cancellation và event delivery passed |
| EF model check Identity/Scheduling | Không có model changes chưa migration |

Unit tests một mình không chứng minh SMTP hoặc database locking. Integration account script dùng Gateway và service thật, email được nhận bởi Mailpit; concurrent reset chạy trên PostgreSQL thật. Playwright mở link từ email và đổi password qua form. Tài khoản được tạo riêng cho test; không đổi mật khẩu demo accounts.

SMTP Mailpit chứng minh gửi tới SMTP sink, không chứng minh giao thư ra Internet, chống spam hay deliverability của nhà cung cấp production. Chưa có load benchmark hoặc chứng nhận production security. Access token cũ vẫn có thể dùng tới khi hết hạn; reset đã revoke refresh.

Fixture account script tự dọn lịch/khóa có prefix dành riêng và ẩn tutor thử nghiệm. `audit-schedule.mjs` cần chạy sau dọn fixture để đối chiếu dữ liệu demo. Không dùng xóa volume để làm test xanh.
