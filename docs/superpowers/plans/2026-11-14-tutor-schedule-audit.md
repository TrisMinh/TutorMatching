# Tutor scheduling repair

Preserve the existing Teach visual system. Replace fixture-only tutor scheduling, booking management and availability with persisted account-specific data. Booking API confirms directly; do not invent pending approvals or completion records.

1. Add authenticated GET tutor/me using the same profile response as public detail, resolving ownership from JWT. Verify missing profile and role restrictions.
2. Replace tutor dashboard and schedule with own courses + confirmed bookings; reuse CourseCalendar, timezone select, week/day controls and automatic scroll. Course selection opens owned detail; booking selection opens its real ID. Dashboard statistics derive from real data; elapsed confirmed bookings are labelled Past, not fabricated Completed.
3. Replace fake requests with actual upcoming/past/cancelled booking tabs. Detail loads participant-scoped booking, supports persisted cancellation with explicit confirmation and failure feedback. No meeting-room or message action without a real destination.
4. Availability reads GET me, adds/removes dated UTC windows from controlled local date/time fields, rejects invalid/overlapping intervals, saves and reloads. Removing availability does not cancel existing bookings. Server rejects invalid/overlapping windows.
5. Test real account ownership, mixed calendar navigation, cancellation persistence/isolation, availability persistence/validation, responsive widths and reduced motion. Run existing overlap probes and data audit. Document remaining unsupported features accurately.
