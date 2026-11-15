namespace TutorMatching.Notification.Api.Domain;

public sealed class Conversation
{
    public Guid Id { get; set; }
    public Guid StudentUserId { get; set; }
    public Guid TutorUserId { get; set; }
    public Guid TutorId { get; set; }
    public string StudentName { get; set; } = "";
    public string TutorName { get; set; } = "";
    public long StudentReadThrough { get; set; }
    public long TutorReadThrough { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
public sealed class ChatMessage
{
    public long Id { get; set; }
    public Guid ConversationId { get; set; }
    public Guid SenderUserId { get; set; }
    public Guid ClientMessageId { get; set; }
    public string Body { get; set; } = "";
    public DateTimeOffset CreatedAtUtc { get; set; }
}
