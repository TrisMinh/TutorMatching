# Kiểm tra giao diện và thao tác

Đã rà 23 màn Student/Tutor ở 1920, 768 và 390 px: 69 lượt mở trang và ảnh chụp trên bản Docker chạy thật. Báo cáo ở `.logs/ui-audit/report.json`, ảnh cùng thư mục; không phát hiện tràn ngang, JavaScript exception hoặc API 5xx trong các lượt kiểm tra cuối.

Các lỗi đã sửa: form Student thiếu bố cục/nhãn field, checkbox môn học bị dính, dữ liệu hồ sơ đã lưu chưa được nạp khi mở onboarding; form sửa hồ sơ có ô chọn không đồng bộ; nút lưu Tutor bị đẩy ra ngoài tablet; lịch còn CSS cố định ngày đầu tháng và nút chuyển tháng quá rộng; danh sách slot thực tế quá dài; dữ liệu tài khoản kiểm thử còn xuất hiện trong catalog công khai.

Kiểm thử hành vi xác nhận lưu/mở lại hồ sơ giữ tên, cấp học, mục tiêu và môn đã chọn; lỗi tải hồ sơ chặn lưu để tránh ghi đè; form Tutor vừa tablet/điện thoại; lịch tháng bắt đầu thứ Hai căn đúng cột. Khóa học của tài khoản kiểm thử được ẩn khỏi catalog, dữ liệu lịch sử và tài khoản cá nhân vẫn giữ nguyên.

Chạy trong thư mục frontend:

```powershell
npm run test:run
npx playwright test --config playwright.live.config.ts ui-polish.spec.ts
npm run audit:ui
```

Audit dùng các tài khoản demo đã seed. Không sửa tài khoản cá nhân. Kiểm thử lưu hồ sơ sử dụng `student24@demo.tutormatching.test` và khôi phục các trường/interest ban đầu bằng API ở khối finally.


## Trạng thái trống thân thiện

Dùng chung `FriendlyEmptyState` với minh họa SVG lịch, chuông, kính lúp và sách. Áp dụng cho booking Student/Tutor, thông báo đầy trang và dropdown, tìm kiếm gia sư, lịch trống Tutor, reservation hết hạn/chưa chọn Tutor, dashboard Student và catalog chưa có khóa học. Minh họa là trang trí (`aria-hidden`); tiêu đề và nút hành động vẫn là HTML có thể đọc/chọn bằng bàn phím.

`friendly-empty-states.spec.ts` kiểm tra 8 tuyến Student/Tutor tại 1920, 768 và 390 px. Các phản hồi rỗng được tạo trong browser test để không xóa dữ liệu thật; kiểm tra màn trống, kích thước nút, tràn ngang, điều hướng và lỗi JavaScript. Khi API booking trả 503, giao diện phải hiện lỗi và nút thử lại, không được hiện “chưa có booking”.

```powershell
npm run test:e2e:live -- friendly-empty-states.spec.ts --workers=1
```


## Chi tiết booking

`booking-confirmation-layout.spec.ts` mở booking thật ở 1920/768/390 px, kiểm tra padding tiêu đề tối thiểu 20 px, khung tối đa 1000 px, khoảng đệm nội dung, nút tối thiểu 44 px và cách nhau ít nhất 12 px. Có ảnh chụp riêng `.logs/booking-details-*.png` để xem lại bố cục. Trạng thái đã hủy và hết hạn hủy được kiểm tra bằng phản hồi trình duyệt giả lập, không hủy booking thật.

Các kiểm tra này chỉ xác nhận các trạng thái/kích thước đã nêu, không bảo đảm mọi trang hoặc mọi nội dung đều không có lỗi giao diện.
