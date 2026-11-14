using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using TutorMatching.Notification.Api.Domain;
using TutorMatching.BuildingBlocks.Security;

namespace TutorMatching.Notification.Api.Infrastructure;

public sealed partial class BookingEventConsumer(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    TimeProvider timeProvider,
    ILogger<BookingEventConsumer> logger) : BackgroundService
{
    private const string EventsExchange = "tutormatching.events";
    private const string RetryExchange = "tutormatching.retry";
    private const string DeadLetterExchange = "tutormatching.dlx";
    private const string QueueName = "notification.booking-events.v1";
    private const string RetryQueue = "notification.booking-events.retry";
    private const string DeadLetterQueue = "notification.booking-events.dlq";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ConsumeUntilDisconnectedAsync(stoppingToken);
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                LogConsumerFailure(logger, exception);
                await Task.Delay(TimeSpan.FromSeconds(5), timeProvider, stoppingToken);
            }
        }
    }

    private async Task ConsumeUntilDisconnectedAsync(CancellationToken cancellationToken)
    {
        var factory = new ConnectionFactory
        {
            Uri = new Uri(configuration.GetConnectionString("RabbitMq")
                ?? "amqp://guest:guest@localhost:5672/"),
            AutomaticRecoveryEnabled = true,
            ConsumerDispatchConcurrency = 1,
        };
        if(factory.Ssl.Enabled&&WorkloadTls.Enabled(configuration)){
            factory.Ssl.ServerName="rabbitmq";
            factory.Ssl.Certs=[WorkloadTls.ClientCertificate(configuration)];
            factory.Ssl.CertificateValidationCallback=(_,certificate,_,errors)=>WorkloadTls.ValidateServer(certificate,errors,configuration,"rabbitmq");
        }
        await using var connection = await factory.CreateConnectionAsync("notification-consumer", cancellationToken);
        await using var channel = await connection.CreateChannelAsync(
            new CreateChannelOptions(true, true, consumerDispatchConcurrency: 1),
            cancellationToken);
        if(configuration.GetValue<bool>("Security:Messaging:RequireSignature"))
            await channel.QueueDeclarePassiveAsync(QueueName,cancellationToken);
        else await DeclareTopologyAsync(channel, cancellationToken);
        await channel.BasicQosAsync(0, 20, global: false, cancellationToken);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, delivery) =>
            await HandleDeliveryAsync(channel, delivery, cancellationToken);
        await channel.BasicConsumeAsync(QueueName, autoAck: false, consumer, cancellationToken);

        var disconnected = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.ConnectionShutdownAsync += (_, _) =>
        {
            disconnected.TrySetResult();
            return Task.CompletedTask;
        };
        using var registration = cancellationToken.Register(() => disconnected.TrySetCanceled(cancellationToken));
        await disconnected.Task;
    }

    private async Task HandleDeliveryAsync(
        IChannel channel,
        BasicDeliverEventArgs delivery,
        CancellationToken cancellationToken)
    {
        try
        {
            await ProcessEventAsync(delivery, cancellationToken);
            await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false, cancellationToken);
        }
        catch (JsonException exception)
        {
            LogPoisonEvent(logger, exception, delivery.BasicProperties.MessageId ?? "unknown");
            await PublishFailureAsync(channel, delivery, DeadLetterExchange, GetAttempt(delivery), cancellationToken);
            await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false, cancellationToken);
        }
        catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
        {
            var attempt = GetAttempt(delivery) + 1;
            LogTransientFailure(logger, exception, delivery.BasicProperties.MessageId ?? "unknown", attempt);
            await PublishFailureAsync(
                channel,
                delivery,
                attempt >= 5 ? DeadLetterExchange : RetryExchange,
                attempt,
                cancellationToken);
            await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false, cancellationToken);
        }
    }

    private async Task ProcessEventAsync(BasicDeliverEventArgs delivery, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(delivery.BasicProperties.MessageId, out var eventId))
        {
            throw new JsonException("Event message ID is not a UUID.");
        }

        var eventType = delivery.BasicProperties.Type ?? throw new JsonException("Event type is missing.");
        if(configuration.GetValue<bool>("Security:Messaging:RequireSignature")){
            string Header(string name)=>delivery.BasicProperties.Headers?.TryGetValue(name,out var value)==true ? value switch {byte[] bytes=>Encoding.UTF8.GetString(bytes),string text=>text,_=>""}:"";
            var proof=new MessageProof(Header("x-key-id"),Header("x-signed-at"),Header("x-signature"));
            if(!MessageAuthentication.Verify(configuration,proof,eventId.ToString(),eventType,GetHeaderInt(delivery.BasicProperties.Headers,"event-version",1),delivery.RoutingKey,delivery.BasicProperties.CorrelationId??"",delivery.Body.Span))
                throw new JsonException("Event signature is missing or invalid.");
        }
        using var payload = JsonDocument.Parse(delivery.Body);
        await using var scope = scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<NotificationDbContext>();
        var now = timeProvider.GetUtcNow();
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var projector = new BookingEventProjector(dbContext);
        await projector.ApplyAsync(
            eventId,
            eventType,
            GetHeaderInt(delivery.BasicProperties.Headers, "event-version", 1),
            payload.RootElement,
            now,
            cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task PublishFailureAsync(
        IChannel channel,
        BasicDeliverEventArgs delivery,
        string exchange,
        int attempt,
        CancellationToken cancellationToken)
    {
        var properties = new BasicProperties(delivery.BasicProperties)
        {
            Persistent = true,
            Headers = new Dictionary<string, object?>(delivery.BasicProperties.Headers ?? new Dictionary<string, object?>())
            {
                ["x-attempt"] = attempt,
            },
        };
        await channel.BasicPublishAsync(
            exchange,
            delivery.RoutingKey,
            mandatory: true,
            properties,
            delivery.Body,
            cancellationToken);
    }

    private static int GetAttempt(BasicDeliverEventArgs delivery) =>
        GetHeaderInt(delivery.BasicProperties.Headers, "x-attempt", 0);

    private static int GetHeaderInt(IDictionary<string, object?>? headers, string key, int fallback)
    {
        if (headers is null || !headers.TryGetValue(key, out var value))
        {
            return fallback;
        }

        return value switch
        {
            int number => number,
            long number => checked((int)number),
            byte[] bytes when int.TryParse(Encoding.UTF8.GetString(bytes), out var number) => number,
            _ => fallback,
        };
    }

    private static async Task DeclareTopologyAsync(IChannel channel, CancellationToken cancellationToken)
    {
        await channel.ExchangeDeclareAsync(EventsExchange, ExchangeType.Topic, durable: true, autoDelete: false, cancellationToken: cancellationToken);
        await channel.ExchangeDeclareAsync(RetryExchange, ExchangeType.Topic, durable: true, autoDelete: false, cancellationToken: cancellationToken);
        await channel.ExchangeDeclareAsync(DeadLetterExchange, ExchangeType.Topic, durable: true, autoDelete: false, cancellationToken: cancellationToken);
        await channel.QueueDeclareAsync(QueueName, durable: true, exclusive: false, autoDelete: false, cancellationToken: cancellationToken);
        await channel.QueueBindAsync(QueueName, EventsExchange, "booking.confirmed.v1", cancellationToken: cancellationToken);
        await channel.QueueBindAsync(QueueName, EventsExchange, "booking.cancelled.v1", cancellationToken: cancellationToken);
        await channel.QueueDeclareAsync(
            RetryQueue,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: new Dictionary<string, object?>
            {
                ["x-message-ttl"] = 30_000,
                ["x-dead-letter-exchange"] = EventsExchange,
            },
            cancellationToken: cancellationToken);
        await channel.QueueBindAsync(RetryQueue, RetryExchange, "booking.*.v1", cancellationToken: cancellationToken);
        await channel.QueueDeclareAsync(DeadLetterQueue, durable: true, exclusive: false, autoDelete: false, cancellationToken: cancellationToken);
        await channel.QueueBindAsync(DeadLetterQueue, DeadLetterExchange, "booking.*.v1", cancellationToken: cancellationToken);
    }

    [LoggerMessage(EventId = 2001, Level = LogLevel.Error, Message = "Booking event consumer disconnected.")]
    private static partial void LogConsumerFailure(ILogger logger, Exception exception);

    [LoggerMessage(EventId = 2002, Level = LogLevel.Error, Message = "Poison booking event {eventId} moved to DLQ.")]
    private static partial void LogPoisonEvent(ILogger logger, Exception exception, string eventId);

    [LoggerMessage(EventId = 2003, Level = LogLevel.Warning, Message = "Booking event {eventId} failed at attempt {attempt}.")]
    private static partial void LogTransientFailure(ILogger logger, Exception exception, string eventId, int attempt);
}

