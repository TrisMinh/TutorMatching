using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace TutorMatching.BuildingBlocks.Security;

public static class JwtKeyMaterial
{
    public static SecurityKey VerificationKey(JwtOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.PublicKeyPath)) return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.SigningKey));
        var rsa = RSA.Create();
        rsa.ImportFromPem(File.ReadAllText(options.PublicKeyPath));
        if (rsa.KeySize < 3072) throw new InvalidOperationException("JWT RSA key must be at least 3072 bits.");
        return new RsaSecurityKey(rsa) { KeyId = Base64UrlEncoder.Encode(SHA256.HashData(rsa.ExportSubjectPublicKeyInfo())) };
    }

    public static SigningCredentials SigningCredentials(JwtOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.PublicKeyPath)) return new(VerificationKey(options), SecurityAlgorithms.HmacSha256);
        if (string.IsNullOrWhiteSpace(options.PrivateKeyPath)) throw new InvalidOperationException("Identity JWT private key is missing.");
        var rsa = RSA.Create();
        rsa.ImportFromPem(File.ReadAllText(options.PrivateKeyPath));
        var verification = (RsaSecurityKey)VerificationKey(options);
        if (!rsa.ExportSubjectPublicKeyInfo().AsSpan().SequenceEqual(verification.Rsa.ExportSubjectPublicKeyInfo())) throw new InvalidOperationException("JWT signing/verification key mismatch.");
        return new(new RsaSecurityKey(rsa) { KeyId = verification.KeyId }, SecurityAlgorithms.RsaSha256);
    }
}
