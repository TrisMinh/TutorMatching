using System.Net.Mail;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TutorMatching.Identity.Api.Domain;
using TutorMatching.Identity.Api.Infrastructure;
using TutorMatching.Identity.Api.Security;

namespace TutorMatching.Identity.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/auth").WithTags("Authentication").RequireRateLimiting("auth");
        group.MapPost("/register", RegisterAsync).AllowAnonymous();
        group.MapPost("/login", LoginAsync).AllowAnonymous();
        group.MapPost("/refresh", RefreshAsync).AllowAnonymous();
        group.MapPost("/revoke", RevokeAsync).AllowAnonymous();
        endpoints.MapGet("/api/v1/users/me", async (ClaimsPrincipal principal, IdentityDbContext db, CancellationToken ct) =>
        {
            var id = Guid.Parse(principal.FindFirstValue("sub")!);
            var account = await db.UserAccounts.AsNoTracking().SingleOrDefaultAsync(a => a.Id == id, ct);
            return account is null || !account.CanAuthenticate ? Results.Unauthorized() : Results.Ok(new
            {userId = account.Id, account.Email, role = account.Role.ToString(), account.DisplayName});
        }).RequireAuthorization().WithTags("Users");
        return endpoints;
    }

    private static async Task<IResult> RegisterAsync(
        RegisterRequest request,
        EmailVerificationService emailVerification,
        IdentityDbContext dbContext,
        IPasswordHasher<string> passwordHasher,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || request.Email.Length > 320 || request.Password is null || request.Password.Length is < 12 or > 128)
            return Results.BadRequest(new { error = "A valid email and a password of 12-128 characters are required." });
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var existing = await dbContext.UserAccounts.AsNoTracking().SingleOrDefaultAsync(
            account => account.NormalizedEmail == normalizedEmail, cancellationToken);
        if (existing is not null)
        {
            if (existing.Status == AccountStatus.PendingVerification)
                return Results.Conflict(new {code = "email_verification_required", error = "This email is awaiting verification. Enter the code from your inbox or request a new one."});
            return Results.Conflict(new ProblemDetails
            {
                Title = "Email is already registered.",
                Status = StatusCodes.Status409Conflict,
                Type = "https://tutormatching.local/problems/email-conflict",
            });
        }

        if (request.Password.Length < 12)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["password"] = ["Password must contain at least 12 characters."],
            });
        }

        if (!Enum.TryParse<AccountRole>(request.Role, true, out var role) || (role != AccountRole.Student && role != AccountRole.Tutor) || !string.Equals(request.Role, role.ToString(), StringComparison.OrdinalIgnoreCase))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["role"] = ["Role must be Student or Tutor."],
            });
        }

        try
        {
            await using var transaction = dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(cancellationToken) : null;
            var passwordHash = passwordHasher.HashPassword(request.Email.Trim(), request.Password);
            var account = UserAccount.Register(request.Email, passwordHash, role, timeProvider.GetUtcNow());
            account.SetDisplayName(request.FullName);
            account.RequireEmailVerification(timeProvider.GetUtcNow());
            dbContext.UserAccounts.Add(account);
            await dbContext.SaveChangesAsync(cancellationToken);
            await emailVerification.IssueAsync(account, cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            return Results.Created($"/api/v1/users/{account.Id}", new
            {
                account.Id,
                account.Email,
                role = account.Role.ToString(),
                status = account.Status.ToString(),
            });
        }
        catch (Exception exception) when (exception is SmtpException || exception is OperationCanceledException && !cancellationToken.IsCancellationRequested)
        {
            return Results.Problem(statusCode: 503, title: "Unable to send verification email. Please try again shortly.");
        }
        catch (ArgumentException exception)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["email"] = [exception.Message],
            });
        }
        catch (DbUpdateException exception) when (exception.InnerException is Npgsql.PostgresException { SqlState: "23505" })
        {
            return Results.Conflict(new { error = "Email is already registered." });
        }
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        IdentityDbContext dbContext,
        IPasswordHasher<string> passwordHasher,
        TokenService tokenService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken) : null;
        var account = dbContext.Database.IsRelational()
            ? (await dbContext.UserAccounts.FromSqlInterpolated($"SELECT * FROM user_accounts WHERE normalized_email = {normalizedEmail} FOR UPDATE").ToListAsync(cancellationToken)).SingleOrDefault()
            : await dbContext.UserAccounts.SingleOrDefaultAsync(candidate => candidate.NormalizedEmail == normalizedEmail, cancellationToken);
        if (account is null || account.Status == AccountStatus.Disabled)
        {
            return Unauthorized();
        }

        var verification = passwordHasher.VerifyHashedPassword(account.Email, account.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
        {
            return Unauthorized();
        }

        if (account.Status == AccountStatus.PendingVerification)
            return Results.Json(new { code = "email_verification_required", error = "Verify your email before signing in." }, statusCode: 403);
        var pair = tokenService.Issue(account);
        account.RecordLogin(timeProvider.GetUtcNow());
        dbContext.RefreshSessions.Add(RefreshSession.Create(
            account.Id,
            pair.RefreshTokenHash,
            timeProvider.GetUtcNow(),
            pair.RefreshTokenExpiresAtUtc, pair.SessionId));
        await dbContext.SaveChangesAsync(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return Results.Ok(ToResponse(pair));
    }

    private static async Task<IResult> RefreshAsync(
        RefreshRequest request,
        IdentityDbContext dbContext,
        TokenService tokenService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var hash = TokenService.HashRefreshToken(request.RefreshToken);
        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken) : null;
        if (dbContext.Database.IsRelational())
        {
            var owner = await dbContext.RefreshSessions.Where(s => s.TokenHash == hash).Select(s => (Guid?)s.UserId).SingleOrDefaultAsync(cancellationToken);
            if (owner is not null) await dbContext.Database.ExecuteSqlInterpolatedAsync($"SELECT id FROM user_accounts WHERE id = {owner.Value} FOR UPDATE", cancellationToken);
        }
        await LockRefreshFamilyAsync(dbContext, hash, cancellationToken);
        var session = dbContext.Database.IsRelational()
            ? (await dbContext.RefreshSessions.FromSqlInterpolated($"SELECT * FROM refresh_sessions WHERE token_hash = {hash} FOR UPDATE").ToListAsync(cancellationToken)).SingleOrDefault()
            : await dbContext.RefreshSessions.SingleOrDefaultAsync(candidate => candidate.TokenHash == hash, cancellationToken);
        if (session is null)
        {
            return Unauthorized();
        }

        if (!session.IsActive(now))
        {
            var family = await dbContext.RefreshSessions
                .Where(candidate => candidate.FamilyId == session.FamilyId)
                .ToListAsync(cancellationToken);
            foreach (var member in family)
            {
                member.Revoke(now);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            return Unauthorized();
        }

        var account = await dbContext.UserAccounts.FindAsync([session.UserId], cancellationToken);
        if (account is null || !account.CanAuthenticate)
        {
            return Unauthorized();
        }

        var pair = tokenService.Issue(account, session.FamilyId);
        var replacement = session.Rotate(pair.RefreshTokenHash, now, pair.RefreshTokenExpiresAtUtc);
        dbContext.RefreshSessions.Add(replacement);
        await dbContext.SaveChangesAsync(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return Results.Ok(ToResponse(pair));
    }

    private static async Task<IResult> RevokeAsync(
        RefreshRequest request,
        IdentityDbContext dbContext,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var hash = TokenService.HashRefreshToken(request.RefreshToken);
        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken) : null;
        if (dbContext.Database.IsRelational())
        {
            var owner = await dbContext.RefreshSessions.Where(s => s.TokenHash == hash).Select(s => (Guid?)s.UserId).SingleOrDefaultAsync(cancellationToken);
            if (owner is not null) await dbContext.Database.ExecuteSqlInterpolatedAsync($"SELECT id FROM user_accounts WHERE id = {owner.Value} FOR UPDATE", cancellationToken);
        }
        await LockRefreshFamilyAsync(dbContext, hash, cancellationToken);
        var session = await dbContext.RefreshSessions.SingleOrDefaultAsync(
            candidate => candidate.TokenHash == hash,
            cancellationToken);
        session?.Revoke(timeProvider.GetUtcNow());
        await dbContext.SaveChangesAsync(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task LockRefreshFamilyAsync(IdentityDbContext db, string hash, CancellationToken ct)
    {
        if (!db.Database.IsRelational()) return;
        var family = await db.RefreshSessions.Where(s => s.TokenHash == hash).Select(s => (Guid?)s.FamilyId).SingleOrDefaultAsync(ct);
        if (family is null) return;
        var key = $"refresh:{family}";
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", ct);
    }

    private static IResult Unauthorized() => Results.Problem(
        title: "Invalid credentials or session.",
        type: "https://tutormatching.local/problems/invalid-credentials",
        statusCode: StatusCodes.Status401Unauthorized);

    private static object ToResponse(TokenPair pair) => new
    {
        pair.AccessToken,
        pair.AccessTokenExpiresAtUtc,
        pair.RefreshToken,
        pair.RefreshTokenExpiresAtUtc,
        tokenType = "Bearer",
    };
}

public sealed record RegisterRequest(string Email, string Password, string Role, string? FullName = null);
public sealed record LoginRequest(string Email, string Password);
public sealed record RefreshRequest(string RefreshToken);

