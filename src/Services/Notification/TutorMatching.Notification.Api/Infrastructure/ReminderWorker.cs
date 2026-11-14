using System.Net;
using System.Net.Mail;
using Microsoft.EntityFrameworkCore;
using TutorMatching.Notification.Api.Domain;

namespace TutorMatching.Notification.Api.Infrastructure;

public interface IEmailSender
{
    Task SendReminderAsync(Guid recipientUserId, Guid bookingId, CancellationToken cancellationToken);
}

public sealed class ReminderSuppressedException : Exception { }
public sealed record ReminderDetails(string Title, DateTimeOffset StartAtUtc, DateTimeOffset EndAtUtc, bool Active, Guid? StudentUserId, Guid? TutorUserId);

public sealed class SmtpEmailSender(IConfiguration configuration,
    TutorMatching.BuildingBlocks.Security.AccountDirectoryClient directory, NotificationDbContext db,
    IHttpClientFactory clients, TimeProvider clock) : IEmailSender
{
    public async Task SendReminderAsync(Guid recipientUserId, Guid bookingId, CancellationToken cancellationToken)
    {
        var account = await directory.GetAsync(recipientUserId, cancellationToken);
        if (account is null || !account.Active || !account.Settings.EmailReminders) throw new ReminderSuppressedException();
        var isCourse = await db.ReminderSchedules.AnyAsync(r => r.BookingId == bookingId && r.RecipientUserId == recipientUserId && r.ReminderType == "CourseOneHour", cancellationToken);
        var target = isCourse ? $"/internal/v1/course-reminders/{bookingId}?recipient={recipientUserId}" : $"/internal/v1/reminders/{bookingId}";
        using var request = new HttpRequestMessage(HttpMethod.Get, target);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",
            TutorMatching.BuildingBlocks.Security.AccountDirectoryClient.CreateToken(configuration, "reminders.read"));
        using var response = await clients.CreateClient(isCourse ? "tutor-reminders" : "scheduling-reminders").SendAsync(request, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound) throw new ReminderSuppressedException();
        response.EnsureSuccessStatusCode();
        var details = await response.Content.ReadFromJsonAsync<ReminderDetails>(cancellationToken) ?? throw new InvalidOperationException("Missing reminder context.");
        if (!details.Active || details.StartAtUtc <= clock.GetUtcNow() || (!isCourse && details.StudentUserId != recipientUserId && details.TutorUserId != recipientUserId)) throw new ReminderSuppressedException();
        var zone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
        var start = TimeZoneInfo.ConvertTime(details.StartAtUtc, zone);
        var end = TimeZoneInfo.ConvertTime(details.EndAtUtc, zone);
        var origin = configuration["Frontend:Origin"] ?? "http://localhost:3000";
        var link = origin.TrimEnd('/') + "/" + (account.Role == "Tutor" ? "tutor" : "student") + "/dashboard";
        using var message = new MailMessage(
            configuration["Email:From"] ?? "no-reply@demo.tutormatching.local",
            account.Email,
            "Upcoming lesson: " + details.Title,
            $"{details.Title}\n{start:dd MMM yyyy, HH:mm} – {end:HH:mm} (GMT+07:00 Vietnam)\nYour lesson starts soon. View your schedule: {link}\nManage email reminders in Settings.");
        using var client = new SmtpClient(
            configuration["Email:Host"] ?? "localhost",
            configuration.GetValue("Email:Port", 1025))
        {
            EnableSsl = configuration.GetValue("Email:EnableSsl", false),
        };
        var username = configuration["Email:Username"];
        if (!string.IsNullOrWhiteSpace(username))
        {
            client.Credentials = new NetworkCredential(username, configuration["Email:Password"]);
        }

        await client.SendMailAsync(message, cancellationToken);
    }
}

public sealed partial class ReminderWorker(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    ILogger<ReminderWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessDueRemindersAsync(stoppingToken);
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                LogWorkerFailure(logger, exception);
            }

            await Task.Delay(TimeSpan.FromSeconds(15), timeProvider, stoppingToken);
        }
    }

    private async Task ProcessDueRemindersAsync(CancellationToken cancellationToken)
    {
        for (var index = 0; index < 20; index++)
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<NotificationDbContext>();
            var now = timeProvider.GetUtcNow();
            await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
            var due = await dbContext.ReminderSchedules
                .FromSqlInterpolated($$"""
                    SELECT * FROM reminder_schedules
                    WHERE scheduled_for_utc <= {{now}}
                      AND next_attempt_at_utc <= {{now}}
                      AND (status = 'Pending' OR (status = 'Processing' AND lease_until_utc <= {{now}}))
                    ORDER BY scheduled_for_utc
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                    """)
                .ToListAsync(cancellationToken);
            var reminder = due.SingleOrDefault();
            if (reminder is null) return;
            if (!reminder.TryClaim(now, TimeSpan.FromMinutes(2))) return;
            // Keep the row lock through bounded delivery. Another replica cannot take
            // the same reminder while this owner is sending or waiting to commit.
            await DeliverAsync(dbContext, reminder, scope.ServiceProvider.GetRequiredService<IEmailSender>(), cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
    }

    private async Task DeliverAsync(NotificationDbContext dbContext, ReminderSchedule reminder, IEmailSender emailSender, CancellationToken cancellationToken)
    {
        var startedAt = timeProvider.GetUtcNow();
        try
        {
            using var sendTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            sendTimeout.CancelAfter(TimeSpan.FromSeconds(10));
            await emailSender.SendReminderAsync(reminder.RecipientUserId, reminder.BookingId, sendTimeout.Token);
            reminder.MarkSent();
            dbContext.DeliveryAttempts.Add(new DeliveryAttempt
            {
                Id = Guid.NewGuid(),
                ReminderId = reminder.Id,
                Channel = "Email",
                AttemptNo = reminder.Attempts + 1,
                Status = "Sent",
                StartedAtUtc = startedAt,
                CompletedAtUtc = timeProvider.GetUtcNow(),
            });
        }
        catch (ReminderSuppressedException) { reminder.Cancel(); }
        catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
        {
            reminder.MarkFailed(exception.Message, timeProvider.GetUtcNow(), maxAttempts: 5);
            dbContext.DeliveryAttempts.Add(new DeliveryAttempt
            {
                Id = Guid.NewGuid(),
                ReminderId = reminder.Id,
                Channel = "Email",
                AttemptNo = reminder.Attempts,
                Status = "Failed",
                ErrorCode = exception.GetType().Name,
                StartedAtUtc = startedAt,
                CompletedAtUtc = timeProvider.GetUtcNow(),
            });
            LogDeliveryFailure(logger, exception, reminder.Id);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    [LoggerMessage(EventId = 2101, Level = LogLevel.Error, Message = "Reminder worker cycle failed.")]
    private static partial void LogWorkerFailure(ILogger logger, Exception exception);

    [LoggerMessage(EventId = 2102, Level = LogLevel.Warning, Message = "Reminder {reminderId} delivery failed.")]
    private static partial void LogDeliveryFailure(ILogger logger, Exception exception, Guid reminderId);
}

