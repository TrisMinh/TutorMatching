using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TutorMatching.BuildingBlocks.Hosting;
using TutorMatching.BuildingBlocks.Security;
using TutorMatching.Identity.Api.Endpoints;
using TutorMatching.Identity.Api.Infrastructure;
using TutorMatching.Identity.Api.Security;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("identity");

builder.Services.AddDbContext<IdentityDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("IdentityDb")
        ?? "Host=localhost;Port=54321;Database=identity_db;Username=identity_app;Password=identity_dev"));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IPasswordHasher<string>, PasswordHasher<string>>();
builder.Services.AddScoped(provider => new TokenService(
    builder.Configuration.GetRequiredSection(JwtOptions.SectionName).Get<JwtOptions>()
        ?? throw new InvalidOperationException("JWT configuration is missing."),
    provider.GetRequiredService<TimeProvider>()));

var app = builder.Build();

app.MapTutorMatchingDefaults();
app.MapAuthEndpoints();
app.MapGet("/", () => Results.Ok(new { service = "identity", status = "ok" })).AllowAnonymous();

app.Run();

public partial class Program;
