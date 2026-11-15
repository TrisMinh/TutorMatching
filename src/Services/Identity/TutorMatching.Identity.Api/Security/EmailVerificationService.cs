using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using TutorMatching.BuildingBlocks.Email;
using TutorMatching.Identity.Api.Domain;
using TutorMatching.Identity.Api.Infrastructure;

namespace TutorMatching.Identity.Api.Security;

public interface IVerificationEmailSender
{
    Task SendAsync(string email, string code, CancellationToken cancellationToken);
}

public sealed class VerificationEmailSender(IConfiguration configuration) : IVerificationEmailSender
{
    public async Task SendAsync(string email, string code, CancellationToken cancellationToken)
    {
        var settings = SmtpSettings.FromConfiguration(configuration);
        using var message = new MailMessage(settings.From, email, "Verify your TutorMatching email",
            $"Your verification code is: {code}\n\nThis code expires in 10 minutes. You have 5 attempts. If you did not register, ignore this email.");
        using var client = settings.CreateClient();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(15));
        await client.SendMailAsync(message, timeout.Token);
    }
}

public sealed class EmailVerificationService(IdentityDbContext db, IVerificationEmailSender sender,
    IConfiguration configuration, TimeProvider clock)
{
    public string Hash(Guid userId, string code)
    {
        var key = configuration["Jwt:SigningKey"] ?? throw new InvalidOperationException("JWT signing key required.");
        return Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes($"verify-email:{userId}:{code}")));
    }

    public async Task IssueAsync(UserAccount account, CancellationToken cancellationToken)
    {
        var row = await db.EmailVerifications.SingleOrDefaultAsync(v => v.UserId == account.Id, cancellationToken);
        if (row is null) { row = new EmailVerification { UserId = account.Id }; db.EmailVerifications.Add(row); }
        string code;
        do { code = RandomNumberGenerator.GetInt32(1000000).ToString("D6", System.Globalization.CultureInfo.InvariantCulture); }
        while (Hash(account.Id, code) == row.CodeHash);
        row.CodeHash = Hash(account.Id, code);
        row.SentAtUtc = clock.GetUtcNow();
        row.ExpiresAtUtc = row.SentAtUtc.AddMinutes(10);
        row.FailedAttempts = 0;
        // Deliver before saving: a failed SMTP request must not consume an existing code.
        await sender.SendAsync(account.Email, code, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
    }
}
