using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using TutorMatching.BuildingBlocks.Security;

namespace TutorMatching.BuildingBlocks.Hosting;

public static class ServiceDefaultsExtensions
{
    public static WebApplicationBuilder AddTutorMatchingApi(
        this WebApplicationBuilder builder,
        string serviceName,
        bool requireJwt = true)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(serviceName);

        builder.Services.AddProblemDetails(options =>
        {
            options.CustomizeProblemDetails = context =>
            {
                context.ProblemDetails.Extensions["service"] = serviceName;
                context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
            };
        });
        builder.Services.AddHealthChecks();
        builder.Services.AddExceptionHandler<DependencyExceptionHandler>();
        builder.Services.AddSingleton(new ServiceInstance(serviceName, Environment.MachineName));
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
        });
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
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
                        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.FromSeconds(jwtOptions.ClockSkewSeconds),
                        NameClaimType = "sub",
                        RoleClaimType = "role",
                    };
                });
            builder.Services.AddAuthorization();
        }

        return builder;
    }

    public static WebApplication MapTutorMatchingDefaults(this WebApplication app, bool useJwt = true)
    {
        app.UseExceptionHandler();
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
