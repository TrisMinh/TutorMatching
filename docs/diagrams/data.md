# Sơ đồ dữ liệu

Đường nối chỉ tồn tại trong phạm vi database sở hữu. UUID xuyên service là external reference, không phải foreign key liên database.

## Database ownership overview

```mermaid
flowchart LR
    Identity[Identity Service] --> IDB[(identity_db\naccounts + refresh sessions)]
    Tutor[Tutor Service] --> TDB[(tutor_db\nprofiles + subjects + availability)]
    Student[Student Service] --> SDB[(student_db\nprofiles + interests)]
    Scheduling[Scheduling Service] --> BDB[(scheduling_db\nbookings + outbox)]
    Notification[Notification Service] --> NDB[(notification_db\ninbox + notifications + reminders)]
    Scheduling -. external UUID .-> Tutor & Student
    Scheduling -. events .-> Notification
```

Nguồn: [`database-erd.puml`](database-erd.puml).

## identity_db

```mermaid
erDiagram
    USER_ACCOUNTS ||--o{ REFRESH_SESSIONS : owns
    USER_ACCOUNTS |o--o{ SECURITY_AUDIT_EVENTS : records
    USER_ACCOUNTS { uuid id PK string normalized_email UK string password_hash string role string status int version }
    REFRESH_SESSIONS { uuid id PK uuid user_id FK string token_hash UK uuid family_id datetime expires_at_utc datetime revoked_at_utc }
    SECURITY_AUDIT_EVENTS { uuid id PK uuid user_id FK string event_type string ip_hash datetime occurred_at_utc }
```

Nguồn: [`identity-database-schema.puml`](identity-database-schema.puml).

## tutor_db

```mermaid
erDiagram
    TUTOR_PROFILES ||--o{ TUTOR_SUBJECTS : teaches
    SUBJECTS ||--o{ TUTOR_SUBJECTS : categorizes
    TUTOR_PROFILES ||--o{ AVAILABILITY_WINDOWS : provides
    TUTOR_PROFILES { uuid id PK uuid user_id UK string display_name string bio int experience_years string status int version }
    SUBJECTS { uuid id PK string code UK string name bool is_active }
    TUTOR_SUBJECTS { uuid tutor_id PK uuid subject_id PK string proficiency_level }
    AVAILABILITY_WINDOWS { uuid id PK uuid tutor_id FK datetime start_at_utc datetime end_at_utc string slot_range }
```

Nguồn: [`tutor-database-schema.puml`](tutor-database-schema.puml).

## student_db

```mermaid
erDiagram
    STUDENT_PROFILES ||--o{ STUDENT_SUBJECT_INTERESTS : prefers
    STUDENT_PROFILES { uuid id PK uuid user_id UK string display_name string education_level string learning_goal string timezone string status int version }
    STUDENT_SUBJECT_INTERESTS { uuid student_id PK uuid subject_id PK int priority datetime created_at_utc }
```

Nguồn: [`student-database-schema.puml`](student-database-schema.puml).

## scheduling_db

```mermaid
erDiagram
    BOOKINGS ||--o{ OUTBOX_MESSAGES : emits
    BOOKINGS { uuid id PK uuid student_id uuid student_user_id uuid tutor_id uuid tutor_user_id uuid subject_id datetime start_at_utc datetime end_at_utc string slot_range string status uuid source_hold_id UK int version }
    OUTBOX_MESSAGES { uuid id PK string aggregate_type uuid aggregate_id string event_type int event_version string routing_key string payload uuid correlation_id datetime occurred_at_utc datetime published_at_utc int attempt_count }
```

Nguồn: [`scheduling-database-schema.puml`](scheduling-database-schema.puml).

## notification_db

```mermaid
erDiagram
    PROCESSED_EVENTS ||--o{ NOTIFICATIONS : creates
    PROCESSED_EVENTS ||--o{ REMINDER_SCHEDULES : schedules
    NOTIFICATIONS |o--o{ DELIVERY_ATTEMPTS : delivers
    REMINDER_SCHEDULES |o--o{ DELIVERY_ATTEMPTS : executes
    PROCESSED_EVENTS { uuid event_id PK string event_type int event_version datetime processed_at_utc }
    NOTIFICATIONS { uuid id PK uuid recipient_user_id uuid booking_id string type string title string body string status uuid source_event_id datetime created_at_utc }
    REMINDER_SCHEDULES { uuid id PK uuid booking_id uuid recipient_user_id string reminder_type datetime scheduled_for_utc string status int attempts datetime next_attempt_at_utc uuid source_event_id }
    DELIVERY_ATTEMPTS { uuid id PK uuid notification_id uuid reminder_id string channel int attempt_no string status datetime started_at_utc }
```

Nguồn: [`notification-database-schema.puml`](notification-database-schema.puml).

