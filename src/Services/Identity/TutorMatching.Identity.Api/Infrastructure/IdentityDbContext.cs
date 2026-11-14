using Microsoft.EntityFrameworkCore;
using TutorMatching.Identity.Api.Domain;

namespace TutorMatching.Identity.Api.Infrastructure;

public sealed class IdentityDbContext(DbContextOptions<IdentityDbContext> options) : DbContext(options)
{
    public DbSet<UserAccount> UserAccounts => Set<UserAccount>();
    public DbSet<RefreshSession> RefreshSessions => Set<RefreshSession>();
    public DbSet<SecurityAuditEvent> SecurityAuditEvents => Set<SecurityAuditEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var users = modelBuilder.Entity<UserAccount>();
        users.ToTable("user_accounts");
        users.HasKey(account => account.Id);
        users.Property(account => account.Id).HasColumnName("id").ValueGeneratedNever();
        users.Property(account => account.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
        users.Property(account => account.NormalizedEmail).HasColumnName("normalized_email").HasMaxLength(320).IsRequired();
        users.HasIndex(account => account.NormalizedEmail).IsUnique();
        users.Property(account => account.PasswordHash).HasColumnName("password_hash").IsRequired();
        users.Property(account => account.Role).HasColumnName("role").HasConversion<string>().HasMaxLength(20);
        users.Property(account => account.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
        users.Property(account => account.LastLoginAtUtc).HasColumnName("last_login_at_utc");
        users.Property(account => account.CreatedAtUtc).HasColumnName("created_at_utc");
        users.Property(account => account.UpdatedAtUtc).HasColumnName("updated_at_utc");
        users.Property(account => account.Version).HasColumnName("version").IsConcurrencyToken();

        var sessions = modelBuilder.Entity<RefreshSession>();
        sessions.ToTable("refresh_sessions");
        sessions.HasKey(session => session.Id);
        sessions.Property(session => session.Id).HasColumnName("id").ValueGeneratedNever();
        sessions.Property(session => session.UserId).HasColumnName("user_id");
        sessions.Property(session => session.TokenHash).HasColumnName("token_hash").HasMaxLength(64).IsFixedLength();
        sessions.HasIndex(session => session.TokenHash).IsUnique();
        sessions.Property(session => session.FamilyId).HasColumnName("family_id");
        sessions.HasIndex(session => new { session.FamilyId, session.RevokedAtUtc });
        sessions.Property(session => session.ExpiresAtUtc).HasColumnName("expires_at_utc");
        sessions.Property(session => session.RevokedAtUtc).HasColumnName("revoked_at_utc");
        sessions.Property(session => session.ReplacedByTokenId).HasColumnName("replaced_by_token_id");
        sessions.Property(session => session.CreatedAtUtc).HasColumnName("created_at_utc");
        sessions.HasOne<UserAccount>().WithMany().HasForeignKey(session => session.UserId).OnDelete(DeleteBehavior.Cascade);

        var audits = modelBuilder.Entity<SecurityAuditEvent>();
        audits.ToTable("security_audit_events");
        audits.HasKey(audit => audit.Id);
        audits.Property(audit => audit.Id).HasColumnName("id").ValueGeneratedNever();
        audits.Property(audit => audit.UserId).HasColumnName("user_id");
        audits.Property(audit => audit.EventType).HasColumnName("event_type").HasMaxLength(80);
        audits.Property(audit => audit.IpHash).HasColumnName("ip_hash").HasMaxLength(64).IsFixedLength();
        audits.Property(audit => audit.UserAgentHash).HasColumnName("user_agent_hash").HasMaxLength(64).IsFixedLength();
        audits.Property(audit => audit.OccurredAtUtc).HasColumnName("occurred_at_utc");
        audits.HasIndex(audit => new { audit.UserId, audit.OccurredAtUtc });
    }
}

public sealed class SecurityAuditEvent
{
    public Guid Id { get; init; }
    public Guid? UserId { get; init; }
    public string EventType { get; init; } = string.Empty;
    public string? IpHash { get; init; }
    public string? UserAgentHash { get; init; }
    public DateTimeOffset OccurredAtUtc { get; init; }
}

