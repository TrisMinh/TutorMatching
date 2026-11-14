using TutorMatching.Notification.Api.Domain;

namespace TutorMatching.Notification.Tests;

public sealed class NotificationTests
{
    [Fact]
    public void MarkReadRejectsDifferentRecipient()
    {
        var notification = NotificationItem.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "BookingConfirmed", "Confirmed", "Body", DateTimeOffset.UtcNow);

        Assert.Throws<UnauthorizedAccessException>(() =>
            notification.MarkRead(Guid.NewGuid(), DateTimeOffset.UtcNow));
    }

    [Fact]
    public void MarkReadIsIdempotentForRecipient()
    {
        var recipient = Guid.NewGuid();
        var now = new DateTimeOffset(2026, 11, 14, 10, 0, 0, TimeSpan.Zero);
        var notification = NotificationItem.Create(
            recipient, Guid.NewGuid(), Guid.NewGuid(), "BookingConfirmed", "Confirmed", "Body", now);

        var first = notification.MarkRead(recipient, now.AddMinutes(1));
        var second = notification.MarkRead(recipient, now.AddMinutes(2));

        Assert.True(first);
        Assert.False(second);
        Assert.Equal(now.AddMinutes(1), notification.ReadAtUtc);
    }
}

