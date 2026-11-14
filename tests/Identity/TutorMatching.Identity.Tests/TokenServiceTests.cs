using System.IdentityModel.Tokens.Jwt;
using TutorMatching.BuildingBlocks.Security;
using TutorMatching.Identity.Api.Domain;
using TutorMatching.Identity.Api.Security;

namespace TutorMatching.Identity.Tests;

public sealed class TokenServiceTests
{
    [Fact]
    public void IssueCreatesCanonicalJwtClaimsAndLifetimes()
    {
        var now = new DateTimeOffset(2026, 11, 14, 10, 0, 0, TimeSpan.Zero);
        var account = UserAccount.Register("student@example.com", "hashed", AccountRole.Student, now);
        var service = new TokenService(Options(), new FixedTimeProvider(now));

        var pair = service.Issue(account);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(pair.AccessToken);

        Assert.Equal(account.Id.ToString(), jwt.Claims.Single(claim => claim.Type == "sub").Value);
        Assert.Equal("Student", jwt.Claims.Single(claim => claim.Type == "role").Value);
        Assert.Equal("tutormatching.identity", jwt.Issuer);
        Assert.Contains("tutormatching.api", jwt.Audiences);
        Assert.Equal(now.AddMinutes(15), pair.AccessTokenExpiresAtUtc);
        Assert.Equal(now.AddDays(7), pair.RefreshTokenExpiresAtUtc);
        Assert.NotEqual(pair.RefreshToken, pair.RefreshTokenHash);
        Assert.Equal(64, pair.RefreshTokenHash.Length);
    }

    private static JwtOptions Options() => new()
    {
        Issuer = "tutormatching.identity",
        Audience = "tutormatching.api",
        SigningKey = "development-only-signing-key-change-before-production",
        AccessTokenMinutes = 15,
        RefreshTokenDays = 7,
        ClockSkewSeconds = 30,
    };

    private sealed class FixedTimeProvider(DateTimeOffset value) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => value;
    }
}

