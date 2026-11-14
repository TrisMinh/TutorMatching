using System.Diagnostics;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TutorMatching.Scheduling.Api.Domain;
using TutorMatching.Scheduling.Api.Infrastructure;
using TutorMatching.BuildingBlocks.Security;

namespace TutorMatching.Scheduling.Api.Endpoints;

public static class BookingEndpoints
{
    private static readonly Action<ILogger,Exception?> LogCleanupFailure=LoggerMessage.Define(LogLevel.Warning,new EventId(1201,"HoldCleanup"),"Booking committed; temporary hold cleanup will expire by TTL.");
    public static IEndpointRouteBuilder MapBookingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/bookings").WithTags("Bookings").RequireAuthorization();
        group.MapPost("/holds", CreateHoldAsync).RequireAuthorization(policy => policy.RequireRole("Student"));
        group.MapDelete("/holds/{holdId:guid}", ReleaseHoldAsync).RequireAuthorization(policy => policy.RequireRole("Student"));
        group.MapPost("/", ConfirmAsync).RequireAuthorization(policy => policy.RequireRole("Student"));
        group.MapGet("/", ListAsync);
        group.MapGet("/{bookingId:guid}/student-profile",async(Guid bookingId,ClaimsPrincipal user,HttpContext context,SchedulingDbContext db,IStudentClient students,CancellationToken ct)=>{
            var uid=GetUserId(user);
            var booking=await db.Bookings.AsNoTracking().SingleOrDefaultAsync(b=>b.Id==bookingId&&b.TutorUserId==uid,ct);
            if(booking is null)return Results.NotFound();
            try{
                var student=await students.GetByUserIdAsync(booking.StudentUserId,context.Request.Headers.Authorization.ToString(),ct);
                if(student is null)return Results.Problem(statusCode:503,title:"Student profile is temporarily unavailable.");
                return Results.Ok(new{student.Id,student.DisplayName,student.AvatarUrl,student.EducationLevel,student.LearningGoal,student.Timezone});
            }catch(HttpRequestException){return Results.Problem(statusCode:503,title:"Student profile is temporarily unavailable.");}
        }).RequireAuthorization(p=>p.RequireRole("Tutor"));
        group.MapGet("/{bookingId:guid}", async (Guid bookingId,ClaimsPrincipal user,HttpContext context,SchedulingDbContext db,IStudentClient students,CancellationToken ct) => {
            var uid=GetUserId(user);
            var booking=await db.Bookings.AsNoTracking().SingleOrDefaultAsync(b=>b.Id==bookingId&&(b.StudentUserId==uid||b.TutorUserId==uid),ct);
            if(booking is null)return Results.NotFound();
            string? studentName=null;
            string? studentAvatarUrl=null;
            try{var student=await students.GetByUserIdAsync(booking.StudentUserId,context.Request.Headers.Authorization.ToString(),ct);studentName=student?.DisplayName;studentAvatarUrl=student?.AvatarUrl;}
            catch(HttpRequestException){ /* Booking remains readable if profile dependency is down. */ }
            return Results.Ok(new{Booking=ToResponse(booking),StudentName=studentName,StudentAvatarUrl=studentAvatarUrl});
        });
        group.MapDelete("/{bookingId:guid}", CancelAsync);

        endpoints.MapPost("/internal/v1/slots/query", QueryBookedSlotsAsync)
            .RequireServiceCaller("gateway")
            .WithTags("Internal");
        return endpoints;
    }

    private static async Task<IResult> CreateHoldAsync(
        CreateHoldRequest request,
        ClaimsPrincipal principal,
        HttpContext httpContext,
        SchedulingDbContext dbContext,
        IBookingHoldStore holdStore,
        ITutorClient tutorClient,
        IStudentClient studentClient,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var studentUserId = GetUserId(principal);
        var slot = TimeSlot.Create(request.StartAtUtc, request.StartAtUtc.AddHours(1));
        var now = timeProvider.GetUtcNow();
        if (slot.StartAtUtc <= now || slot.StartAtUtc > now.AddDays(90))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["startAtUtc"] = ["Start must be in the future and within 90 days."],
            });
        }

        var authorization = httpContext.Request.Headers.Authorization.ToString();
        var student = await studentClient.GetByUserIdAsync(studentUserId, authorization, cancellationToken);
        var tutor = await tutorClient.ValidateAvailabilityAsync(
            request.TutorId,
            request.SubjectId,
            request.StartAtUtc,
            authorization,
            cancellationToken);
        if (student is null || tutor is null)
        {
            return Results.Problem(
                title: "A required profile service is unavailable or the profile does not exist.",
                type: "https://tutormatching.local/problems/dependency-unavailable",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        if (!tutor.Valid)
        {
            return Results.UnprocessableEntity(new { error = "Tutor is not available for this subject and slot." });
        }

        var confirmedOverlap = await dbContext.Bookings.AsNoTracking().AnyAsync(booking =>
            booking.Status == BookingStatus.Confirmed
            && (booking.TutorId == request.TutorId || booking.StudentId == student.Id)
            && booking.StartAtUtc < slot.EndAtUtc
            && slot.StartAtUtc < booking.EndAtUtc,
            cancellationToken);
        if (confirmedOverlap)
        {
            return Results.Conflict(new { error = "Slot conflicts with a confirmed booking." });
        }

        var result = await holdStore.TryCreateAsync(
            student.Id,
            student.UserId,
            tutor.TutorId,
            tutor.TutorUserId,
            request.SubjectId,
            slot.StartAtUtc,
            cancellationToken);
        if (!result.Created || result.Hold is null)
        {
            return Results.Conflict(new { error = "Slot is temporarily held by another request." });
        }

        return Results.Created($"/api/v1/bookings/holds/{result.Hold.HoldId}", new
        {
            result.Hold.HoldId,
            holdToken = result.HoldToken,
            result.Hold.ExpiresAtUtc,
        });
    }

    private static async Task<IResult> ReleaseHoldAsync(
        Guid holdId,
        string holdToken,
        ClaimsPrincipal principal,
        IBookingHoldStore holdStore,
        CancellationToken cancellationToken)
    {
        var hold = await ValidOwnedHoldAsync(holdId, holdToken, GetUserId(principal), holdStore, cancellationToken);
        if (hold is null)
        {
            return Results.NotFound();
        }

        await holdStore.ReleaseAsync(hold, cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> ConfirmAsync(
        ConfirmBookingRequest request,
        ClaimsPrincipal principal,
        HttpContext httpContext,
        SchedulingDbContext dbContext,
        IBookingHoldStore holdStore,
        ITutorClient tutorClient,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var existing = await dbContext.Bookings.AsNoTracking()
            .SingleOrDefaultAsync(booking => booking.SourceHoldId == request.HoldId, cancellationToken);
        if (existing is not null)
        {
            if(existing.StudentUserId!=GetUserId(principal))return Results.NotFound();
            if(existing.SourceHoldTokenHash is null||string.IsNullOrWhiteSpace(request.HoldToken)||!CryptographicOperations.FixedTimeEquals(System.Text.Encoding.UTF8.GetBytes(existing.SourceHoldTokenHash),System.Text.Encoding.UTF8.GetBytes(RedisBookingHoldStore.HashToken(request.HoldToken))))
                return Results.Conflict(new{error="Cannot verify the original booking operation."});
            httpContext.Items["audit-result-id"]=existing.Id.ToString();
            return Results.Ok(ToResponse(existing));
        }

        var hold = await ValidOwnedHoldAsync(
            request.HoldId,
            request.HoldToken,
            GetUserId(principal),
            holdStore,
            cancellationToken);
        if (hold is null)
        {
            return Results.Problem(
                title: "Hold is missing, expired, or invalid.",
                type: "https://tutormatching.local/problems/invalid-hold",
                statusCode: StatusCodes.Status409Conflict);
        }

        var availability=await tutorClient.ValidateAvailabilityAsync(hold.TutorId,hold.SubjectId,hold.StartAtUtc,httpContext.Request.Headers.Authorization.ToString(),cancellationToken);
        if(availability is null)return Results.StatusCode(503);
        if(!availability.Valid)return Results.Conflict(new{error="The student or tutor now has a conflicting course session."});
        var now = timeProvider.GetUtcNow();
        var booking = Booking.ConfirmFromHold(
            hold.HoldId,
            hold.StudentId,
            hold.StudentUserId,
            hold.TutorId,
            hold.TutorUserId,
            hold.SubjectId,
            TimeSlot.Create(hold.StartAtUtc, hold.EndAtUtc),
            now,tokenHash:hold.TokenHash);
        var correlationId = GetCorrelationId(httpContext);
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        dbContext.Bookings.Add(booking);
        dbContext.OutboxMessages.Add(OutboxMessage.BookingConfirmed(
            booking,
            correlationId,
            Activity.Current?.Id,
            now));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.ExclusionViolation })
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.Conflict(new { error = "Slot conflicts with a confirmed booking." });
        }

        httpContext.Items["audit-result-id"]=booking.Id.ToString();
        try{await holdStore.ReleaseAsync(hold, cancellationToken);}
        catch(Exception exception) when(exception is StackExchange.Redis.RedisException or OperationCanceledException){
            LogCleanupFailure(httpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("BookingCleanup"),exception);
        }
        return Results.Created($"/api/v1/bookings/{booking.Id}", ToResponse(booking));
    }

    private static async Task<IResult> ListAsync(
        ClaimsPrincipal principal,
        SchedulingDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId(principal);
        var bookings = await dbContext.Bookings.AsNoTracking()
            .Where(booking => booking.StudentUserId == userId || booking.TutorUserId == userId)
            .OrderBy(booking => booking.StartAtUtc)
            .Select(booking => ToResponse(booking))
            .ToListAsync(cancellationToken);
        return Results.Ok(bookings);
    }

    private static async Task<IResult> CancelAsync(
        Guid bookingId,
        string reasonCode,
        ClaimsPrincipal principal,
        HttpContext httpContext,
        SchedulingDbContext dbContext,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var booking = await dbContext.Bookings.SingleOrDefaultAsync(candidate => candidate.Id == bookingId, cancellationToken);
        if (booking is null)
        {
            return Results.NotFound();
        }

        var actor=GetUserId(principal);
        if(actor!=booking.StudentUserId&&actor!=booking.TutorUserId)return Results.Forbid();
        if(string.IsNullOrWhiteSpace(reasonCode)||reasonCode.Length>300)return Results.BadRequest(new{error="A cancellation reason of 1–300 characters is required."});
        if(booking.Status==BookingStatus.Confirmed&&booking.StartAtUtc<=timeProvider.GetUtcNow())return Results.Conflict(new{error="A lesson that has already started cannot be cancelled."});
        try
        {
            if (booking.Cancel(actor, reasonCode, timeProvider.GetUtcNow()))
            {
                dbContext.OutboxMessages.Add(OutboxMessage.BookingCancelled(
                    booking,
                    GetCorrelationId(httpContext),
                    Activity.Current?.Id,
                    timeProvider.GetUtcNow()));
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            return Results.NoContent();
        }
        catch (UnauthorizedAccessException)
        {
            return Results.Forbid();
        }
    }

    private static async Task<IResult> QueryBookedSlotsAsync(
        SlotQueryRequest request,
        SchedulingDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (request.TutorIds.Count > 100 || request.ToUtc - request.FromUtc > TimeSpan.FromDays(7))
        {
            return Results.BadRequest(new { error = "At most 100 tutors and a 7-day range are allowed." });
        }

        var rows = await dbContext.Bookings.AsNoTracking()
            .Where(booking => request.TutorIds.Contains(booking.TutorId)
                && booking.Status == BookingStatus.Confirmed
                && booking.StartAtUtc < request.ToUtc
                && request.FromUtc < booking.EndAtUtc)
            .Select(booking => new { booking.TutorId, booking.StartAtUtc, booking.EndAtUtc })
            .ToListAsync(cancellationToken);
        return Results.Ok(new { bookedSlots = rows });
    }

    private static async Task<BookingHold?> ValidOwnedHoldAsync(
        Guid holdId,
        string rawToken,
        Guid ownerUserId,
        IBookingHoldStore holdStore,
        CancellationToken cancellationToken)
    {
        var hold = await holdStore.GetAsync(holdId, cancellationToken);
        if (hold is null || hold.StudentUserId != ownerUserId)
        {
            return null;
        }

        var supplied = Convert.FromHexString(RedisBookingHoldStore.HashToken(rawToken));
        var expected = Convert.FromHexString(hold.TokenHash);
        return CryptographicOperations.FixedTimeEquals(supplied, expected) ? hold : null;
    }

    private static Guid GetUserId(ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue("sub"), out var userId)
            ? userId
            : throw new InvalidOperationException("Authenticated token does not contain a valid subject.");

    private static Guid GetCorrelationId(HttpContext context) =>
        Guid.TryParse(context.Request.Headers["X-Correlation-ID"], out var value) ? value : Guid.NewGuid();

    private static object ToResponse(Booking booking) => new
    {
        booking.Id,
        booking.StudentId,
        booking.TutorId,
        booking.SubjectId,
        booking.StartAtUtc,
        booking.EndAtUtc,
        status = booking.Status.ToString(),
        booking.ConfirmedAtUtc,
        booking.CancelledAtUtc,
    };
}

public sealed record CreateHoldRequest(Guid TutorId, Guid SubjectId, DateTimeOffset StartAtUtc);
public sealed record ConfirmBookingRequest(Guid HoldId, string HoldToken);
public sealed record SlotQueryRequest(IReadOnlyCollection<Guid> TutorIds, DateTimeOffset FromUtc, DateTimeOffset ToUtc);

