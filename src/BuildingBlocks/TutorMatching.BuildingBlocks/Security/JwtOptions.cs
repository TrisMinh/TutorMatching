using System.Text;

namespace TutorMatching.BuildingBlocks.Security;

public sealed record JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; init; } = string.Empty;
    public string Audience { get; init; } = string.Empty;
    public string SigningKey { get; init; } = string.Empty;
    public string? PublicKeyPath { get; init; }
    public string? PrivateKeyPath { get; init; }
    public bool RequireAsymmetric { get; init; }
    public int AccessTokenMinutes { get; init; } = 15;
    public int RefreshTokenDays { get; init; } = 7;
    public int ClockSkewSeconds { get; init; } = 30;

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(Issuer))
        {
            throw new InvalidOperationException("JWT issuer is required.");
        }

        if (string.IsNullOrWhiteSpace(Audience))
        {
            throw new InvalidOperationException("JWT audience is required.");
        }

        if (RequireAsymmetric && string.IsNullOrWhiteSpace(PublicKeyPath))
            throw new InvalidOperationException("Asymmetric JWT verification key is required.");
        if (!string.IsNullOrWhiteSpace(PublicKeyPath) && !File.Exists(PublicKeyPath))
            throw new InvalidOperationException("JWT public key file is missing.");
        if (string.IsNullOrWhiteSpace(PublicKeyPath) && Encoding.UTF8.GetByteCount(SigningKey) < 32)
        {
            throw new InvalidOperationException("JWT signing key must be at least 32 bytes.");
        }

        if (AccessTokenMinutes <= 0 || RefreshTokenDays <= 0 || ClockSkewSeconds < 0)
        {
            throw new InvalidOperationException("JWT lifetimes must be positive and clock skew cannot be negative.");
        }
    }
}

