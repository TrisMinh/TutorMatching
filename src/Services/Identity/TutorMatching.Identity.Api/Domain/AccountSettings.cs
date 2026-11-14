namespace TutorMatching.Identity.Api.Domain;

public sealed class AccountSettings
{
    public Guid UserId { get; set; }
    public bool EmailReminders { get; set; } = true;
    public bool InAppNotifications { get; set; } = true;
    public bool EnrollmentAlerts { get; set; } = true;
    public bool ProfileVisible { get; set; } = true;
    public int CancellationNoticeHours { get; set; } = 12;
    public int Version { get; set; }
}

public sealed class PasswordReset
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public DateTimeOffset? UsedAtUtc { get; set; }
}
