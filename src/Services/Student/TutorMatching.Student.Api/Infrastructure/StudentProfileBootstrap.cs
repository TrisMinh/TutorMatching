using Microsoft.EntityFrameworkCore;
using Npgsql;
using TutorMatching.BuildingBlocks.Security;
using TutorMatching.Student.Api.Domain;

namespace TutorMatching.Student.Api.Infrastructure;

// A student can use the platform with only their registration name.
public sealed class StudentProfileBootstrap(StudentDbContext db, AccountDirectoryClient accounts, TimeProvider clock)
{
    public async Task<StudentProfile?> EnsureAsync(Guid userId, CancellationToken ct)
    {
        var existing = await db.StudentProfiles.SingleOrDefaultAsync(p => p.UserId == userId, ct);
        if (existing is not null) return existing;
        var account = await accounts.GetAsync(userId, ct);
        if (account is null || !account.Active || account.Role != "Student") return null;
        var name = string.IsNullOrWhiteSpace(account.DisplayName) ? account.Email.Split('@')[0] : account.DisplayName;
        var profile = StudentProfile.Create(userId, name, EducationLevel.Unspecified, "", "Asia/Ho_Chi_Minh", clock.GetUtcNow());
        db.StudentProfiles.Add(profile);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException {SqlState: PostgresErrorCodes.UniqueViolation})
        {
            // The shell and dashboard may request the new profile concurrently.
            db.Entry(profile).State = EntityState.Detached;
            return await db.StudentProfiles.SingleAsync(p => p.UserId == userId, ct);
        }
        return profile;
    }
}
