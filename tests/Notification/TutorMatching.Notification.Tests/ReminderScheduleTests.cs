using TutorMatching.Notification.Api.Domain;

namespace TutorMatching.Notification.Tests;

public sealed class ReminderScheduleTests
{
    [Fact]
    public void ClaimSetsProcessingLease()
    {
        var now = new DateTimeOffset(2026, 11, 14, 10, 0, 0, TimeSpan.Zero);
        var reminder = ReminderSchedule.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "OneHour", now);

        var claimed = reminder.TryClaim(now, TimeSpan.FromMinutes(2));

        Assert.True(claimed);
        Assert.Equal(DeliveryStatus.Processing, reminder.Status);
        Assert.Equal(now.AddMinutes(2), reminder.LeaseUntilUtc);
    }

    [Fact]
    public void FailureSchedulesBoundedRetryThenEventuallyFails()
    {
        var now = new DateTimeOffset(2026, 11, 14, 10, 0, 0, TimeSpan.Zero);
        var reminder = ReminderSchedule.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "OneHour", now);

        for (var attempt = 1; attempt <= 5; attempt++)
        {
            var attemptAt = now.AddMinutes(attempt * 10);
            Assert.True(reminder.TryClaim(attemptAt, TimeSpan.FromMinutes(1)));
            reminder.MarkFailed("smtp unavailable", attemptAt, maxAttempts: 5);
        }

        Assert.Equal(DeliveryStatus.Failed, reminder.Status);
        Assert.Equal(5, reminder.Attempts);
    }

    [Fact]
    public void CancelledReminderCannotBeClaimed()
    {
        var now = DateTimeOffset.UtcNow;
        var reminder = ReminderSchedule.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "OneHour", now);

        reminder.Cancel();

        Assert.False(reminder.TryClaim(now, TimeSpan.FromMinutes(1)));
    }
}

