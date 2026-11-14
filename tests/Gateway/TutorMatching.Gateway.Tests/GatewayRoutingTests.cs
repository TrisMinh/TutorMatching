using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace TutorMatching.Gateway.Tests;

public sealed class GatewayRoutingTests : IClassFixture<GatewayFactory>
{
    private readonly GatewayFactory factory;

    public GatewayRoutingTests(GatewayFactory factory)
    {
        this.factory = factory;
    }

    [Fact]
    public void ConfigurationContainsOnlyPublicApiRoutes()
    {
        var configuration = factory.Services.GetRequiredService<IConfiguration>();
        var paths = configuration.GetSection("ReverseProxy:Routes").GetChildren()
            .Select(route => route["Match:Path"])
            .ToArray();

        Assert.NotEmpty(paths);
        Assert.All(paths, path => Assert.StartsWith("/api/v1/", path, StringComparison.Ordinal));
        Assert.DoesNotContain(paths, path => path?.Contains("/internal/", StringComparison.OrdinalIgnoreCase) == true);
    }

    [Fact]
    public async Task InternalPathIsNotExposed()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/internal/v1/students/by-user/11111111-1111-1111-1111-111111111111");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}

public sealed class GatewayFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
    }
}

