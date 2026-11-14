using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace TutorMatching.BuildingBlocks.Security;

public sealed class AccessRevocation(IConfiguration configuration, IServiceProvider services)
{
    private bool Enabled => configuration.GetValue<bool>("Security:Revocation:Enabled");
    private IConnectionMultiplexer Redis => services.GetRequiredService<IConnectionMultiplexer>();
    private static string FamilyKey(string family) => $"security:revoked:family:{family}";
    private static string UserKey(string user) => $"security:revoked:user:{user}";
    public Task<bool> IsFamilyRevokedAsync(Guid family) => Enabled ? Redis.GetDatabase().KeyExistsAsync(FamilyKey(family.ToString())) : Task.FromResult(false);
    public async Task<bool> IsRevokedAsync(ClaimsPrincipal principal)
    {
        if (!Enabled) return false;
        var family = principal.FindFirstValue("sid");
        var user = principal.FindFirstValue("sub");
        if (!Guid.TryParse(family, out _) || !Guid.TryParse(user, out _) || !long.TryParse(principal.FindFirstValue("issued_ms"), out var issued)) return true;
        var values = await Redis.GetDatabase().StringGetAsync([FamilyKey(family), UserKey(user)]);
        return !values[0].IsNull || (long.TryParse(values[1].ToString(), out var cutoff) && issued <= cutoff);
    }
    public Task RevokeFamilyAsync(Guid family) => Enabled ? Redis.GetDatabase().StringSetAsync(FamilyKey(family.ToString()), "1", TimeSpan.FromDays(configuration.GetValue("Jwt:RefreshTokenDays", 7)) + TimeSpan.FromMinutes(1)) : Task.CompletedTask;
    public Task RevokeUserAsync(Guid user) => Enabled ? Redis.GetDatabase().StringSetAsync(UserKey(user.ToString()), DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), TimeSpan.FromMinutes(configuration.GetValue("Jwt:AccessTokenMinutes", 15) + 2)) : Task.CompletedTask;
}
