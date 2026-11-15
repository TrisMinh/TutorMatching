# Cài đặt TutorMatching trên máy Windows mới

## Chạy nhanh

1. Tải/clone toàn bộ repository, giải nén nếu là ZIP. Cần giữ nguyên cấu trúc thư mục.
2. Nhấp đúp **`setup.cmd`** ở thư mục gốc. Máy cần Internet để tải phần mềm và Docker images.
3. Nếu Windows hỏi quyền quản trị để bật WSL2, chọn cho phép. Nếu script báo cần khởi động lại, restart máy rồi chạy `setup.cmd` lại. Script không tự restart máy.
4. Mở **Docker Desktop**, hoàn tất màn hình thiết lập ban đầu và chờ engine chạy. Chọn **Linux containers**, backend **WSL2**.
5. Mở `.env` nếu cần đổi cấu hình email. Mặc định thư đi vào Mailpit, không cần Gmail.
6. Nhấp đúp **`rebuild.cmd`**. Lần đầu sẽ tải images và build nên có thể mất nhiều phút. Những lần sửa code hoặc `.env` sau đó chỉ cần chạy lại `rebuild.cmd`.
7. Mở website tại [localhost:3000](http://localhost:3000), pgAdmin tại [localhost:5050](http://localhost:5050).

`setup.cmd` kiểm tra/cài các công cụ còn thiếu, cập nhật WSL và khởi tạo `.env`. Nó không tự build hay tự cài lại phần mềm đã có. Chạy lại được mà không ghi đè mật khẩu đã cấu hình. Khi tạo `.env` mới, JWT signing key và mật khẩu pgAdmin mẫu được thay bằng giá trị ngẫu nhiên; thông tin Gmail và mật khẩu database hiện có được giữ nguyên.

## Những gì cần cài

| Công cụ | Vai trò | Setup xử lý |
|---|---|---|
| Windows 64-bit được Docker Desktop hỗ trợ, bật ảo hóa BIOS/UEFI | Nền tảng WSL2 | Kiểm tra cơ bản; người dùng cập nhật Windows/bật ảo hóa nếu cần |
| WSL2 | Chạy Linux containers | Kiểm tra, bật nếu thiếu, cập nhật kernel; có thể cần quyền admin và restart |
| Docker Desktop + Compose v2 | Build và chạy toàn hệ thống | Cài qua WinGet nếu thiếu; người dùng mở Docker và hoàn tất first-run |
| Git | Clone và cập nhật source | Cài qua WinGet nếu thiếu |
| WinGet (App Installer) | Tải các bộ cài trên | Nếu thiếu, script báo cài App Installer từ Microsoft Store |

Không cần cài riêng **PostgreSQL, pgAdmin, Redis, RabbitMQ, Mailpit hoặc .NET SDK** để chạy bằng Docker. Node.js LTS được setup cài cho công cụ seed và kiểm chứng dữ liệu. Chỉ cần .NET SDK theo `global.json` và Node.js phù hợp nếu muốn phát triển/chạy test trực tiếp ngoài container.

Xem yêu cầu Windows, RAM, WSL và ảo hóa hiện hành tại [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/). Máy cấu hình yếu có thể thiếu tài nguyên khi chạy đồng thời ba Scheduling và toàn bộ database; cấp đủ bộ nhớ cho Docker hoặc dùng `docker compose up -d --build --wait` cho cấu hình một Scheduling.

## Cài thủ công nếu WinGet không dùng được

- [WSL của Microsoft](https://learn.microsoft.com/en-us/windows/wsl/install): bật WSL2, restart khi được yêu cầu. Docker không cần bạn cài thêm Ubuntu riêng.
- [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
- [Git for Windows](https://git-scm.com/download/win).
- [App Installer / WinGet](https://learn.microsoft.com/en-us/windows/package-manager/winget/).

Sau khi cài thủ công, mở cửa sổ terminal mới hoặc restart máy rồi chạy `setup.cmd` lại. Không tắt Windows Update/ảo hóa hay bỏ qua lỗi cài đặt để tiếp tục build.

Chỉ kiểm tra, không cài đặt hay thay đổi cấu hình:

```powershell
./scripts/setup-windows.ps1 -CheckOnly
```

## Tạo dữ liệu ban đầu

Sau `rebuild.cmd`, nhấp đúp `seed-data.cmd` để nạp dữ liệu và kiểm tra liên kết. Xem [dữ liệu và kiểm chứng](data-and-validation.md).

## Xem dữ liệu bằng pgAdmin

1. Mở [localhost:5050](http://localhost:5050).
2. Đăng nhập bằng **`PGADMIN_EMAIL`** và **`LOCAL_ADMIN_PASSWORD`** trong `.env`. Mật khẩu này dùng chung cho pgAdmin và cả năm database local.
3. Mở nhóm **TutorMatching**. Năm server đã được khai báo sẵn; nhấp đúp server cần xem.
4. Khi được hỏi password, dùng cùng `LOCAL_ADMIN_PASSWORD` trong `.env`. Bạn có thể chọn lưu password trong pgAdmin.
5. Mở `Databases → <database> → Schemas → public → Tables`, chọn bảng rồi **View/Edit Data → All Rows** để xem dữ liệu.

| Server | Host trong Docker | Database | Username | Password lấy từ `.env` |
|---|---|---|---|---|
| Identity DB | identity-db | identity_db | identity_app | LOCAL_ADMIN_PASSWORD |
| Tutor DB | tutor-db | tutor_db | tutor_app | LOCAL_ADMIN_PASSWORD |
| Student DB | student-db | student_db | student_app | LOCAL_ADMIN_PASSWORD |
| Scheduling DB | scheduling-db | scheduling_db | scheduling_app | LOCAL_ADMIN_PASSWORD |
| Notification DB | notification-db | notification_db | notification_app | LOCAL_ADMIN_PASSWORD |

Cả năm dùng port nội bộ `5432`. pgAdmin kết nối qua mạng Docker, không dùng `localhost` làm host database. Cổng web pgAdmin chỉ bind `127.0.0.1:5050`. Cấu hình server nằm trong `deploy/pgadmin/servers.json`, không chứa mật khẩu. pgAdmin hỗ trợ nạp sẵn server và lưu cấu hình trong volume theo [tài liệu triển khai container](https://www.pgadmin.org/docs/pgadmin4/latest/container_deployment.html).

Thông tin pgAdmin lưu trong volume `pgadmin-data`. Khi cần đổi mật khẩu local, sửa duy nhất `LOCAL_ADMIN_PASSWORD` trong `.env` rồi chạy `rebuild.cmd`; script đồng bộ mật khẩu cho cả năm database và pgAdmin, giữ nguyên dữ liệu.

## Các địa chỉ sau khi chạy

| Địa chỉ | Công dụng |
|---|---|
| [localhost:3000](http://localhost:3000) | Website |
| [localhost:5050](http://localhost:5050) | pgAdmin |
| [localhost:8025](http://localhost:8025) | Mailpit, xem email demo |
| [localhost:8404](http://localhost:8404) | HAProxy stats với cấu hình HA |
| [localhost:15672](http://localhost:15672) | RabbitMQ management |

Nếu `rebuild.cmd` báo lỗi Docker engine: mở Docker Desktop và chờ engine sẵn sàng. Nếu cổng đang bị chiếm, dừng ứng dụng đang chiếm cổng hoặc sửa port mapping trong Compose. Khi dừng, dùng `docker compose -f compose.yaml -f compose.ha.yaml stop`; không dùng `down -v` vì sẽ xóa dữ liệu.

### Chẩn đoán rebuild

`GMAIL_USERNAME` chấp nhận email đầy đủ hoặc tên Gmail chưa có `@gmail.com` (ứng dụng tự bổ sung). `rebuild.cmd` kiểm tra cấu hình mail trước khi build, chờ mọi container khỏe và kiểm tra HTTP của website, Gateway, pgAdmin. Log mỗi lần chạy được lưu trong `.logs/rebuild-*.log` (không đưa lên Git). Lỗi sẽ giữ cửa sổ mở; xem thông báo và log trước khi chạy lại. Build thành công không xác nhận Google đã chấp nhận App Password; cần thử gửi thư riêng để kiểm tra điều đó.
