using System.Net.Security;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Microsoft.Extensions.Configuration;
using TutorMatching.BuildingBlocks.Security;

namespace TutorMatching.BuildingBlocks.Tests;
public sealed class WorkloadSecurityTests
{
    [Fact]
    public void TrustedWorkloadAndSignedEventRejectWrongIdentityAndTampering()
    {
        var directory=Path.Combine(Path.GetTempPath(),"tm-workload-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(directory);
        try
        {
            using var rootKey=RSA.Create(3072);
            var rootRequest=new CertificateRequest("CN=Test CA",rootKey,HashAlgorithmName.SHA256,RSASignaturePadding.Pkcs1);
            rootRequest.CertificateExtensions.Add(new X509BasicConstraintsExtension(true,false,0,true));
            rootRequest.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.KeyCertSign,true));
            using var authority=rootRequest.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-10),DateTimeOffset.UtcNow.AddDays(2));
            using var key=RSA.Create(2048);
            var request=new CertificateRequest("CN=scheduling",key,HashAlgorithmName.SHA256,RSASignaturePadding.Pkcs1);
            request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false,false,0,true));
            request.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(new OidCollection {new("1.3.6.1.5.5.7.3.1"),new("1.3.6.1.5.5.7.3.2")},false));
            using var certificate=request.Create(authority,DateTimeOffset.UtcNow.AddMinutes(-5),DateTimeOffset.UtcNow.AddDays(1),RandomNumberGenerator.GetBytes(16));
            var rootPath=Path.Combine(directory,"ca.crt");var certPath=Path.Combine(directory,"producer.crt");var keyPath=Path.Combine(directory,"key.pem");
            File.WriteAllText(rootPath,authority.ExportCertificatePem());File.WriteAllText(certPath,certificate.ExportCertificatePem());File.WriteAllText(keyPath,key.ExportPkcs8PrivateKeyPem());
            var config=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["Security:Transport:CaPath"]=rootPath,["Security:Transport:CertificatePath"]=certPath,["Security:Transport:KeyPath"]=keyPath,["Security:Messaging:ProducerCertificatePath"]=certPath }).Build();
            Assert.True(WorkloadTls.ValidateServer(certificate,SslPolicyErrors.RemoteCertificateChainErrors,config,"scheduling"));
            Assert.False(WorkloadTls.ValidateServer(certificate,SslPolicyErrors.None,config,"student"));
            Assert.False(WorkloadTls.ValidateServer(certificate,SslPolicyErrors.RemoteCertificateNameMismatch,config,"scheduling"));
            var body=System.Text.Encoding.UTF8.GetBytes("{\"bookingId\":\"fixture\"}");
            var proof=MessageAuthentication.Sign(config,"event","BookingConfirmed",1,"booking.confirmed.v1","trace",body);
            Assert.True(MessageAuthentication.Verify(config,proof,"event","BookingConfirmed",1,"booking.confirmed.v1","trace",body));
            Assert.False(MessageAuthentication.Verify(config,proof,"another-event","BookingConfirmed",1,"booking.confirmed.v1","trace",body));
            Assert.False(MessageAuthentication.Verify(config,proof,"event","BookingConfirmed",1,"booking.cancelled.v1","trace",body));
            Assert.False(MessageAuthentication.Verify(config,proof,"event","BookingConfirmed",1,"booking.confirmed.v1","trace",[1,2,3]));
            Assert.False(MessageAuthentication.Verify(config,proof with {Signature="invalid"},"event","BookingConfirmed",1,"booking.confirmed.v1","trace",body));
        }
        finally { Directory.Delete(directory,recursive:true); }
    }
}
