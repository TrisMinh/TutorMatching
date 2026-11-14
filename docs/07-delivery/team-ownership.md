# Phân công và quyền sở hữu

| Thành viên | Owner | Platform duty | Deliverable |
|---|---|---|---|
| Hoàng Minh Trí | Identity | YARP, JWT/CORS/rate | Identity API/DB/test/image; Gateway routes/security |
| Ngô Quang Sinh | Tutor | REST/DNS, search composition contract | Tutor profile/subject/availability/OpenAPI/test/image |
| Lê Thị Kiều Chi | Student | DTO/error/auth consistency | Student profile/relationship auth/OpenAPI/test/image |
| Đinh Công Trung Sỹ | Scheduling | Redis, outbox publisher, concurrency | Booking/DB/Lua/outbox/test/image |
| Ngô Thành Đạt | Notification | RabbitMQ, worker, Compose integration | Consumer/reminder/DB/test/image; integrated Compose |

## RACI cho hạ tầng

| Hạng mục | Accountable | Responsible/Consulted |
|---|---|---|
| Gateway routes/JWT edge | Identity owner | mọi service cung cấp route/policy/health |
| JWT issuer/key contract | Identity owner | platform + 4 service validate |
| Redis keys/Lua/TTL | Scheduling owner | Compose owner provision/monitor |
| Rabbit topology/DLQ | Notification owner | Scheduling publisher contract |
| Compose/network/ports | Notification/Compose owner | mỗi owner Dockerfile/env/health |
| API/event standards | Cả nhóm, một maintainer merge | publisher + consumers bắt buộc review |
| E2E/demo | Compose owner điều phối | mọi owner sửa failure service mình |

## Quy tắc phối hợp

- Owner chịu từ Domain đến migration/test/Dockerfile/docs, không đẩy phần khó sang người tích hợp.
- Compose owner không viết thay Dockerfile/service behavior; chỉ ghép và phản hồi contract.
- Gateway owner không chứa nghiệp vụ service.
- Scheduling không query TutorDb/StudentDb; Notification không sửa Booking.
- Thay JWT/event/port/health/config phải báo và cập nhật canonical docs trong cùng PR.
- Incident: service owner triage logic; platform duty triage dependency; một incident lead giữ timeline/quyết định.

