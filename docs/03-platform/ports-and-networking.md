# Cổng và networking

## Cổng canonical

Container app đều listen `8080`; tên DNS phân biệt service. Chỉ mở host port cần cho người dùng/demo.

| Thành phần | DNS Compose | Container | Host local | Public baseline |
|---|---|---:|---:|---|
| React Web | `web` | 3000 | 3000 | Có |
| YARP Gateway | `gateway` | 8080 | 8080 | Có |
| Identity | `identity-service` | 8080 | 8081 (profile debug) | Không |
| Tutor | `tutor-service` | 8080 | 8082 (debug) | Không |
| Student | `student-service` | 8080 | 8083 (debug) | Không |
| Scheduling | `scheduling-service` | 8080 | 8084 (debug) | Không |
| Notification | `notification-service` | 8080 | 8085 (debug) | Không |
| identity-postgres | `identity-db` | 5432 | 54321 | Không |
| tutor-postgres | `tutor-db` | 5432 | 54322 | Không |
| student-postgres | `student-db` | 5432 | 54323 | Không |
| scheduling-postgres | `scheduling-db` | 5432 | 54324 | Không |
| notification-postgres | `notification-db` | 5432 | 54325 | Không |
| Redis | `redis` | 6379 | 6379 loopback/debug | Không |
| RabbitMQ AMQP | `rabbitmq` | 5672 | 5672 loopback/debug | Không |
| RabbitMQ Management | `rabbitmq` | 15672 | 15672 loopback/dev | Không |
| Mailpit SMTP | `mailpit` | 1025 | 1025 loopback/dev | Không |
| Mailpit UI | `mailpit` | 8025 | 8025 loopback/dev | Không |
| OTLP gRPC (collector nếu có) | `otel-collector` | 4317 | 4317 loopback | Không |

Trong container luôn dùng DNS+container port, ví dụ `Host=tutor-db;Port=5432`; không dùng host mapping 54322. `localhost` trong container là chính container.

## Network

- `frontend`: web <-> gateway.
- `backend`: gateway <-> five services; service-to-service REST.
- `data`: services <-> owner DB, Redis, RabbitMQ, Mailpit/telemetry.

Gateway tham gia frontend+backend. Web không tham gia backend/data. Database chỉ data. Có thể tách data network per service khi hardening; baseline dùng một private data network nhưng credential/ACL vẫn riêng.

## Host binding

Public dev: `0.0.0.0:3000`, `0.0.0.0:8080` khi cần LAN demo. Debug/management/data port phải bind `127.0.0.1:<port>:<containerPort>` và nằm profile `debug`. Production-like không publish service/database/Redis/RabbitMQ management.

## DNS và URL nội bộ

| Caller config | Giá trị |
|---|---|
| Gateway -> Identity | `http://identity-service:8080` |
| Gateway -> Tutor | `http://tutor-service:8080` |
| Gateway -> Student | `http://student-service:8080` |
| Gateway -> Scheduling | `http://scheduling-service:8080` |
| Gateway -> Notification | `http://notification-service:8080` |
| Scheduling -> Tutor | `http://tutor-service:8080` |
| Scheduling -> Student | `http://student-service:8080` |
| Student -> Scheduling | `http://scheduling-service:8080` |

## Firewall và CORS

Firewall chỉ mở 3000/8080 cho demo. CORS origin là scheme+host+port của Web, không phải wildcard. Internal endpoints `/internal` không có route tại Gateway. Health detail/metrics/management chỉ internal hoặc loopback.

