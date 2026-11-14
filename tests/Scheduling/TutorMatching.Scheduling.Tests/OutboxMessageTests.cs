using System.Text.Json;
using TutorMatching.Scheduling.Api.Domain;
using TutorMatching.Scheduling.Api.Infrastructure;

namespace TutorMatching.Scheduling.Tests;

public sealed class OutboxMessageTests
{
    [Fact]
    public void BookingConfirmedContainsVersionedRoutingAndParticipants()
    {
        var now = new DateTimeOffset(2026, 11, 14, 10, 0, 0, TimeSpan.Zero);
        var booking = Booking.ConfirmFromHold(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            TimeSlot.Create(now.AddDays(1), now.AddDays(1).AddHours(1)), now);

        var message = OutboxMessage.BookingConfirmed(booking, Guid.NewGuid(), "00-trace", now);
        using var payload = JsonDocument.Parse(message.Payload);

        Assert.Equal("BookingConfirmed", message.EventType);
        Assert.Equal("booking.confirmed.v1", message.RoutingKey);
        Assert.Equal(1, message.EventVersion);
        Assert.Equal(booking.StudentUserId, payload.RootElement.GetProperty("StudentUserId").GetGuid());
        Assert.Equal(booking.TutorUserId, payload.RootElement.GetProperty("TutorUserId").GetGuid());
    }

    [Fact]
    public void RefreshTokenStyleHoldHashIsDeterministicAndNotRawToken()
    {
        const string rawToken = "one-time-random-token";

        var first = RedisBookingHoldStore.HashToken(rawToken);
        var second = RedisBookingHoldStore.HashToken(rawToken);

        Assert.Equal(first, second);
        Assert.Equal(64, first.Length);
        Assert.DoesNotContain(rawToken, first, StringComparison.Ordinal);
    }
}

