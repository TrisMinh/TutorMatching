using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using TutorMatching.Identity.Api.Domain;
using TutorMatching.Identity.Api.Infrastructure;
using TutorMatching.Identity.Api.Security;

namespace TutorMatching.Identity.Api.Endpoints;

public static class EmailVerificationEndpoints
{
    public static void MapEmailVerificationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/auth").RequireRateLimiting("auth");
        group.MapPost("/verify-email", VerifyAsync).AllowAnonymous();
        group.MapPost("/resend-verification", ResendAsync).AllowAnonymous();
    }

    private static async Task<UserAccount?> LockAccount(IdentityDbContext db, string email, CancellationToken ct)
    {
        var normalized = email.Trim().ToUpperInvariant();
        return db.Database.IsRelational()
            ? (await db.UserAccounts.FromSqlInterpolated($"SELECT * FROM user_accounts WHERE normalized_email = {normalized} FOR UPDATE").ToListAsync(ct)).SingleOrDefault()
            : await db.UserAccounts.SingleOrDefaultAsync(u => u.NormalizedEmail == normalized, ct);
    }

    private static IResult InvalidCode() => Results.BadRequest(new { error = "Invalid or expired verification code. Request a new code if needed." });

    private static async Task<IResult> VerifyAsync(VerifyInput input, IdentityDbContext db, EmailVerificationService service, TimeProvider clock, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Email) || input.Email.Length > 320 || input.Code is null ||
            input.Code.Length != 6 || input.Code.Any(c => c is < '0' or > '9')) return InvalidCode();
        await using var tx = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(ct) : null;
        var account = await LockAccount(db, input.Email, ct);
        if (account is null || account.Status != AccountStatus.PendingVerification) return InvalidCode();
        var row = await db.EmailVerifications.SingleOrDefaultAsync(v => v.UserId == account.Id, ct);
        if (row is null || row.ExpiresAtUtc <= clock.GetUtcNow() || row.FailedAttempts >= 5) return InvalidCode();
        var matches = CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(row.CodeHash), Encoding.ASCII.GetBytes(service.Hash(account.Id, input.Code)));
        if (!matches)
        {
            row.FailedAttempts++;
            await db.SaveChangesAsync(ct);
            if (tx is not null) await tx.CommitAsync(ct);
            return InvalidCode();
        }
        account.VerifyEmail(clock.GetUtcNow());
        db.EmailVerifications.Remove(row);
        await db.SaveChangesAsync(ct);
        if (tx is not null) await tx.CommitAsync(ct);
        return Results.Ok(new { message = "Email verified. You can now sign in.", role = account.Role.ToString() });
    }

    private static async Task<IResult> ResendAsync(ResendInput input, IdentityDbContext db, EmailVerificationService service, TimeProvider clock, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Email) || input.Email.Length > 320) return Results.BadRequest(new { error = "A valid email is required." });
        await using var tx = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(ct) : null;
        var account = await LockAccount(db, input.Email, ct);
        if (account is not null && account.Status == AccountStatus.PendingVerification)
        {
            var row = await db.EmailVerifications.SingleOrDefaultAsync(v => v.UserId == account.Id, ct);
            if (row is not null && row.SentAtUtc.AddSeconds(60) > clock.GetUtcNow())
                return Results.Json(new { error = "Wait 60 seconds between verification emails." }, statusCode: 429);
            try { await service.IssueAsync(account, ct); }
            catch (Exception ex) when (ex is SmtpException || ex is OperationCanceledException && !ct.IsCancellationRequested)
            { return Results.Problem(statusCode: 503, title: "Unable to send verification email. Please try again shortly."); }
        }
        if (tx is not null) await tx.CommitAsync(ct);
        return Results.Accepted(value: new { message = "If this account needs verification, a code will be sent." });
    }

    public sealed record VerifyInput(string Email, string Code);
    public sealed record ResendInput(string Email);
}
