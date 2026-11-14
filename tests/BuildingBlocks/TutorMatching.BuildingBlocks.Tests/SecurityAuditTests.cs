using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TutorMatching.BuildingBlocks.Security;

namespace TutorMatching.BuildingBlocks.Tests;
public sealed class SecurityAuditTests
{
    [Fact]
    public async Task AuditExcludesSecretsAndDetectsModifiedRecordsOnRestart()
    {
        var directory = Path.Combine(Path.GetTempPath(), "tm-audit-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(directory);
        try
        {
            var key = Path.Combine(directory,"audit.key");File.WriteAllText(key,Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)));
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["Security:Audit:KeyPath"]=key,["Security:Audit:Directory"]=directory,["Security:ServiceName"]="test" }).Build();
            using var provider = new ServiceCollection().AddSingleton<IConfiguration>(config).BuildServiceProvider();
            var context = new DefaultHttpContext { RequestServices=provider };
            context.Request.Method="POST";context.Request.Headers.Authorization="Bearer secret-token";context.Request.QueryString=new QueryString("?password=secret-password");context.Request.Body=new MemoryStream(System.Text.Encoding.UTF8.GetBytes("{\"password\":\"secret-password\"}"));
            var verifiedActor=Guid.NewGuid().ToString();context.Items["audit-actor-id"]=verifiedActor;context.Items["audit-result-id"]=Guid.NewGuid().ToString();
            using (var audit = new SecurityAudit(config)) { await audit.WriteAsync(context,"Intent");await audit.WriteAsync(context,"Result",401); }
            var file=Directory.GetFiles(directory,"*.jsonl").Single();var text=File.ReadAllText(file);
            Assert.DoesNotContain("secret-token",text);Assert.DoesNotContain("secret-password",text);Assert.Contains("TimestampUtc",text);Assert.Contains("401",text);
            Assert.Contains(verifiedActor,text);Assert.Contains("resultId",text);
            using(var restored = new SecurityAudit(config)) await restored.WriteAsync(context,"Result",403);
            File.WriteAllText(file,File.ReadAllText(file).Replace("401","201",StringComparison.Ordinal));
            Assert.Throws<InvalidOperationException>(()=>new SecurityAudit(config));
        }
        finally { Directory.Delete(directory,recursive:true); }
    }
}
