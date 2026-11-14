using Microsoft.EntityFrameworkCore;
using TutorMatching.BuildingBlocks.Hosting;
using TutorMatching.Tutor.Api.Endpoints;
using TutorMatching.Tutor.Api.Infrastructure;
using TutorMatching.BuildingBlocks.Security;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("tutor");
builder.Services.AddDbContext<TutorDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("TutorDb")
        ?? "Host=localhost;Port=54322;Database=tutor_db;Username=tutor_app;Password=tutor_dev"));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHttpClient();
builder.Services.AddHttpClient("student",client=>client.BaseAddress=new Uri(builder.Configuration["Services:Student"]??"http://student-service:8080")).ConfigurePrimaryHttpMessageHandler(()=>WorkloadTls.HttpHandler(builder.Configuration,"student"));
builder.Services.AddHttpClient("scheduling",client=>client.BaseAddress=new Uri(builder.Configuration["Services:Scheduling"]??"http://scheduling-service:8080")).ConfigurePrimaryHttpMessageHandler(()=>WorkloadTls.HttpHandler(builder.Configuration,"scheduling"));
builder.Services.AddSingleton<StackExchange.Redis.IConnectionMultiplexer>(_=>SecurityRedis.Connect(builder.Configuration));
builder.Services.AddDependencyReadiness("database",(sp,ct)=>sp.GetRequiredService<TutorDbContext>().Database.CanConnectAsync(ct));
builder.Services.AddDependencyReadiness("redis",async(sp,ct)=>{await sp.GetRequiredService<StackExchange.Redis.IConnectionMultiplexer>().GetDatabase().PingAsync().WaitAsync(ct);return true;});
var app = builder.Build();

app.MapTutorMatchingDefaults();
app.UseScheduleWriteLock();
app.Use(async(context,next)=>{
    try { await next(context); }
    catch(Microsoft.EntityFrameworkCore.DbUpdateException ex) when(ex.InnerException is Npgsql.PostgresException {SqlState:"40001" or "23505"}) {
        context.Response.StatusCode=409;await context.Response.WriteAsJsonAsync(new{error="Schedule changed concurrently. Refresh and retry."});
    }
    catch(Npgsql.PostgresException ex) when(ex.SqlState=="40001") {
        context.Response.StatusCode=409;await context.Response.WriteAsJsonAsync(new{error="Schedule changed concurrently. Refresh and retry."});
    }
});
app.MapTutorEndpoints();
app.MapCourseEndpoints();
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
