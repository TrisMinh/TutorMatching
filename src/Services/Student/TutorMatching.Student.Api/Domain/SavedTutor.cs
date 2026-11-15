namespace TutorMatching.Student.Api.Domain;
public sealed class SavedTutor
{
    public Guid StudentId {get;set;}
    public Guid TutorId {get;set;}
    public DateTimeOffset CreatedAtUtc {get;set;}
}
