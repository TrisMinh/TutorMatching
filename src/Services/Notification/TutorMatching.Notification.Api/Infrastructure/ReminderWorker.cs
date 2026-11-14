using System.Net;
using System.Net.Mail;
using Microsoft.EntityFrameworkCore;
using TutorMatching.Notification.Api.Domain;

namespace TutorMatching.Notification.Api.Infrastructure;

public interface IEmailSender
{
    Task SendReminderAsync(Guid recipientUserId, Guid bookingId, CancellationToken cancellationToken);
}

public sealed class SmtpEmailSender(IConfiguration configuration) : IEmailSender
{
    public async Task SendReminderAsync(Guid recipientUserId, Guid bookingId, CancellationToken cancellationToken)
    {
        using var message = new MailMessage(
            configuration["Email:From"] ?? "no-reply@demo.tutormatching.local",
            $"{recipientUserId:N}@demo.tutormatching.local",
            "TutorMatching session reminder",
            $"Your tutoring session for booking {bookingId} starts in one hour.");
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
        var claimedIds = new List<Guid>();
        await using (var scope = scopeFactory.CreateAsyncScope())
        {
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
                    LIMIT 20
                    """)
                .ToListAsync(cancellationToken);
            foreach (var reminder in due)
            {
                if (reminder.TryClaim(now, TimeSpan.FromMinutes(2)))
                {
                    claimedIds.Add(reminder.Id);
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }

        foreach (var reminderId in claimedIds)
        {
            await DeliverAsync(reminderId, cancellationToken);
        }
    }

    private async Task DeliverAsync(Guid reminderId, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<NotificationDbContext>();
        var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
        var reminder = await dbContext.ReminderSchedules.SingleAsync(item => item.Id == reminderId, cancellationToken);
        var startedAt = timeProvider.GetUtcNow();
        try
        {
            await emailSender.SendReminderAsync(reminder.RecipientUserId, reminder.BookingId, cancellationToken);
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

