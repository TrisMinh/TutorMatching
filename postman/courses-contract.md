# Course API

## Secure deployment contract (14 November 2026)

The secure overlay uses RS256, pinned algorithm/issuer/audience/lifetime, per-API Redis revocation checks, and mTLS caller identity for internal routes. Public JSON contracts and owner checks remain compatible. Identity alone receives the JWT private key. GET/POST user-context requests are not authorized merely by possession of a valid workload certificate.

`POST /api/v1/auth/revoke` revokes the access-token family in Redis as well as refresh state; `POST /api/v1/auth/revoke-all` requires authentication and targets only JWT sub. `POST /api/v1/users/{userId}/disable` is Admin-only and invalidates access/refresh while disabling login. Revoked tokens return 401; unavailable revocation checking fails closed with 503. Auth has a basic shared-proxy-source rate limit (429), not a claimed distributed per-user limit.

Internal Student lookup and Tutor availability require Scheduling certificate plus valid user JWT; internal slot batch query requires Gateway certificate plus JWT. Public ingress rejects `/internal/*`. HTTPS local endpoints are 3443 (web) and 8443 (API); HTTP 3000/8080 remains explicitly loopback-only demo compatibility. See [service security report](../docs/04-security/README.md) for exact guarantees and limitations.

Courses persist in TutorDb. Course.tutorId references a tutor profile; sessions and enrollments reference their course. Enrollment identity is the authenticated student user ID, never a client-supplied identity.

- GET /api/v1/courses: public catalog, instructor, enrollment count and sessions.
- GET /api/v1/courses/{id}: public course detail and sessions, without exposing enrolled user IDs.
- PUT /api/v1/courses/{id}: authenticated owning tutor. Requires title, positive capacity and non-overlapping sessions with end after start. Returns 403 for another tutor, 409 if capacity would exclude existing enrollments.
- POST /api/v1/courses/{id}/enrollments: student only. Idempotent for an existing enrollment; 409 for full course or overlap with another enrolled course. Capacity check and insert use a serializable transaction.

Seed: node scripts/seed-courses.mjs. Preserves the existing template names and images, creates four future sessions per course and registers existing demo students.
# Account course library

`GET /api/v1/bookings/{bookingId}/student-profile` requires Tutor role and verifies the booking belongs to the caller before reading the student service. Nonowned/unknown bookings return 404. Returns student id, name, avatar, education level, learning goal and timezone only. Missing/unavailable upstream profile returns 503. Student detail links are scoped to this booking; no general public student lookup is exposed.

## Enrollment alerts

Notice display metadata includes `className`, `startAtUtc`, `actorName` and optional `avatarUrl`; technical IDs are used for links/read operations, not visible copy. Student profile PUT accepts optional `avatarUrl` (up to 2,000,000 characters), GET returns the saved avatar, and participant-only booking detail exposes `studentAvatarUrl`. Omitting avatar on profile update preserves the saved value. Enrollment notices snapshot the registrant's saved name/avatar atomically with enrollment. Booking notification presentation resolves class/time/person from participant-scoped booking data, including for older notices; fallback text removes UUIDs and formats UTC timestamps as GMT+7.

Enrollment remains immediate and idempotent; there is no approval state. Each first successful enrollment creates one durable tutor notice in the same database transaction. Duplicate requests create no extra notices. `GET /api/v1/courses/enrollment-notifications` (Tutor only) returns only the caller's notices with courseId, student name, timestamp and read status. `PUT /api/v1/courses/enrollment-notifications/{noticeId}/read` (Tutor only) is idempotent and refuses access to other tutors' notices. The frontend combines these with existing booking notifications and opens the owned course detail on click.

Notification presentation preserves the event heading (New student enrolled / Booking confirmed), displays the actor name alongside a small saved avatar, then class and lesson time. Missing photos use initials; UUIDs and raw ISO timestamps are not displayed.

`POST /api/v1/bookings` confirmation replay uses the original hold ID and token. Once committed, the original student with matching token receives the same booking (200), including after Redis hold cleanup. Wrong student returns 404; missing/invalid durable token proof returns 409. New confirmations return 201. Scheduling lock contention/dependency outage returns retryable 503 with Retry-After; domain schedule conflicts remain 409. See [retry and recovery guarantees](../docs/retry-recovery.md) for bounded retries, transactional outbox recovery and operational limits.

The Docker HA override routes Scheduling through three health-checked replicas with no sticky session; Identity, Tutor, Student, Notification and Gateway each run one instance. Shared hold/proof/enrollment identities and response contracts remain unchanged across instance changes. Optional diagnostics headers identify the responding API/gateway only when enabled. Refresh rotation is serialized by token family; simultaneous reuse returns one 200 and one 401 and revokes the family, rather than creating two replacement branches. Concurrent duplicate email registration returns 201/409. See [deployment and failure verification](../docs/docker-multi-instance.md).

`GET /api/v1/bookings/{id}` requires participant authentication. Returns `{ booking, studentName }`; strangers and unknown IDs return 404 before a student lookup. The booking remains readable with `studentName: null` if the profile HTTP dependency is unreachable. Cancellation requires a nonblank reason of at most 300 characters; confirmed lessons already started return 409. Repeating cancellation for an already cancelled booking remains idempotent (204). Nonparticipants cannot cancel (403).

`GET /api/v1/tutors/me` requires Tutor role, resolves the caller's profile from JWT and returns the same shape as tutor public detail (including subjects and dated availability); missing profile returns 404. Availability PUT rejects end-before-start, non-UTC, off-30-minute-grid, or overlapping intervals with 400. Adjacent intervals are valid. Availability changes do not cancel confirmed bookings or override course conflicts.

Tutor booking screens use existing participant-scoped GET bookings and DELETE bookings/{id}?reasonCode. The backend confirms student reservations directly; there is no pending approval or completion endpoint. Past is a presentation classification of elapsed confirmed bookings, not a persisted completion claim.

`GET /api/v1/courses/mine` requires Student or Tutor authentication. Returns the same course shape as the catalog plus `isEnrolled`. For students it contains only courses with their persisted enrollment; for tutors only courses owned by their tutor profile. An empty list is valid. Other accounts' courses are not returned. Each result includes its ordered sessions and current enrollment count. The catalog remains available separately.

