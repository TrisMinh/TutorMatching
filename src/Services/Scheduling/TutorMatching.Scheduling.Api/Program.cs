using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using TutorMatching.BuildingBlocks.Hosting;
using TutorMatching.Scheduling.Api.Endpoints;
using TutorMatching.Scheduling.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("scheduling");
builder.Services.AddDbContext<SchedulingDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("SchedulingDb")
        ?? "Host=localhost;Port=54324;Database=scheduling_db;Username=scheduling_app;Password=scheduling_dev"));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(
    builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379,abortConnect=false"));
builder.Services.AddSingleton<IBookingHoldStore, RedisBookingHoldStore>();
builder.Services.AddHttpClient<ITutorClient, TutorClient>(client =>
    client.BaseAddress = new Uri(builder.Configuration["Services:Tutor"] ?? "http://localhost:8082"));
builder.Services.AddHttpClient<IStudentClient, StudentClient>(client =>
    client.BaseAddress = new Uri(builder.Configuration["Services:Student"] ?? "http://localhost:8083"));
builder.Services.AddHostedService<OutboxPublisher>();
var app = builder.Build();

app.MapTutorMatchingDefaults();
app.MapBookingEndpoints();
app.MapGet("/", () => Results.Ok(new { service = "scheduling", status = "ok" })).AllowAnonymous();

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<SchedulingDbContext>();
    if (dbContext.Database.IsRelational())
    {
        await dbContext.Database.MigrateAsync();
    }
}

app.Run();

public partial class Program;
