namespace TutorMatching.Student.Api.Domain;

public enum EducationLevel
{
    Unspecified = -1,
    Primary,
    LowerSecondary,
    UpperSecondary,
    University,
    Adult,
}

public enum StudentStatus
{
    Active,
    Suspended,
}

public sealed class StudentProfile
{
    private readonly List<SubjectInterest> interests = [];

    private StudentProfile()
    {
    }

    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public string DisplayName { get; private set; } = string.Empty;
    public string? AvatarUrl { get; private set; }
    public void SetAvatar(string avatarUrl) { AvatarUrl=avatarUrl; }
    public EducationLevel EducationLevel { get; private set; }
    public string LearningGoal { get; private set; } = string.Empty;
    public string Timezone { get; private set; } = string.Empty;
    public StudentStatus Status { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public int Version { get; private set; }
    public IReadOnlyCollection<SubjectInterest> Interests => interests;

    public static StudentProfile Create(
        Guid userId,
        string displayName,
        EducationLevel educationLevel,
        string learningGoal,
        string timezone,
        DateTimeOffset now)
    {
        Validate(displayName, learningGoal, timezone);
        return new StudentProfile
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            DisplayName = displayName.Trim(),
            EducationLevel = educationLevel,
            LearningGoal = learningGoal?.Trim() ?? string.Empty,
            Timezone = timezone.Trim(),
            Status = StudentStatus.Active,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            Version = 1,
        };
    }

    public void Update(
        string displayName,
        EducationLevel educationLevel,
        string learningGoal,
        string timezone,
        DateTimeOffset now)
    {
        Validate(displayName, learningGoal, timezone);
        DisplayName = displayName.Trim();
        EducationLevel = educationLevel;
        LearningGoal = learningGoal?.Trim() ?? string.Empty;
        Timezone = timezone.Trim();
        UpdatedAtUtc = now;
        Version++;
    }

    public void ReplaceInterests(IEnumerable<SubjectInterest> replacements)
    {
        var values = replacements.ToList();
        if (values.Any(interest => interest.StudentId != Id))
        {
            throw new InvalidOperationException("Every interest must belong to this profile.");
        }

        if (values.Select(interest => interest.SubjectId).Distinct().Count() != values.Count)
        {
            throw new InvalidOperationException("A subject interest can only be assigned once.");
        }

        interests.Clear();
        interests.AddRange(values);
    }

    private static void Validate(string displayName, string learningGoal, string timezone)
    {
        if (string.IsNullOrWhiteSpace(displayName) || displayName.Trim().Length > 100)
        {
            throw new ArgumentException("Display name is required and cannot exceed 100 characters.", nameof(displayName));
        }

        if (learningGoal?.Length > 2000)
        {
            throw new ArgumentException("Learning goal cannot exceed 2000 characters.", nameof(learningGoal));
        }

        if (string.IsNullOrWhiteSpace(timezone) || timezone.Trim().Length > 100)
        {
            throw new ArgumentException("Timezone is required and cannot exceed 100 characters.", nameof(timezone));
        }
    }
}

public sealed class SubjectInterest
{
    private SubjectInterest()
    {
    }

    public Guid StudentId { get; private set; }
    public Guid SubjectId { get; private set; }
    public short Priority { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }

    public static SubjectInterest Create(
        Guid studentId,
        Guid subjectId,
        int priority,
        DateTimeOffset now)
    {
        if (priority is < 1 or > 5)
        {
            throw new ArgumentOutOfRangeException(nameof(priority), "Priority must be between 1 and 5.");
        }

        return new SubjectInterest
        {
            StudentId = studentId,
            SubjectId = subjectId,
            Priority = (short)priority,
            CreatedAtUtc = now,
        };
    }
}

