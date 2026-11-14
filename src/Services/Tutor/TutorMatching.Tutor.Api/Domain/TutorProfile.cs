namespace TutorMatching.Tutor.Api.Domain;

public enum TutorStatus
{
    Active,
    Suspended,
}

public enum ProficiencyLevel
{
    Beginner,
    Intermediate,
    Advanced,
    Expert,
}

public sealed class TutorProfile
{
    private readonly List<TutorSubject> subjects = [];
    private readonly List<AvailabilityWindow> availabilityWindows = [];

    private TutorProfile()
    {
    }

    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public string DisplayName { get; private set; } = string.Empty;
    public string Bio { get; private set; } = string.Empty;
    public short ExperienceYears { get; private set; }
    public string? AvatarUrl { get; private set; }
    public TutorStatus Status { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public int Version { get; private set; }
    public IReadOnlyCollection<TutorSubject> Subjects => subjects;
    public IReadOnlyCollection<AvailabilityWindow> AvailabilityWindows => availabilityWindows;

    public static TutorProfile Create(
        Guid userId,
        string displayName,
        string bio,
        short experienceYears,
        DateTimeOffset now)
    {
        Validate(displayName, bio, experienceYears);
        return new TutorProfile
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            DisplayName = displayName.Trim(),
            Bio = bio.Trim(),
            ExperienceYears = experienceYears,
            Status = TutorStatus.Active,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            Version = 1,
        };
    }

    public void Update(
        string displayName,
        string bio,
        short experienceYears,
        string? avatarUrl,
        DateTimeOffset now)
    {
        Validate(displayName, bio, experienceYears);
        DisplayName = displayName.Trim();
        Bio = bio.Trim();
        ExperienceYears = experienceYears;
        AvatarUrl = string.IsNullOrWhiteSpace(avatarUrl) ? null : avatarUrl.Trim();
        UpdatedAtUtc = now;
        Version++;
    }

    public void ReplaceSubjects(IEnumerable<TutorSubject> replacements)
    {
        var values = replacements.ToList();
        if (values.Any(subject => subject.TutorId != Id))
        {
            throw new InvalidOperationException("Every tutor subject must belong to this profile.");
        }

        if (values.Select(subject => subject.SubjectId).Distinct().Count() != values.Count)
        {
            throw new InvalidOperationException("A subject can only be assigned once.");
        }

        subjects.Clear();
        subjects.AddRange(values);
    }

    public void ReplaceAvailability(IEnumerable<AvailabilityWindow> replacements)
    {
        var values = replacements.OrderBy(window => window.StartAtUtc).ToList();
        if (values.Any(window => window.TutorId != Id))
        {
            throw new InvalidOperationException("Every availability window must belong to this profile.");
        }

        for (var index = 1; index < values.Count; index++)
        {
            if (values[index - 1].EndAtUtc > values[index].StartAtUtc)
            {
                throw new InvalidOperationException("Availability windows cannot overlap.");
            }
        }

        availabilityWindows.Clear();
        availabilityWindows.AddRange(values);
    }

    private static void Validate(string displayName, string bio, short experienceYears)
    {
        if (string.IsNullOrWhiteSpace(displayName) || displayName.Trim().Length > 100)
        {
            throw new ArgumentException("Display name is required and cannot exceed 100 characters.", nameof(displayName));
        }

        if (bio?.Length > 2000)
        {
            throw new ArgumentException("Bio cannot exceed 2000 characters.", nameof(bio));
        }

        if (experienceYears is < 0 or > 80)
        {
            throw new ArgumentOutOfRangeException(nameof(experienceYears));
        }
    }
}

public sealed class TutorSubject
{
    private TutorSubject()
    {
    }

    public Guid TutorId { get; private set; }
    public Guid SubjectId { get; private set; }
    public ProficiencyLevel ProficiencyLevel { get; private set; }

    public static TutorSubject Create(Guid tutorId, Guid subjectId, ProficiencyLevel level) => new()
    {
        TutorId = tutorId,
        SubjectId = subjectId,
        ProficiencyLevel = level,
    };
}

public sealed class AvailabilityWindow
{
    private AvailabilityWindow()
    {
    }

    public Guid Id { get; private set; }
    public Guid TutorId { get; private set; }
    public DateTimeOffset StartAtUtc { get; private set; }
    public DateTimeOffset EndAtUtc { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }

    public static AvailabilityWindow Create(
        Guid tutorId,
        DateTimeOffset startAtUtc,
        DateTimeOffset endAtUtc,
        DateTimeOffset now)
    {
        if (startAtUtc.Offset != TimeSpan.Zero || endAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Availability must be expressed in UTC.");
        }

        if (startAtUtc.Second != 0 || startAtUtc.Millisecond != 0 || startAtUtc.Minute is not (0 or 30))
        {
            throw new ArgumentException("Availability must align to the 30-minute grid.", nameof(startAtUtc));
        }

        if (endAtUtc <= startAtUtc || endAtUtc.Minute is not (0 or 30) || endAtUtc.Second != 0)
        {
            throw new ArgumentException("Availability end must be after start and align to the 30-minute grid.", nameof(endAtUtc));
        }

        return new AvailabilityWindow
        {
            Id = Guid.NewGuid(),
            TutorId = tutorId,
            StartAtUtc = startAtUtc,
            EndAtUtc = endAtUtc,
            CreatedAtUtc = now,
        };
    }
}

