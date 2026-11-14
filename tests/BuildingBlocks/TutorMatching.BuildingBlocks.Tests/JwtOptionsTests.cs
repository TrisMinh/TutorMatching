using TutorMatching.BuildingBlocks.Security;

namespace TutorMatching.BuildingBlocks.Tests;

public sealed class JwtOptionsTests
{
    [Fact]
    public void ValidateRejectsShortSigningKey()
    {
        var options = ValidOptions() with { SigningKey = "too-short" };

        var exception = Assert.Throws<InvalidOperationException>(options.Validate);

        Assert.Contains("32 bytes", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void ValidateAcceptsCanonicalConfiguration()
    {
        var options = ValidOptions();

        options.Validate();

        Assert.Equal(15, options.AccessTokenMinutes);
        Assert.Equal(7, options.RefreshTokenDays);
        Assert.Equal(30, options.ClockSkewSeconds);
    }

    private static JwtOptions ValidOptions() => new()
    {
        Issuer = "tutormatching.identity",
        Audience = "tutormatching.api",
        SigningKey = "development-signing-key-32-bytes-minimum",
        AccessTokenMinutes = 15,
        RefreshTokenDays = 7,
        ClockSkewSeconds = 30,
    };
}

