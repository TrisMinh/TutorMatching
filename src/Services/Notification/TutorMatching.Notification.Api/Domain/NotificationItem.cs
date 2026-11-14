namespace TutorMatching.Notification.Api.Domain;

public enum ReadStatus
{
    Unread,
    Read,
}

public enum DeliveryStatus
{
    Pending,
    Processing,
    Sent,
    Cancelled,
    Failed,
}

public sealed class NotificationItem
{
    private NotificationItem()
    {
    }

    public Guid Id { get; private set; }
    public Guid RecipientUserId { get; private set; }
    public Guid BookingId { get; private set; }
    public string Type { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public string Body { get; private set; } = string.Empty;
    public ReadStatus Status { get; private set; }
    public Guid SourceEventId { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset? ReadAtUtc { get; private set; }

    public static NotificationItem Create(
        Guid recipientUserId,
        Guid bookingId,
        Guid sourceEventId,
        string type,
        string title,
        string body,
        DateTimeOffset now)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(type);
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        return new NotificationItem
        {
            Id = Guid.NewGuid(),
            RecipientUserId = recipientUserId,
            BookingId = bookingId,
            SourceEventId = sourceEventId,
            Type = type,
            Title = title,
            Body = body,
            Status = ReadStatus.Unread,
            CreatedAtUtc = now,
        };
    }

    public bool MarkRead(Guid actorUserId, DateTimeOffset now)
    {
        if (actorUserId != RecipientUserId)
        {
            throw new UnauthorizedAccessException("Only the recipient can mark this notification as read.");
        }

        if (Status == ReadStatus.Read)
        {
            return false;
        }

        Status = ReadStatus.Read;
        ReadAtUtc = now;
        return true;
    }
}

public sealed class ReminderSchedule
{
    private ReminderSchedule()
    {
    }

    public Guid Id { get; private set; }
    public Guid BookingId { get; private set; }
    public Guid RecipientUserId { get; private set; }
    public string ReminderType { get; private set; } = string.Empty;
    public DateTimeOffset ScheduledForUtc { get; private set; }
    public DeliveryStatus Status { get; private set; }
    public DateTimeOffset? LeaseUntilUtc { get; private set; }
    public int Attempts { get; private set; }
    public DateTimeOffset NextAttemptAtUtc { get; private set; }
    public string? LastError { get; private set; }
    public Guid SourceEventId { get; private set; }

    public static ReminderSchedule Create(
        Guid bookingId,
        Guid recipientUserId,
        Guid sourceEventId,
        string reminderType,
        DateTimeOffset scheduledForUtc) => new()
        {
            Id = Guid.NewGuid(),
            BookingId = bookingId,
            RecipientUserId = recipientUserId,
            SourceEventId = sourceEventId,
            ReminderType = reminderType,
            ScheduledForUtc = scheduledForUtc,
            NextAttemptAtUtc = scheduledForUtc,
            Status = DeliveryStatus.Pending,
        };

    public bool TryClaim(DateTimeOffset now, TimeSpan leaseDuration)
    {
        var available = Status == DeliveryStatus.Pending
            || (Status == DeliveryStatus.Processing && LeaseUntilUtc <= now);
        if (!available || ScheduledForUtc > now || NextAttemptAtUtc > now)
        {
            return false;
        }

        Status = DeliveryStatus.Processing;
        LeaseUntilUtc = now.Add(leaseDuration);
        return true;
    }

    public void MarkSent()
    {
        if (Status != DeliveryStatus.Processing)
        {
            throw new InvalidOperationException("Only a claimed reminder can be marked sent.");
        }

        Status = DeliveryStatus.Sent;
        LeaseUntilUtc = null;
        LastError = null;
    }

    public void MarkFailed(string error, DateTimeOffset now, int maxAttempts)
    {
        if (Status != DeliveryStatus.Processing)
        {
            throw new InvalidOperationException("Only a claimed reminder can fail.");
        }

        Attempts++;
        LastError = error.Length <= 1000 ? error : error[..1000];
        LeaseUntilUtc = null;
        if (Attempts >= maxAttempts)
        {
            Status = DeliveryStatus.Failed;
            return;
        }

        Status = DeliveryStatus.Pending;
        NextAttemptAtUtc = now.AddSeconds(Math.Min(300, Math.Pow(2, Attempts) * 10));
    }

    public void Cancel()
    {
        if (Status is not DeliveryStatus.Sent)
        {
            Status = DeliveryStatus.Cancelled;
            LeaseUntilUtc = null;
        }
    }
}

