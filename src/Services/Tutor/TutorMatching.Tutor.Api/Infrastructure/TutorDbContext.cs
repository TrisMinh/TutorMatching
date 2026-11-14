using Microsoft.EntityFrameworkCore;
using NpgsqlTypes;
using TutorMatching.Tutor.Api.Domain;

namespace TutorMatching.Tutor.Api.Infrastructure;

public sealed class TutorDbContext(DbContextOptions<TutorDbContext> options) : DbContext(options)
{
    public DbSet<TutorProfile> TutorProfiles => Set<TutorProfile>();
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<TutorSubject> TutorSubjects => Set<TutorSubject>();
    public DbSet<AvailabilityWindow> AvailabilityWindows => Set<AvailabilityWindow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("btree_gist");

        var profiles = modelBuilder.Entity<TutorProfile>();
        profiles.ToTable("tutor_profiles", table =>
        {
            table.HasCheckConstraint("ck_tutor_experience_years", "experience_years BETWEEN 0 AND 80");
            table.HasCheckConstraint("ck_tutor_status", "status IN ('Active', 'Suspended')");
        });
        profiles.HasKey(profile => profile.Id);
        profiles.Property(profile => profile.Id).HasColumnName("id").ValueGeneratedNever();
        profiles.Property(profile => profile.UserId).HasColumnName("user_id");
        profiles.HasIndex(profile => profile.UserId).IsUnique();
        profiles.Property(profile => profile.DisplayName).HasColumnName("display_name").HasMaxLength(100);
        profiles.Property(profile => profile.Bio).HasColumnName("bio").HasMaxLength(2000);
        profiles.Property(profile => profile.ExperienceYears).HasColumnName("experience_years");
        profiles.Property(profile => profile.AvatarUrl).HasColumnName("avatar_url").HasMaxLength(500);
        profiles.Property(profile => profile.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
        profiles.Property(profile => profile.CreatedAtUtc).HasColumnName("created_at_utc");
        profiles.Property(profile => profile.UpdatedAtUtc).HasColumnName("updated_at_utc");
        profiles.Property(profile => profile.Version).HasColumnName("version").IsConcurrencyToken();
        profiles.HasMany(profile => profile.Subjects).WithOne().HasForeignKey(subject => subject.TutorId);
        profiles.HasMany(profile => profile.AvailabilityWindows).WithOne().HasForeignKey(window => window.TutorId);
        profiles.Navigation(profile => profile.Subjects).UsePropertyAccessMode(PropertyAccessMode.Field);
        profiles.Navigation(profile => profile.AvailabilityWindows).UsePropertyAccessMode(PropertyAccessMode.Field);

        var subjects = modelBuilder.Entity<Subject>();
        subjects.ToTable("subjects");
        subjects.HasKey(subject => subject.Id);
        subjects.Property(subject => subject.Id).HasColumnName("id").ValueGeneratedNever();
        subjects.Property(subject => subject.Code).HasColumnName("code").HasMaxLength(50);
        subjects.HasIndex(subject => subject.Code).IsUnique();
        subjects.Property(subject => subject.Name).HasColumnName("name").HasMaxLength(120);
        subjects.Property(subject => subject.IsActive).HasColumnName("is_active");
        subjects.Property(subject => subject.CreatedAtUtc).HasColumnName("created_at_utc");
        subjects.Property(subject => subject.UpdatedAtUtc).HasColumnName("updated_at_utc");

        var tutorSubjects = modelBuilder.Entity<TutorSubject>();
        tutorSubjects.ToTable("tutor_subjects");
        tutorSubjects.HasKey(subject => new { subject.TutorId, subject.SubjectId });
        tutorSubjects.Property(subject => subject.TutorId).HasColumnName("tutor_id");
        tutorSubjects.Property(subject => subject.SubjectId).HasColumnName("subject_id");
        tutorSubjects.Property(subject => subject.ProficiencyLevel).HasColumnName("proficiency_level").HasConversion<string>().HasMaxLength(20);
        tutorSubjects.HasOne<Subject>().WithMany().HasForeignKey(subject => subject.SubjectId);

        var windows = modelBuilder.Entity<AvailabilityWindow>();
        windows.ToTable("availability_windows", table =>
            table.HasCheckConstraint("ck_availability_order", "end_at_utc > start_at_utc"));
        windows.HasKey(window => window.Id);
        windows.Property(window => window.Id).HasColumnName("id").ValueGeneratedNever();
        windows.Property(window => window.TutorId).HasColumnName("tutor_id");
        windows.Property(window => window.StartAtUtc).HasColumnName("start_at_utc");
        windows.Property(window => window.EndAtUtc).HasColumnName("end_at_utc");
        windows.Property(window => window.CreatedAtUtc).HasColumnName("created_at_utc");
        windows.Property<NpgsqlRange<DateTimeOffset>>("SlotRange")
            .HasColumnName("slot_range")
            .HasColumnType("tstzrange")
            .HasComputedColumnSql("tstzrange(start_at_utc, end_at_utc, '[)')", stored: true);
    }
}

