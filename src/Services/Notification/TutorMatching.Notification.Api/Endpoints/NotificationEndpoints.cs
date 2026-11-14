using TutorMatching.BuildingBlocks.Security;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TutorMatching.Notification.Api.Domain;
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
        AccountDirectoryClient directory,
        CancellationToken cancellationToken,
        string? status = null,
        string? type = null,
        int page = 1,
        int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var userId = GetUserId(principal);
        var account = await directory.GetAsync(userId, cancellationToken);
        if (account is null || !account.Settings.InAppNotifications) return Results.Ok(new {items=Array.Empty<object>(),page,pageSize,total=0});
        var query = dbContext.Notifications.AsNoTracking()
            .Where(item => item.RecipientUserId == userId);
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<ReadStatus>(status, true, out var parsedStatus))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["status"] = ["Status must be Unread or Read."],
                });
            }

            query = query.Where(item => item.Status == parsedStatus);
        }

        if (!string.IsNullOrWhiteSpace(type))
        {
            query = query.Where(item => item.Type == type);
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(item => item.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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
        return Results.Ok(new { items = rows, page, pageSize, total });
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

