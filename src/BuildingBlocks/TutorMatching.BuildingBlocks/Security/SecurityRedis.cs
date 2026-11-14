using Microsoft.Extensions.Configuration;
using StackExchange.Redis;

namespace TutorMatching.BuildingBlocks.Security;
public static class SecurityRedis
{
    public static IConnectionMultiplexer Connect(IConfiguration configuration)
    {
        var options = ConfigurationOptions.Parse(configuration.GetConnectionString("Redis") ?? "redis:6379,abortConnect=false");
        if (options.Ssl && WorkloadTls.Enabled(configuration))
            options.CertificateValidation += (_, certificate, _, errors) => WorkloadTls.ValidateServer(certificate, errors, configuration, "redis");
        return ConnectionMultiplexer.Connect(options);
    }
}
