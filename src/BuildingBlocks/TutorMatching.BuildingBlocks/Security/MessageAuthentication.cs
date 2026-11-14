using System.Globalization;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace TutorMatching.BuildingBlocks.Security;

public sealed record MessageProof(string KeyId, string SignedAt, string Signature);
public static class MessageAuthentication
{
    private static byte[] Canonical(string id, string type, int version, string routingKey, string correlation, ReadOnlySpan<byte> body, string time) =>
        Encoding.UTF8.GetBytes(string.Join('\n', "tm-event-v1", id, type, version.ToString(CultureInfo.InvariantCulture), routingKey, correlation, time, Convert.ToHexStringLower(SHA256.HashData(body))));

    public static MessageProof Sign(IConfiguration configuration, string id, string type, int version, string routingKey, string correlation, ReadOnlySpan<byte> body)
    {
        using var certificate = WorkloadTls.ClientCertificate(configuration);
        using var key = certificate.GetRSAPrivateKey() ?? throw new InvalidOperationException("Producer signing key unavailable.");
        var time = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture);
        return new(certificate.GetCertHashString(HashAlgorithmName.SHA256), time,
            Convert.ToBase64String(key.SignData(Canonical(id,type,version,routingKey,correlation,body,time),HashAlgorithmName.SHA256,RSASignaturePadding.Pss)));
    }

    public static bool Verify(IConfiguration configuration, MessageProof proof, string id, string type, int version, string routingKey, string correlation, ReadOnlySpan<byte> body)
    {
        try
        {
            using var certificate = X509Certificate2.CreateFromPem(File.ReadAllText(configuration["Security:Messaging:ProducerCertificatePath"]!));
            if(certificate.GetNameInfo(X509NameType.SimpleName,false)!="scheduling" || certificate.GetCertHashString(HashAlgorithmName.SHA256)!=proof.KeyId ||
                !WorkloadTls.Trusted(certificate,configuration,"1.3.6.1.5.5.7.3.2") || !DateTimeOffset.TryParse(proof.SignedAt,CultureInfo.InvariantCulture,DateTimeStyles.RoundtripKind,out _)) return false;
            using var key=certificate.GetRSAPublicKey();
            return key is not null && key.VerifyData(Canonical(id,type,version,routingKey,correlation,body,proof.SignedAt),Convert.FromBase64String(proof.Signature),HashAlgorithmName.SHA256,RSASignaturePadding.Pss);
        }
        catch(Exception exception) when(exception is CryptographicException or FormatException or ArgumentException or JsonException){return false;}
    }
}
