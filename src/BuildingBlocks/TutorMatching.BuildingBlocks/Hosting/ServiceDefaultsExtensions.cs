using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using TutorMatching.BuildingBlocks.Security;
using Microsoft.Extensions.DependencyInjection.Extensions;
using StackExchange.Redis;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;

namespace TutorMatching.BuildingBlocks.Hosting;

public static class ServiceDefaultsExtensions
{
    public static WebApplicationBuilder AddTutorMatchingApi(
        this WebApplicationBuilder builder,
        string serviceName,
        bool requireJwt = true)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(serviceName);
        var runtime = Environment.GetEnvironmentVariable("SECURITY_CONFIG_PATH");
        if (!string.IsNullOrWhiteSpace(runtime)) builder.Configuration.AddJsonFile(runtime, optional: false, reloadOnChange: false);
        WorkloadTls.ConfigureServer(builder);
        builder.Services.AddSingleton<AccessRevocation>();
        if (builder.Configuration.GetValue<bool>("Security:Revocation:Enabled"))
        {
            builder.Services.TryAddSingleton<IConnectionMultiplexer>(_ => SecurityRedis.Connect(builder.Configuration));
            builder.Services.AddDependencyReadiness("security-cache", async (sp, ct) => { await sp.GetRequiredService<IConnectionMultiplexer>().GetDatabase().PingAsync().WaitAsync(ct); return true; });
        }
        if (builder.Configuration.GetValue<bool>("Security:Audit:Enabled")) builder.Services.AddSingleton<SecurityAudit>();
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
        });

        builder.Services.AddProblemDetails(options =>
        {
            options.CustomizeProblemDetails = context =>
            {
                context.ProblemDetails.Extensions["service"] = serviceName;
                context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
            };
        });
        builder.Services.AddHealthChecks();
        builder.Services.AddSingleton(new ServiceInstance(serviceName, Environment.MachineName));
        builder.Services.AddOpenApi();

        if (requireJwt)
        {
            var jwtOptions = builder.Configuration
                .GetRequiredSection(JwtOptions.SectionName)
                .Get<JwtOptions>()
                ?? throw new InvalidOperationException("JWT configuration is missing.");
            jwtOptions.Validate();

            builder.Services
                .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.MapInboundClaims = false;
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuer = jwtOptions.Issuer,
                        ValidateAudience = true,
                        ValidAudience = jwtOptions.Audience,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = JwtKeyMaterial.VerificationKey(jwtOptions),
                        ValidAlgorithms = [string.IsNullOrWhiteSpace(jwtOptions.PublicKeyPath) ? SecurityAlgorithms.HmacSha256 : SecurityAlgorithms.RsaSha256],
                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.FromSeconds(jwtOptions.ClockSkewSeconds),
                        NameClaimType = "sub",
                        RoleClaimType = "role",
                    };
                    options.Events = new JwtBearerEvents
                    {
                        OnTokenValidated = async context =>
                        {
                            if (!builder.Configuration.GetValue<bool>("Security:Revocation:Enabled")) return;
                            try { if (await context.HttpContext.RequestServices.GetRequiredService<AccessRevocation>().IsRevokedAsync(context.Principal!)) context.Fail("Session has been revoked."); }
                            catch (RedisException) { context.HttpContext.Items["revocation-unavailable"] = true; context.Fail("Session validation unavailable."); }
                        },
                        OnChallenge = async context =>
                        {
                            if (!context.HttpContext.Items.ContainsKey("revocation-unavailable")) return;
                            context.HandleResponse(); context.Response.StatusCode = 503;
                            await context.Response.WriteAsJsonAsync(new { error = "Session validation is temporarily unavailable." });
                        },
                    };
                });
            builder.Services.AddAuthorization();
        }

        return builder;
    }

    public static WebApplication MapTutorMatchingDefaults(this WebApplication app, bool useJwt = true)
    {
        app.UseExceptionHandler();
        var audit = app.Services.GetService<SecurityAudit>(); // Validate persistent chain at startup.
        app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/health")) { await next(context); return; }
            if (WorkloadTls.Enabled(app.Configuration) && !context.Request.IsHttps) { context.Response.StatusCode = 426; return; }
            context.Response.Headers.XContentTypeOptions = "nosniff";
            context.Response.Headers["Referrer-Policy"] = "no-referrer";
            context.Response.Headers.CacheControl = "no-store";
            context.Response.Headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
            await next(context);
        });
        if (app.Configuration.GetValue<bool>("Diagnostics:ExposeInstance"))
        {
            var instance = app.Services.GetRequiredService<ServiceInstance>();
            app.Use(async (context, next) =>
            {
                context.Response.OnStarting(() =>
                {
                    context.Response.Headers[instance.Name == "gateway" ? "X-Gateway-Instance" : "X-Service-Instance"] = instance.Id;
                    return Task.CompletedTask;
                });
                await next(context);
            });
        }

        if (useJwt)
        {
            app.UseAuthentication();
        }
        if (audit is not null)
        {
            app.Use(async (context, next) =>
            {
                if (context.Request.Path.StartsWithSegments("/health")) { await next(context); return; }
                await audit.WriteAsync(context, "Intent"); // Failure here occurs before business execution.
                var status = 500;
                try { await next(context); status = context.Response.StatusCode; }
                finally { await audit.WriteAsync(context, "Result", status); }
            });
        }
        if (useJwt)
        {
            app.UseRateLimiter();
            app.UseAuthorization();
        }

        app.MapOpenApi();
        app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
        app.MapHealthChecks("/health/ready");
        return app;
    }
}

internal sealed record ServiceInstance(string Name, string Id);

