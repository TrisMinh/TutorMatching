# Retry and recovery safety

Keep direct enrollment and existing demo data. Restore notification event heading with learner identity/class/time (independent UI task).

1. API client: retry safe reads and explicitly repeatable confirm-by-hold, enrollment-by-course/student and cancellation only. Reuse exact request body/key; bounded attempts, timeout, exponential jitter, Retry-After bounded to budget; never retry validation/auth/domain-conflict or account creation/hold creation/profile writes. Distinguish schedule lock contention from a booking conflict.
2. Confirm replay must authenticate ownership before returning an already-created booking. Verify supplied hold token against durable token hash so guessed IDs cannot retrieve someone else's result; preserve original hold ID/body for retry.
3. Scheduling outbox: claim each eligible event with PostgreSQL row locking SKIP LOCKED inside a transaction; bounded broker publish; commit published/failure metadata with jitter. Process death releases DB lock automatically. At-least-once publication is expected; consumer event identity prevents duplicate notifications. Leave exhausted events durably inspectable for explicit replay.
4. Schedule lock: acquisition failures fail closed with 503; busy has explicit retryable code. Release failure after commit is logged, never turns a successful write into a false failure. Preserve conservative TTL; no unproven lease shortening.
5. Readiness checks DB/Redis where required; Rabbit outage does not invalidate a successful booking because outbox retains notification work.
6. Verify unit retry policy, lost-response replay, invalid ownership, fail-before-commit rollback, concurrent workers and terminated DB session recovery. Document SMTP external-send ambiguity: duplicate email after send-before-commit remains possible without provider idempotency. This work is not multi-host/database HA.
