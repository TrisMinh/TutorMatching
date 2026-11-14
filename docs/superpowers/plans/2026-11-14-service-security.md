# Service security implementation and reporting

Preserve Scheduling=3 and all other APIs/Gateway=1; preserve existing volumes/data. Harden the existing application rather than adding unnecessary services.

1. Generate ignored local CA, per-workload certificates, RSA JWT signing key/public verification key and per-service audit keys; mount only each workload's own private material. Identity alone receives JWT private key. Pin validation algorithm to prevent HS/RS confusion.
2. Add TLS/mTLS Kestrel endpoints. Keep HTTP health probes only on each API. Use TLS-passthrough internal HAProxy pools so receiving services verify the actual caller certificate, not an untrusted forwarded header. Enforce explicit caller allowlists on internal routes. Keep user JWT/ownership checks as a separate layer. Add HTTPS localhost ingress/frontend; describe any retained loopback HTTP development access.
3. Add shared Redis-backed session/token revocation with fail-closed validation. Logout/revoke must revoke access family as well as refresh state; add own-session revoke-all and administrative invalidation. Revocation must be visible across all three Scheduling replicas.
4. Add security audit with allowlisted fields (no credentials/body/query), UTC actor/action/resource/status/trace metadata and persistent integrity-protected JSONL. Document that a same-host log is not legal non-repudiation or an independently immutable archive. Add basic authentication throttling and browser security headers.
5. Verify cryptography, permissions, revocation, audit redaction/integrity, TLS rejection/caller rules, actual course/booking flows and Scheduling failover on Docker. Do not weaken validation to make tests pass.
6. Split detailed Vietnamese Markdown into security overview/threat model, JWT/identity, authorization/BOLA, mTLS/service identity, revocation, audit, secrets/operations, lesson mapping, and a separate instance/retry/rollback report. Link current evidence and state limitations honestly (no invented OIDC/WS-Security/signature-by-student capabilities).

## Completed evidence

Secure overlay deployed with Scheduling=3, others=1. RS256, HTTP mTLS/caller rules, Redis TLS/ACL/revocation, broker mTLS/per-service users, signed events and persistent audit verified. Database passwords rotated to generated per-context values; Student credential denied at IdentityDb. No volume deletion or original course/booking replacement.

55 .NET tests passed; 2 outbox + 1 multi-worker PostgreSQL cases executed separately with generated secure credentials through temporary proxies; 6 HTTPS live browser cases passed. Security probes include cache outage fail-closed/reconnect/revocation persistence and direct revocation checks on all three Scheduling nodes. HA and booking workflow verify crash recovery and signed confirmed/cancelled notifications. Latest copied audit snapshot: 35 streams, 8,026 HMAC/schema-verified entries, including successful-login actor and created/replayed booking result IDs.

Detailed chapters indexed in docs/04-security/README.md; instance/retry reports in docs/03-platform; secure runbook in docs/05-operations. ADR 013 supersedes HMAC/deferred-service-identity baseline. Limits explicitly documented: local CA lifecycle/trust, JS token storage, no full OIDC/SSO/MFA, non-WORM audit, no user transaction non-repudiation/message encryption, DB/SMTP TLS and SQL runtime-role separation still pending. Original 95 confirmed bookings retained, zero course-booking conflicts after fixture cleanup.
