using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using StackExchange.Redis;

namespace TutorMatching.Scheduling.Api.Infrastructure;

public sealed record BookingHold(
    Guid HoldId,
    Guid StudentId,
    Guid StudentUserId,
    Guid TutorId,
    Guid TutorUserId,
    Guid SubjectId,
    DateTimeOffset StartAtUtc,
    DateTimeOffset EndAtUtc,
    string TokenHash,
    DateTimeOffset ExpiresAtUtc,
    IReadOnlyList<string> LockKeys, int CancellationNoticeHours = 12);

public sealed record HoldCreationResult(bool Created, BookingHold? Hold, string? HoldToken);

public interface IBookingHoldStore
{
    Task<HoldCreationResult> TryCreateAsync(
        Guid studentId,
        Guid studentUserId,
        Guid tutorId,
        Guid tutorUserId,
        Guid subjectId,
        DateTimeOffset startAtUtc,
        CancellationToken cancellationToken, int cancellationNoticeHours = 12);

    Task<BookingHold?> GetAsync(Guid holdId, CancellationToken cancellationToken);

    Task ReleaseAsync(BookingHold hold, CancellationToken cancellationToken);
}

public sealed class RedisBookingHoldStore(
    IConnectionMultiplexer connection,
    TimeProvider timeProvider) : IBookingHoldStore
{
    private const int HoldSeconds = 300;
    private const string CreateScript =
        "for i=1,6 do if redis.call('exists',KEYS[i])==1 then return 0 end end "
        + "for i=1,6 do redis.call('set',KEYS[i],ARGV[1],'PX',ARGV[3]) end "
        + "redis.call('set',KEYS[7],ARGV[2],'PX',ARGV[3]); return 1";
    private const string ReleaseScript =
        "for i=1,6 do if redis.call('get',KEYS[i])==ARGV[1] then redis.call('del',KEYS[i]) end end "
        + "if redis.call('get',KEYS[7]) then redis.call('del',KEYS[7]) end; return 1";

    public async Task<HoldCreationResult> TryCreateAsync(
        Guid studentId,
        Guid studentUserId,
        Guid tutorId,
        Guid tutorUserId,
        Guid subjectId,
        DateTimeOffset startAtUtc,
        CancellationToken cancellationToken, int cancellationNoticeHours = 12)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var database = connection.GetDatabase();
        var holdId = Guid.NewGuid();
        var token = Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var tokenHash = HashToken(token);
        var expiry = timeProvider.GetUtcNow().AddSeconds(HoldSeconds);
        var lockKeys = BuildLockKeys(tutorId, studentId, startAtUtc);
        var hold = new BookingHold(
            holdId,
            studentId,
            studentUserId,
            tutorId,
            tutorUserId,
            subjectId,
            startAtUtc,
            startAtUtc.AddHours(1),
            tokenHash,
            expiry,
            lockKeys, cancellationNoticeHours);
        var keys = lockKeys.Select(key => (RedisKey)key).Append((RedisKey)MetadataKey(holdId)).ToArray();
        var result = (long)await database.ScriptEvaluateAsync(
            CreateScript,
            keys,
            [(RedisValue)holdId.ToString(), JsonSerializer.Serialize(hold), HoldSeconds * 1000]);
        return result == 1 ? new HoldCreationResult(true, hold, token) : new HoldCreationResult(false, null, null);
    }

    public async Task<BookingHold?> GetAsync(Guid holdId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var value = await connection.GetDatabase().StringGetAsync(MetadataKey(holdId));
        return value.IsNullOrEmpty ? null : JsonSerializer.Deserialize<BookingHold>((string)value!);
    }

    public async Task ReleaseAsync(BookingHold hold, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var keys = hold.LockKeys.Select(key => (RedisKey)key).Append((RedisKey)MetadataKey(hold.HoldId)).ToArray();
        await connection.GetDatabase().ScriptEvaluateAsync(ReleaseScript, keys, [(RedisValue)hold.HoldId.ToString()]);
    }

    public static string HashToken(string token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string MetadataKey(Guid holdId) => $"booking:hold:{holdId:N}";

    private static string[] BuildLockKeys(Guid tutorId, Guid studentId, DateTimeOffset start)
    {
        var starts = new[] { start.AddMinutes(-30), start, start.AddMinutes(30) };
        return starts.Select(value => $"booking:lock:tutor:{tutorId:N}:{value.ToUnixTimeSeconds()}")
            .Concat(starts.Select(value => $"booking:lock:student:{studentId:N}:{value.ToUnixTimeSeconds()}"))
            .ToArray();
    }
}

