using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TutorMatching.Student.Api.Domain;
using TutorMatching.Student.Api.Infrastructure;

namespace TutorMatching.Student.Api.Endpoints;

public static class StudentEndpoints
{
    public static IEndpointRouteBuilder MapStudentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/students").WithTags("Students")
            .RequireAuthorization(policy => policy.RequireRole("Student"));
        group.MapGet("/me", GetMeAsync);
        group.MapPut("/me", UpsertAsync);
        group.MapPut("/me/interests", ReplaceInterestsAsync);

        endpoints.MapGet("/internal/v1/students/by-user/{userId:guid}", GetByUserIdAsync)
            .RequireAuthorization()
            .WithTags("Internal");
        return endpoints;
    }

    private static async Task<IResult> GetMeAsync(
        ClaimsPrincipal principal,
        StudentDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId(principal);
        var profile = await dbContext.StudentProfiles.AsNoTracking()
            .Where(candidate => candidate.UserId == userId)
            .Select(candidate => new
            {
                candidate.Id,
                candidate.UserId,
                candidate.DisplayName,
                candidate.AvatarUrl,
                candidate.EducationLevel,
                candidate.LearningGoal,
                candidate.Timezone,
                candidate.Status,
                candidate.Version,
                interests = candidate.Interests.Select(interest => new { interest.SubjectId, interest.Priority }),
            })
            .SingleOrDefaultAsync(cancellationToken);
        return profile is null ? Results.NotFound() : Results.Ok(profile);
    }

    private static async Task<IResult> UpsertAsync(
        StudentProfileRequest request,
        ClaimsPrincipal principal,
        StudentDbContext dbContext,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        if(request.AvatarUrl?.Length>2000000)return Results.BadRequest(new{error="Avatar image is too large."});
        var userId = GetUserId(principal);
        var profile = await dbContext.StudentProfiles.SingleOrDefaultAsync(
            candidate => candidate.UserId == userId,
            cancellationToken);
        if (profile is null)
        {
            profile = StudentProfile.Create(
                userId,
                request.DisplayName,
                request.EducationLevel,
                request.LearningGoal,
                request.Timezone,
                timeProvider.GetUtcNow());
            dbContext.StudentProfiles.Add(profile);
        }
        else
        {
            profile.Update(
                request.DisplayName,
                request.EducationLevel,
                request.LearningGoal,
                request.Timezone,
                timeProvider.GetUtcNow());
        }

        if(request.AvatarUrl is not null)profile.SetAvatar(request.AvatarUrl);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { profile.Id, profile.UserId, profile.DisplayName, profile.Version });
    }

    private static async Task<IResult> ReplaceInterestsAsync(
        IReadOnlyCollection<SubjectInterestRequest> request,
        ClaimsPrincipal principal,
        StudentDbContext dbContext,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId(principal);
        var profile = await dbContext.StudentProfiles.Include(candidate => candidate.Interests)
            .SingleOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken);
        if (profile is null)
        {
            return Results.NotFound();
        }

        profile.ReplaceInterests(request.Select(item => SubjectInterest.Create(
            profile.Id,
            item.SubjectId,
            item.Priority,
            timeProvider.GetUtcNow())));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> GetByUserIdAsync(
        Guid userId,
        StudentDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var profile = await dbContext.StudentProfiles.AsNoTracking()
            .Where(candidate => candidate.UserId == userId && candidate.Status == StudentStatus.Active)
            .Select(candidate => new { candidate.Id, candidate.UserId, candidate.DisplayName, candidate.Timezone, candidate.AvatarUrl, EducationLevel=candidate.EducationLevel.ToString(), candidate.LearningGoal })
            .SingleOrDefaultAsync(cancellationToken);
        return profile is null ? Results.NotFound() : Results.Ok(profile);
    }

    private static Guid GetUserId(ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue("sub"), out var userId)
            ? userId
            : throw new InvalidOperationException("Authenticated token does not contain a valid subject.");
}

public sealed record StudentProfileRequest(
    string DisplayName,
    EducationLevel EducationLevel,
    string LearningGoal,
    string Timezone,
    string? AvatarUrl = null);

public sealed record SubjectInterestRequest(Guid SubjectId, int Priority);

