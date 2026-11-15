using TutorMatching.BuildingBlocks.Email;
using TutorMatching.BuildingBlocks.Security;
using Microsoft.EntityFrameworkCore;
using TutorMatching.BuildingBlocks.Hosting;
using TutorMatching.Notification.Api.Endpoints;
using TutorMatching.Notification.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("notification");
_ = SmtpSettings.FromConfiguration(builder.Configuration);
builder.Services.AddDbContext<NotificationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("NotificationDb")
        ?? "Host=localhost;Port=54325;Database=notification_db;Username=notification_app;Password=notification_dev"));
builder.Services.AddSingleton(TimeProvider.System);
 builder.Services.AddHttpClient<AccountDirectoryClient>(client => {
     client.BaseAddress = new Uri(builder.Configuration["Services:Identity"] ?? "http://identity-service:8080");
     client.Timeout = TimeSpan.FromSeconds(5);
 });
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddHostedService<BookingEventConsumer>();
builder.Services.AddHostedService<ReminderWorker>();
builder.Services.AddHostedService<CourseReminderSync>();
builder.Services.AddHttpClient("tutor-reminders", client => { client.BaseAddress = new Uri(builder.Configuration["Services:Tutor"] ?? "http://tutor-service:8080"); client.Timeout = TimeSpan.FromSeconds(5); });
builder.Services.AddHttpClient("scheduling-reminders", client => { client.BaseAddress = new Uri(builder.Configuration["Services:Scheduling"] ?? "http://scheduling-service:8080"); client.Timeout = TimeSpan.FromSeconds(5); });
builder.Services.AddDependencyReadiness("database",(sp,ct)=>sp.GetRequiredService<NotificationDbContext>().Database.CanConnectAsync(ct));
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
