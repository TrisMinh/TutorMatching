using Microsoft.EntityFrameworkCore;
using Npgsql;
using TutorMatching.Scheduling.Api.Domain;
using TutorMatching.Scheduling.Api.Infrastructure;

namespace TutorMatching.Scheduling.Tests;
public sealed class OutboxRecoveryTests
{
    [Fact]
    public async Task ConcurrentWorkersSkipClaimedRowsAndRecoverAfterConnectionDies(){
        var connection=Environment.GetEnvironmentVariable("TEST_SCHEDULING_DB");if(string.IsNullOrWhiteSpace(connection))return;
        var builder=new NpgsqlConnectionStringBuilder(connection){Database="retry_test_"+Guid.NewGuid().ToString("N")};
        await using var admin=new NpgsqlConnection(connection);await admin.OpenAsync();
        await using(var create=new NpgsqlCommand($"CREATE DATABASE {builder.Database}",admin))await create.ExecuteNonQueryAsync();
        try{
            var options=new DbContextOptionsBuilder<SchedulingDbContext>().UseNpgsql(builder.ConnectionString).Options;
            await using(var seed=new SchedulingDbContext(options)){
                await seed.Database.MigrateAsync();seed.OutboxMessages.AddRange(Event(),Event());await seed.SaveChangesAsync();
            }
            await using var first=new SchedulingDbContext(options);await using var second=new SchedulingDbContext(options);
            await using var transaction1=await first.Database.BeginTransactionAsync();await using var transaction2=await second.Database.BeginTransactionAsync();
            var one=await OutboxPublisher.ClaimNextAsync(first,DateTimeOffset.UtcNow.AddSeconds(1),default);var two=await OutboxPublisher.ClaimNextAsync(second,DateTimeOffset.UtcNow.AddSeconds(1),default);
            Assert.NotNull(one);Assert.NotNull(two);Assert.NotEqual(one.Id,two.Id);
            await transaction2.RollbackAsync();second.ChangeTracker.Clear();
            var pid=((NpgsqlConnection)first.Database.GetDbConnection()).ProcessID;
            await using(var terminate=new NpgsqlCommand("SELECT pg_terminate_backend(@pid)",admin)){terminate.Parameters.AddWithValue("pid",pid);await terminate.ExecuteNonQueryAsync();}
            await using var recovery=await second.Database.BeginTransactionAsync();
            var recovered=await OutboxPublisher.ClaimNextAsync(second,DateTimeOffset.UtcNow.AddSeconds(1),default);Assert.NotNull(recovered);Assert.Equal(one.Id,recovered.Id);
            recovered.MarkPublished(DateTimeOffset.UtcNow);await second.SaveChangesAsync();await recovery.CommitAsync();
            await using var check=new SchedulingDbContext(options);Assert.Equal(1,await check.OutboxMessages.CountAsync(m=>m.PublishedAtUtc!=null));
        }finally{await using var drop=new NpgsqlCommand($"DROP DATABASE {builder.Database} WITH (FORCE)",admin);await drop.ExecuteNonQueryAsync();}
    }
    [Fact]
    public async Task RollbackLeavesNeitherBookingNorOutboxAndCommitPersistsBoth(){
        var connection=Environment.GetEnvironmentVariable("TEST_SCHEDULING_DB");if(string.IsNullOrWhiteSpace(connection))return;
        var builder=new NpgsqlConnectionStringBuilder(connection){Database="rollback_test_"+Guid.NewGuid().ToString("N")};
        await using var admin=new NpgsqlConnection(connection);await admin.OpenAsync();await using(var create=new NpgsqlCommand($"CREATE DATABASE {builder.Database}",admin))await create.ExecuteNonQueryAsync();
        try{
            var options=new DbContextOptionsBuilder<SchedulingDbContext>().UseNpgsql(builder.ConnectionString).Options;
            await using(var setup=new SchedulingDbContext(options))await setup.Database.MigrateAsync();
            foreach(var commit in new[]{false,true}){
                await using var db=new SchedulingDbContext(options);await using var tx=await db.Database.BeginTransactionAsync();
                var booking=Booking();db.Bookings.Add(booking);db.OutboxMessages.Add(OutboxMessage.BookingConfirmed(booking,Guid.NewGuid(),null,DateTimeOffset.UtcNow));await db.SaveChangesAsync();
                if(commit)await tx.CommitAsync();else await tx.RollbackAsync();
                await using var check=new SchedulingDbContext(options);Assert.Equal(commit?1:0,await check.Bookings.CountAsync());Assert.Equal(commit?1:0,await check.OutboxMessages.CountAsync());
            }
        }finally{await using var drop=new NpgsqlCommand($"DROP DATABASE {builder.Database} WITH (FORCE)",admin);await drop.ExecuteNonQueryAsync();}
    }
    private static Booking Booking(){var start=DateTimeOffset.UtcNow.AddDays(5);start=new DateTimeOffset(start.Year,start.Month,start.Day,10,0,0,TimeSpan.Zero);return TutorMatching.Scheduling.Api.Domain.Booking.ConfirmFromHold(Guid.NewGuid(),Guid.NewGuid(),Guid.NewGuid(),Guid.NewGuid(),Guid.NewGuid(),Guid.NewGuid(),TimeSlot.Create(start,start.AddHours(1)),DateTimeOffset.UtcNow);}
    private static OutboxMessage Event()=>OutboxMessage.BookingConfirmed(Booking(),Guid.NewGuid(),null,DateTimeOffset.UtcNow.AddSeconds(-2));
}
