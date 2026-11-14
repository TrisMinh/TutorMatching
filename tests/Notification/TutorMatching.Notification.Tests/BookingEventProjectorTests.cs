using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TutorMatching.Notification.Api.Infrastructure;

namespace TutorMatching.Notification.Tests;

public sealed class BookingEventProjectorTests
{
    [Fact]
    public async Task DuplicateConfirmedEventHasNoDuplicateEffects()
    {
        var options = new DbContextOptionsBuilder<NotificationDbContext>()
            .UseInMemoryDatabase($"notification-{Guid.NewGuid():N}")
            .Options;
        await using var dbContext = new NotificationDbContext(options);
        var projector = new BookingEventProjector(dbContext);
        var eventId = Guid.NewGuid();
        var payload = JsonSerializer.SerializeToElement(new
        {
            bookingId = Guid.NewGuid(),
            StudentUserId = Guid.NewGuid(),
            TutorUserId = Guid.NewGuid(),
            StartAtUtc = DateTimeOffset.UtcNow.AddDays(1),
        });

        Assert.True(await projector.ApplyAsync(
            eventId, "BookingConfirmed", 1, payload, DateTimeOffset.UtcNow, CancellationToken.None));
        await dbContext.SaveChangesAsync();
        Assert.False(await projector.ApplyAsync(
            eventId, "BookingConfirmed", 1, payload, DateTimeOffset.UtcNow, CancellationToken.None));
        await dbContext.SaveChangesAsync();

        Assert.Equal(1, await dbContext.ProcessedEvents.CountAsync());
        Assert.Equal(2, await dbContext.Notifications.CountAsync());
        Assert.Equal(2, await dbContext.ReminderSchedules.CountAsync());
    }
}

