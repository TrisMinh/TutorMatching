using System.Text;
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

        if (useJwt)
        {
            app.UseAuthentication();
            app.UseAuthorization();
        }

        app.MapOpenApi();
        app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
        app.MapHealthChecks("/health/ready");
        return app;
    }
}

