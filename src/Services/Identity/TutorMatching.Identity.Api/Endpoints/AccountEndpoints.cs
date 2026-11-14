using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TutorMatching.BuildingBlocks.Security;
using TutorMatching.Identity.Api.Domain;
using TutorMatching.Identity.Api.Infrastructure;
using TutorMatching.Identity.Api.Security;

namespace TutorMatching.Identity.Api.Endpoints;

public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/users/me/settings", async (ClaimsPrincipal user, IdentityDbContext db, CancellationToken ct) =>
            Results.Ok(await Preferences(db, Guid.Parse(user.FindFirstValue("sub")!), ct))).RequireAuthorization();
        app.MapPut("/api/v1/users/me/settings", SaveSettings).RequireAuthorization();
        var directory = app.MapGroup("/internal/v1/users").RequireAuthorization(p => p.RequireRole("Service").RequireClaim("scope", "identity.directory"));
        directory.MapGet("/hidden-tutors", async (IdentityDbContext db, CancellationToken ct) =>
            await db.AccountSettings.Where(s => !s.ProfileVisible).Select(s => s.UserId).ToArrayAsync(ct));
        directory.MapGet("/{id:guid}/delivery", async (Guid id, IdentityDbContext db, CancellationToken ct) =>
        {
            var account = await db.UserAccounts.AsNoTracking().SingleOrDefaultAsync(u => u.Id == id, ct);
            return account is null ? Results.NotFound() : Results.Ok(new AccountDelivery(id, account.Email, account.CanAuthenticate, await Preferences(db, id, ct), account.Role.ToString()));
        });
        var auth = app.MapGroup("/api/v1/auth").RequireRateLimiting("auth");
        auth.MapPost("/forgot-password", ForgotPassword).AllowAnonymous();
        auth.MapPost("/reset-password", ResetPassword).AllowAnonymous();
    }

    private static async Task<AccountPreferences> Preferences(IdentityDbContext db, Guid id, CancellationToken ct)
    {
        var row = await db.AccountSettings.AsNoTracking().SingleOrDefaultAsync(s => s.UserId == id, ct);
        return row is null ? new() : new(row.EmailReminders, row.InAppNotifications, row.EnrollmentAlerts, row.ProfileVisible, row.CancellationNoticeHours, row.Version);
    }

    private static async Task<IResult> SaveSettings(AccountPreferences input, ClaimsPrincipal user, IdentityDbContext db, CancellationToken ct)
    {
        if (!new[] { 0, 6, 12, 24, 48 }.Contains(input.CancellationNoticeHours)) return Results.BadRequest(new { error = "Choose a cancellation notice of 0, 6, 12, 24 or 48 hours." });
        if (!user.IsInRole("Tutor") && (!input.ProfileVisible || input.CancellationNoticeHours != 12))
            return Results.BadRequest(new { error = "Only tutors can change profile visibility and cancellation policy." });
        var id = Guid.Parse(user.FindFirstValue("sub")!);
        var row = await db.AccountSettings.SingleOrDefaultAsync(s => s.UserId == id, ct);
        if ((row?.Version ?? 0) != input.Version) return Results.Conflict(new { error = "Settings changed in another window. Reload before saving." });
        if (row is null) { row = new AccountSettings { UserId = id }; db.AccountSettings.Add(row); }
        row.EmailReminders = input.EmailReminders; row.InAppNotifications = input.InAppNotifications;
        row.EnrollmentAlerts = input.EnrollmentAlerts; row.ProfileVisible = input.ProfileVisible;
        row.CancellationNoticeHours = input.CancellationNoticeHours; row.Version++;
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return Results.Conflict(new { error = "Settings changed. Reload before saving." }); }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" }) { return Results.Conflict(new { error = "Settings changed. Reload before saving." }); }
        return Results.Ok(new AccountPreferences(row.EmailReminders, row.InAppNotifications, row.EnrollmentAlerts, row.ProfileVisible, row.CancellationNoticeHours, row.Version));
    }

    private static async Task LockAccount(IdentityDbContext db, Guid id, CancellationToken ct)
    {
        if (db.Database.IsRelational()) await db.Database.ExecuteSqlInterpolatedAsync($"SELECT id FROM user_accounts WHERE id = {id} FOR UPDATE", ct);
    }

    private static async Task<IResult> ForgotPassword(ForgotPasswordInput input, IdentityDbContext db, IConfiguration config, TimeProvider clock, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Email) || input.Email.Length > 320 || !MailAddress.TryCreate(input.Email, out _)) return Results.BadRequest(new { error = "Enter a valid email address." });
        var normalized = input.Email.Trim().ToUpperInvariant();
        var account = await db.UserAccounts.AsNoTracking().SingleOrDefaultAsync(u => u.NormalizedEmail == normalized, ct);
        if (account is null || !account.CanAuthenticate) return Results.Accepted(value: new { message = "If an active account exists, a recovery email will be sent." });
        var now = clock.GetUtcNow();
        await using var tx = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(ct) : null;
        await LockAccount(db, account.Id, ct);
        var old = await db.PasswordResets.Where(r => r.UserId == account.Id).ToListAsync(ct);
        if (old.Any(r => r.CreatedAtUtc > now.AddSeconds(-60))) return Results.Accepted(value: new { message = "If an active account exists, a recovery email will be sent." });
        var raw = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        foreach (var reset in old.Where(r => r.UsedAtUtc is null)) reset.UsedAtUtc = now;
        db.PasswordResets.Add(new PasswordReset { Id = Guid.NewGuid(), UserId = account.Id, TokenHash = TokenService.HashRefreshToken(raw), CreatedAtUtc = now, ExpiresAtUtc = now.AddMinutes(30) });
        await db.SaveChangesAsync(ct);
        var origin = config["Frontend:Origin"] ?? "http://localhost:3000";
        var link = origin.TrimEnd('/') + "/auth/reset-password?token=" + Uri.EscapeDataString(raw);
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromSeconds(4));
            using var mail = new MailMessage(config["Email:From"] ?? "no-reply@demo.tutormatching.local", account.Email,
                "Reset your TutorMatching password", $"Use this link to reset your password (expires in 30 minutes):\n{link}\n\nIf you did not request this, ignore this email.");
            using var smtp = new SmtpClient(config["Email:Host"] ?? "localhost", config.GetValue("Email:Port", 1025)) { EnableSsl = config.GetValue("Email:EnableSsl", false) };
            if (!string.IsNullOrWhiteSpace(config["Email:Username"])) smtp.Credentials = new System.Net.NetworkCredential(config["Email:Username"], config["Email:Password"]);
            await smtp.SendMailAsync(mail, timeout.Token);
        }
        catch (Exception ex) when (ex is SmtpException || ex is OperationCanceledException && !ct.IsCancellationRequested)
        { return Results.Problem(statusCode: 503, title: "Unable to send recovery email. Please try again shortly."); }
        if (tx is not null) await tx.CommitAsync(ct);
        return Results.Accepted(value: new { message = "If an active account exists, a recovery email will be sent." });
    }

    private static async Task<IResult> ResetPassword(ResetPasswordInput input, IdentityDbContext db, IPasswordHasher<string> hasher, TimeProvider clock, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Token) || input.Token.Length > 256 || input.Password is null || input.Password.Length is < 12 or > 128)
            return Results.BadRequest(new { error = "A valid reset link and a password of 12–128 characters are required." });
        var hash = TokenService.HashRefreshToken(input.Token);
        var owner = await db.PasswordResets.Where(r => r.TokenHash == hash).Select(r => (Guid?)r.UserId).SingleOrDefaultAsync(ct);
        if (owner is null) return InvalidReset();
        await using var tx = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(ct) : null;
        await LockAccount(db, owner.Value, ct);
        var reset = await db.PasswordResets.SingleAsync(r => r.TokenHash == hash, ct);
        var now = clock.GetUtcNow();
        var account = await db.UserAccounts.SingleAsync(u => u.Id == owner, ct);
        if (reset.UsedAtUtc is not null || reset.ExpiresAtUtc <= now || !account.CanAuthenticate) return InvalidReset();
        account.ChangePassword(hasher.HashPassword(account.Email, input.Password), now);
        foreach (var token in await db.PasswordResets.Where(r => r.UserId == owner && r.UsedAtUtc == null).ToListAsync(ct)) token.UsedAtUtc = now;
        foreach (var session in await db.RefreshSessions.Where(s => s.UserId == owner && s.RevokedAtUtc == null).ToListAsync(ct)) session.Revoke(now);
        await db.SaveChangesAsync(ct);
        if (tx is not null) await tx.CommitAsync(ct);
        return Results.NoContent();
    }

    private static IResult InvalidReset() => Results.BadRequest(new { error = "This reset link is invalid, expired or already used. Request a new link." });
}
public sealed record ForgotPasswordInput(string Email);
public sealed record ResetPasswordInput(string Token, string Password);
