# Complete Technical Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an implementation-ready Markdown documentation set and PlantUML diagram suite for the complete TutorMatching platform.

**Architecture:** Treat the existing design report as the baseline and convert it into a modular, normative engineering handbook. Separate system-wide contracts, per-service specifications, infrastructure runbooks, security, testing, and operations so each file has one clear owner and can be implemented independently without inventing missing decisions.

**Tech Stack:** .NET 10, ASP.NET Core, EF Core, YARP, PostgreSQL, Redis 7, RabbitMQ 3, React, Docker Compose, JWT, OpenTelemetry, Serilog, xUnit, Testcontainers, PlantUML.

**Spec:** `docs/TutorMatching_BaoCaoThietKe_HoanThien.docx`

## Global Constraints

- All public routes use `/api/v1`; internal health routes use `/health/live` and `/health/ready`.
- Store all timestamps as UTC `timestamptz` and exchange them as ISO 8601 strings with a `Z` suffix.
- Use UUID identifiers across service boundaries.
- Each service owns its PostgreSQL database, migrations, credentials, and schema; cross-database queries are forbidden.
- Confirm bookings immediately from a valid hold; use fixed 60-minute slots and a 5-minute hold TTL.
- PostgreSQL is the booking source of truth; Redis is never authoritative for confirmed bookings.
- Use Docker Compose DNS for discovery in the first release; Consul is explicitly out of scope.
- Publish booking integration events through a transactional outbox; consumers are idempotent and use bounded retry plus DLQ.
- Never commit secrets; inject JWT keys, database passwords, RabbitMQ credentials, and provider credentials through environment variables or secret stores.
- Documentation language is Vietnamese; identifiers, routes, payload fields, and code-level names remain English.

## Review Focus

- Concurrent confirmation attempts for the same tutor slot or overlapping student slot must produce at most one confirmed booking.
- Expired, stolen, replayed, or mismatched hold tokens must return deterministic errors without creating a booking.
- Duplicate and out-of-order RabbitMQ events must not create duplicate notifications or regress state.
- JWT validation must agree across Gateway and services on issuer, audience, signing key, clock skew, and role/subject claims.
- Compose startup, health checks, migrations, dependency outages, and restart recovery must be executable from the documented commands.

---

### Task 1: Documentation Information Architecture and Decision Record

**Files:**
- Create: `docs/README.md`
- Create: `docs/00-overview/system-scope.md`
- Create: `docs/00-overview/technology-baseline.md`
- Create: `docs/00-overview/implementation-roadmap.md`
- Create: `docs/01-architecture/architecture-decisions.md`

**Interfaces:**
- Consumes: Baseline scope, service boundaries, technology choices, and open questions from the source report.
- Produces: Canonical decisions, terminology, navigation, delivery phases, and repository layout referenced by all later documents.

- [ ] **Step 1: Write the documentation index and scope documents**

Define the intended readers, normative wording, document map, goals, non-goals, actors, use cases, bounded contexts, and the fixed decisions in Global Constraints.

- [ ] **Step 2: Write the architecture decision log**

Record accepted decisions for five services, database-per-service, synchronous REST versus asynchronous events, immediate confirmation, fixed slots, Redis hold semantics, PostgreSQL conflict enforcement, outbox, Docker DNS, API composition, and notification channels.

- [ ] **Step 3: Verify navigation and decision consistency**

Run: `rg -n "TBD|TODO|cần chốt|nếu dùng|tùy chọn" docs -g "*.md"`
Expected: No unresolved architectural decision in implementation documents; historical alternatives may appear only when explicitly marked rejected or deferred.

- [ ] **Step 4: Commit**

```bash
git add docs/README.md docs/00-overview docs/01-architecture/architecture-decisions.md
git commit -m "docs: define implementation-ready architecture baseline"
```

### Task 2: System Architecture and Cross-Service Contracts

**Files:**
- Create: `docs/01-architecture/system-architecture.md`
- Create: `docs/01-architecture/domain-model.md`
- Create: `docs/01-architecture/service-communication.md`
- Create: `docs/01-architecture/api-standards.md`
- Create: `docs/01-architecture/event-catalog.md`
- Create: `docs/01-architecture/data-ownership.md`

**Interfaces:**
- Consumes: Decisions and vocabulary from Task 1.
- Produces: System boundaries, canonical REST/error/pagination/time conventions, event envelopes, context relationships, and ownership rules consumed by every service specification.

- [ ] **Step 1: Specify the runtime and domain architecture**

Document components, trust boundaries, request paths, bounded contexts, aggregates, ubiquitous language, dependency rules, and allowed communication paths.

- [ ] **Step 2: Specify shared API and event contracts**

Define versioning, headers, Problem Details error shape, pagination, idempotency, correlation, retry/timeouts, event envelope, routing keys, compatibility rules, and sample payloads.

- [ ] **Step 3: Specify data ownership and consistency**

Define authoritative stores, eventual consistency, outbox/inbox behavior, read composition, retention, and prohibited cross-service access.

- [ ] **Step 4: Verify contract vocabulary**

Run: `rg -n "BookingConfirmed|BookingCancelled|correlationId|traceId|Idempotency-Key|/api/v1" docs/01-architecture`
Expected: Every listed cross-service concept has one canonical definition and examples use matching field names.

- [ ] **Step 5: Commit**

```bash
git add docs/01-architecture
git commit -m "docs: specify system architecture and contracts"
```

### Task 3: Identity, Tutor, and Student Service Specifications

**Files:**
- Create: `docs/02-services/identity-service.md`
- Create: `docs/02-services/tutor-service.md`
- Create: `docs/02-services/student-service.md`

**Interfaces:**
- Consumes: API standards, JWT claims, UUID/time rules, ownership matrix, and service communication rules from Tasks 1-2.
- Produces: Implementable domain models, PostgreSQL schemas, endpoints, authorization matrices, use-case flows, validation, configuration, migrations, failure behavior, and test cases for the three services.

- [ ] **Step 1: Specify Identity Service**

Include user lifecycle, password hashing, access/refresh token rotation, claims, revocation, database DDL-level schema, endpoint request/response examples, rate limits, configuration variables, migrations, audit rules, and tests.

- [ ] **Step 2: Specify Tutor Service**

Include profile/subject/availability aggregates, overlap rules, database indexes and constraints, search/pagination, ownership authorization, endpoint contracts, cache invalidation, configuration, and tests.

- [ ] **Step 3: Specify Student Service**

Include profile, education level, learning goals, subject interests, Tutor visibility only for related bookings, database schema, endpoint contracts, authorization, configuration, and tests.

- [ ] **Step 4: Verify every service has the complete implementation checklist**

Run: `rg -n "Trách nhiệm|Mô hình miền|Cơ sở dữ liệu|API|Phân quyền|Biến môi trường|Migration|Kiểm thử|Health" docs/02-services`
Expected: Each of the three files contains every implementation section.

- [ ] **Step 5: Commit**

```bash
git add docs/02-services/identity-service.md docs/02-services/tutor-service.md docs/02-services/student-service.md
git commit -m "docs: specify identity tutor and student services"
```

### Task 4: Scheduling and Notification Service Specifications

**Files:**
- Create: `docs/02-services/scheduling-service.md`
- Create: `docs/02-services/notification-service.md`

**Interfaces:**
- Consumes: Hold, booking, outbox, event, authorization, and data ownership contracts from Tasks 1-2.
- Produces: Precise algorithms and persistence models for the core booking flow and asynchronous delivery pipeline.

- [ ] **Step 1: Specify Scheduling Service**

Define Booking and OutboxMessage schemas, PostgreSQL range/exclusion constraints, Redis key and Lua semantics, hold token binding, transaction boundaries, state machine, REST contracts, authorization, cancellation, outbox publisher, concurrency behavior, errors, configuration, migrations, and tests.

- [ ] **Step 2: Specify Notification Service**

Define Notification, ProcessedEvent, ReminderSchedule, and DeliveryAttempt schemas; queue bindings; inbox idempotency; retry/DLQ; reminder worker claiming; in-app delivery; development email sink; endpoints; configuration; and tests.

- [ ] **Step 3: Verify race and replay cases are explicit**

Run: `rg -n "exclusion|atomic|Lua|FOR UPDATE|outbox|idempoten|duplicate|DLQ|SKIP LOCKED" docs/02-services`
Expected: Scheduling documents atomic conflict protection and Notification documents duplicate-safe processing and worker claiming.

- [ ] **Step 4: Commit**

```bash
git add docs/02-services/scheduling-service.md docs/02-services/notification-service.md
git commit -m "docs: specify scheduling and notification services"
```

### Task 5: Gateway, JWT, and Security Specifications

**Files:**
- Create: `docs/03-platform/api-gateway.md`
- Create: `docs/04-security/jwt-and-authorization.md`
- Create: `docs/04-security/security-hardening.md`
- Create: `docs/04-security/secrets-and-data-protection.md`

**Interfaces:**
- Consumes: Public endpoints, roles, ownership rules, JWT claims, composition needs, and service routes from Tasks 2-4.
- Produces: YARP route map, public/internal port boundary, rate limits, CORS, composition behavior, JWT validation settings, threat controls, secret handling, and security tests.

- [ ] **Step 1: Specify YARP Gateway configuration**

Document routes/clusters, transforms, timeouts, rate-limit policies, CORS, forwarded headers, health behavior, composition endpoint, partial failure rules, and sample configuration.

- [ ] **Step 2: Specify JWT and authorization**

Define token fields, lifetimes, key requirements, refresh rotation, validation parameters, clock skew, policies, ownership checks, and 401 versus 403 behavior.

- [ ] **Step 3: Specify security hardening and secrets**

Cover OWASP API threats, mass assignment, SSRF, injection, logging redaction, TLS assumptions, container hardening, dependency scanning, data classification, backup encryption, secret rotation, and incident response.

- [ ] **Step 4: Verify security settings agree**

Run: `rg -n "Issuer|Audience|ClockSkew|AccessToken|RefreshToken|HMAC|JWT__|401|403|rate" docs/03-platform docs/04-security docs/02-services/identity-service.md`
Expected: The same JWT names, lifetimes, claims, and authorization semantics appear across all relevant documents.

- [ ] **Step 5: Commit**

```bash
git add docs/03-platform/api-gateway.md docs/04-security
git commit -m "docs: define gateway jwt and security controls"
```

### Task 6: PostgreSQL, Redis, RabbitMQ, and Docker Specifications

**Files:**
- Create: `docs/03-platform/postgresql.md`
- Create: `docs/03-platform/redis.md`
- Create: `docs/03-platform/rabbitmq.md`
- Create: `docs/03-platform/docker-compose.md`
- Create: `docs/03-platform/ports-and-networking.md`
- Create: `docs/03-platform/configuration-reference.md`

**Interfaces:**
- Consumes: All persistence schemas, Redis operations, event topology, service dependencies, health endpoints, and environment variables from Tasks 2-5.
- Produces: Exact container topology, internal/external ports, database roles and names, volumes, health checks, startup dependencies, broker declarations, Redis policies, environment variable catalog, and operational commands.

- [ ] **Step 1: Specify PostgreSQL and Redis**

Document one database/user per service, extensions, migrations, indexes, constraints, pooling, backup/restore, readiness, Redis keyspace, TTL, atomic scripts, eviction, persistence stance, ACL, failure behavior, and inspection commands.

- [ ] **Step 2: Specify RabbitMQ**

Document virtual host, users, exchange, queues, routing keys, DLX/DLQ, durability, publisher confirms, prefetch, retry topology, message envelope, observability, and inspection/replay procedures.

- [ ] **Step 3: Specify Compose, ports, networking, and configuration**

Provide canonical service/container names, internal and host ports, network exposure, volumes, health checks, dependency conditions, profiles, environment files, startup/shutdown/reset commands, and the complete variable matrix with safe development defaults.

- [ ] **Step 4: Verify every named dependency has health and configuration coverage**

Run: `rg -n "5432|6379|5672|15672|8080|health|depends_on|ConnectionStrings__|RabbitMq__|Redis__" docs/03-platform`
Expected: Ports, health checks, Compose dependencies, and environment variable names are consistent.

- [ ] **Step 5: Commit**

```bash
git add docs/03-platform
git commit -m "docs: specify data messaging and container infrastructure"
```

### Task 7: Observability, Operations, Testing, and Delivery

**Files:**
- Create: `docs/05-operations/observability.md`
- Create: `docs/05-operations/runbook.md`
- Create: `docs/05-operations/backup-and-recovery.md`
- Create: `docs/06-testing/test-strategy.md`
- Create: `docs/06-testing/e2e-scenarios.md`
- Create: `docs/06-testing/postman-guide.md`
- Create: `docs/07-delivery/development-workflow.md`
- Create: `docs/07-delivery/definition-of-done.md`
- Create: `docs/07-delivery/team-ownership.md`

**Interfaces:**
- Consumes: Health endpoints, error codes, traces, dependencies, schemas, flows, and ownership decisions from all previous tasks.
- Produces: Logs/metrics/traces contract, incident and recovery procedures, executable test matrix, Postman environments, CI gates, branch/PR workflow, ownership, and per-service completion criteria.

- [ ] **Step 1: Specify observability and operational runbooks**

Define correlation propagation, structured log fields, OpenTelemetry spans, metrics, dashboards/alerts, health semantics, common incident procedures, dependency outage behavior, backup, restore, and recovery objectives.

- [ ] **Step 2: Specify the test strategy and scenarios**

Map unit, integration, contract, API, E2E, concurrency, resilience, and security tests to services; give setup, fixtures, commands, expected status codes, and assertions for the critical booking path and Review Focus cases.

- [ ] **Step 3: Specify delivery workflow and ownership**

Define repository layout, local development sequence, migration ownership, OpenAPI/event compatibility gates, CI stages, PR checks, Definition of Done, and the five-member responsibility matrix.

- [ ] **Step 4: Verify all critical behaviors have tests and owners**

Run: `rg -n "concurr|race|expired|duplicate|out-of-order|401|403|409|429|restart|backup|restore" docs/05-operations docs/06-testing docs/07-delivery`
Expected: Each critical condition has a test or runbook outcome and an accountable service owner.

- [ ] **Step 5: Commit**

```bash
git add docs/05-operations docs/06-testing docs/07-delivery
git commit -m "docs: add operations testing and delivery handbook"
```

### Task 8: PlantUML Diagram Suite

**Files:**
- Create: `docs/diagrams/README.md`
- Create: `docs/diagrams/system-context.puml`
- Create: `docs/diagrams/container-architecture.puml`
- Create: `docs/diagrams/deployment-compose.puml`
- Create: `docs/diagrams/ddd-context-map.puml`
- Create: `docs/diagrams/identity-domain.puml`
- Create: `docs/diagrams/tutor-domain.puml`
- Create: `docs/diagrams/student-domain.puml`
- Create: `docs/diagrams/scheduling-domain.puml`
- Create: `docs/diagrams/notification-domain.puml`
- Create: `docs/diagrams/database-erd.puml`
- Create: `docs/diagrams/login-sequence.puml`
- Create: `docs/diagrams/search-sequence.puml`
- Create: `docs/diagrams/booking-sequence.puml`
- Create: `docs/diagrams/cancel-sequence.puml`
- Create: `docs/diagrams/notification-sequence.puml`
- Create: `docs/diagrams/booking-state.puml`
- Create: `docs/diagrams/rabbitmq-topology.puml`
- Create: `docs/diagrams/redis-hold-flow.puml`
- Create: `docs/diagrams/request-tracing.puml`

**Interfaces:**
- Consumes: Component names, routes, schemas, state transitions, data ownership, event topology, and operations flows from Tasks 1-7.
- Produces: Source-controlled visual models linked from the relevant Markdown files.

- [ ] **Step 1: Create architecture and deployment diagrams**

Model users, frontend, Gateway, five services, five databases, Redis, RabbitMQ, Docker network, trust boundaries, public ports, and allowed dependencies.

- [ ] **Step 2: Create domain and ER diagrams**

Model bounded contexts, aggregates/value objects, per-service tables, keys, indexes/unique rules, and cross-service identifiers without false foreign keys.

- [ ] **Step 3: Create sequence, state, messaging, and observability diagrams**

Model login, search composition, hold/confirm, cancellation, outbox-to-notification, booking state machine, RabbitMQ retry/DLQ, atomic Redis hold, and trace propagation.

- [ ] **Step 4: Validate PlantUML sources**

Run: `plantuml -checkonly docs/diagrams/*.puml`
Expected: Exit code 0. If PlantUML is unavailable, verify every file has matching `@startuml`/`@enduml`, no duplicate aliases in a file, and document the exact Docker render command in `docs/diagrams/README.md`.

- [ ] **Step 5: Commit**

```bash
git add docs/diagrams
git commit -m "docs: add complete PlantUML diagram suite"
```

### Task 9: Final Consistency and Implementation-Readiness Review

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: Any document or diagram with a discovered inconsistency.

**Interfaces:**
- Consumes: The full documentation corpus from Tasks 1-8.
- Produces: A navigable, internally consistent implementation handbook with no unresolved critical decisions.

- [ ] **Step 1: Link the repository README to the documentation handbook**

Keep the root README concise and point to the architecture baseline, service specifications, local startup procedure, tests, and diagrams.

- [ ] **Step 2: Run unresolved-marker and secret scans**

Run: `rg -n "TBD|TODO|FIXME|CHANGE_ME|<password>|secret123|localhost:[0-9]+" docs README.md`
Expected: No unresolved marker or unsafe credential; localhost references are restricted to documented host-facing development endpoints.

- [ ] **Step 3: Run cross-document terminology and port checks**

Run: `rg -n "IdentityDb|TutorDb|StudentDb|SchedulingDb|NotificationDb|808[0-9]|543[2-9]|5672|6379|15672" docs`
Expected: Database names and port assignments match the canonical configuration reference and diagrams.

- [ ] **Step 4: Run Markdown and PlantUML structural checks**

Run: `npx --yes markdownlint-cli2 "README.md" "docs/**/*.md"`
Expected: Exit code 0, or only explicitly documented style exceptions. Also run the PlantUML validation command from Task 8.

- [ ] **Step 5: Review the critical path end to end**

Trace register/login, tutor availability, search composition, hold, confirmation, exclusion constraint, outbox publish, RabbitMQ consume, notification creation, reminder delivery, cancellation, and restart recovery. Confirm every step names the owning service, store, API/event contract, failure result, observability signal, and test.

- [ ] **Step 6: Commit**

```bash
git add README.md docs
git commit -m "docs: finalize TutorMatching implementation handbook"
```
