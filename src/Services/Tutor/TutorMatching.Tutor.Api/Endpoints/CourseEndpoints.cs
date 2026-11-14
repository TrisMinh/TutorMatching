using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TutorMatching.Tutor.Api.Domain;
using TutorMatching.Tutor.Api.Infrastructure;

namespace TutorMatching.Tutor.Api.Endpoints;
public static class CourseEndpoints
{
    public static void MapCourseEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/courses").WithTags("Courses");
        group.MapGet("/enrollment-notifications",async(ClaimsPrincipal user,TutorDbContext db,CancellationToken ct)=>{
            var uid=Guid.Parse(user.FindFirstValue("sub")!);
            return Results.Ok(await db.EnrollmentNotices.AsNoTracking().Where(n=>n.TutorUserId==uid).OrderByDescending(n=>n.CreatedAtUtc).Take(100).Select(n=>new {
                Id="enrollment:"+n.Id,Type="CourseEnrolled",Title="New student enrolled",n.CourseId,n.StudentName,
                ActorName=n.StudentName,n.AvatarUrl,
                ClassName=db.Courses.Where(c=>c.Id==n.CourseId).Select(c=>c.Title).First(),
                StartAtUtc=db.CourseSessions.Where(s=>s.CourseId==n.CourseId).OrderBy(s=>s.StartAtUtc).Select(s=>(DateTimeOffset?)s.StartAtUtc).FirstOrDefault(),
                Body=n.StudentName+" enrolled in "+db.Courses.Where(c=>c.Id==n.CourseId).Select(c=>c.Title).First()+".",
                Status=n.ReadAtUtc==null?"Unread":"Read",n.CreatedAtUtc,n.ReadAtUtc
            }).ToListAsync(ct));
        }).RequireAuthorization(p=>p.RequireRole("Tutor"));
        group.MapPut("/enrollment-notifications/{noticeId:guid}/read",async(Guid noticeId,ClaimsPrincipal user,TutorDbContext db,CancellationToken ct)=>{
            var uid=Guid.Parse(user.FindFirstValue("sub")!);
            var notice=await db.EnrollmentNotices.SingleOrDefaultAsync(n=>n.Id==noticeId&&n.TutorUserId==uid,ct);
            if(notice is null)return Results.NotFound();
            if(notice.ReadAtUtc is null){notice.ReadAtUtc=DateTimeOffset.UtcNow;await db.SaveChangesAsync(ct);}
            return Results.NoContent();
        }).RequireAuthorization(p=>p.RequireRole("Tutor"));
        group.MapGet("/mine", async (ClaimsPrincipal user,TutorDbContext db,CancellationToken ct) => {
            var uid=Guid.Parse(user.FindFirstValue("sub")!);
            var courses=db.Courses.AsNoTracking().Where(c=>user.IsInRole("Tutor")
                ? db.TutorProfiles.Any(t=>t.Id==c.TutorId&&t.UserId==uid)
                : c.Enrollments.Any(e=>e.StudentUserId==uid));
            return Results.Ok(await courses.Select(c=>new {
                c.Id,c.Title,c.TutorId,c.Image,c.Category,c.Description,c.Capacity,
                Instructor=db.TutorProfiles.Where(t=>t.Id==c.TutorId).Select(t=>t.DisplayName).First(),
                Enrolled=c.Enrollments.Count,IsEnrolled=c.Enrollments.Any(e=>e.StudentUserId==uid),
                Sessions=c.Sessions.OrderBy(s=>s.StartAtUtc).Select(s=>new{s.Id,s.StartAtUtc,s.EndAtUtc})
            }).ToListAsync(ct));
        }).RequireAuthorization(p=>p.RequireRole("Student","Tutor"));
        group.MapGet("/", async (TutorDbContext db, CancellationToken ct) => Results.Ok(await db.Courses.AsNoTracking().Select(c => new {
            c.Id,c.Title,c.TutorId,c.Image,c.Category,c.Description,c.Capacity,
            Instructor=db.TutorProfiles.Where(t=>t.Id==c.TutorId).Select(t=>t.DisplayName).First(),
            Enrolled=c.Enrollments.Count, Sessions=c.Sessions.OrderBy(s=>s.StartAtUtc).Select(s=>new{s.Id,s.StartAtUtc,s.EndAtUtc})
        }).ToListAsync(ct))).AllowAnonymous();
        group.MapGet("/{id}", async (string id,TutorDbContext db,CancellationToken ct) => {
            var course=await db.Courses.AsNoTracking().Include(c=>c.Sessions).Include(c=>c.Enrollments).SingleOrDefaultAsync(c=>c.Id==id,ct);
            if(course is null) return Results.NotFound();
            var instructor=await db.TutorProfiles.Where(t=>t.Id==course.TutorId).Select(t=>t.DisplayName).SingleAsync(ct);
            return Results.Ok(new {course.Id,course.Title,course.TutorId,course.Image,course.Category,course.Description,course.Capacity,Instructor=instructor,Enrolled=course.Enrollments.Count,course.Sessions});
        }).AllowAnonymous();
        group.MapPut("/{id}", async (string id,CourseInput input,ClaimsPrincipal user,TutorDbContext db,HttpContext context,IHttpClientFactory clients,CancellationToken ct) => {
            await using var transaction=await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable,ct);
            var uid=Guid.Parse(user.FindFirstValue("sub")!);
            var tutor=await db.TutorProfiles.SingleOrDefaultAsync(t=>t.UserId==uid,ct);
            if(tutor is null) return Results.NotFound();
            if(string.IsNullOrWhiteSpace(input.Title)||input.Capacity<1||input.Sessions.Count==0||input.Sessions.Any(s=>s.EndAtUtc<=s.StartAtUtc)) return Results.BadRequest(new{error="Valid title, capacity and sessions are required."});
            var ordered=input.Sessions.OrderBy(s=>s.StartAtUtc).ToArray();
            if(ordered.Skip(1).Where((s,i)=>s.StartAtUtc<ordered[i].EndAtUtc).Any()) return Results.BadRequest(new{error="Sessions overlap."});
            var course=await db.Courses.Include(c=>c.Sessions).Include(c=>c.Enrollments).SingleOrDefaultAsync(c=>c.Id==id,ct);
            if(course is not null && course.TutorId!=tutor.Id) return Results.Forbid();
            if(course is not null && course.Enrollments.Count>input.Capacity) return Results.Conflict();
            var teacherSessions=await db.CourseSessions.Where(s=>s.CourseId!=id&&db.Courses.Any(c=>c.Id==s.CourseId&&c.TutorId==tutor.Id)).ToListAsync(ct);
            if(ordered.Any(s=>teacherSessions.Any(o=>s.StartAtUtc<o.EndAtUtc&&o.StartAtUtc<s.EndAtUtc)))return Results.Conflict(new{error="Instructor already teaches at this time."});
            if(course is not null&&course.Enrollments.Count>0&&!course.Sessions.OrderBy(s=>s.StartAtUtc).Select(s=>(s.StartAtUtc,s.EndAtUtc)).SequenceEqual(ordered.Select(s=>(s.StartAtUtc,s.EndAtUtc))))return Results.Conflict(new{error="An enrolled course cannot be rescheduled without resolving existing enrollments."});
            if(await ConflictsWithBookings(ordered,context,clients,ct))return Results.Conflict(new{error="Session overlaps a confirmed booking."});
            if(course is null) {course=new Course{Id=id,TutorId=tutor.Id};db.Courses.Add(course);}
            course.Title=input.Title;course.Image=input.Image;course.Description=input.Description;course.Category=input.Category;course.Capacity=input.Capacity;
            db.CourseSessions.RemoveRange(course.Sessions);
            course.Sessions=ordered.Select(s=>new CourseSession{Id=Guid.NewGuid(),CourseId=id,StartAtUtc=s.StartAtUtc,EndAtUtc=s.EndAtUtc}).ToList();
            db.CourseSessions.AddRange(course.Sessions);
            await db.SaveChangesAsync(ct);await transaction.CommitAsync(ct);return Results.Ok(new{course.Id});
        }).RequireAuthorization(p=>p.RequireRole("Tutor"));
        group.MapPost("/{id}/enrollments", async(string id,ClaimsPrincipal user,TutorDbContext db,HttpContext context,IHttpClientFactory clients,CancellationToken ct)=>{
            var uid=Guid.Parse(user.FindFirstValue("sub")!);
            await using var transaction=await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable,ct);
            var course=await db.Courses.Include(c=>c.Enrollments).SingleOrDefaultAsync(c=>c.Id==id,ct);
            if(course is null)return Results.NotFound();
            if(course.Enrollments.Any(e=>e.StudentUserId==uid))return Results.Ok(new{enrolled=true});
            if(course.Enrollments.Count>=course.Capacity)return Results.Conflict(new{error="Course is full."});
            var sessions=await db.CourseSessions.Where(s=>s.CourseId==id).ToListAsync(ct);
            var otherSessions=await db.CourseSessions.Where(s=>db.CourseEnrollments.Any(e=>e.CourseId==s.CourseId&&e.StudentUserId==uid)).ToListAsync(ct);
            if(sessions.Any(s=>otherSessions.Any(o=>s.StartAtUtc<o.EndAtUtc&&o.StartAtUtc<s.EndAtUtc)))return Results.Conflict(new{error="A session overlaps an enrolled course."});
            if(await ConflictsWithBookings(sessions.Select(s=>new CourseSessionInput(s.StartAtUtc,s.EndAtUtc)),context,clients,ct))return Results.Conflict(new{error="A session overlaps a confirmed booking."});
            course.Enrollments.Add(new CourseEnrollment{CourseId=id,StudentUserId=uid,EnrolledAtUtc=DateTimeOffset.UtcNow});
            var tutorUid=await db.TutorProfiles.Where(t=>t.Id==course.TutorId).Select(t=>t.UserId).SingleAsync(ct);
            var studentName="A student";
            string? avatarUrl=null;
            using(var nameRequest=new HttpRequestMessage(HttpMethod.Get,"/api/v1/students/me")){
                nameRequest.Headers.TryAddWithoutValidation("Authorization",context.Request.Headers.Authorization.ToString());
                using var timeout=CancellationTokenSource.CreateLinkedTokenSource(ct);timeout.CancelAfter(TimeSpan.FromSeconds(3));
                try{using var response=await clients.CreateClient("student").SendAsync(nameRequest,timeout.Token);if(response.IsSuccessStatusCode){var profile=await response.Content.ReadFromJsonAsync<EnrollmentStudent>(timeout.Token);if(!string.IsNullOrWhiteSpace(profile?.DisplayName))studentName=profile.DisplayName;avatarUrl=profile?.AvatarUrl;}}
                catch(HttpRequestException){}catch(OperationCanceledException) when(!ct.IsCancellationRequested){}
            }
            db.EnrollmentNotices.Add(new EnrollmentNotice{Id=Guid.NewGuid(),CourseId=id,StudentUserId=uid,TutorUserId=tutorUid,StudentName=studentName.Length>160?studentName[..160]:studentName,AvatarUrl=avatarUrl,CreatedAtUtc=DateTimeOffset.UtcNow});
            await db.SaveChangesAsync(ct);await transaction.CommitAsync(ct);return Results.Ok(new{enrolled=true});
        }).RequireAuthorization(p=>p.RequireRole("Student"));
    }
    private static async Task<bool> ConflictsWithBookings(IEnumerable<CourseSessionInput> sessions,HttpContext context,IHttpClientFactory clients,CancellationToken ct){
        using var request=new HttpRequestMessage(HttpMethod.Get,"/api/v1/bookings");
        request.Headers.TryAddWithoutValidation("Authorization",context.Request.Headers.Authorization.ToString());
        using var response=await clients.CreateClient("scheduling").SendAsync(request,ct);
        response.EnsureSuccessStatusCode();
        var bookings=await response.Content.ReadFromJsonAsync<List<BookingSlot>>(ct)??[];
        return sessions.Any(s=>bookings.Any(b=>b.Status=="Confirmed"&&s.StartAtUtc<b.EndAtUtc&&b.StartAtUtc<s.EndAtUtc));
    }
}
public sealed record BookingSlot(string Status,DateTimeOffset StartAtUtc,DateTimeOffset EndAtUtc);
public sealed record EnrollmentStudent(string DisplayName,string? AvatarUrl=null);
public sealed record CourseInput(string Title,string Image,string Category,string Description,int Capacity,List<CourseSessionInput> Sessions);
public sealed record CourseSessionInput(DateTimeOffset StartAtUtc,DateTimeOffset EndAtUtc);
