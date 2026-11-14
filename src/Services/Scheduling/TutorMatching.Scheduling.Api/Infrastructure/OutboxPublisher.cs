using System.Text;
using Microsoft.EntityFrameworkCore;
using RabbitMQ.Client;

namespace TutorMatching.Scheduling.Api.Infrastructure;

public sealed partial class OutboxPublisher(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    TimeProvider timeProvider,
    ILogger<OutboxPublisher> logger) : BackgroundService
{
    private const string ExchangeName = "tutormatching.events";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PublishBatchAsync(stoppingToken);
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                LogCycleFailure(logger, exception);
            }

            await Task.Delay(TimeSpan.FromSeconds(2), timeProvider, stoppingToken);
        }
    }

    private async Task PublishBatchAsync(CancellationToken cancellationToken)
    {
        var factory = new ConnectionFactory
        {
            Uri = new Uri(configuration.GetConnectionString("RabbitMq")
                ?? "amqp://guest:guest@localhost:5672/"),
            AutomaticRecoveryEnabled = true,
        };
        await using var connection = await factory.CreateConnectionAsync("scheduling-outbox", cancellationToken);
        await using var channel = await connection.CreateChannelAsync(
            new CreateChannelOptions(publisherConfirmationsEnabled: true, publisherConfirmationTrackingEnabled: true),
            cancellationToken);
        await channel.ExchangeDeclareAsync(
            ExchangeName,
            ExchangeType.Topic,
            durable: true,
            autoDelete: false,
            cancellationToken: cancellationToken);

        await using var scope = scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<SchedulingDbContext>();
        var now = timeProvider.GetUtcNow();
        var messages = await dbContext.OutboxMessages
            .Where(message => message.PublishedAtUtc == null
                && message.NextAttemptAtUtc <= now
                && (message.LockedUntilUtc == null || message.LockedUntilUtc < now))
            .OrderBy(message => message.OccurredAtUtc)
            .Take(20)
            .ToListAsync(cancellationToken);

        foreach (var message in messages)
        {
            try
            {
                var properties = new BasicProperties
                {
                    Persistent = true,
                    ContentType = "application/json",
                    MessageId = message.Id.ToString(),
                    Type = message.EventType,
                    CorrelationId = message.CorrelationId.ToString(),
                    Headers = new Dictionary<string, object?>
                    {
                        ["event-version"] = message.EventVersion,
                        ["traceparent"] = message.Traceparent ?? string.Empty,
                    },
                };
                await channel.BasicPublishAsync(
                    ExchangeName,
                    message.RoutingKey,
                    mandatory: true,
                    properties,
                    Encoding.UTF8.GetBytes(message.Payload),
                    cancellationToken);
                message.MarkPublished(timeProvider.GetUtcNow());
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
            {
                message.MarkFailed(exception.Message, timeProvider.GetUtcNow());
                LogPublishFailure(logger, exception, message.Id);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    [LoggerMessage(EventId = 1001, Level = LogLevel.Error, Message = "Outbox publisher cycle failed.")]
    private static partial void LogCycleFailure(ILogger logger, Exception exception);

    [LoggerMessage(EventId = 1002, Level = LogLevel.Warning, Message = "Failed to publish outbox event {eventId}.")]
    private static partial void LogPublishFailure(ILogger logger, Exception exception, Guid eventId);
}

