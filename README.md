# TutorMatching · Teach.

Nền tảng ghép cặp gia sư và học sinh theo khung giờ, kết hợp đặt lịch 1–1, đăng ký khóa học và quản lý lịch dạy/học. Dự án triển khai **Hướng 4 — Scheduling & Time Constraints** với API Gateway, các microservice độc lập và Docker Compose.

![Giao diện đăng nhập TutorMatching](docs/images/sign-in.png)

## Chức năng chính

- **Student:** tìm gia sư theo môn và thời gian trống, giữ chỗ và xác nhận booking, đăng ký khóa học, xem khóa đã đăng ký và lịch học cá nhân.
- **Vòng đời khóa:** đóng/mở đăng ký, hủy khóa có thông báo, Student rút đăng ký trước buổi đầu; giữ lịch sử và giải phóng lịch đúng trạng thái.
- **Tutor:** xem lịch dạy và booking, cấu hình availability, xem khóa đang dạy và hồ sơ học sinh có liên quan.
- **Lịch:** hiển thị booking và session khóa học theo ngày/tuần, chọn ngày từ lịch nhỏ, đổi múi giờ và chuyển đến buổi học của khóa đã chọn.
- **Tương tác:** tìm kiếm có gợi ý, thông báo dropdown, toast, bộ lọc và chọn kích thước thẻ khóa học; điều hướng giữ nguyên app shell.
- **Ràng buộc:** kiểm tra trùng giờ của Tutor/Student, Redis hold có thời hạn, transaction và database constraint khi xác nhận.
- **Tài khoản:** Settings lưu theo tài khoản, khôi phục mật khẩu bằng email một lần và chính sách hủy chụp vào từng booking.
- **Tác vụ nền:** Transactional Outbox, RabbitMQ, notification và reminder trước buổi học một giờ; retry hữu hạn và cơ chế phục hồi.

## Giao diện thực tế

Ảnh chụp từ ứng dụng chạy cục bộ bằng tài khoản demo, không phải ảnh mockup. Ngày hiển thị phụ thuộc dữ liệu seed và tuần được chọn.

### Lịch học của Student

![Dashboard Student với lịch học và danh sách khóa](docs/images/student-dashboard.png)

### Khóa học đã đăng ký

![Thư viện khóa học của Student](docs/images/student-courses.png)

### Lịch dạy của Tutor

![Dashboard Tutor với lớp được phân công](docs/images/tutor-dashboard.png)

### Cài đặt và Teach Buddy

![Cài đặt Tutor với nhân vật Teach Buddy](docs/images/tutor-settings.png)

## Kiến trúc và công nghệ

| Thành phần | Trách nhiệm | Instance trong bản demo HA |
|---|---|---:|
| API Gateway — YARP | Ingress API, xác thực và API Composition tìm tutor khả dụng | 1 |
| Identity Service | Tài khoản, JWT và refresh session | 1 |
| Tutor / Provider Service | Hồ sơ gia sư, môn học, availability, course và enrollment | 1 |
| Student / Consumer Service | Hồ sơ học sinh | 1 |
| Scheduling Service | Hold, booking, kiểm tra conflict và outbox | **3** |
| Notification / Reminder Service | Nhận event, thông báo và quét reminder chạy nền | 1 |

Frontend dùng **React 19, TypeScript, Vite**, font Gilroy và tài nguyên Figma lưu cục bộ. Backend dùng **.NET 10, ASP.NET Core, EF Core**. Mỗi service sở hữu PostgreSQL riêng; Redis lưu hold/khóa phối hợp, RabbitMQ truyền event, Mailpit nhận email demo. HAProxy điều phối request đến các Scheduling bằng `leastconn` và readiness checks.

Gateway tổng hợp thông tin Tutor với booked slots từ Scheduling để trả danh sách gia sư khả dụng. Quyết định xác nhận và chống trùng vẫn nằm trong service nghiệp vụ. Xem [API Composition](docs/coursework/api-composition.md).

## Khởi chạy bằng Docker Compose

**Máy Windows mới:** nhấp đúp **`setup.cmd`** để kiểm tra/cài WSL2, Docker Desktop và Git, rồi mở Docker Desktop và chạy **`rebuild.cmd`**. Xem [hướng dẫn cài đặt máy mới và pgAdmin](docs/setup-windows.md).

Yêu cầu **Docker Desktop chạy Linux containers**, Docker Compose v2 và PowerShell nếu dùng script.

**Trên Windows:** mở Docker Desktop, sau đó nhấp đúp **`rebuild.cmd`** ở thư mục gốc. File này tự tạo `.env` từ mẫu nếu chưa có, build lại code, cập nhật container và chờ hệ thống sẵn sàng. Sau mỗi lần sửa code hoặc đổi `.env`, nhấp đúp lại file này; dữ liệu trong database volume được giữ nguyên. Nếu có lỗi, cửa sổ giữ mở để đọc thông báo. Nếu `.env` chưa có, chỉnh cấu hình trong file mới tạo rồi chạy lại khi cần.

Nếu muốn thao tác bằng lệnh, chạy trong thư mục gốc repository:

```powershell
# Chỉ tạo khi chưa có .env; không ghi đè password của volume hiện có.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Đặt `JWT_SIGNING_KEY` trong `.env` thành khóa ngẫu nhiên tối thiểu 32 byte. Giữ `.env` ở máy cục bộ, không commit. Sau đó:

```powershell
./scripts/start-ha.ps1
```

Hoặc chạy trực tiếp, dùng cùng hai file cho mọi lệnh vận hành:

```powershell
docker compose -f compose.yaml -f compose.ha.yaml up -d --build --wait --wait-timeout 240
docker compose -f compose.yaml -f compose.ha.yaml ps
```

| Địa chỉ | Nội dung |
|---|---|
| [localhost:3000](http://localhost:3000) | Website |
| [localhost:8080/health/ready](http://localhost:8080/health/ready) | Gateway readiness |
| [localhost:8404](http://localhost:8404) | HAProxy stats |
| [localhost:8025](http://localhost:8025) | Mailpit — email demo |
| [localhost:5050](http://localhost:5050) | pgAdmin — xem 5 database |

`compose.yaml` đơn lẻ chạy một instance mỗi API để phát triển; `compose.ha.yaml` tăng riêng Scheduling lên ba. API nội bộ và database không publish cổng trong cấu hình demo. Dùng `compose.debug.yaml` khi cần cổng loopback để debug.

Dừng stack nhưng giữ dữ liệu:

```powershell
docker compose -f compose.yaml -f compose.ha.yaml stop
```

**Không dùng `down -v` nếu muốn giữ tài khoản, khóa học và booking.**

## Xem database bằng pgAdmin

Mở [localhost:5050](http://localhost:5050), đăng nhập bằng `PGADMIN_EMAIL` và `LOCAL_ADMIN_PASSWORD` trong `.env`. Nhóm **TutorMatching** có sẵn 5 server. Khi kết nối, nhập mật khẩu `LOCAL_ADMIN_PASSWORD` tương ứng trong `.env`. Xem [bảng thông tin kết nối và cách mở bảng dữ liệu](docs/setup-windows.md#xem-dữ-liệu-bằng-pgadmin). `rebuild.cmd` đồng bộ mật khẩu với các database và tài khoản pgAdmin đã tồn tại, giữ nguyên dữ liệu.

## Chọn Mailpit hoặc Gmail

Mở `.env` ở thư mục gốc (cùng chỗ với `compose.yaml`). Chỉ cần đổi **một biến** để chọn nơi gửi:

```dotenv
EMAIL_PROVIDER=mailpit
```

Để gửi thư thật qua Gmail, điền tài khoản và App Password một lần:

```dotenv
EMAIL_PROVIDER=gmail
GMAIL_USERNAME=your-account@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
```

Ứng dụng tự chọn host, port, TLS và địa chỉ gửi: Mailpit dùng `mailpit:1025`, Gmail dùng `smtp.gmail.com:587` với STARTTLS. Chuyển lại `EMAIL_PROVIDER=mailpit` để dùng hộp thư demo; giữ nguyên thông tin Gmail cho lần sau. Chế độ Mailpit không dùng thông tin đăng nhập Gmail. Giá trị provider không hợp lệ hoặc thiếu thông tin Gmail khi chọn Gmail sẽ báo lỗi lúc khởi động.

`GMAIL_APP_PASSWORD` là Google App Password, không phải mật khẩu đăng nhập Gmail. Bật xác minh hai bước rồi tạo tại [Google App Passwords](https://myaccount.google.com/apppasswords); tài khoản do tổ chức quản lý có thể bị hạn chế. `.env` được Git bỏ qua; không đưa mật khẩu vào `.env.example` hay README.

Sau mỗi lần đổi provider, lưu `.env` rồi nhấp đúp `rebuild.cmd` để áp dụng cho cả Identity (khôi phục mật khẩu) và Notification (nhắc lịch), hoặc chạy:

```powershell
docker compose -f compose.yaml -f compose.ha.yaml up -d --build --wait --wait-timeout 240
```

Với Mailpit, xem thư tại `http://localhost:8025`. Với Gmail, đăng ký tài khoản bằng email nhận được rồi dùng quên mật khẩu để kiểm tra thư thật. Nhắc lịch phụ thuộc lịch học và tùy chọn trong Settings. Đăng ký mới yêu cầu xác minh mã email 6 số trước khi đăng nhập; chọn Student/Tutor ngay trong form đăng ký. Xem [luồng xác minh email](docs/08-account-experience/email-verification.md). Đặt `FRONTEND_ORIGIN` thành URL HTTPS công khai khi cho người khác dùng liên kết trong thư.

## Dữ liệu và tài khoản demo

Chạy **`seed-data.cmd`** để nạp dữ liệu liên kết vào database qua API, tự chọn lịch không trùng và kiểm tra toàn vẹn. Xem [dữ liệu và kiểm chứng](docs/data-and-validation.md). Tài khoản mới phải hoàn thiện hồ sơ trước khi đặt lịch; các màn nghiệp vụ không dùng fixture thay dữ liệu thật.

Đặt `EMAIL_PROVIDER=mailpit` và chạy lại `rebuild.cmd` trước khi seed tài khoản demo mới. Script seed tự lấy mã trong Mailpit để xác minh tài khoản, không bỏ qua kiểm tra email.

Volume mới chưa có dữ liệu demo. Khi stack healthy, dùng Node.js 22 trở lên chạy theo thứ tự:

```powershell
node scripts/seed-demo.mjs
node scripts/seed-courses.mjs
node scripts/seed-demo-avatars.mjs
```

Các script gọi API thật để tạo/liên kết dữ liệu; đọc script trước khi chạy lại trên môi trường đã có dữ liệu. Nếu đang dùng volume demo hiện tại thì có thể đăng nhập ngay, không cần seed lại.

| Vai trò | Email | Mật khẩu demo |
|---|---|---|
| Student | `student01@demo.tutormatching.test` | `TutorDemo!2026` |
| Tutor | `tutor01@demo.tutormatching.test` | `TutorDemo!2026` |

Chọn đúng vai trò ở màn đăng nhập. Đây là tài khoản công khai cho demo cục bộ. Lịch course có ngày cố định trong seed; dùng danh sách khóa trên dashboard để chuyển tới session, không cần sửa ngày hệ thống.

## Phát triển và kiểm thử

Backend cần .NET 10 SDK; frontend cần Node.js 22 trở lên.

```powershell
dotnet build TutorMatching.slnx
dotnet test TutorMatching.slnx --no-build
```

Frontend:

```powershell
cd src/Web/TutorMatching.Web
npm ci
npm run dev
npm run test:run
npm run build
# Cần Docker stack đang chạy và Chrome đã cài:
npm run test:e2e:live
```

Kiểm tra tích hợp từ thư mục gốc, trên stack demo cục bộ:

```powershell
node scripts/verify-account-features.mjs
node scripts/audit-schedule.mjs
node scripts/verify-tutor-workflow.mjs
node scripts/verify-ha.mjs
python scripts/verify-database-recovery.py
```

`verify-ha` chủ động dừng một Scheduling rồi phục hồi để kiểm tra failover. Helper Python chạy kiểm tra rollback/claim worker với PostgreSQL thật qua proxy tạm. Các phép kiểm tra này không nên chạy trên hệ thống đang phục vụ người dùng thật.

## Tài liệu báo cáo

| Chủ đề | Tài liệu |
|---|---|
| Đối chiếu yêu cầu đề bài | [Phạm vi đồ án](docs/coursework/requirements-and-scope.md) |
| Tìm slot, giữ chỗ, chống trùng | [Thuật toán lập lịch](docs/coursework/scheduling-algorithms.md) |
| Tổng hợp dữ liệu tại Gateway | [API Composition](docs/coursework/api-composition.md) |
| Worker độc lập, nhắc lịch và retry | [Reminder/background jobs](docs/coursework/reminder-jobs.md) |
| Số instance và điều phối | [Instances & load balancing](docs/03-platform/instances-load-balancing.md) |
| Lỗi, retry và rollback | [Retry & recovery](docs/03-platform/retry-rollback-recovery.md) |
| Kịch bản trình bày | [Demo và kiểm chứng](docs/coursework/demo-and-verification.md) |
| Settings, recovery, reminder và policy | [Account experience](docs/08-account-experience/settings.md) |
| Quản lý vòng đời khóa học | [Course lifecycle](docs/02-services/course-lifecycle.md) |
| Danh mục toàn bộ tài liệu | [Docs index](docs/README.md) |

## Các nhánh

- **[feat/scheduling-coursework](https://github.com/TrisMinh/TutorMatching/tree/feat/scheduling-coursework):** bản hiện tại dành cho đồ án Scheduling; giữ JWT, role/owner checks và nghiệp vụ, không cần triển khai PKI.
- **[feat/advanced-service-security](https://github.com/TrisMinh/TutorMatching/tree/feat/advanced-service-security):** bản lưu riêng các lớp bảo mật nâng cao trước khi rút gọn.

Ba Scheduling giúp tiếp tục phục vụ qua replica còn khỏe; request đang chạy có thể lỗi và cần retry theo quy tắc idempotency. Trạng thái phục hồi dựa trên database/Redis dùng chung. Gateway, broker và datastore vẫn là single instance trong demo; đây không phải triển khai HA toàn hệ thống hoặc cấu hình production.

### Chẩn đoán rebuild

`GMAIL_USERNAME` chấp nhận email đầy đủ hoặc tên Gmail chưa có `@gmail.com` (ứng dụng tự bổ sung). `rebuild.cmd` kiểm tra cấu hình mail trước khi build, chờ mọi container khỏe và kiểm tra HTTP của website, Gateway, pgAdmin. Log mỗi lần chạy được lưu trong `.logs/rebuild-*.log` (không đưa lên Git). Lỗi sẽ giữ cửa sổ mở; xem thông báo và log trước khi chạy lại. Build thành công không xác nhận Google đã chấp nhận App Password; cần thử gửi thư riêng để kiểm tra điều đó.


### Nhắn tin với gia sư

Hồ sơ gia sư có nút **Message tutor**. Cả Student/Tutor dùng mục **Messages** hoặc biểu tượng tin nhắn trên thanh đầu trang để xem hội thoại, gửi và trả lời. Tin nhắn văn bản lưu trong PostgreSQL của Notification service, có kiểm tra thành viên, số tin chưa đọc, tải tin cũ và chống gửi trùng; giao diện cập nhật mỗi 3 giây khi đang mở hội thoại. Giữ nguyên **5 service nghiệp vụ**. Xem [phạm vi và API messaging](docs/messaging-contract.md).
