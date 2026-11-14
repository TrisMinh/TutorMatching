using TutorMatching.Scheduling.Api.Domain;

namespace TutorMatching.Scheduling.Tests;

public sealed class BookingTests
{
    [Fact]
    public void CancellationDeadlineUsesBookingPolicySnapshot()
    {
        var now = new DateTimeOffset(2026,11,14,10,0,0,TimeSpan.Zero);
        var booking = CreateBooking(now);
        booking.SetCancellationPolicy(24);
        Assert.Equal(booking.StartAtUtc.AddHours(-24), booking.CancellationDeadlineUtc);
        Assert.Throws<ArgumentOutOfRangeException>(()=>booking.SetCancellationPolicy(-1));
        Assert.Throws<ArgumentOutOfRangeException>(()=>booking.SetCancellationPolicy(999));
    }

    [Fact]
    public void ConfirmFromHoldCreatesConfirmedBooking()
    {
        var now = new DateTimeOffset(2026, 11, 14, 10, 0, 0, TimeSpan.Zero);
        var slot = TimeSlot.Create(now.AddDays(1), now.AddDays(1).AddHours(1));

        var booking = Booking.ConfirmFromHold(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), slot, now);

        Assert.Equal(BookingStatus.Confirmed, booking.Status);
        Assert.Equal(now, booking.ConfirmedAtUtc);
    }

    [Fact]
    public void CancelRejectsUserWhoIsNotParticipant()
    {
        var now = new DateTimeOffset(2026, 11, 14, 10, 0, 0, TimeSpan.Zero);
        var booking = CreateBooking(now);

        Assert.Throws<UnauthorizedAccessException>(() =>
            booking.Cancel(Guid.NewGuid(), "changed_mind", now.AddMinutes(1)));
    }

    [Fact]
    public void RepeatedCancelIsIdempotent()
    {
        var now = new DateTimeOffset(2026, 11, 14, 10, 0, 0, TimeSpan.Zero);
        var booking = CreateBooking(now);

        var first = booking.Cancel(booking.StudentUserId, "changed_mind", now.AddMinutes(1));
        var second = booking.Cancel(booking.StudentUserId, "changed_mind", now.AddMinutes(2));

        Assert.True(first);
        Assert.False(second);
        Assert.Equal(now.AddMinutes(1), booking.CancelledAtUtc);
    }

    private static Booking CreateBooking(DateTimeOffset now) => Booking.ConfirmFromHold(
        Guid.NewGuid(),
        Guid.NewGuid(),
        Guid.NewGuid(),
        Guid.NewGuid(),
        Guid.NewGuid(),
        Guid.NewGuid(),
        TimeSlot.Create(now.AddDays(1), now.AddDays(1).AddHours(1)),
        now);
}

