using System.Text.Json;
using TutorMatching.Scheduling.Api.Domain;

namespace TutorMatching.Scheduling.Api.Infrastructure;

public sealed class OutboxMessage
{
    private OutboxMessage()
    {
    }

    public Guid Id { get; private set; }
    public string AggregateType { get; private set; } = string.Empty;
    public Guid AggregateId { get; private set; }
    public string EventType { get; private set; } = string.Empty;
    public int EventVersion { get; private set; }
    public string RoutingKey { get; private set; } = string.Empty;
    public string Payload { get; private set; } = string.Empty;
    public Guid CorrelationId { get; private set; }
    public Guid? CausationId { get; private set; }
    public string? Traceparent { get; private set; }
    public DateTimeOffset OccurredAtUtc { get; private set; }
    public DateTimeOffset? PublishedAtUtc { get; private set; }
    public int AttemptCount { get; private set; }
    public DateTimeOffset NextAttemptAtUtc { get; private set; }
    public DateTimeOffset? LockedUntilUtc { get; private set; }
    public string? LastError { get; private set; }

    public static OutboxMessage BookingConfirmed(
        Booking booking,
        Guid correlationId,
        string? traceparent,
        DateTimeOffset now) => Create(
            booking,
            "BookingConfirmed",
            "booking.confirmed.v1",
            new
            {
                bookingId = booking.Id,
                booking.StudentId,
                booking.StudentUserId,
                booking.TutorId,
                booking.TutorUserId,
                booking.SubjectId,
                booking.StartAtUtc,
                booking.EndAtUtc,
            },
            correlationId,
            traceparent,
            now);

    public static OutboxMessage BookingCancelled(
        Booking booking,
        Guid correlationId,
        string? traceparent,
        DateTimeOffset now) => Create(
            booking,
            "BookingCancelled",
            "booking.cancelled.v1",
            new
            {
                bookingId = booking.Id,
                booking.StudentUserId,
                booking.TutorUserId,
                booking.CancelledAtUtc,
                booking.CancelledByUserId,
                booking.CancellationReason,
            },
            correlationId,
            traceparent,
            now);

    public void MarkPublished(DateTimeOffset now)
    {
        PublishedAtUtc = now;
        LockedUntilUtc = null;
        LastError = null;
    }

    public void MarkFailed(string error, DateTimeOffset now)
    {
        AttemptCount++;
        LastError = error.Length <= 1000 ? error : error[..1000];
        NextAttemptAtUtc = now.AddSeconds(Math.Min(300,Math.Pow(2,Math.Min(AttemptCount,8)))+Random.Shared.NextDouble()*2);
        LockedUntilUtc = null;
    }

    private static OutboxMessage Create(
        Booking booking,
        string eventType,
        string routingKey,
        object payload,
        Guid correlationId,
        string? traceparent,
        DateTimeOffset now) => new()
        {
            Id = Guid.NewGuid(),
            AggregateType = "Booking",
            AggregateId = booking.Id,
            EventType = eventType,
            EventVersion = 1,
            RoutingKey = routingKey,
            Payload = JsonSerializer.Serialize(payload),
            CorrelationId = correlationId,
            Traceparent = traceparent,
            OccurredAtUtc = now,
            NextAttemptAtUtc = now,
        };
}

