namespace TutorMatching.Identity.Api.Domain;

public sealed class RefreshSession
{
    private RefreshSession()
    {
    }

    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public string TokenHash { get; private set; } = string.Empty;
    public Guid FamilyId { get; private set; }
    public DateTimeOffset ExpiresAtUtc { get; private set; }
    public DateTimeOffset? RevokedAtUtc { get; private set; }
    public Guid? ReplacedByTokenId { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }

    public static RefreshSession Create(
        Guid userId,
        string tokenHash,
        DateTimeOffset createdAtUtc,
        DateTimeOffset expiresAtUtc,
        Guid? familyId = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(tokenHash);
        if (expiresAtUtc <= createdAtUtc)
        {
            throw new ArgumentOutOfRangeException(nameof(expiresAtUtc), "Expiry must be after creation.");
        }

        return new RefreshSession
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            FamilyId = familyId ?? Guid.NewGuid(),
            CreatedAtUtc = createdAtUtc,
            ExpiresAtUtc = expiresAtUtc,
        };
    }

    public bool IsActive(DateTimeOffset now) => RevokedAtUtc is null && ExpiresAtUtc > now;

    public RefreshSession Rotate(string newTokenHash, DateTimeOffset now, DateTimeOffset newExpiry)
    {
        if (!IsActive(now))
        {
            throw new InvalidOperationException("Only an active refresh session can be rotated.");
        }

        var replacement = Create(UserId, newTokenHash, now, newExpiry, FamilyId);
        RevokedAtUtc = now;
        ReplacedByTokenId = replacement.Id;
        return replacement;
    }

    public void Revoke(DateTimeOffset now)
    {
        RevokedAtUtc ??= now;
    }
}

