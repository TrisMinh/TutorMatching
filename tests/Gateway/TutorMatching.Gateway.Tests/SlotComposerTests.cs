using TutorMatching.Gateway;

namespace TutorMatching.Gateway.Tests;

public sealed class SlotComposerTests
{
    [Fact]
    public void ComposeUsesThirtyMinuteGridAndRemovesOverlappingBookings()
    {
        var tutorId = Guid.NewGuid();
        var from = new DateTimeOffset(2026, 11, 15, 0, 0, 0, TimeSpan.Zero);
        var windows = new[] { new AvailabilityWindowResponse(from.AddMinutes(15), from.AddHours(3)) };
        var booked = new[] { new BookedSlotResponseItem(tutorId, from.AddHours(1), from.AddHours(2)) };

        var result = SlotComposer.Compose(windows, booked, from, from.AddDays(1));

        Assert.Equal(
            [from.AddHours(2)],
            result.Select(slot => slot.StartAtUtc));
    }

    [Fact]
    public void ComposeClipsAvailabilityToRequestedUtcDay()
    {
        var from = new DateTimeOffset(2026, 11, 15, 0, 0, 0, TimeSpan.Zero);
        var windows = new[] { new AvailabilityWindowResponse(from.AddHours(-1), from.AddHours(1)) };

        var result = SlotComposer.Compose(windows, [], from, from.AddDays(1));

        Assert.Single(result);
        Assert.Equal(from, result[0].StartAtUtc);
    }
}
