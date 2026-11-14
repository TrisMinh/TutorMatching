using Microsoft.EntityFrameworkCore;
using TutorMatching.Student.Api.Domain;

namespace TutorMatching.Student.Api.Infrastructure;

public sealed class StudentDbContext(DbContextOptions<StudentDbContext> options) : DbContext(options)
{
    public DbSet<StudentProfile> StudentProfiles => Set<StudentProfile>();
    public DbSet<SubjectInterest> SubjectInterests => Set<SubjectInterest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var profiles = modelBuilder.Entity<StudentProfile>();
        profiles.ToTable("student_profiles", table =>
            table.HasCheckConstraint("ck_student_status", "status IN ('Active', 'Suspended')"));
        profiles.HasKey(profile => profile.Id);
        profiles.Property(profile => profile.Id).HasColumnName("id").ValueGeneratedNever();
        profiles.Property(profile => profile.UserId).HasColumnName("user_id");
        profiles.HasIndex(profile => profile.UserId).IsUnique();
        profiles.Property(profile => profile.DisplayName).HasColumnName("display_name").HasMaxLength(100);
        profiles.Property(profile => profile.EducationLevel).HasColumnName("education_level").HasConversion<string>().HasMaxLength(30);
        profiles.Property(profile => profile.LearningGoal).HasColumnName("learning_goal").HasMaxLength(2000);
        profiles.Property(profile => profile.Timezone).HasColumnName("timezone").HasMaxLength(100);
        profiles.Property(profile => profile.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
        profiles.Property(profile => profile.CreatedAtUtc).HasColumnName("created_at_utc");
        profiles.Property(profile => profile.UpdatedAtUtc).HasColumnName("updated_at_utc");
        profiles.Property(profile => profile.Version).HasColumnName("version").IsConcurrencyToken();
        profiles.HasMany(profile => profile.Interests).WithOne().HasForeignKey(interest => interest.StudentId);
        profiles.Navigation(profile => profile.Interests).UsePropertyAccessMode(PropertyAccessMode.Field);

        var interests = modelBuilder.Entity<SubjectInterest>();
        interests.ToTable("student_subject_interests", table =>
            table.HasCheckConstraint("ck_interest_priority", "priority BETWEEN 1 AND 5"));
        interests.HasKey(interest => new { interest.StudentId, interest.SubjectId });
        interests.Property(interest => interest.StudentId).HasColumnName("student_id");
        interests.Property(interest => interest.SubjectId).HasColumnName("subject_id");
        interests.Property(interest => interest.Priority).HasColumnName("priority");
        interests.Property(interest => interest.CreatedAtUtc).HasColumnName("created_at_utc");
    }
}

