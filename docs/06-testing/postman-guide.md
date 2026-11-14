# Hướng dẫn Postman

## Cấu trúc collection

Folders: `00 Health`, `01 Identity`, `02 Tutor`, `03 Student`, `04 Search`, `05 Holds and Bookings`, `06 Notifications`, `07 Negative Security`, `08 Cleanup`. Request gọi `{{gatewayBaseUrl}}`, không gọi service debug trừ collection internal riêng.

## Environment

Non-secret committed template: `gatewayBaseUrl=http://localhost:8080`, `studentEmail`, `tutorEmail`, dynamic IDs/times. Password/token/holdToken dùng local/current value hoặc vault, không export/commit. Variables sau script: `studentAccessToken`, `tutorAccessToken`, refresh tokens, profile IDs, subjectId, holdId/token, bookingId, traceId.

## Script pattern

Login test assert 200/schema và lưu token. Mọi request assert status, content-type, response time hợp lý, Problem Details khi lỗi và correlation header. Timestamps tính động UTC +2 days và align grid; không hard-code 2026 date.

## Chạy CLI

Postman CLI đã có trên máy. Khi collection được tạo:

```bash
postman collection run <collection-file-or-id> \
  -e <environment-file-or-id> \
  --env-var "studentPassword=$STUDENT_TEST_PASSWORD" \
  --env-var "tutorPassword=$TUTOR_TEST_PASSWORD" \
  --bail
```

CI lấy secret từ secret store, không in reporter verbose chứa token. Collection setup tạo data unique; teardown best-effort. Race/concurrency không nên giả bằng Collection Runner tuần tự; dùng test .NET/k6 script chuyên dụng.

## Assertions bắt buộc

Happy path, 401/403/409/429, hold expiry/replay, owner access, pagination max, cancellation idempotent, notification eventual polling. Poll dùng `postman.setNextRequest` với attempt/deadline giới hạn, không loop vô hạn.

