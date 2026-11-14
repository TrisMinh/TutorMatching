using StackExchange.Redis;
using TutorMatching.Scheduling.Api.Infrastructure;

namespace TutorMatching.Scheduling.Tests;

public sealed class RedisBookingHoldStoreIntegrationTests
{
    [Fact]
    public async Task ConcurrentHoldForSameTutorAndSlotAllowsExactlyOneOwner()
    {
        var connectionString = Environment.GetEnvironmentVariable("TEST_REDIS_CONNECTION");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return;
        }

        await using var connection = await ConnectionMultiplexer.ConnectAsync(connectionString);
        await connection.GetDatabase().ExecuteAsync("FLUSHDB");
        var store = new RedisBookingHoldStore(connection, TimeProvider.System);
        var tutorId = Guid.NewGuid();
        var tutorUserId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var start = DateTimeOffset.UtcNow.AddDays(1);
        start = new DateTimeOffset(start.Year, start.Month, start.Day, start.Hour, 0, 0, TimeSpan.Zero);

        var attempts = await Task.WhenAll(
            store.TryCreateAsync(Guid.NewGuid(), Guid.NewGuid(), tutorId, tutorUserId, subjectId, start, CancellationToken.None),
            store.TryCreateAsync(Guid.NewGuid(), Guid.NewGuid(), tutorId, tutorUserId, subjectId, start, CancellationToken.None));

        Assert.Single(attempts, result => result.Created);
        Assert.Single(attempts, result => !result.Created);

        var winner = attempts.Single(result => result.Created);
        Assert.NotNull(winner.Hold);
        Assert.NotNull(await store.GetAsync(winner.Hold.HoldId, CancellationToken.None));
        await store.ReleaseAsync(winner.Hold, CancellationToken.None);
    }
}

