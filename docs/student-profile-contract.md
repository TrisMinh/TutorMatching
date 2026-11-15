# Optional student learning profile

After registration and email verification, Student login opens the dashboard directly. No mandatory profile-completion page.

- `GET /api/v1/students/me` initializes a missing profile from the verified Identity account registration name. Concurrent first reads return the same persisted profile.
- School level starts as `Unspecified` (-1), learning goal as an empty string, and interests as an empty list. Existing levels retain their numeric values (0–4).
- `PUT /api/v1/students/me` requires a display name; educationLevel, learningGoal and timezone may be omitted (defaults: -1, empty string, Asia/Ho_Chi_Minh). Optional details can be cleared later.
- Profile initialization also applies to internal scheduling lookups and saving a tutor, so booking does not require filling optional learning details.
- Existing profiles and interests are preserved. Existing suspended profiles are never reactivated. Missing/deactivated/non-Student Identity accounts do not receive a new Student profile.
- Optional subject catalog failure does not prevent saving other profile details, and does not clear existing interests.

The Tutor publishing/onboarding flow is unchanged.
