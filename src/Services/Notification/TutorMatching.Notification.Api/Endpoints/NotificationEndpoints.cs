using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TutorMatching.Notification.Api.Infrastructure;

namespace TutorMatching.Notification.Api.Endpoints;

public static class NotificationEndpoints
{
    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/notifications").WithTags("Notifications").RequireAuthorization();
        group.MapGet("/", ListAsync);
        group.MapPut("/{id:guid}/read", MarkReadAsync);
        return endpoints;
    }

    private static async Task<IResult> ListAsync(
        ClaimsPrincipal principal,
        NotificationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId(principal);
        var rows = await dbContext.Notifications.AsNoTracking()
            .Where(item => item.RecipientUserId == userId)
            .OrderByDescending(item => item.CreatedAtUtc)
            .Take(100)
            .Select(item => new
            {
                item.Id,
                item.BookingId,
                item.Type,
                item.Title,
                item.Body,
                item.Status,
                item.CreatedAtUtc,
                item.ReadAtUtc,
            })
            .ToListAsync(cancellationToken);
        return Results.Ok(rows);
    }

    private static async Task<IResult> MarkReadAsync(
        Guid id,
        ClaimsPrincipal principal,
        NotificationDbContext dbContext,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var notification = await dbContext.Notifications.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (notification is null)
        {
            return Results.NotFound();
        }

        try
        {
            if (notification.MarkRead(GetUserId(principal), timeProvider.GetUtcNow()))
            {
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            return Results.NoContent();
        }
        catch (UnauthorizedAccessException)
        {
            return Results.Forbid();
        }
    }

    private static Guid GetUserId(ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue("sub"), out var userId)
            ? userId
            : throw new InvalidOperationException("Authenticated token does not contain a valid subject.");
}

