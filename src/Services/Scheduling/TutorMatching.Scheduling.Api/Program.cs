using TutorMatching.BuildingBlocks.Hosting;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("scheduling");
var app = builder.Build();

app.MapTutorMatchingDefaults();
app.MapGet("/", () => Results.Ok(new { service = "scheduling", status = "ok" })).AllowAnonymous();

app.Run();
