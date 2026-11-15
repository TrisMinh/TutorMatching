# Student–Tutor messaging (five services)

Messaging is a module in Notification and uses notification_db. It does not add a sixth service. Identity remains account owner; Tutor resolves public tutor profile IDs to their owning account through an authenticated internal contact endpoint.

## Contract

All `/api/v1/conversations` routes require a Student or Tutor JWT. Only Student can start a pair via `POST /` with `{tutorId}`. Server resolves both participants; arbitrary sender/recipient IDs are never trusted. One conversation per student/tutor pair, including concurrent starts. Only active visible tutors accept new contacts. Existing participants keep their history.

- `GET /?page=1&pageSize=50`: own conversations, latest activity first, peer name, preview, unread count, total.
- `GET /unread`: total incoming unread messages for the authenticated user.
- `GET /{id}`: own conversation metadata; outsiders receive 404.
- `GET /{id}/messages?before=<messageId>`: newest 50 in chronological order, hasMore and nextBefore for older history. Optional `after` fetches incoming batches in ascending ID order. Before/after are mutually exclusive.
- `POST /{id}/messages`: `{body,clientMessageId}`. Trimmed plain text 1–2000 characters (NUL is rejected); nonempty UUID required. Sender comes from JWT. Same sender/conversation/clientMessageId retries return the same record (200); new message returns 201. Reusing a key with different text returns 409.
- `POST /{id}/read`: `{messageId}` belonging to this conversation; advances only the caller's read cursor, monotonically. It never marks messages beyond the displayed one as read.

Messages are persisted before success. Browser polls open threads every 3 seconds and inbox/unread indicators periodically; this is not a WebSocket transport. No attachments, message deletion, or typing/presence in this version. Text is rendered escaped. API failures retain drafts and show retryable errors. The UI loads older history on demand.

## Verification

Verify real Student→Tutor→Student delivery and reload persistence, unread/read transitions, pagination, concurrent starts, retry deduplication, validation, outsider read/send/mark-read denial, anonymous denial and Tutor start denial. Browser tests cover desktop/tablet/mobile and stale request handling. Tests use demo/fixture accounts, never personal accounts.


## Reproducible checks

- `node scripts/verify-messaging.mjs`: real Gateway/PostgreSQL/Identity/Tutor checks; includes >50 stored fixture messages for pagination. Seed data is required.
- `postman collection run "postman/collections/TutorMatching Messaging"`: 20 requests / 24 assertions for role/membership, two-way delivery, read counts and retry semantics using seeded demo accounts.
- `npm run test:e2e:live -- messaging.spec.ts --workers=1` in the frontend: two browser sessions, persisted exchange, mobile/tablet/desktop, escaped HTML text and retained/retried draft after an injected 503. The injected 503 validates browser recovery, not an actual Notification outage.
- `MessagesScreen.test.tsx`: failed sends retain draft/retry key, IME composition does not prematurely send, loading failures remain errors, and failed new contacts stay visible/recoverable on mobile.

No private email addresses, access tokens or message contents from personal accounts are committed.
