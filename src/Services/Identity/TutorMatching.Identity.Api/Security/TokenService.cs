using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using TutorMatching.BuildingBlocks.Security;
using TutorMatching.Identity.Api.Domain;

namespace TutorMatching.Identity.Api.Security;

public sealed record TokenPair(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAtUtc,
    string RefreshToken,
    string RefreshTokenHash,
    DateTimeOffset RefreshTokenExpiresAtUtc,
    Guid SessionId);

public sealed class TokenService(JwtOptions options, TimeProvider timeProvider)
{
    public TokenPair Issue(UserAccount account, Guid? sessionId = null)
    {
        ArgumentNullException.ThrowIfNull(account);
        options.Validate();

        var now = timeProvider.GetUtcNow();
        var accessExpiry = now.AddMinutes(options.AccessTokenMinutes);
        var credentials = JwtKeyMaterial.SigningCredentials(options);
        var family = sessionId ?? Guid.NewGuid();
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, account.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, account.Email),
            new Claim("role", account.Role.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim("sid", family.ToString()),
            new Claim("issued_ms", now.ToUnixTimeMilliseconds().ToString(System.Globalization.CultureInfo.InvariantCulture)),
        };
        var jwt = new JwtSecurityToken(
            issuer: options.Issuer,
            audience: options.Audience,
            claims: claims,
            notBefore: now.UtcDateTime,
            expires: accessExpiry.UtcDateTime,
            signingCredentials: credentials);

        var refreshToken = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));
        var refreshHash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken)));

        return new TokenPair(
            new JwtSecurityTokenHandler().WriteToken(jwt),
            accessExpiry,
            refreshToken,
            refreshHash,
            now.AddDays(options.RefreshTokenDays), family);
    }

    public static string HashRefreshToken(string rawToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rawToken);
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
    }
}

