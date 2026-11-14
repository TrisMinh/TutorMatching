# Three-instance Docker deployment

Deploy an additive `compose.ha.yaml` override. Three replicas each of identity, tutor, student, scheduling, notification and gateway share existing durable databases, Redis and RabbitMQ. Preserve named volumes and all course data. One HAProxy edge/internal service discovers replica addresses using Docker DNS and actively checks readiness; least-connections distributes requests without sticky sessions. Redis and PostgreSQL coordinate writes/workers across replicas.

Route gateway and service-to-service traffic through health-checked pools. Retry TCP connect failures only at HAProxy; do not replay uncertain writes. Application operation IDs/idempotency handle safe request replay after a lost response. Never claim migration of an executing stack frame or exactly-once SMTP.

Validate configuration, build, deploy with `--wait`, then prove three distinct responding instances per API, kill one replica and prove traffic uses survivors, restart it and prove rejoining. Prove confirmation replay across a killed original replica, shared refresh/auth state, duplicate enrollment prevention and worker transaction recovery. Always restore killed replicas in finally blocks. Check invariants and remove only test fixtures.

Review concurrent startup migrations, multi-consumer deduplication and reminder claims before scaling. Keep SQL transaction rollback and outbox retry/dead-letter recovery. Document two-minute crashed schedule-lock TTL, SMTP ambiguity, and single-host/datastore/load-balancer limits. Supply start/status/test/stop instructions with no volume deletion.

## Completed verification — 14 November 2026

- Docker deployed all 18 API/gateway replicas plus HAProxy; health checks passed.
- `verify-ha.mjs` passed for six pools: 3 distinct instance IDs, hard kill, 36 successful requests on survivors, restarted replica rejoined. Concurrent login, refresh rotation/family revocation and duplicate email registration passed.
- `HA_CHAOS=1 verify-tutor-workflow.mjs` passed shared-hold recovery, post-commit replay on a surviving instance, token/owner rejection, conflict checks and cancellation.
- Scheduling: 12 tests passed, including 2 real PostgreSQL transaction/worker recovery tests in isolated databases. Notification: 8 tests passed, including 3 concurrent projectors/workers on real PostgreSQL with 14 nonduplicated sends through a test email sender. Identity: 11 tests; Gateway: 4; Tutor: 4.
- Six live browser tests passed: enrollment alert and read-state persistence, notification metadata, lost-response enrollment replay, and persistent Student/Tutor navigation.
- Disposable fixtures cleaned; 95 confirmed bookings preserved, zero course/booking conflicts. Temporary database test proxies stopped. No named volumes deleted.

## Topology adjustment requested after initial deployment

The user reduced scope to three Scheduling replicas and one each of Identity, Tutor, Student, Notification and Gateway (8 API/gateway containers). Compose, HAProxy slots, verification script and current operational docs now reflect that topology. The historical eighteen-instance verification above records the earlier deployment, not the current configuration. After downscaling, verification passed all expected 1/1/1/1/3/1 instance counts and Scheduling hard-crash/survivor/rejoin checks.
