using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TutorMatching.BuildingBlocks.Security;
using TutorMatching.Tutor.Api.Domain;
using TutorMatching.Tutor.Api.Infrastructure;

namespace TutorMatching.Tutor.Api.Endpoints;

public static class CourseLifecycleEndpoints
{
    public static void MapCourseLifecycle(this IEndpointRouteBuilder app)
    {
        var group=app.MapGroup("/api/v1/courses").RequireAuthorization();
        group.MapPut("/{id}/status", ChangeStatus).RequireAuthorization(p=>p.RequireRole("Tutor"));
        group.MapDelete("/{id}/enrollments/me", Withdraw).RequireAuthorization(p=>p.RequireRole("Student"));
        group.MapGet("/lifecycle-notifications",async(ClaimsPrincipal user,TutorDbContext db,AccountDirectoryClient directory,CancellationToken ct)=>{
            var uid=Guid.Parse(user.FindFirstValue("sub")!);
            var account=await directory.GetAsync(uid,ct);
            if(account is null||!account.Settings.InAppNotifications)return Results.Ok(Array.Empty<object>());
            return Results.Ok(await db.CourseLifecycleNotices.AsNoTracking().Where(n=>n.RecipientUserId==uid).OrderByDescending(n=>n.CreatedAtUtc).Take(100).Select(n=>new{
                Id="course-lifecycle:"+n.Id,n.CourseId,n.Type,n.Title,n.Body,n.ActorName,n.AvatarUrl,n.CreatedAtUtc,n.ReadAtUtc,
                ClassName=db.Courses.Where(c=>c.Id==n.CourseId).Select(c=>c.Title).Single(),
                StartAtUtc=db.CourseSessions.Where(s=>s.CourseId==n.CourseId&&s.EndAtUtc>n.CreatedAtUtc).OrderBy(s=>s.StartAtUtc).Select(s=>(DateTimeOffset?)s.StartAtUtc).FirstOrDefault(),
                Status=n.ReadAtUtc==null?"Unread":"Read"
            }).ToListAsync(ct));
        });
        group.MapPut("/lifecycle-notifications/{id:guid}/read",async(Guid id,ClaimsPrincipal user,TutorDbContext db,TimeProvider clock,CancellationToken ct)=>{
            var uid=Guid.Parse(user.FindFirstValue("sub")!);
            var notice=await db.CourseLifecycleNotices.SingleOrDefaultAsync(n=>n.Id==id&&n.RecipientUserId==uid,ct);
            if(notice is null)return Results.NotFound();
            if(notice.ReadAtUtc is null){notice.ReadAtUtc=clock.GetUtcNow();await db.SaveChangesAsync(ct);}
            return Results.NoContent();
        });
    }

    private static async Task<IResult> ChangeStatus(string id,CourseStatusInput input,ClaimsPrincipal user,TutorDbContext db,TimeProvider clock,CancellationToken ct)
    {
        if(input.Status is not ("Open" or "Closed" or "Cancelled"))return Results.BadRequest(new{error="Choose Open, Closed or Cancelled."});
        var uid=Guid.Parse(user.FindFirstValue("sub")!);
        await using var tx=await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable,ct);
        var course=await db.Courses.Include(c=>c.Sessions).Include(c=>c.Enrollments).SingleOrDefaultAsync(c=>c.Id==id,ct);
        if(course is null)return Results.NotFound();
        var tutor=await db.TutorProfiles.SingleOrDefaultAsync(t=>t.Id==course.TutorId&&t.UserId==uid,ct);
        if(tutor is null)return Results.Forbid();
        if(course.Status==input.Status)return Results.Ok(new{course.Status,course.Version});
        if(course.Version!=input.Version)return Results.Conflict(new{error="Course changed. Reload before updating."});
        if(course.Status=="Cancelled")return Results.Conflict(new{error="A cancelled course cannot be reopened."});
        var now=clock.GetUtcNow();
        if(!course.Sessions.Any(s=>s.EndAtUtc>now))return Results.Conflict(new{error="A completed course cannot be changed."});
        if(input.Status!="Cancelled"&&course.Sessions.Any(s=>s.StartAtUtc<=now))return Results.Conflict(new{error="Registration cannot be reopened or changed after the course starts."});
        if(input.Status=="Cancelled"&&(string.IsNullOrWhiteSpace(input.Reason)||input.Reason.Trim().Length>300))return Results.BadRequest(new{error="Give a cancellation reason of 1–300 characters."});
        course.Status=input.Status;course.Version++;
        if(input.Status=="Cancelled"){
            course.CancellationReason=input.Reason!.Trim();course.CancelledAtUtc=now;
            foreach(var recipient in course.Enrollments.Where(e=>e.WithdrawnAtUtc==null).Select(e=>e.StudentUserId))
                db.CourseLifecycleNotices.Add(new CourseLifecycleNotice{Id=Guid.NewGuid(),CourseId=id,RecipientUserId=recipient,Type="CourseCancelled",Title="Course cancelled",Body=course.CancellationReason,ActorName=tutor.DisplayName,AvatarUrl=tutor.AvatarUrl,CreatedAtUtc=now});
        }
        await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);
        return Results.Ok(new{course.Status,course.Version});
    }

    private static async Task<IResult> Withdraw(string id,ClaimsPrincipal user,TutorDbContext db,TimeProvider clock,CancellationToken ct)
    {
        var uid=Guid.Parse(user.FindFirstValue("sub")!);
        await using var tx=await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable,ct);
        var course=await db.Courses.Include(c=>c.Sessions).SingleOrDefaultAsync(c=>c.Id==id,ct);
        if(course is null)return Results.NotFound();
        var enrollment=await db.CourseEnrollments.SingleOrDefaultAsync(e=>e.CourseId==id&&e.StudentUserId==uid,ct);
        if(enrollment is null||enrollment.WithdrawnAtUtc is not null||course.Status=="Cancelled")return Results.NoContent();
        var now=clock.GetUtcNow();
        if(course.Sessions.Any(s=>s.StartAtUtc<=now))return Results.Conflict(new{error="You can withdraw only before the first session starts. Contact your tutor for help."});
        enrollment.WithdrawnAtUtc=now;
        var tutor=await db.TutorProfiles.SingleAsync(t=>t.Id==course.TutorId,ct);
        var prior=await db.EnrollmentNotices.AsNoTracking().SingleOrDefaultAsync(n=>n.CourseId==id&&n.StudentUserId==uid,ct);
        db.CourseLifecycleNotices.Add(new CourseLifecycleNotice{Id=Guid.NewGuid(),CourseId=id,RecipientUserId=tutor.UserId,Type="CourseWithdrawn",Title="Student withdrew from course",Body="A place is available again.",ActorName=prior?.StudentName??"Student",AvatarUrl=prior?.AvatarUrl,CreatedAtUtc=now});
        course.Version++;
        await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return Results.NoContent();
    }
}
public sealed record CourseStatusInput(string Status,string? Reason,int Version);
