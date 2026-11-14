using TutorMatching.BuildingBlocks.Hosting;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("tutor");
var app = builder.Build();

app.MapTutorMatchingDefaults();
app.MapGet("/", () => Results.Ok(new { service = "tutor", status = "ok" })).AllowAnonymous();

app.Run();
