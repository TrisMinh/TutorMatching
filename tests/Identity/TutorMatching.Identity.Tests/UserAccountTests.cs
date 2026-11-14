using TutorMatching.Identity.Api.Domain;

namespace TutorMatching.Identity.Tests;

public sealed class UserAccountTests
{
    [Fact]
    public void RegisterNormalizesEmailAndActivatesAccount()
    {
        var now = new DateTimeOffset(2026, 11, 14, 10, 0, 0, TimeSpan.Zero);

        var account = UserAccount.Register("  Student@Example.COM ", "hashed", AccountRole.Student, now);

        Assert.Equal("Student@Example.COM", account.Email);
        Assert.Equal("STUDENT@EXAMPLE.COM", account.NormalizedEmail);
        Assert.Equal(AccountStatus.Active, account.Status);
        Assert.Equal(now, account.CreatedAtUtc);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("missing-domain@")]
    public void RegisterRejectsInvalidEmail(string email)
    {
        Assert.Throws<ArgumentException>(() =>
            UserAccount.Register(email, "hashed", AccountRole.Student, DateTimeOffset.UtcNow));
    }

    [Fact]
    public void DisabledAccountCannotAuthenticate()
    {
        var account = UserAccount.Register(
            "student@example.com",
            "hashed",
            AccountRole.Student,
            DateTimeOffset.UtcNow);

        account.Disable(DateTimeOffset.UtcNow);

        Assert.False(account.CanAuthenticate);
        Assert.Equal(AccountStatus.Disabled, account.Status);
    }
}

