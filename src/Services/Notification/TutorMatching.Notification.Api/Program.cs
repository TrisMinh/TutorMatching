using Microsoft.EntityFrameworkCore;
using TutorMatching.BuildingBlocks.Hosting;
using TutorMatching.Notification.Api.Endpoints;
using TutorMatching.Notification.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("notification");
builder.Services.AddDbContext<NotificationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("NotificationDb")
        ?? "Host=localhost;Port=54325;Database=notification_db;Username=notification_app;Password=notification_dev"));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddHostedService<BookingEventConsumer>();
builder.Services.AddHostedService<ReminderWorker>();
var app = builder.Build();

app.MapTutorMatchingDefaults();
app.MapNotificationEndpoints();
app.MapGet("/", () => Results.Ok(new { service = "notification", status = "ok" })).AllowAnonymous();

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<NotificationDbContext>();
    if (dbContext.Database.IsRelational())
    {
        await dbContext.Database.MigrateAsync();
    }
}

app.Run();

public partial class Program;
