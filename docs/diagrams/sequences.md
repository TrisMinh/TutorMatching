# Sơ đồ tuần tự

## Đăng nhập và gọi API có JWT

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web
    participant GW as Gateway
    participant ID as Identity
    participant DB as identity_db
    participant Tutor
    User->>Web: Email và password
    Web->>GW: POST /api/v1/auth/login
    GW->>ID: Forward + traceparent
    ID->>DB: Lookup normalized email
    DB-->>ID: Account + password hash
    ID->>ID: Verify, issue JWT + refresh
    ID->>DB: Store refresh token hash
    ID-->>Web: 200 token pair, no-store
    Web->>GW: GET /api/v1/tutors + Bearer JWT
    GW->>GW: Validate iss/aud/signature/exp
    GW->>Tutor: Forward JWT + trace context
    Tutor-->>Web: 200 tutor page
```

Nguồn: [`login-sequence.puml`](login-sequence.puml).

## Tìm gia sư còn lịch

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Web
    participant GW as Gateway BFF
    participant Tutor
    participant Scheduling
    Student->>Web: Chọn subject, date, timezone
    Web->>GW: GET /api/v1/search/available-tutors
    GW->>Tutor: GET tutor candidates (paged)
    Tutor-->>GW: Profiles + availability
    GW->>Scheduling: POST /internal/v1/slots/query (batch)
    Scheduling-->>GW: Slots grouped by tutorId
    GW->>GW: Join, preserve pagination
    GW-->>Web: Snapshot + generatedAtUtc
```

Nguồn: [`search-sequence.puml`](search-sequence.puml).

## Giữ slot và xác nhận booking

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant GW as Gateway
    participant Sch as Scheduling
    participant Tutor
    participant DB as scheduling_db
    participant Redis
    Student->>GW: POST /api/v1/bookings/holds
    GW->>Sch: JWT + tutorId/subjectId/start
    Sch->>Tutor: Validate tutor, subject, availability
    Sch->>DB: Check confirmed overlap
    Sch->>Redis: Lua lock tutor/student, PX 300000
    alt Slot available
        Redis-->>Student: 201 holdId + one-time token
    else Held by another request
        Redis-->>Student: 409 + remaining TTL
    end
    Student->>GW: POST /api/v1/bookings (holdId, token)
    GW->>Sch: Confirm hold
    Sch->>Redis: Validate owner, token and TTL
    Sch->>DB: Transaction: Booking + Outbox
    alt Exclusion constraints pass
        DB-->>Sch: COMMIT
        Sch->>Redis: Compare-and-delete
        Sch-->>Student: 201 Confirmed
    else SQLSTATE 23P01
        DB-->>Sch: ROLLBACK
        Sch-->>Student: 409 slot conflict
    end
```

Nguồn: [`booking-sequence.puml`](booking-sequence.puml).

## Hủy booking

```mermaid
sequenceDiagram
    autonumber
    actor User as Participant
    participant Gateway
    participant Scheduling
    participant DB as scheduling_db
    User->>Gateway: DELETE /api/v1/bookings/{id}
    Gateway->>Scheduling: JWT + reasonCode
    Scheduling->>DB: Load booking
    Scheduling->>Scheduling: Authorize participant, then Cancel()
    alt Confirmed
        Scheduling->>DB: UPDATE Cancelled + Outbox
        Scheduling-->>User: 204
    else Already cancelled
        Scheduling-->>User: 204 idempotent
    else Not participant
        Scheduling-->>User: 403/404
    end
```

Nguồn: [`cancel-sequence.puml`](cancel-sequence.puml).

## Outbox đến notification và reminder

```mermaid
sequenceDiagram
    autonumber
    participant Publisher as Outbox Publisher
    participant ODB as scheduling_db
    participant MQ as RabbitMQ
    participant Consumer as Notification Consumer
    participant NDB as notification_db
    participant Worker as Reminder Worker
    Publisher->>ODB: Claim pending SKIP LOCKED
    Publisher->>MQ: Persistent publish + mandatory
    MQ-->>Publisher: Publisher confirm
    Publisher->>ODB: Set publishedAtUtc
    MQ->>Consumer: BookingConfirmed (at-least-once)
    Consumer->>NDB: Transaction: inbox + notification + reminder
    alt New eventId
        NDB-->>MQ: COMMIT then ACK
    else Duplicate eventId
        NDB-->>MQ: Existing then ACK, no duplicate effect
    end
    Worker->>NDB: Claim due reminders with lease
    Worker->>Worker: Deliver in-app / SMTP
    Worker->>NDB: Sent or bounded retry
```

Nguồn: [`notification-sequence.puml`](notification-sequence.puml).

