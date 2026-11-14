using TutorMatching.Scheduling.Api.Domain;

namespace TutorMatching.Scheduling.Tests;

public sealed class TimeSlotTests
{
    [Fact]
    public void CreateAcceptsExactlySixtyMinutesOnGrid()
    {
        var start = new DateTimeOffset(2026, 11, 15, 8, 30, 0, TimeSpan.Zero);

        var slot = TimeSlot.Create(start, start.AddMinutes(60));

        Assert.Equal(TimeSpan.FromMinutes(60), slot.EndAtUtc - slot.StartAtUtc);
    }

    [Theory]
    [InlineData(45)]
    [InlineData(90)]
    public void CreateRejectsNonSixtyMinuteDuration(int minutes)
    {
        var start = new DateTimeOffset(2026, 11, 15, 8, 0, 0, TimeSpan.Zero);

        Assert.Throws<ArgumentException>(() => TimeSlot.Create(start, start.AddMinutes(minutes)));
    }

    [Fact]
    public void CreateRejectsOffGridStart()
    {
        var start = new DateTimeOffset(2026, 11, 15, 8, 15, 0, TimeSpan.Zero);

        Assert.Throws<ArgumentException>(() => TimeSlot.Create(start, start.AddMinutes(60)));
    }
}

