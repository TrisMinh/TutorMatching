using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using TutorMatching.Notification.Api.Domain;
using TutorMatching.Notification.Api.Infrastructure;

namespace TutorMatching.Notification.Tests;

public sealed class MultiInstanceRecoveryTests
{
    [Fact]
    public async Task CompetingProjectorsDeduplicateAndThreeWorkersDeliverEachReminderOnce()
    {
        var connection = Environment.GetEnvironmentVariable("TEST_NOTIFICATION_DB");
        if (string.IsNullOrWhiteSpace(connection)) return;
        var builder = new NpgsqlConnectionStringBuilder(connection) { Database = "notification_recovery_" + Guid.NewGuid().ToString("N") };
        await using var admin = new NpgsqlConnection(connection);
        await admin.OpenAsync();
        await using (var create = new NpgsqlCommand($"CREATE DATABASE {builder.Database}", admin)) await create.ExecuteNonQueryAsync();
        try
        {
            var options = new DbContextOptionsBuilder<NotificationDbContext>().UseNpgsql(builder.ConnectionString).Options;
            await using (var setup = new NotificationDbContext(options)) await setup.Database.MigrateAsync();
            var eventId = Guid.NewGuid();
            var payload = JsonSerializer.SerializeToElement(new { bookingId = Guid.NewGuid(), StudentUserId = Guid.NewGuid(), TutorUserId = Guid.NewGuid(), StartAtUtc = DateTimeOffset.UtcNow.AddMinutes(30) });
            await Task.WhenAll(Enumerable.Range(0, 3).Select(async _ =>
            {
                await using var db = new NotificationDbContext(options);
                await using var tx = await db.Database.BeginTransactionAsync();
                await new BookingEventProjector(db).ApplyAsync(eventId, "BookingConfirmed", 1, payload, DateTimeOffset.UtcNow, default);
                await db.SaveChangesAsync();
                await tx.CommitAsync();
            }));
            await using (var db = new NotificationDbContext(options))
            {
                Assert.Equal(1, await db.ProcessedEvents.CountAsync());
                Assert.Equal(2, await db.Notifications.CountAsync());
                Assert.Equal(2, await db.ReminderSchedules.CountAsync());
                for (var i = 0; i < 12; i++) db.ReminderSchedules.Add(ReminderSchedule.Create(Guid.NewGuid(), Guid.NewGuid(), eventId, "OneHour", DateTimeOffset.UtcNow.AddMinutes(-1)));
                await db.SaveChangesAsync();
            }
            var sender = new CountingSender();
            var services = new ServiceCollection().AddDbContext<NotificationDbContext>(o => o.UseNpgsql(builder.ConnectionString)).AddSingleton<IEmailSender>(sender);
            await using var provider = services.BuildServiceProvider();
            var workers = Enumerable.Range(0, 3).Select(_ => new ReminderWorker(provider.GetRequiredService<IServiceScopeFactory>(), TimeProvider.System, NullLogger<ReminderWorker>.Instance)).ToArray();
            try
            {
                foreach (var worker in workers) await worker.StartAsync(default);
                var deadline = DateTime.UtcNow.AddSeconds(15);
                while (DateTime.UtcNow < deadline)
                {
                    await using var db = new NotificationDbContext(options);
                    if (await db.ReminderSchedules.CountAsync(r => r.Status == DeliveryStatus.Sent) == 14) break;
                    await Task.Delay(100);
                }
            }
            finally { foreach (var worker in workers) { await worker.StopAsync(default); worker.Dispose(); } }
            Assert.Equal(14, sender.Deliveries.Count);
            Assert.All(sender.Deliveries.Values, count => Assert.Equal(1, count));
            await using var check = new NotificationDbContext(options);
            Assert.Equal(14, await check.ReminderSchedules.CountAsync(r => r.Status == DeliveryStatus.Sent));
        }
        finally
        {
            await using var drop = new NpgsqlCommand($"DROP DATABASE {builder.Database} WITH (FORCE)", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }

    private sealed class CountingSender : IEmailSender
    {
        public ConcurrentDictionary<(Guid, Guid), int> Deliveries { get; } = new();
        public async Task SendReminderAsync(Guid recipientUserId, Guid bookingId, CancellationToken cancellationToken)
        {
            await Task.Delay(100, cancellationToken);
            Deliveries.AddOrUpdate((recipientUserId, bookingId), 1, (_, count) => count + 1);
        }
    }
}
