# Postman smoke test

Collection v3 `TutorMatching Smoke` exercises the public Gateway flow: health,
student/tutor registration and login, both profiles, subject and availability,
composed search, Redis hold, PostgreSQL booking confirmation, and notification
query.

```powershell
postman collection lint "postman/collections/TutorMatching Smoke" --fail-severity warning
postman collection run "postman/collections/TutorMatching Smoke"
```

The collection generates unique email addresses and a future UTC booking slot
at run time. Start `compose.yaml` before the live run.
