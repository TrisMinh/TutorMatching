using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TutorMatching.Tutor.Api.Domain;
using TutorMatching.Tutor.Api.Infrastructure;
using TutorMatching.BuildingBlocks.Security;

namespace TutorMatching.Tutor.Api.Endpoints;

public static class TutorEndpoints
{
    public static IEndpointRouteBuilder MapTutorEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var publicGroup = endpoints.MapGroup("/api/v1/tutors").WithTags("Tutors");
        publicGroup.MapGet("/", SearchAsync).AllowAnonymous();
        publicGroup.MapGet("/{id:guid}", GetByIdAsync).AllowAnonymous();
        publicGroup.MapGet("/me", async (ClaimsPrincipal user,TutorDbContext db,CancellationToken ct) => {
            var id=await db.TutorProfiles.Where(t=>t.UserId==GetUserId(user)).Select(t=>(Guid?)t.Id).SingleOrDefaultAsync(ct);
            return id is null ? Results.NotFound() : await GetByIdAsync(id.Value,db,ct);
        }).RequireAuthorization(policy=>policy.RequireRole("Tutor"));
        publicGroup.MapPut("/me", UpsertProfileAsync).RequireAuthorization(policy => policy.RequireRole("Tutor"));
        publicGroup.MapPut("/me/subjects", ReplaceSubjectsAsync).RequireAuthorization(policy => policy.RequireRole("Tutor"));
        publicGroup.MapPut("/me/availability", ReplaceAvailabilityAsync).RequireAuthorization(policy => policy.RequireRole("Tutor"));

        endpoints.MapGet("/api/v1/subjects", async (TutorDbContext dbContext, CancellationToken cancellationToken) =>
            Results.Ok(await dbContext.Subjects.AsNoTracking()
                .Where(subject => subject.IsActive)
                .OrderBy(subject => subject.Name)
                .Select(subject => new { subject.Id, subject.Code, subject.Name })
                .ToListAsync(cancellationToken)))
            .AllowAnonymous()
            .WithTags("Subjects");

        endpoints.MapGet("/internal/v1/tutors/{id:guid}/availability", ValidateAvailabilityAsync)
            .RequireServiceCaller("scheduling")
            .WithTags("Internal");
        return endpoints;
    }

    private static async Task<IResult> SearchAsync(
        Guid? subjectId,
        int page,
        int pageSize,
        TutorDbContext dbContext,
        CancellationToken cancellationToken)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = dbContext.TutorProfiles.AsNoTracking().Where(profile => profile.Status == TutorStatus.Active);
        if (subjectId is not null)
        {
            query = query.Where(profile => profile.Subjects.Any(subject => subject.SubjectId == subjectId));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderBy(profile => profile.DisplayName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(profile => new
            {
                profile.Id,
                profile.DisplayName,
                profile.Bio,
                profile.ExperienceYears,
                profile.AvatarUrl,
                subjects = profile.Subjects.Select(subject => new { subject.SubjectId, subject.ProficiencyLevel }),
                availability = profile.AvailabilityWindows.Select(window => new { window.StartAtUtc, window.EndAtUtc }),
            })
            .ToListAsync(cancellationToken);
        return Results.Ok(new { items, page, pageSize, total });
    }

    private static async Task<IResult> GetByIdAsync(Guid id, TutorDbContext dbContext, CancellationToken cancellationToken)
    {
        var profile = await dbContext.TutorProfiles.AsNoTracking()
            .Where(candidate => candidate.Id == id && candidate.Status == TutorStatus.Active)
            .Select(candidate => new
            {
                candidate.Id,
                candidate.DisplayName,
                candidate.Bio,
                candidate.ExperienceYears,
                candidate.AvatarUrl,
                subjects = candidate.Subjects.Select(subject => new { subject.SubjectId, subject.ProficiencyLevel }),
                availability = candidate.AvailabilityWindows.Select(window => new { window.StartAtUtc, window.EndAtUtc }),
            })
            .SingleOrDefaultAsync(cancellationToken);
        return profile is null ? Results.NotFound() : Results.Ok(profile);
    }

    private static async Task<IResult> UpsertProfileAsync(
        TutorProfileRequest request,
        ClaimsPrincipal principal,
        TutorDbContext dbContext,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId(principal);
        var profile = await dbContext.TutorProfiles.SingleOrDefaultAsync(
            candidate => candidate.UserId == userId,
            cancellationToken);
        if (profile is null)
        {
            profile = TutorProfile.Create(userId, request.DisplayName, request.Bio, request.ExperienceYears, timeProvider.GetUtcNow());
            profile.Update(request.DisplayName, request.Bio, request.ExperienceYears, request.AvatarUrl, timeProvider.GetUtcNow());
            dbContext.TutorProfiles.Add(profile);
        }
        else
        {
            profile.Update(request.DisplayName, request.Bio, request.ExperienceYears, request.AvatarUrl, timeProvider.GetUtcNow());
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { profile.Id, profile.UserId, profile.DisplayName, profile.Version });
    }

    private static async Task<IResult> ReplaceSubjectsAsync(
        IReadOnlyCollection<TutorSubjectRequest> request,
        ClaimsPrincipal principal,
        TutorDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId(principal);
        var profile = await dbContext.TutorProfiles.Include(candidate => candidate.Subjects)
            .SingleOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken);
        if (profile is null)
        {
            return Results.NotFound();
        }

        var ids = request.Select(item => item.SubjectId).Distinct().ToArray();
        if(ids.Length!=request.Count||request.Any(item=>!Enum.IsDefined(item.ProficiencyLevel)))return Results.BadRequest(new{error="Subjects must be unique and proficiency must be valid."});
        if (await dbContext.Subjects.CountAsync(subject => ids.Contains(subject.Id) && subject.IsActive, cancellationToken) != ids.Length)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["subjects"] = ["One or more subjects are invalid or inactive."] });
        }

        profile.ReplaceSubjects(request.Select(item => TutorSubject.Create(profile.Id, item.SubjectId, item.ProficiencyLevel)));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> ReplaceAvailabilityAsync(
        IReadOnlyCollection<AvailabilityRequest> request,
        ClaimsPrincipal principal,
        TutorDbContext dbContext,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var ordered=request.OrderBy(window=>window.StartAtUtc).ToArray();
        if(ordered.Any(window=>window.EndAtUtc<=window.StartAtUtc||window.StartAtUtc.Offset!=TimeSpan.Zero||window.EndAtUtc.Offset!=TimeSpan.Zero
            ||window.StartAtUtc.Minute%30!=0||window.EndAtUtc.Minute%30!=0||window.StartAtUtc.Second!=0||window.EndAtUtc.Second!=0||window.StartAtUtc.Millisecond!=0||window.EndAtUtc.Millisecond!=0)
            ||ordered.Skip(1).Where((window,index)=>window.StartAtUtc<ordered[index].EndAtUtc).Any())
            return Results.BadRequest(new{error="Availability windows must be valid UTC intervals without overlaps."});
        var userId = GetUserId(principal);
        var profile = await dbContext.TutorProfiles.Include(candidate => candidate.AvailabilityWindows)
            .SingleOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken);
        if (profile is null)
        {
            return Results.NotFound();
        }

        profile.ReplaceAvailability(request.Select(item => AvailabilityWindow.Create(
            profile.Id,
            item.StartAtUtc,
            item.EndAtUtc,
            timeProvider.GetUtcNow())));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> ValidateAvailabilityAsync(
        Guid id,
        Guid subjectId,
        DateTimeOffset startAtUtc,
        ClaimsPrincipal principal,
        TutorDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var endAtUtc = startAtUtc.AddHours(1);
        var tutor = await dbContext.TutorProfiles.AsNoTracking()
            .Where(profile => profile.Id == id)
            .Select(profile => new
            {
                profile.Id,
                profile.UserId,
                valid = profile.Status == TutorStatus.Active
                    && !dbContext.CourseSessions.Any(session=>session.StartAtUtc<endAtUtc&&startAtUtc<session.EndAtUtc&&(dbContext.Courses.Any(course=>course.Id==session.CourseId&&course.TutorId==id)||dbContext.CourseEnrollments.Any(enrollment=>enrollment.CourseId==session.CourseId&&enrollment.StudentUserId==GetUserId(principal))))
                    && profile.Subjects.Any(subject => subject.SubjectId == subjectId)
                    && profile.AvailabilityWindows.Any(window => window.StartAtUtc <= startAtUtc && window.EndAtUtc >= endAtUtc),
            })
            .SingleOrDefaultAsync(cancellationToken);
        return tutor is null
            ? Results.NotFound()
            : Results.Ok(new { tutorId = tutor.Id, tutorUserId = tutor.UserId, subjectId, startAtUtc, endAtUtc, tutor.valid });
    }

    private static Guid GetUserId(ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue("sub"), out var userId)
            ? userId
            : throw new InvalidOperationException("Authenticated token does not contain a valid subject.");
}

public sealed record TutorProfileRequest(string DisplayName, string Bio, short ExperienceYears, string? AvatarUrl);
public sealed record TutorSubjectRequest(Guid SubjectId, ProficiencyLevel ProficiencyLevel);
public sealed record AvailabilityRequest(DateTimeOffset StartAtUtc, DateTimeOffset EndAtUtc);

