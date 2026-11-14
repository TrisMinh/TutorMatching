using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TutorMatching.Identity.Api.Domain;
using TutorMatching.Identity.Api.Infrastructure;
using TutorMatching.Identity.Api.Security;

namespace TutorMatching.Identity.Tests;

public sealed class AccountRecoveryTests(IdentityApiFactory factory) : IClassFixture<IdentityApiFactory>
{
    private async Task<(HttpClient Client,string Email,string Refresh)> Account(string role = "Student")
    {
        var client=factory.CreateClient();var email=$"settings-{Guid.NewGuid():N}@example.com";
        var register=await client.PostAsJsonAsync("/api/v1/auth/register",new{email,password="OriginalPassword!123",role});
        Assert.Equal(HttpStatusCode.Created,register.StatusCode);
        var login=await client.PostAsJsonAsync("/api/v1/auth/login",new{email,password="OriginalPassword!123"});
        var tokens=await login.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",tokens.GetProperty("accessToken").GetString());
        return (client,email,tokens.GetProperty("refreshToken").GetString()!);
    }

    [Fact]
    public async Task SettingsPersistAndRejectStaleOrStudentPolicyChanges()
    {
        var (client,_,_)=await Account();
        var first=await client.GetFromJsonAsync<JsonElement>("/api/v1/users/me/settings");
        Assert.True(first.GetProperty("emailReminders").GetBoolean());
        var update=new{emailReminders=false,inAppNotifications=false,enrollmentAlerts=true,profileVisible=true,cancellationNoticeHours=12,version=0};
        Assert.Equal(HttpStatusCode.OK,(await client.PutAsJsonAsync("/api/v1/users/me/settings",update)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await client.PutAsJsonAsync("/api/v1/users/me/settings",update)).StatusCode);
        var saved=await client.GetFromJsonAsync<JsonElement>("/api/v1/users/me/settings");
        Assert.False(saved.GetProperty("emailReminders").GetBoolean());
        Assert.Equal(HttpStatusCode.BadRequest,(await client.PutAsJsonAsync("/api/v1/users/me/settings",new{emailReminders=true,inAppNotifications=true,enrollmentAlerts=true,profileVisible=true,cancellationNoticeHours=48,version=1})).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await client.GetAsync("/internal/v1/users/hidden-tutors")).StatusCode);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ResetRequiresUnexpiredSingleUseProofAndRevokesRefresh(bool expired)
    {
        var (client,email,refresh)=await Account();
        var raw=Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
        using(var scope=factory.Services.CreateScope())
        {
            var db=scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
            var account=await db.UserAccounts.SingleAsync(u=>u.Email==email);
            db.PasswordResets.Add(new PasswordReset{Id=Guid.NewGuid(),UserId=account.Id,TokenHash=TokenService.HashRefreshToken(raw),CreatedAtUtc=DateTimeOffset.UtcNow,ExpiresAtUtc=DateTimeOffset.UtcNow.AddMinutes(expired?-1:30)});
            await db.SaveChangesAsync();
        }
        var result=await client.PostAsJsonAsync("/api/v1/auth/reset-password",new{token=raw,password="ChangedPassword!123"});
        Assert.Equal(expired?HttpStatusCode.BadRequest:HttpStatusCode.NoContent,result.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await client.PostAsJsonAsync("/api/v1/auth/reset-password",new{token=raw,password="AnotherPassword!123"})).StatusCode);
        var login=await client.PostAsJsonAsync("/api/v1/auth/login",new{email,password="ChangedPassword!123"});
        Assert.Equal(expired?HttpStatusCode.Unauthorized:HttpStatusCode.OK,login.StatusCode);
        if(!expired)
        {
            Assert.Equal(HttpStatusCode.Unauthorized,(await client.PostAsJsonAsync("/api/v1/auth/refresh",new{refreshToken=refresh})).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized,(await client.PostAsJsonAsync("/api/v1/auth/login",new{email,password="OriginalPassword!123"})).StatusCode);
        }
    }
}
