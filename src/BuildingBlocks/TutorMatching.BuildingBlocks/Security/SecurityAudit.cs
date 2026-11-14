using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;

namespace TutorMatching.BuildingBlocks.Security;

public sealed class SecurityAudit : IDisposable
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly byte[] key;
    private readonly string file;
    private string previous = new('0', 64);

    public SecurityAudit(IConfiguration configuration)
    {
        key = Convert.FromHexString(File.ReadAllText(configuration["Security:Audit:KeyPath"]!).Trim());
        var directory = configuration["Security:Audit:Directory"] ?? "/var/log/tutormatching";
        Directory.CreateDirectory(directory);
        var name = configuration["Security:ServiceName"] ?? "api";
        file = Path.Combine(directory, $"{name}-{Environment.MachineName}.jsonl");
        // Validate an existing chain before appending after a container restart.
        if (!File.Exists(file)) return;
        foreach (var line in File.ReadLines(file))
        {
            var entry = JsonSerializer.Deserialize<AuditEnvelope>(line) ?? throw new InvalidOperationException("Invalid audit entry.");
            if (entry.Previous != previous || !CryptographicOperations.FixedTimeEquals(Convert.FromHexString(entry.Mac), Convert.FromHexString(Mac(entry.Previous, entry.Payload))))
                throw new InvalidOperationException("Audit integrity validation failed.");
            previous = entry.Mac;
        }
    }

    private string Mac(string predecessor, string payload) => Convert.ToHexStringLower(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(predecessor + "\n" + payload)));

    public async Task WriteAsync(HttpContext context, string phase, int? status = null)
    {
        var endpoint = context.GetEndpoint() as RouteEndpoint;
        var resource = context.Request.RouteValues.Where(p => p.Key.EndsWith("Id", StringComparison.OrdinalIgnoreCase) || p.Key == "id")
            .ToDictionary(p => p.Key, p => p.Value?.ToString() is { } value ? value[..Math.Min(value.Length, 100)] : null);
        if(context.Items["audit-result-id"] is string resultId && Guid.TryParse(resultId,out _)) resource["resultId"]=resultId;
        var actor = context.Items["audit-actor-id"] is string verified && Guid.TryParse(verified,out _) ? verified : context.User.FindFirstValue("sub");
        // Deliberately no request body, query string, auth/cookie headers or exception text.
        var payload = JsonSerializer.Serialize(new
        {
            EventId = Guid.NewGuid(), TimestampUtc = DateTimeOffset.UtcNow, Phase = phase,
            Service = context.RequestServices.GetService(typeof(IConfiguration)) is IConfiguration c ? c["Security:ServiceName"] : null,
            Instance = Environment.MachineName, ActorId = actor, Role = context.Items["audit-actor-role"] as string ?? context.User.FindFirstValue("role"),
            Caller = context.Connection.ClientCertificate?.GetNameInfo(System.Security.Cryptography.X509Certificates.X509NameType.SimpleName, false),
            Method = context.Request.Method, Route = endpoint?.RoutePattern.RawText ?? "unmatched", Resource = resource, Status = status,
            TraceId = System.Diagnostics.Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier,
            SourceHash = Convert.ToHexStringLower(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(context.Connection.RemoteIpAddress?.ToString() ?? "unknown"))),
        });
        await gate.WaitAsync();
        try
        {
            var envelope = new AuditEnvelope(previous, payload, Mac(previous, payload));
            var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(envelope) + "\n");
            await using var stream = new FileStream(file, FileMode.Append, FileAccess.Write, FileShare.Read, 4096, FileOptions.WriteThrough);
            await stream.WriteAsync(bytes);
            await stream.FlushAsync();
            previous = envelope.Mac;
        }
        finally { gate.Release(); }
    }

    public sealed record AuditEnvelope(string Previous, string Payload, string Mac);
    public void Dispose() { gate.Dispose(); CryptographicOperations.ZeroMemory(key); }
}
