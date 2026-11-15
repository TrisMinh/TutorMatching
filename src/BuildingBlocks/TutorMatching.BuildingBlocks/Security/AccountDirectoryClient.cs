using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace TutorMatching.BuildingBlocks.Security;

public sealed record AccountPreferences(bool EmailReminders = true, bool InAppNotifications = true,
    bool EnrollmentAlerts = true, bool ProfileVisible = true, int CancellationNoticeHours = 12, int Version = 0);
public sealed record AccountDelivery(Guid UserId, string Email, bool Active, AccountPreferences Settings, string Role = "Student", string DisplayName = "");

// Minimal workload token for the local HS256 architecture; not a user token.
public sealed class AccountDirectoryClient(HttpClient client, IConfiguration configuration)
{
    public static string CreateToken(IConfiguration configuration, string scope)
    {
        var jwt = configuration.GetRequiredSection("Jwt").Get<JwtOptions>()!;
        return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(jwt.Issuer, jwt.Audience,
            [new Claim("sub", "backend-worker"), new Claim("role", "Service"), new Claim("scope", scope)],
            expires: DateTime.UtcNow.AddMinutes(2), signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)), SecurityAlgorithms.HmacSha256)));
    }

    public async Task<AccountDelivery?> GetAsync(Guid id, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/internal/v1/users/{id}/delivery");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", CreateToken(configuration, "identity.directory"));
        using var response = await client.SendAsync(request, ct);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound) return null;
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<AccountDelivery>(ct);
    }

    public async Task<Guid[]> HiddenTutorsAsync(CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/internal/v1/users/hidden-tutors");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", CreateToken(configuration, "identity.directory"));
        using var response = await client.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<Guid[]>(ct) ?? [];
    }
}
