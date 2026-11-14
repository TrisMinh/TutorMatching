using TutorMatching.BuildingBlocks.Hosting;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("gateway");
var app = builder.Build();

app.MapTutorMatchingDefaults();
app.MapGet("/", () => Results.Ok(new { service = "gateway", status = "ok" })).AllowAnonymous();

app.Run();
