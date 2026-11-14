namespace TutorMatching.Scheduling.Api.Domain;

public enum BookingStatus
{
    Confirmed,
    Cancelled,
}

public readonly record struct TimeSlot
{
    private TimeSlot(DateTimeOffset startAtUtc, DateTimeOffset endAtUtc)
    {
        StartAtUtc = startAtUtc;
        EndAtUtc = endAtUtc;
    }

    public DateTimeOffset StartAtUtc { get; }
    public DateTimeOffset EndAtUtc { get; }

    public static TimeSlot Create(DateTimeOffset startAtUtc, DateTimeOffset endAtUtc)
    {
        if (startAtUtc.Offset != TimeSpan.Zero || endAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Booking slots must be expressed in UTC.");
        }

        if (startAtUtc.Second != 0 || startAtUtc.Millisecond != 0 || startAtUtc.Minute is not (0 or 30))
        {
            throw new ArgumentException("Booking start must align to minute 00 or 30.", nameof(startAtUtc));
        }

        if (endAtUtc - startAtUtc != TimeSpan.FromMinutes(60))
        {
            throw new ArgumentException("A booking slot must last exactly 60 minutes.", nameof(endAtUtc));
        }

        return new TimeSlot(startAtUtc, endAtUtc);
    }

    public bool Overlaps(TimeSlot other) => StartAtUtc < other.EndAtUtc && other.StartAtUtc < EndAtUtc;
}

public sealed class Booking
{
    private Booking()
    {
    }

    public Guid Id { get; private set; }
    public Guid StudentId { get; private set; }
    public Guid StudentUserId { get; private set; }
    public Guid TutorId { get; private set; }
    public Guid TutorUserId { get; private set; }
    public Guid SubjectId { get; private set; }
    public DateTimeOffset StartAtUtc { get; private set; }
    public DateTimeOffset EndAtUtc { get; private set; }
    public BookingStatus Status { get; private set; }
    public Guid SourceHoldId { get; private set; }
    public DateTimeOffset ConfirmedAtUtc { get; private set; }
    public DateTimeOffset? CancelledAtUtc { get; private set; }
    public Guid? CancelledByUserId { get; private set; }
    public string? CancellationReason { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public int Version { get; private set; }
    public TimeSlot Slot => TimeSlot.Create(StartAtUtc, EndAtUtc);

    public static Booking ConfirmFromHold(
        Guid sourceHoldId,
        Guid studentId,
        Guid studentUserId,
        Guid tutorId,
        Guid tutorUserId,
        Guid subjectId,
        TimeSlot slot,
        DateTimeOffset now) => new()
        {
            Id = Guid.NewGuid(),
            SourceHoldId = sourceHoldId,
            StudentId = studentId,
            StudentUserId = studentUserId,
            TutorId = tutorId,
            TutorUserId = tutorUserId,
            SubjectId = subjectId,
            StartAtUtc = slot.StartAtUtc,
            EndAtUtc = slot.EndAtUtc,
            Status = BookingStatus.Confirmed,
            ConfirmedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            Version = 1,
        };

    public bool Cancel(Guid actorUserId, string reason, DateTimeOffset now)
    {
        if (actorUserId != StudentUserId && actorUserId != TutorUserId)
        {
            throw new UnauthorizedAccessException("Only booking participants can cancel a booking.");
        }

        if (Status == BookingStatus.Cancelled)
        {
            return false;
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(reason);
        Status = BookingStatus.Cancelled;
        CancelledAtUtc = now;
        CancelledByUserId = actorUserId;
        CancellationReason = reason.Trim();
        UpdatedAtUtc = now;
        Version++;
        return true;
    }
}

