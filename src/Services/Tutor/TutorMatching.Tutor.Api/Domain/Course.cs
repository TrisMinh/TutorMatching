namespace TutorMatching.Tutor.Api.Domain;

public sealed class Course
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public Guid TutorId { get; set; }
    public string Image { get; set; } = "";
    public string Category { get; set; } = "";
    public string Description { get; set; } = "";
    public int Capacity { get; set; }
    public string Status { get; set; } = "Open";
    public int Version { get; set; } = 1;
    public string? CancellationReason { get; set; }
    public DateTimeOffset? CancelledAtUtc { get; set; }
    public List<CourseSession> Sessions { get; set; } = [];
    public List<CourseEnrollment> Enrollments { get; set; } = [];
}
public sealed class CourseSession
{
    public Guid Id { get; set; }
    public string CourseId { get; set; } = "";
    public DateTimeOffset StartAtUtc { get; set; }
    public DateTimeOffset EndAtUtc { get; set; }
}
public sealed class CourseEnrollment
{
    public string CourseId { get; set; } = "";
    public Guid StudentUserId { get; set; }
    public DateTimeOffset EnrolledAtUtc { get; set; }
    public DateTimeOffset? WithdrawnAtUtc { get; set; }
}
public sealed class CourseLifecycleNotice
{
    public Guid Id { get; set; }
    public string CourseId { get; set; } = "";
    public Guid RecipientUserId { get; set; }
    public string Type { get; set; } = "";
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string ActorName { get; set; } = "";
    public string? AvatarUrl { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? ReadAtUtc { get; set; }
}
public sealed class EnrollmentNotice
{
    public Guid Id { get; set; }
    public string CourseId { get; set; } = "";
    public Guid StudentUserId { get; set; }
    public Guid TutorUserId { get; set; }
    public string StudentName { get; set; } = "";
    public string? AvatarUrl { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? ReadAtUtc { get; set; }
}
