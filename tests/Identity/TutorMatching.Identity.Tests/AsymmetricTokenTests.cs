using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;
using TutorMatching.BuildingBlocks.Security;
using TutorMatching.Identity.Api.Domain;
using TutorMatching.Identity.Api.Security;

namespace TutorMatching.Identity.Tests;
public sealed class AsymmetricTokenTests
{
    [Fact]
    public void RsaTokenValidatesWithOnlyPublicKeyAndRejectsWrongKeyAndHmacConfusion()
    {
        var directory = Path.Combine(Path.GetTempPath(), "tm-rsa-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        try
        {
            using var rsa = RSA.Create(3072);
            var privatePath = Path.Combine(directory, "private.pem"); var publicPath = Path.Combine(directory, "public.pem");
            File.WriteAllText(privatePath, rsa.ExportPkcs8PrivateKeyPem()); File.WriteAllText(publicPath, rsa.ExportSubjectPublicKeyInfoPem());
            var options = new JwtOptions { Issuer="test",Audience="test-api",PublicKeyPath=publicPath,PrivateKeyPath=privatePath,RequireAsymmetric=true };
            var account = UserAccount.Register("rsa@example.com", "hash", AccountRole.Student, DateTimeOffset.UtcNow);
            var pair = new TokenService(options, TimeProvider.System).Issue(account);
            var handler = new JwtSecurityTokenHandler { MapInboundClaims=false };
            var validator = new TokenValidationParameters { ValidIssuer="test",ValidAudience="test-api",IssuerSigningKey=JwtKeyMaterial.VerificationKey(options with { PrivateKeyPath=null }),ValidAlgorithms=[SecurityAlgorithms.RsaSha256],ValidateIssuerSigningKey=true };
            var principal = handler.ValidateToken(pair.AccessToken, validator, out _);
            Assert.Equal(pair.SessionId.ToString(), principal.FindFirst("sid")?.Value);
            Assert.Equal(SecurityAlgorithms.RsaSha256, handler.ReadJwtToken(pair.AccessToken).Header.Alg);
            using var wrong = RSA.Create(3072);
            var wrongParameters = validator.Clone(); wrongParameters.IssuerSigningKey = new RsaSecurityKey(wrong);
            Assert.ThrowsAny<SecurityTokenException>(()=>handler.ValidateToken(pair.AccessToken, wrongParameters, out _));
            var forged = handler.WriteToken(new JwtSecurityToken("test","test-api",expires:DateTime.UtcNow.AddMinutes(5),signingCredentials:new SigningCredentials(new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(File.ReadAllText(publicPath))), SecurityAlgorithms.HmacSha256)));
            Assert.ThrowsAny<SecurityTokenException>(()=>handler.ValidateToken(forged, validator, out _));
        }
        finally { Directory.Delete(directory, recursive:true); }
    }
}
