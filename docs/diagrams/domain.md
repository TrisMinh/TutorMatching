# Sơ đồ domain

## Identity domain

```mermaid
classDiagram
    class UserAccount { +UUID Id +EmailAddress Email +Role Role +AccountStatus Status +Register() +VerifyPassword() +Disable() }
    class RefreshSession { +UUID Id +UUID FamilyId +string TokenHash +instant ExpiresAtUtc +Rotate() +RevokeFamily() }
    class EmailAddress
    class Role { <<enumeration>> Student Tutor Admin }
    class AccountStatus { <<enumeration>> Active Disabled }
    UserAccount "1" *-- "0..*" RefreshSession
    UserAccount *-- EmailAddress
    UserAccount --> Role
    UserAccount --> AccountStatus
```

Nguồn: [`identity-domain.puml`](identity-domain.puml).

## Tutor domain

```mermaid
classDiagram
    class TutorProfile { +UUID Id +UUID UserId +string DisplayName +UpdateProfile() +ReplaceSubjects() +ReplaceAvailability() }
    class TutorSubject { +UUID SubjectId +Level Proficiency }
    class AvailabilityWindow { +instant StartAtUtc +instant EndAtUtc +Overlaps() bool }
    class Subject { +UUID Id +string Code +bool IsActive }
    class Level { <<enumeration>> Beginner Intermediate Advanced Expert }
    TutorProfile "1" *-- "0..*" TutorSubject
    TutorProfile "1" *-- "0..*" AvailabilityWindow
    TutorSubject "*" --> "1" Subject
    TutorSubject --> Level
```

Nguồn: [`tutor-domain.puml`](tutor-domain.puml).

## Student domain

```mermaid
classDiagram
    class StudentProfile { +UUID Id +UUID UserId +string DisplayName +EducationLevel EducationLevel +string LearningGoal +string Timezone +UpdateProfile() +ReplaceInterests() }
    class SubjectInterest { +UUID SubjectId +int Priority }
    class EducationLevel { <<enumeration>> Primary LowerSecondary UpperSecondary University Adult }
    StudentProfile "1" *-- "0..*" SubjectInterest
    StudentProfile --> EducationLevel
```

Nguồn: [`student-domain.puml`](student-domain.puml).

## Scheduling domain

```mermaid
classDiagram
    class Booking { +UUID Id +UUID StudentId +UUID TutorId +TimeSlot Slot +BookingStatus Status +ConfirmFromHold() +Cancel(actor, reason) }
    class TimeSlot { +instant StartAtUtc +instant EndAtUtc +Overlaps() bool }
    class BookingStatus { <<enumeration>> Confirmed Cancelled }
    class BookingConfirmed
    class BookingCancelled
    class OutboxMessage
    Booking *-- TimeSlot
    Booking --> BookingStatus
    Booking ..> BookingConfirmed : raises
    Booking ..> BookingCancelled : raises
    BookingConfirmed ..> OutboxMessage : maps
    BookingCancelled ..> OutboxMessage : maps
```

Nguồn: [`scheduling-domain.puml`](scheduling-domain.puml).

## Notification domain

```mermaid
classDiagram
    class Notification { +UUID Id +UUID RecipientUserId +NotificationType Type +ReadStatus Status +MarkRead() }
    class ReminderSchedule { +UUID BookingId +instant ScheduledForUtc +DeliveryStatus Status +Claim() +MarkSent() +Retry() +Cancel() }
    class DeliveryAttempt
    class ProcessedEvent
    class DeliveryStatus { <<enumeration>> Pending Processing Sent Cancelled Failed }
    ReminderSchedule "1" *-- "0..*" DeliveryAttempt
    ReminderSchedule --> DeliveryStatus
    ProcessedEvent ..> Notification : idempotent creation
    ProcessedEvent ..> ReminderSchedule : idempotent scheduling
```

Nguồn: [`notification-domain.puml`](notification-domain.puml).

