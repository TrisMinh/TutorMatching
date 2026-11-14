using TutorMatching.Identity.Api.Domain;

namespace TutorMatching.Identity.Tests;

public sealed class RefreshSessionTests
{
    [Fact]
    public void RotateRevokesCurrentSessionAndLinksReplacement()
    {
        var now = new DateTimeOffset(2026, 11, 14, 10, 0, 0, TimeSpan.Zero);
        var session = RefreshSession.Create(Guid.NewGuid(), "old-hash", now, now.AddDays(7));

        var replacement = session.Rotate("new-hash", now.AddMinutes(1), now.AddDays(7));

        Assert.Equal(session.FamilyId, replacement.FamilyId);
        Assert.Equal(replacement.Id, session.ReplacedByTokenId);
        Assert.Equal(now.AddMinutes(1), session.RevokedAtUtc);
        Assert.False(session.IsActive(now.AddMinutes(2)));
        Assert.True(replacement.IsActive(now.AddMinutes(2)));
    }

    [Fact]
    public void ExpiredSessionIsNotActive()
    {
        var now = new DateTimeOffset(2026, 11, 14, 10, 0, 0, TimeSpan.Zero);
        var session = RefreshSession.Create(Guid.NewGuid(), "hash", now.AddDays(-8), now.AddSeconds(-1));

        Assert.False(session.IsActive(now));
    }
}

