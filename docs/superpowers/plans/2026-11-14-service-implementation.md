# TutorMatching Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a runnable .NET 10 TutorMatching microservice workspace from the approved technical handbook.

**Architecture:** A monorepo solution contains YARP Gateway, five independently deployable minimal-API services, a small integration-contract building block, database-per-service persistence, Redis booking holds and RabbitMQ outbox/inbox messaging. Each task is a vertical slice with its own tests and commit.

**Tech Stack:** .NET 10, ASP.NET Core, EF Core/Npgsql, PostgreSQL 17, Redis 7.4, RabbitMQ 3.13, YARP, xUnit, Testcontainers, Docker Compose, Postman CLI.

**Spec:** `docs/superpowers/specs/2026-11-14-service-implementation-design.md`

## Global Constraints

- Public APIs are versioned under `/api/v1`; internal APIs under `/internal/v1` are never routed publicly.
- Each service owns one lowercase PostgreSQL database and never reads another service's database.
- Access tokens last 15 minutes; refresh sessions last 7 days; booking holds last 300 seconds.
- API failures use Problem Details and do not leak secrets or raw exception messages.
- Production code requires a test that failed first; each vertical slice ends with build and test verification.

## Review Focus

- Concurrent holds and confirmations must never double-book tutor or student.
- Refresh-token replay must revoke the token family.
- Duplicate RabbitMQ delivery must not create duplicate notifications.
- Gateway must not expose internal endpoints or silently turn dependency failure into empty results.
- Containers must become ready in dependency order without relying on host-only addresses.

---

### Task 1: Renderable Markdown diagrams

**Files:** Create five grouped `docs/diagrams/*.md` pages; modify `docs/diagrams/README.md`.

- [ ] Write a structural check that requires Mermaid blocks for every documented diagram.
- [ ] Add Architecture, Domain, Data, Sequence and State/Infrastructure pages.
- [ ] Run Markdown, link and Mermaid fence checks; commit and push the documentation milestone.

### Task 2: Workspace and shared host conventions

**Files:** Create `TutorMatching.slnx`, `src/`, `tests/`, `Directory.Build.props`, `Directory.Packages.props`, `global.json`.

- [ ] Add failing architecture tests for project references and public route boundaries.
- [ ] Scaffold five services, Gateway, BuildingBlocks and test projects.
- [ ] Add common Problem Details, JWT and observability conventions; build and test.

### Task 3: Identity vertical slice

**Files:** `src/Services/Identity/**`, `tests/Identity.*Tests/**`.

- [ ] Test registration, login, JWT claims, refresh rotation/replay and authorization policies.
- [ ] Implement domain, EF schema/migration and endpoints.
- [ ] Run Identity unit/integration tests and commit.

### Task 4: Tutor and Student vertical slices

**Files:** `src/Services/Tutor/**`, `src/Services/Student/**`, corresponding tests.

- [ ] Test profile ownership, validation, subject/interest replacement and overlapping availability.
- [ ] Implement schemas, endpoints and internal lookup contracts.
- [ ] Run both service suites and commit.

### Task 5: Scheduling vertical slice

**Files:** `src/Services/Scheduling/**`, `tests/Scheduling.*Tests/**`.

- [ ] Test slot rules, hold ownership/token/TTL, idempotent confirmation/cancel and overlap races.
- [ ] Implement Redis Lua hold, booking constraints, outbox and endpoints.
- [ ] Run unit and container-backed integration tests; commit.

### Task 6: Notification vertical slice

**Files:** `src/Services/Notification/**`, `tests/Notification.*Tests/**`.

- [ ] Test inbox idempotency, reminder scheduling, retry/lease and mark-read authorization.
- [ ] Implement consumer, persistence, worker, in-app and SMTP adapters.
- [ ] Run tests and commit.

### Task 7: Gateway, Compose and executable API contract

**Files:** `src/Gateway/**`, `compose*.yml`, `postman/**`, `.env.example`.

- [ ] Test public routing, JWT validation and internal-route rejection.
- [ ] Add YARP routes, containers, health checks, Postman collection/environment.
- [ ] Validate Compose, boot the stack, run migrations, health and Postman smoke tests; commit.

### Task 8: Full verification and delivery

- [ ] Run formatting, build, unit/integration tests, docs validation and secret scan.
- [ ] Re-read the specification and record any intentionally deferred item.
- [ ] Push the implementation branch and report exact verification evidence.

