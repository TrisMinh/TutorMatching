# Sơ đồ trạng thái và hạ tầng

## Booking lifecycle

```mermaid
stateDiagram-v2
    [*] --> Available
    Available --> Held: createHold [slot free] / Lua NX + TTL
    Held --> Confirmed: owner + token + TTL + no conflict
    Held --> Expired: TTL elapsed
    Held --> Available: owner releases hold
    Confirmed --> Cancelled: participant cancels / outbox event
    Confirmed --> Confirmed: repeated confirmation returns existing
    Cancelled --> Cancelled: repeated cancellation is no-op
    Expired --> [*]
    Cancelled --> [*]
```

Nguồn: [`booking-state.puml`](booking-state.puml).

## RabbitMQ topology

```mermaid
flowchart LR
    Pub[Scheduling Outbox Publisher] -.->|persistent + confirms| Events{{tutormatching.events}}
    Events -.->|booking.confirmed.v1 / cancelled.v1| Main[(notification.booking-events.v1)]
    Main -.->|manual ACK| Consumer[Notification Consumer]
    Consumer -.->|transient attempt below 5| RetryEx{{tutormatching.retry}}
    RetryEx --> RetryQ[(retry queue TTL 30s)]
    RetryQ -.->|original route| Events
    Consumer -.->|poison or max attempts| DLX{{tutormatching.dlx}}
    DLX --> DLQ[(notification.booking-events.dlq)]
```

Nguồn: [`rabbitmq-topology.puml`](rabbitmq-topology.puml).

## Redis atomic hold flow

```mermaid
flowchart TD
    Start([Create hold]) --> Validate[Validate Student JWT, slot grid and horizon]
    Validate --> Tutor[Validate tutor, subject and availability]
    Tutor --> DB[Check confirmed overlap in scheduling_db]
    DB --> Valid{Dependencies valid?}
    Valid -->|No| Error[422 or 503]
    Valid -->|Yes| Lua[Lua checks tutor/student overlap keys at start-30, start, start+30]
    Lua --> Locked{Any lock exists?}
    Locked -->|Yes| Conflict[409 + remaining PTTL]
    Locked -->|No| Set[SET locks and metadata NX PX 300000]
    Set --> Created[201 holdId + one-time token + expiresAtUtc]
```

Nguồn: [`redis-hold-flow.puml`](redis-hold-flow.puml).

## Trace và correlation propagation

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Gateway
    participant Scheduling
    participant DB as PostgreSQL
    participant Publisher
    participant MQ as RabbitMQ
    participant Consumer
    Client->>Gateway: Request, optional traceparent/correlation
    Gateway->>Gateway: Validate or create W3C trace + UUID
    Gateway->>Scheduling: Inject trace context
    Scheduling->>DB: EF span + parameterized query
    Scheduling->>DB: Booking + Outbox with trace metadata
    Scheduling-->>Client: Response + correlation ID
    Publisher->>DB: Claim Outbox
    Publisher->>MQ: Event + AMQP trace headers
    MQ->>Consumer: Delivery
    Consumer->>Consumer: Create consumer span linked to producer
```

Nguồn: [`request-tracing.puml`](request-tracing.puml).

