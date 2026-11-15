using TutorMatching.BuildingBlocks.Email;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TutorMatching.BuildingBlocks.Hosting;
using TutorMatching.BuildingBlocks.Security;
using TutorMatching.Identity.Api.Endpoints;
using TutorMatching.Identity.Api.Infrastructure;
using TutorMatching.Identity.Api.Security;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("identity");
_ = SmtpSettings.FromConfiguration(builder.Configuration);

builder.Services.AddDbContext<IdentityDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("IdentityDb")
        ?? "Host=localhost;Port=54321;Database=identity_db;Username=identity_app;Password=identity_dev"));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IVerificationEmailSender, VerificationEmailSender>();
builder.Services.AddScoped<EmailVerificationService>();
builder.Services.AddSingleton<IPasswordHasher<string>, PasswordHasher<string>>();
builder.Services.AddScoped(provider => new TokenService(
    builder.Configuration.GetRequiredSection(JwtOptions.SectionName).Get<JwtOptions>()
        ?? throw new InvalidOperationException("JWT configuration is missing."),
    provider.GetRequiredService<TimeProvider>()));

builder.Services.AddDependencyReadiness("database",(sp,ct)=>sp.GetRequiredService<IdentityDbContext>().Database.CanConnectAsync(ct));
var app = builder.Build();

app.MapTutorMatchingDefaults();
app.MapAuthEndpoints();
app.MapEmailVerificationEndpoints();
app.MapAccountEndpoints();
app.MapGet("/", () => Results.Ok(new { service = "identity", status = "ok" })).AllowAnonymous();

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
    if (dbContext.Database.IsRelational())
    {
        await dbContext.Database.MigrateAsync();
    }
}

app.Run();

public partial class Program;
