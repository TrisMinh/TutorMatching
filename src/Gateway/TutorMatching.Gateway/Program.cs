using TutorMatching.BuildingBlocks.Hosting;
using TutorMatching.Gateway;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("gateway");
builder.Services.AddReverseProxy().LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));
builder.Services.AddHttpClient("tutor", client => client.BaseAddress = new Uri(
    builder.Configuration["Services:Tutor"] ?? "http://tutor-service:8080"));
builder.Services.AddHttpClient("scheduling", client => client.BaseAddress = new Uri(
    builder.Configuration["Services:Scheduling"] ?? "http://scheduling-service:8080"));
builder.Services.AddScoped<SearchCompositionService>();
var app = builder.Build();

app.MapTutorMatchingDefaults();
app.MapGet("/", () => Results.Ok(new { service = "gateway", status = "ok" })).AllowAnonymous();
app.MapAvailableTutorSearch();
app.MapReverseProxy();

app.Run();

public partial class Program;
