using TutorMatching.Tutor.Api.Domain;

namespace TutorMatching.Tutor.Tests;

public sealed class TutorProfileTests
{
    [Fact]
    public void ReplaceAvailabilityRejectsOverlappingWindows()
    {
        var profile = TutorProfile.Create(Guid.NewGuid(), "Tutor A", "Bio", 5, DateTimeOffset.UtcNow);
        var first = AvailabilityWindow.Create(
            profile.Id,
            new DateTimeOffset(2026, 11, 15, 8, 0, 0, TimeSpan.Zero),
            new DateTimeOffset(2026, 11, 15, 10, 0, 0, TimeSpan.Zero),
            DateTimeOffset.UtcNow);
        var overlapping = AvailabilityWindow.Create(
            profile.Id,
            new DateTimeOffset(2026, 11, 15, 9, 30, 0, TimeSpan.Zero),
            new DateTimeOffset(2026, 11, 15, 11, 0, 0, TimeSpan.Zero),
            DateTimeOffset.UtcNow);

        Assert.Throws<InvalidOperationException>(() => profile.ReplaceAvailability([first, overlapping]));
    }

    [Theory]
    [InlineData(8, 15)]
    [InlineData(8, 45)]
    public void AvailabilityMustAlignToThirtyMinuteGrid(int hour, int minute)
    {
        var start = new DateTimeOffset(2026, 11, 15, hour, minute, 0, TimeSpan.Zero);

        Assert.Throws<ArgumentException>(() =>
            AvailabilityWindow.Create(Guid.NewGuid(), start, start.AddHours(1), DateTimeOffset.UtcNow));
    }

    [Fact]
    public void ReplaceSubjectsRejectsDuplicateSubject()
    {
        var profile = TutorProfile.Create(Guid.NewGuid(), "Tutor A", "Bio", 5, DateTimeOffset.UtcNow);
        var subjectId = Guid.NewGuid();

        Assert.Throws<InvalidOperationException>(() => profile.ReplaceSubjects(
        [
            TutorSubject.Create(profile.Id, subjectId, ProficiencyLevel.Advanced),
            TutorSubject.Create(profile.Id, subjectId, ProficiencyLevel.Expert),
        ]));
    }
}

