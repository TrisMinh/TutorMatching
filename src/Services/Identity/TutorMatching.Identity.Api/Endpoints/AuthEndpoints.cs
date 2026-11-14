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
        var group = endpoints.MapGroup("/api/v1/auth").WithTags("Authentication");
        group.MapPost("/register", RegisterAsync).AllowAnonymous();
        group.MapPost("/login", LoginAsync).AllowAnonymous();
        group.MapPost("/refresh", RefreshAsync).AllowAnonymous();
        group.MapPost("/revoke", RevokeAsync).AllowAnonymous();

        endpoints.MapGet("/api/v1/users/me", (ClaimsPrincipal principal) =>
            Results.Ok(new
            {
                userId = principal.FindFirstValue("sub"),
                email = principal.FindFirstValue("email"),
                role = principal.FindFirstValue("role"),
            }))
            .RequireAuthorization()
            .WithTags("Users");

        return endpoints;
    }

    private static async Task<IResult> RegisterAsync(
        RegisterRequest request,
        IdentityDbContext dbContext,
        IPasswordHasher<string> passwordHasher,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        if (await dbContext.UserAccounts.AnyAsync(
            account => account.NormalizedEmail == normalizedEmail,
            cancellationToken))
        {
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

        if (!Enum.TryParse<AccountRole>(request.Role, true, out var role) || role == AccountRole.Admin)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["role"] = ["Role must be Student or Tutor."],
            });
        }

        try
        {
            var passwordHash = passwordHasher.HashPassword(request.Email, request.Password);
            var account = UserAccount.Register(request.Email, passwordHash, role, timeProvider.GetUtcNow());
            dbContext.UserAccounts.Add(account);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.Created($"/api/v1/users/{account.Id}", new
            {
                account.Id,
                account.Email,
                role = account.Role.ToString(),
                status = account.Status.ToString(),
            });
        }
        catch (ArgumentException exception)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["email"] = [exception.Message],
            });
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
        var account = await dbContext.UserAccounts.SingleOrDefaultAsync(
            candidate => candidate.NormalizedEmail == normalizedEmail,
            cancellationToken);
        if (account is null || !account.CanAuthenticate)
        {
            return Unauthorized();
        }

        var verification = passwordHasher.VerifyHashedPassword(account.Email, account.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
        {
            return Unauthorized();
        }

        var pair = tokenService.Issue(account);
        account.RecordLogin(timeProvider.GetUtcNow());
        dbContext.RefreshSessions.Add(RefreshSession.Create(
            account.Id,
            pair.RefreshTokenHash,
            timeProvider.GetUtcNow(),
            pair.RefreshTokenExpiresAtUtc));
        await dbContext.SaveChangesAsync(cancellationToken);
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
        var session = await dbContext.RefreshSessions.SingleOrDefaultAsync(
            candidate => candidate.TokenHash == hash,
            cancellationToken);
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
            return Unauthorized();
        }

        var account = await dbContext.UserAccounts.FindAsync([session.UserId], cancellationToken);
        if (account is null || !account.CanAuthenticate)
        {
            return Unauthorized();
        }

        var pair = tokenService.Issue(account);
        var replacement = session.Rotate(pair.RefreshTokenHash, now, pair.RefreshTokenExpiresAtUtc);
        dbContext.RefreshSessions.Add(replacement);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(ToResponse(pair));
    }

    private static async Task<IResult> RevokeAsync(
        RefreshRequest request,
        IdentityDbContext dbContext,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var hash = TokenService.HashRefreshToken(request.RefreshToken);
        var session = await dbContext.RefreshSessions.SingleOrDefaultAsync(
            candidate => candidate.TokenHash == hash,
            cancellationToken);
        session?.Revoke(timeProvider.GetUtcNow());
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
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

public sealed record RegisterRequest(string Email, string Password, string Role);
public sealed record LoginRequest(string Email, string Password);
public sealed record RefreshRequest(string RefreshToken);

