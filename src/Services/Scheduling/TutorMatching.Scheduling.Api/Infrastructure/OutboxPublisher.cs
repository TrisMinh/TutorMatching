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
        var failures=0;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PublishBatchAsync(stoppingToken);
                failures=0;
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                LogCycleFailure(logger, exception);
                failures=Math.Min(failures+1,4);
            }

            await Task.Delay(TimeSpan.FromSeconds(Math.Min(30,2*Math.Pow(2,failures))+Random.Shared.NextDouble()), timeProvider, stoppingToken);
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
        for(var index=0;index<20;index++)
        {
            await using var transaction=await dbContext.Database.BeginTransactionAsync(cancellationToken);
            var message=await ClaimNextAsync(dbContext,timeProvider.GetUtcNow(),cancellationToken);
            if(message is null)return;
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
                using var publishTimeout=CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);publishTimeout.CancelAfter(TimeSpan.FromSeconds(5));
                var payload=Encoding.UTF8.GetBytes(message.Payload);
                await channel.BasicPublishAsync(
                    ExchangeName,
                    message.RoutingKey,
                    mandatory: true,
                    properties,
                    payload,
                    publishTimeout.Token);
                message.MarkPublished(timeProvider.GetUtcNow());
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
            {
                message.MarkFailed(exception.Message, timeProvider.GetUtcNow());
                LogPublishFailure(logger, exception, message.Id);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            dbContext.ChangeTracker.Clear();
            if(!channel.IsOpen)return;
        }
    }
    // The owning transaction is the lease: process death releases it without waiting for a TTL.
    public static async Task<OutboxMessage?> ClaimNextAsync(SchedulingDbContext db,DateTimeOffset now,CancellationToken ct){
        if(db.Database.CurrentTransaction is null)throw new InvalidOperationException("An outbox claim requires a transaction.");
        var rows=await db.OutboxMessages.FromSqlInterpolated($"""
            SELECT * FROM outbox_messages
            WHERE published_at_utc IS NULL AND next_attempt_at_utc <= {now}
              AND (locked_until_utc IS NULL OR locked_until_utc < {now})
              AND attempt_count < 8
            ORDER BY occurred_at_utc
            LIMIT 1 FOR UPDATE SKIP LOCKED
            """).ToListAsync(ct);
        return rows.SingleOrDefault();
    }

    [LoggerMessage(EventId = 1001, Level = LogLevel.Error, Message = "Outbox publisher cycle failed.")]
    private static partial void LogCycleFailure(ILogger logger, Exception exception);

    [LoggerMessage(EventId = 1002, Level = LogLevel.Warning, Message = "Failed to publish outbox event {eventId}.")]
    private static partial void LogPublishFailure(ILogger logger, Exception exception, Guid eventId);
}

