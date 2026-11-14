using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TutorMatching.Notification.Api.Domain;

namespace TutorMatching.Notification.Api.Infrastructure;

public sealed class BookingEventProjector(NotificationDbContext dbContext)
{
    public async Task<bool> ApplyAsync(
        Guid eventId,
        string eventType,
        int eventVersion,
        JsonElement payload,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (await dbContext.ProcessedEvents.AnyAsync(item => item.EventId == eventId, cancellationToken))
        {
            return false;
        }

        dbContext.ProcessedEvents.Add(new ProcessedEvent
        {
            EventId = eventId,
            EventType = eventType,
            EventVersion = eventVersion,
            ProcessedAtUtc = now,
        });

        switch (eventType)
        {
            case "BookingConfirmed":
                AddConfirmed(eventId, payload, now);
                break;
            case "BookingCancelled":
                await AddCancelledAsync(eventId, payload, now, cancellationToken);
                break;
            default:
                throw new JsonException($"Unsupported event type: {eventType}");
        }

        return true;
    }

    private void AddConfirmed(Guid eventId, JsonElement payload, DateTimeOffset now)
    {
        var bookingId = payload.GetProperty("bookingId").GetGuid();
        var studentUserId = payload.GetProperty("StudentUserId").GetGuid();
        var tutorUserId = payload.GetProperty("TutorUserId").GetGuid();
        var startAtUtc = payload.GetProperty("StartAtUtc").GetDateTimeOffset();
        foreach (var recipient in new[] { studentUserId, tutorUserId })
        {
            dbContext.Notifications.Add(NotificationItem.Create(
                recipient,
                bookingId,
                eventId,
                "BookingConfirmed",
                "Booking confirmed",
                $"Your tutoring session starts at {startAtUtc:O}.",
                now));
            dbContext.ReminderSchedules.Add(ReminderSchedule.Create(
                bookingId,
                recipient,
                eventId,
                "OneHour",
                startAtUtc.AddHours(-1) > now ? startAtUtc.AddHours(-1) : now));
        }
    }

    private async Task AddCancelledAsync(
        Guid eventId,
        JsonElement payload,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var bookingId = payload.GetProperty("bookingId").GetGuid();
        var studentUserId = payload.GetProperty("StudentUserId").GetGuid();
        var tutorUserId = payload.GetProperty("TutorUserId").GetGuid();
        var reminders = await dbContext.ReminderSchedules
            .Where(item => item.BookingId == bookingId)
            .ToListAsync(cancellationToken);
        foreach (var reminder in reminders)
        {
            reminder.Cancel();
        }

        foreach (var recipient in new[] { studentUserId, tutorUserId })
        {
            dbContext.Notifications.Add(NotificationItem.Create(
                recipient,
                bookingId,
                eventId,
                "BookingCancelled",
                "Booking cancelled",
                "Your tutoring session has been cancelled.",
                now));
        }
    }
}

