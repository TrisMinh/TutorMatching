using TutorMatching.BuildingBlocks.Hosting;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("student");
var app = builder.Build();

app.MapTutorMatchingDefaults();
app.MapGet("/", () => Results.Ok(new { service = "student", status = "ok" })).AllowAnonymous();

app.Run();
