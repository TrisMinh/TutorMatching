using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TutorMatching.Identity.Api.Infrastructure;

namespace TutorMatching.Identity.Tests;

public sealed class IdentityApiTests : IClassFixture<IdentityApiFactory>
{
    private readonly HttpClient client;

    public IdentityApiTests(IdentityApiFactory factory)
    {
        client = factory.CreateClient();
    }

    [Fact]
    public async Task RegisterThenLoginReturnsTokenPair()
    {
        var email = $"student-{Guid.NewGuid():N}@example.com";
        var register = await client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            password = "Correct-Horse-Battery-123!",
            role = "Student",
        });

        Assert.Equal(HttpStatusCode.Created, register.StatusCode);

        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email,
            password = "Correct-Horse-Battery-123!",
        });

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        using var body = JsonDocument.Parse(await login.Content.ReadAsStringAsync());
        Assert.False(string.IsNullOrWhiteSpace(body.RootElement.GetProperty("accessToken").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(body.RootElement.GetProperty("refreshToken").GetString()));
    }

    [Fact]
    public async Task DuplicateNormalizedEmailReturnsConflict()
    {
        var email = $"duplicate-{Guid.NewGuid():N}@example.com";
        var request = new { email, password = "Correct-Horse-Battery-123!", role = "Tutor" };

        var first = await client.PostAsJsonAsync("/api/v1/auth/register", request);
        var duplicate = await client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email = email.ToUpperInvariant(),
            request.password,
            request.role,
        });

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
    }

    [Fact]
    public async Task RefreshReplayRevokesReplacementSession()
    {
        var email = $"refresh-{Guid.NewGuid():N}@example.com";
        const string password = "Correct-Horse-Battery-123!";
        await client.PostAsJsonAsync("/api/v1/auth/register", new { email, password, role = "Student" });
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        using var loginBody = JsonDocument.Parse(await login.Content.ReadAsStringAsync());
        var firstToken = loginBody.RootElement.GetProperty("refreshToken").GetString();

        var rotation = await client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = firstToken });
        Assert.Equal(HttpStatusCode.OK, rotation.StatusCode);
        using var rotationBody = JsonDocument.Parse(await rotation.Content.ReadAsStringAsync());
        var replacementToken = rotationBody.RootElement.GetProperty("refreshToken").GetString();

        var replay = await client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = firstToken });
        var replacementAfterReplay = await client.PostAsJsonAsync(
            "/api/v1/auth/refresh",
            new { refreshToken = replacementToken });

        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, replacementAfterReplay.StatusCode);
    }
}

public sealed class IdentityApiFactory : WebApplicationFactory<Program>
{
    private readonly string databaseName = $"identity-tests-{Guid.NewGuid():N}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<IdentityDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<IdentityDbContext>>();
            services.AddDbContext<IdentityDbContext>(options =>
                options.UseInMemoryDatabase(databaseName));
        });
    }
}

