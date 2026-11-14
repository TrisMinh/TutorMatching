using Microsoft.EntityFrameworkCore;
using TutorMatching.BuildingBlocks.Hosting;
using TutorMatching.Tutor.Api.Endpoints;
using TutorMatching.Tutor.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("tutor");
builder.Services.AddDbContext<TutorDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("TutorDb")
        ?? "Host=localhost;Port=54322;Database=tutor_db;Username=tutor_app;Password=tutor_dev"));
builder.Services.AddSingleton(TimeProvider.System);
var app = builder.Build();

app.MapTutorMatchingDefaults();
app.MapTutorEndpoints();
app.MapGet("/", () => Results.Ok(new { service = "tutor", status = "ok" })).AllowAnonymous();

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<TutorDbContext>();
    if (dbContext.Database.IsRelational())
    {
        await dbContext.Database.MigrateAsync();
    }
}

app.Run();

public partial class Program;
