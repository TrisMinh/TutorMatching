using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using TutorMatching.BuildingBlocks.Security;

namespace TutorMatching.Notification.Api.Infrastructure;

public sealed partial class CourseReminderSync(IServiceScopeFactory scopes, IHttpClientFactory clients, IConfiguration config, TimeProvider clock, ILogger<CourseReminderSync> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var now = clock.GetUtcNow();
                using var request = new HttpRequestMessage(HttpMethod.Get,
                    $"/internal/v1/course-reminders/?from={Uri.EscapeDataString(now.ToString("O"))}&to={Uri.EscapeDataString(now.AddHours(1).ToString("O"))}");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", AccountDirectoryClient.CreateToken(config, "reminders.read"));
                using var response = await clients.CreateClient("tutor-reminders").SendAsync(request, stoppingToken);
                response.EnsureSuccessStatusCode();
                var rows = await response.Content.ReadFromJsonAsync<CourseReminderRow[]>(stoppingToken) ?? [];
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<NotificationDbContext>();
                foreach (var row in rows)
                {
                    await using var tx = await db.Database.BeginTransactionAsync(stoppingToken);
                    await db.Database.ExecuteSqlInterpolatedAsync($"""
                        INSERT INTO processed_events(event_id,event_type,event_version,processed_at_utc)
                        VALUES ({row.SessionId},'CourseSessionReminder',1,{now}) ON CONFLICT DO NOTHING
                        """, stoppingToken);
                    var due = row.StartAtUtc.AddHours(-1);
                    var id = Guid.NewGuid();
                    await db.Database.ExecuteSqlInterpolatedAsync($"""
                        INSERT INTO reminder_schedules(id,booking_id,recipient_user_id,reminder_type,scheduled_for_utc,status,attempts,next_attempt_at_utc,source_event_id)
                        VALUES ({id},{row.SessionId},{row.UserId},'CourseOneHour',{due},'Pending',0,{due},{row.SessionId}) ON CONFLICT DO NOTHING
                        """, stoppingToken);
                    await tx.CommitAsync(stoppingToken);
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested) { LogSyncFailure(logger, ex); }
            await Task.Delay(TimeSpan.FromSeconds(30), clock, stoppingToken);
        }
    }
    [LoggerMessage(EventId = 2110, Level = LogLevel.Warning, Message = "Course reminder sync failed; next polling cycle will retry.")]
    private static partial void LogSyncFailure(ILogger logger, Exception exception);
}
public sealed record CourseReminderRow(Guid SessionId, Guid UserId, DateTimeOffset StartAtUtc);
