using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Https;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace TutorMatching.BuildingBlocks.Security;

public static class WorkloadTls
{
    private static readonly HashSet<string> KnownCallers = ["identity", "tutor", "student", "scheduling", "notification", "gateway", "service-lb"];
    public static bool Enabled(IConfiguration configuration) => configuration.GetValue<bool>("Security:Transport:RequireMtls");

    public static void ConfigureServer(WebApplicationBuilder builder)
    {
        if (!Enabled(builder.Configuration)) return;
        var certificate = ClientCertificate(builder.Configuration);
        builder.WebHost.ConfigureKestrel(server =>
        {
            server.ListenAnyIP(8080); // HTTP is restricted to health probes by middleware.
            server.ListenAnyIP(8443, endpoint => endpoint.UseHttps(new HttpsConnectionAdapterOptions
            {
                ServerCertificate = certificate,
                SslProtocols = System.Security.Authentication.SslProtocols.Tls12 | System.Security.Authentication.SslProtocols.Tls13,
                ClientCertificateMode = ClientCertificateMode.RequireCertificate,
                ClientCertificateValidation = (cert, _, _) => KnownCallers.Contains(cert.GetNameInfo(X509NameType.SimpleName, false)) && Trusted(cert, builder.Configuration, "1.3.6.1.5.5.7.3.2"),
            }));
        });
    }

    public static X509Certificate2 ClientCertificate(IConfiguration configuration) => X509Certificate2.CreateFromPemFile(
        configuration["Security:Transport:CertificatePath"] ?? throw new InvalidOperationException("Workload certificate required."),
        configuration["Security:Transport:KeyPath"] ?? throw new InvalidOperationException("Workload key required."));

    public static bool Trusted(X509Certificate2 certificate, IConfiguration configuration, string usage)
    {
        using var chain = new X509Chain();
        chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;
        using var authority = X509Certificate2.CreateFromPem(File.ReadAllText(configuration["Security:Transport:CaPath"]!));
        chain.ChainPolicy.CustomTrustStore.Add(authority);
        chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck; // Local CA has no OCSP/CRL; documented operational limit.
        chain.ChainPolicy.ApplicationPolicy.Add(new System.Security.Cryptography.Oid(usage));
        return chain.Build(certificate);
    }

    public static bool ValidateServer(X509Certificate? certificate, SslPolicyErrors errors, IConfiguration configuration, string expectedName)
    {
        if (certificate is null || (errors & (SslPolicyErrors.RemoteCertificateNameMismatch | SslPolicyErrors.RemoteCertificateNotAvailable)) != 0) return false;
        using var copy = X509CertificateLoader.LoadCertificate(certificate.GetRawCertData());
        return copy.GetNameInfo(X509NameType.SimpleName, false) == expectedName && Trusted(copy, configuration, "1.3.6.1.5.5.7.3.1");
    }

    public static HttpMessageHandler HttpHandler(IConfiguration configuration, string expectedName)
    {
        var handler = new HttpClientHandler { AllowAutoRedirect = false };
        if (Enabled(configuration))
        {
            handler.ClientCertificates.Add(ClientCertificate(configuration));
            handler.ServerCertificateCustomValidationCallback = (_, cert, _, errors) => ValidateServer(cert, errors, configuration, expectedName);
        }
        return handler;
    }

    public static IEndpointConventionBuilder RequireServiceCaller(this IEndpointConventionBuilder endpoint, params string[] allowed)
    {
        return endpoint.RequireAuthorization(policy => { policy.RequireAuthenticatedUser(); policy.RequireAssertion(context =>
        {
            if (context.Resource is not HttpContext http) return false;
            var configuration = http.RequestServices.GetRequiredService<IConfiguration>();
            if (!Enabled(configuration)) return http.RequestServices.GetRequiredService<IHostEnvironment>().IsDevelopment();
            var cert = http.Connection.ClientCertificate;
            return http.Request.IsHttps && cert is not null && allowed.Contains(cert.GetNameInfo(X509NameType.SimpleName, false), StringComparer.Ordinal);
        }); });
    }
}
