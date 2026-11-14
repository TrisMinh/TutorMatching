using Microsoft.EntityFrameworkCore;
using TutorMatching.BuildingBlocks.Hosting;
using TutorMatching.Student.Api.Endpoints;
using TutorMatching.Student.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("student");
builder.Services.AddDbContext<StudentDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("StudentDb")
        ?? "Host=localhost;Port=54323;Database=student_db;Username=student_app;Password=student_dev"));
builder.Services.AddSingleton(TimeProvider.System);
var app = builder.Build();

app.MapTutorMatchingDefaults();
app.MapStudentEndpoints();
app.MapGet("/", () => Results.Ok(new { service = "student", status = "ok" })).AllowAnonymous();

app.Run();

public partial class Program;
