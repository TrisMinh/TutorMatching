# Retry and recovery guarantees

The browser retries GET/HEAD and the explicitly repeatable booking confirmation, course enrollment, booking cancellation and notification-read operations. Each operation has at most three attempts, a five-second attempt timeout and a twelve-second total budget including response-body reading. Retry-After is respected within that budget. Validation, ownership and scheduling conflicts are not retried. Account creation, hold creation and profile writes are not automatically retried.

Confirmation retries use the original hold ID and token. The committed booking retains the token hash; replay returns the same booking only for the original student with valid proof, even after Redis releases the hold. Legacy bookings without a proof hash reject replay. Enrollment uses the course/student identity and only creates a notice for a new enrollment.

Scheduling writes fail closed when Redis is unavailable. Lock contention returns 503 with Retry-After; actual schedule conflicts return 409. The global write lock retains its conservative two-minute expiry. A crashed owner can therefore temporarily block writes; this is not an instant distributed failover guarantee. Cleanup failure after a database commit is logged without turning the committed write into an apparent failure.

Booking and outbox creation commit together. Outbox workers claim one row in a PostgreSQL transaction with FOR UPDATE SKIP LOCKED. The publish operation has a five-second deadline and RabbitMQ publisher confirmation. A dead database session releases its row lock. Publication is at least once: a crash after broker acceptance but before database commit can publish again with the same event ID; the notification consumer deduplicates that ID transactionally.

Failed publications use exponential backoff with jitter. After eight failures the event remains unpublished in the database for inspection; it is not deleted. After fixing the cause, an operator can replay exactly that retained event with `node scripts/replay-outbox.mjs <event-uuid>`. The command refuses published or non-exhausted events. Broker connection failures back off without consuming individual event attempts.

Readiness probes database connectivity and Redis for services that require it. RabbitMQ outage leaves notification work in the outbox and does not undo a committed booking. SMTP itself has no idempotency guarantee: a process crash after the mail server accepts a message but before delivery state commits can still cause duplicate email.

The additive `compose.ha.yaml` deployment runs three Scheduling replicas and one instance each of Identity, Tutor, Student, Notification and Gateway; see [Docker multi-instance deployment](docker-multi-instance.md). It does not add database failover or preserve work held only in process memory. Recovery relies on committed database state and shared Redis, not transferring an executing call between processes.
