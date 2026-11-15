using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TutorMatching.Identity.Api.Domain;
using TutorMatching.Identity.Api.Infrastructure;

namespace TutorMatching.Identity.Tests;

public sealed class EmailVerificationTests(IdentityApiFactory factory) : IClassFixture<IdentityApiFactory>
{
    private const string Password = "VerificationPassword!2026";
    private async Task<(HttpClient Client, string Email)> Register(string role = "Student")
    {
        var client = factory.CreateClient();
        var email = $"verify-{Guid.NewGuid():N}@example.com";
        var register = await client.PostAsJsonAsync("/api/v1/auth/register", new {email, password = Password, role});
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        var body = await register.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("PendingVerification", body.GetProperty("status").GetString());
        Assert.Matches("^[0-9]{6}$", factory.Emails.Codes[email]);
        return (client, email);
    }

    [Theory]
    [InlineData("Student")]
    [InlineData("Tutor")]
    public async Task VerificationIsRequiredAndPreservesRole(string role)
    {
        var (client, email) = await Register(role);
        var denied = await client.PostAsJsonAsync("/api/v1/auth/login", new {email, password = Password});
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        Assert.Equal("email_verification_required", (await denied.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
        var wrongPassword = await client.PostAsJsonAsync("/api/v1/auth/login", new {email, password = "wrong-password"});
        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
            var account = await db.UserAccounts.SingleAsync(a => a.Email == email);
            Assert.False(account.CanAuthenticate);
            Assert.Empty(await db.RefreshSessions.Where(s => s.UserId == account.Id).ToArrayAsync());
            var stored = await db.EmailVerifications.SingleAsync(v => v.UserId == account.Id);
            Assert.DoesNotContain(factory.Emails.Codes[email], stored.CodeHash);
        }
        var verified = await client.PostAsJsonAsync("/api/v1/auth/verify-email", new {email, code = factory.Emails.Codes[email]});
        Assert.Equal(HttpStatusCode.OK, verified.StatusCode);
        Assert.Equal(role, (await verified.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("role").GetString());
        var replay = await client.PostAsJsonAsync("/api/v1/auth/verify-email", new {email, code = factory.Emails.Codes[email]});
        Assert.Equal(HttpStatusCode.BadRequest, replay.StatusCode);
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new {email, password = Password});
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    [Fact]
    public async Task AttemptsAreLimitedAndResendInvalidatesOldCode()
    {
        var (client, email) = await Register();
        var oldCode = factory.Emails.Codes[email];
        var wrong = oldCode == "000000" ? "111111" : "000000";
        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/v1/auth/verify-email", new {email, code = wrong})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/v1/auth/verify-email", new {email, code = oldCode})).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsJsonAsync("/api/v1/auth/resend-verification", new {email})).StatusCode);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
            var id = await db.UserAccounts.Where(a => a.Email == email).Select(a => a.Id).SingleAsync();
            var row = await db.EmailVerifications.SingleAsync(v => v.UserId == id);
            row.SentAtUtc = DateTimeOffset.UtcNow.AddMinutes(-2);
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync("/api/v1/auth/resend-verification", new {email})).StatusCode);
        await factory.VerifyEmailAsync(client, email);
    }

    [Fact]
    public async Task ExpiredOrMalformedCodesCannotActivateAccount()
    {
        var (client, email) = await Register();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
            var id = await db.UserAccounts.Where(a => a.Email == email).Select(a => a.Id).SingleAsync();
            (await db.EmailVerifications.SingleAsync(v => v.UserId == id)).ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }
        foreach (var code in new[] {factory.Emails.Codes[email], "12345", "abcdef"})
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/v1/auth/verify-email", new {email, code})).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/v1/auth/login", new {email, password = Password})).StatusCode);
    }

    [Theory]
    [InlineData("Admin")]
    [InlineData("2")]
    [InlineData("99")]
    public async Task RegistrationRejectsNonPublicRoles(string role)
    {
        var client = factory.CreateClient();
        var result = await client.PostAsJsonAsync("/api/v1/auth/register", new {email = $"role-{Guid.NewGuid():N}@example.com", password = Password, role});
        Assert.Equal(HttpStatusCode.BadRequest, result.StatusCode);
    }
}
