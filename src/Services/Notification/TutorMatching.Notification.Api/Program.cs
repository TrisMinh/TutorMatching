using TutorMatching.BuildingBlocks.Hosting;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("notification");
var app = builder.Build();

app.MapTutorMatchingDefaults();
app.MapGet("/", () => Results.Ok(new { service = "notification", status = "ok" })).AllowAnonymous();

app.Run();
