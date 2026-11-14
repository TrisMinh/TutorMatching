# Sơ đồ kiến trúc

Các sơ đồ trong trang này được viết bằng Mermaid và hiển thị trực tiếp trên GitHub. PlantUML tương ứng vẫn nằm cạnh trang này để làm nguồn kiểm tra chi tiết.

## System context

```mermaid
flowchart LR
    Student[Học sinh] -->|Tìm kiếm, đặt và hủy lịch| System[TutorMatching Platform]
    Tutor[Gia sư] -->|Hồ sơ, availability, lịch dạy| System
    Admin[Quản trị viên] -->|Account, health, demo| System
    System -.->|Xác nhận và nhắc lịch| Email[Mailpit / Email provider]
```

Nguồn: [`system-context.puml`](system-context.puml).

## Container architecture

```mermaid
flowchart LR
    User --> Web[React Web :3000] --> Gateway[YARP Gateway :8080]
    Gateway --> Identity[Identity Service]
    Gateway --> Tutor[Tutor Service]
    Gateway --> Student[Student Service]
    Gateway --> Scheduling[Scheduling Service]
    Gateway --> Notification[Notification Service]
    Identity --> IDB[(identity_db)]
    Tutor --> TDB[(tutor_db)]
    Student --> SDB[(student_db)]
    Scheduling --> BDB[(scheduling_db)]
    Scheduling --> Redis[(Redis hold TTL 300s)]
    Scheduling -.-> Rabbit[(RabbitMQ topic)]
    Rabbit -.-> Notification
    Notification --> NDB[(notification_db)]
    Scheduling -->|Validate tutor/slot| Tutor
    Scheduling -->|Resolve participant| Student
```

Nguồn: [`container-architecture.puml`](container-architecture.puml).

## Docker Compose deployment

```mermaid
flowchart TB
    subgraph Host[Docker Engine]
        subgraph Frontend[frontend network]
            Web[web 3000:3000]
            Gateway[gateway 8080:8080]
        end
        subgraph Backend[backend network]
            I[identity-service :8080]
            T[tutor-service :8080]
            S[student-service :8080]
            Sch[scheduling-service :8080]
            N[notification-service :8080]
        end
        subgraph Data[data network]
            PG[(5 PostgreSQL containers :5432)]
            R[(Redis :6379)]
            MQ[(RabbitMQ :5672)]
            Mail[Mailpit :1025]
        end
    end
    Web --> Gateway
    Gateway --> I & T & S & Sch & N
    I & T & S & Sch & N --> PG
    Sch --> R
    Sch -.-> MQ -.-> N
    N -.-> Mail
```

Nguồn: [`deployment-compose.puml`](deployment-compose.puml).

## DDD context map

```mermaid
flowchart LR
    Gateway[Gateway / BFF\nComposition]
    Identity[Identity & Access\nSupporting]
    Tutor[Tutor Management\nSupporting]
    Student[Student Management\nSupporting]
    Scheduling[Scheduling & Matching\nCORE DOMAIN]
    Notification[Notification\nSupporting]
    Gateway -->|Published Language / REST| Identity
    Gateway --> Tutor & Student & Scheduling & Notification
    Scheduling -->|Conformist API| Tutor & Student
    Scheduling -.->|Booking events v1| Notification
```

Nguồn: [`ddd-context-map.puml`](ddd-context-map.puml).

