namespace TutorMatching.BuildingBlocks.Messaging;

public sealed record IntegrationEvent<TPayload>(
    Guid EventId,
    string EventType,
    int EventVersion,
    DateTimeOffset OccurredAtUtc,
    Guid CorrelationId,
    Guid? CausationId,
    TPayload Payload);

