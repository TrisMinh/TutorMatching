using Microsoft.EntityFrameworkCore;
using TutorMatching.Notification.Api.Domain;

namespace TutorMatching.Notification.Api.Infrastructure;

public sealed class NotificationDbContext(DbContextOptions<NotificationDbContext> options) : DbContext(options)
{
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<ProcessedEvent> ProcessedEvents => Set<ProcessedEvent>();
    public DbSet<NotificationItem> Notifications => Set<NotificationItem>();
    public DbSet<ReminderSchedule> ReminderSchedules => Set<ReminderSchedule>();
    public DbSet<DeliveryAttempt> DeliveryAttempts => Set<DeliveryAttempt>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var conversations = modelBuilder.Entity<Conversation>();
        conversations.ToTable("conversations");
        conversations.HasKey(c => c.Id);
        conversations.Property(c => c.Id).ValueGeneratedNever();
        conversations.Property(c => c.StudentName).HasMaxLength(100);
        conversations.Property(c => c.TutorName).HasMaxLength(100);
        conversations.HasIndex(c => new {c.StudentUserId,c.TutorUserId}).IsUnique();
        conversations.HasIndex(c => new {c.StudentUserId,c.UpdatedAtUtc});
        conversations.HasIndex(c => new {c.TutorUserId,c.UpdatedAtUtc});
        var messages = modelBuilder.Entity<ChatMessage>();
        messages.ToTable("chat_messages");
        messages.HasKey(m => m.Id);
        messages.Property(m => m.Id).UseIdentityAlwaysColumn();
        messages.Property(m => m.Body).HasMaxLength(2000);
        messages.HasIndex(m => new {m.ConversationId,m.Id});
        messages.HasIndex(m => new {m.ConversationId,m.SenderUserId,m.ClientMessageId}).IsUnique();
        messages.HasOne<Conversation>().WithMany().HasForeignKey(m => m.ConversationId).OnDelete(DeleteBehavior.Cascade);
        var events = modelBuilder.Entity<ProcessedEvent>();
        events.ToTable("processed_events");
        events.HasKey(item => item.EventId);
        events.Property(item => item.EventId).HasColumnName("event_id").ValueGeneratedNever();
        events.Property(item => item.EventType).HasColumnName("event_type").HasMaxLength(120);
        events.Property(item => item.EventVersion).HasColumnName("event_version");
        events.Property(item => item.ProcessedAtUtc).HasColumnName("processed_at_utc");

        var notifications = modelBuilder.Entity<NotificationItem>();
        notifications.ToTable("notifications", table =>
            table.HasCheckConstraint("ck_notification_status", "status IN ('Unread', 'Read')"));
        notifications.HasKey(item => item.Id);
        notifications.Property(item => item.Id).HasColumnName("id").ValueGeneratedNever();
        notifications.Property(item => item.RecipientUserId).HasColumnName("recipient_user_id");
        notifications.HasIndex(item => item.RecipientUserId);
        notifications.Property(item => item.BookingId).HasColumnName("booking_id");
        notifications.Property(item => item.Type).HasColumnName("type").HasMaxLength(50);
        notifications.Property(item => item.Title).HasColumnName("title").HasMaxLength(200);
        notifications.Property(item => item.Body).HasColumnName("body").HasMaxLength(4000);
        notifications.Property(item => item.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
        notifications.Property(item => item.SourceEventId).HasColumnName("source_event_id");
        notifications.Property(item => item.CreatedAtUtc).HasColumnName("created_at_utc");
        notifications.Property(item => item.ReadAtUtc).HasColumnName("read_at_utc");
        notifications.HasIndex(item => new { item.SourceEventId, item.RecipientUserId, item.Type }).IsUnique();
        notifications.HasOne<ProcessedEvent>().WithMany().HasForeignKey(item => item.SourceEventId);

        var reminders = modelBuilder.Entity<ReminderSchedule>();
        reminders.ToTable("reminder_schedules", table =>
            table.HasCheckConstraint("ck_reminder_status", "status IN ('Pending', 'Processing', 'Sent', 'Cancelled', 'Failed')"));
        reminders.HasKey(item => item.Id);
        reminders.Property(item => item.Id).HasColumnName("id").ValueGeneratedNever();
        reminders.Property(item => item.BookingId).HasColumnName("booking_id");
        reminders.Property(item => item.RecipientUserId).HasColumnName("recipient_user_id");
        reminders.Property(item => item.ReminderType).HasColumnName("reminder_type").HasMaxLength(30);
        reminders.Property(item => item.ScheduledForUtc).HasColumnName("scheduled_for_utc");
        reminders.HasIndex(item => item.ScheduledForUtc);
        reminders.Property(item => item.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
        reminders.Property(item => item.LeaseUntilUtc).HasColumnName("lease_until_utc");
        reminders.Property(item => item.Attempts).HasColumnName("attempts");
        reminders.Property(item => item.NextAttemptAtUtc).HasColumnName("next_attempt_at_utc");
        reminders.Property(item => item.LastError).HasColumnName("last_error").HasMaxLength(1000);
        reminders.Property(item => item.SourceEventId).HasColumnName("source_event_id");
        reminders.HasIndex(item => new { item.BookingId, item.RecipientUserId, item.ReminderType }).IsUnique();
        reminders.HasOne<ProcessedEvent>().WithMany().HasForeignKey(item => item.SourceEventId);

        var attempts = modelBuilder.Entity<DeliveryAttempt>();
        attempts.ToTable("delivery_attempts");
        attempts.HasKey(item => item.Id);
        attempts.Property(item => item.Id).HasColumnName("id").ValueGeneratedNever();
        attempts.Property(item => item.NotificationId).HasColumnName("notification_id");
        attempts.Property(item => item.ReminderId).HasColumnName("reminder_id");
        attempts.Property(item => item.Channel).HasColumnName("channel").HasMaxLength(20);
        attempts.Property(item => item.AttemptNo).HasColumnName("attempt_no");
        attempts.Property(item => item.Status).HasColumnName("status").HasMaxLength(20);
        attempts.Property(item => item.ProviderMessageId).HasColumnName("provider_message_id").HasMaxLength(200);
        attempts.Property(item => item.ErrorCode).HasColumnName("error_code").HasMaxLength(100);
        attempts.Property(item => item.StartedAtUtc).HasColumnName("started_at_utc");
        attempts.Property(item => item.CompletedAtUtc).HasColumnName("completed_at_utc");
    }
}

public sealed class ProcessedEvent
{
    public Guid EventId { get; init; }
    public string EventType { get; init; } = string.Empty;
    public int EventVersion { get; init; }
    public DateTimeOffset ProcessedAtUtc { get; init; }
}

public sealed class DeliveryAttempt
{
    public Guid Id { get; init; }
    public Guid? NotificationId { get; init; }
    public Guid? ReminderId { get; init; }
    public string Channel { get; init; } = string.Empty;
    public int AttemptNo { get; init; }
    public string Status { get; init; } = string.Empty;
    public string? ProviderMessageId { get; init; }
    public string? ErrorCode { get; init; }
    public DateTimeOffset StartedAtUtc { get; init; }
    public DateTimeOffset? CompletedAtUtc { get; init; }
}

