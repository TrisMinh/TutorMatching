using TutorMatching.Student.Api.Domain;

namespace TutorMatching.Student.Tests;

public sealed class StudentProfileTests
{
    [Fact]
    public void ReplaceInterestsRejectsDuplicateSubject()
    {
        var profile = StudentProfile.Create(
            Guid.NewGuid(),
            "Student A",
            EducationLevel.University,
            "Learn calculus",
            "Asia/Ho_Chi_Minh",
            DateTimeOffset.UtcNow);
        var subjectId = Guid.NewGuid();

        Assert.Throws<InvalidOperationException>(() => profile.ReplaceInterests(
        [
            SubjectInterest.Create(profile.Id, subjectId, 3, DateTimeOffset.UtcNow),
            SubjectInterest.Create(profile.Id, subjectId, 5, DateTimeOffset.UtcNow),
        ]));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public void InterestPriorityMustBeBetweenOneAndFive(int priority)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => SubjectInterest.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            priority,
            DateTimeOffset.UtcNow));
    }

    [Fact]
    public void UpdateIncrementsOptimisticVersion()
    {
        var profile = StudentProfile.Create(
            Guid.NewGuid(),
            "Student A",
            EducationLevel.University,
            "Learn calculus",
            "Asia/Ho_Chi_Minh",
            DateTimeOffset.UtcNow);

        profile.Update("Student B", EducationLevel.Adult, "Career change", "UTC", DateTimeOffset.UtcNow);

        Assert.Equal(2, profile.Version);
        Assert.Equal("Student B", profile.DisplayName);
    }
}

