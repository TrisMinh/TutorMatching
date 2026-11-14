using TutorMatching.BuildingBlocks.Hosting;
using TutorMatching.Gateway;
using TutorMatching.BuildingBlocks.Security;

var builder = WebApplication.CreateBuilder(args)
    .AddTutorMatchingApi("gateway");
builder.Services.AddReverseProxy().LoadFromConfig(builder.Configuration.GetSection("ReverseProxy")).ConfigureHttpClient((context,handler)=>{
    if(!WorkloadTls.Enabled(builder.Configuration))return;
    handler.SslOptions.ClientCertificates=[WorkloadTls.ClientCertificate(builder.Configuration)];
    handler.SslOptions.RemoteCertificateValidationCallback=(_,certificate,_,errors)=>WorkloadTls.ValidateServer(certificate,errors,builder.Configuration,context.ClusterId);
    handler.PooledConnectionLifetime=TimeSpan.FromSeconds(15);
});
builder.Services.AddHttpClient("tutor", client => client.BaseAddress = new Uri(
    builder.Configuration["Services:Tutor"] ?? "http://tutor-service:8080")).ConfigurePrimaryHttpMessageHandler(()=>WorkloadTls.HttpHandler(builder.Configuration,"tutor"));
builder.Services.AddHttpClient("scheduling", client => client.BaseAddress = new Uri(
    builder.Configuration["Services:Scheduling"] ?? "http://scheduling-service:8080")).ConfigurePrimaryHttpMessageHandler(()=>WorkloadTls.HttpHandler(builder.Configuration,"scheduling"));
builder.Services.AddScoped<SearchCompositionService>();
var app = builder.Build();

app.MapTutorMatchingDefaults();
app.MapGet("/", () => Results.Ok(new { service = "gateway", status = "ok" })).AllowAnonymous();
app.MapAvailableTutorSearch();
app.MapReverseProxy();

app.Run();

public partial class Program;
