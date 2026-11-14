using System.Net.Mail;

namespace TutorMatching.Identity.Api.Domain;

public enum AccountRole
{
    Student,
    Tutor,
    Admin,
}

public enum AccountStatus
{
    Active,
    Disabled,
}

public sealed class UserAccount
{
    private UserAccount()
    {
    }

    public Guid Id { get; private set; }
    public string Email { get; private set; } = string.Empty;
    public string NormalizedEmail { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public AccountRole Role { get; private set; }
    public AccountStatus Status { get; private set; }
    public DateTimeOffset? LastLoginAtUtc { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public int Version { get; private set; }
    public bool CanAuthenticate => Status == AccountStatus.Active;

    public static UserAccount Register(
        string email,
        string passwordHash,
        AccountRole role,
        DateTimeOffset now)
    {
        var trimmedEmail = email?.Trim() ?? string.Empty;
        if (trimmedEmail.Length is 0 or > 320 || !IsValidEmail(trimmedEmail))
        {
            throw new ArgumentException("A valid email address is required.", nameof(email));
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(passwordHash);

        return new UserAccount
        {
            Id = Guid.NewGuid(),
            Email = trimmedEmail,
            NormalizedEmail = trimmedEmail.ToUpperInvariant(),
            PasswordHash = passwordHash,
            Role = role,
            Status = AccountStatus.Active,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            Version = 1,
        };
    }

    public void RecordLogin(DateTimeOffset now)
    {
        if (!CanAuthenticate)
        {
            throw new InvalidOperationException("Disabled accounts cannot authenticate.");
        }

        LastLoginAtUtc = now;
        UpdatedAtUtc = now;
        Version++;
    }

    public void ChangePassword(string hash, DateTimeOffset now)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(hash);
        PasswordHash = hash; UpdatedAtUtc = now; Version++;
    }

    public void Disable(DateTimeOffset now)
    {
        Status = AccountStatus.Disabled;
        UpdatedAtUtc = now;
        Version++;
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            var address = new MailAddress(email);
            return string.Equals(address.Address, email, StringComparison.OrdinalIgnoreCase)
                && email.Contains('.', StringComparison.Ordinal);
        }
        catch (FormatException)
        {
            return false;
        }
    }
}

