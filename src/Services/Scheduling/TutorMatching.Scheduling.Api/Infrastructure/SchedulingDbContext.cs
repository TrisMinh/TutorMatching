using Microsoft.EntityFrameworkCore;
using NpgsqlTypes;
using TutorMatching.Scheduling.Api.Domain;

namespace TutorMatching.Scheduling.Api.Infrastructure;

public sealed class SchedulingDbContext(DbContextOptions<SchedulingDbContext> options) : DbContext(options)
{
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("btree_gist");

        var bookings = modelBuilder.Entity<Booking>();
        bookings.ToTable("bookings", table =>
        {
            table.HasCheckConstraint("ck_booking_duration", "end_at_utc = start_at_utc + interval '60 minutes'");
            table.HasCheckConstraint("ck_booking_status", "status IN ('Confirmed', 'Cancelled')");
        });
        bookings.HasKey(booking => booking.Id);
        bookings.Property(booking => booking.Id).HasColumnName("id").ValueGeneratedNever();
        bookings.Property(booking => booking.StudentId).HasColumnName("student_id");
        bookings.Property(booking => booking.StudentUserId).HasColumnName("student_user_id");
        bookings.Property(booking => booking.TutorId).HasColumnName("tutor_id");
        bookings.Property(booking => booking.TutorUserId).HasColumnName("tutor_user_id");
        bookings.Property(booking => booking.SubjectId).HasColumnName("subject_id");
        bookings.Property(booking => booking.StartAtUtc).HasColumnName("start_at_utc");
        bookings.Property(booking => booking.EndAtUtc).HasColumnName("end_at_utc");
        bookings.Property(booking => booking.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
        bookings.Property(booking => booking.SourceHoldId).HasColumnName("source_hold_id");
        bookings.Property(booking => booking.SourceHoldTokenHash).HasColumnName("source_hold_token_hash").HasMaxLength(64);
        bookings.HasIndex(booking => booking.SourceHoldId).IsUnique();
        bookings.Property(booking => booking.ConfirmedAtUtc).HasColumnName("confirmed_at_utc");
        bookings.Property(booking => booking.CancelledAtUtc).HasColumnName("cancelled_at_utc");
        bookings.Property(booking => booking.CancelledByUserId).HasColumnName("cancelled_by_user_id");
        bookings.Property(booking => booking.CancellationReason).HasColumnName("cancellation_reason").HasMaxLength(50);
        bookings.Property(booking => booking.CreatedAtUtc).HasColumnName("created_at_utc");
        bookings.Property(booking => booking.UpdatedAtUtc).HasColumnName("updated_at_utc");
        bookings.Property(booking => booking.Version).HasColumnName("version").IsConcurrencyToken();
        bookings.Ignore(booking => booking.Slot);
        bookings.Property<NpgsqlRange<DateTimeOffset>>("SlotRange")
            .HasColumnName("slot_range")
            .HasColumnType("tstzrange")
            .HasComputedColumnSql("tstzrange(start_at_utc, end_at_utc, '[)')", stored: true);
        bookings.HasIndex(booking => new { booking.StudentId, booking.Status, booking.StartAtUtc });
        bookings.HasIndex(booking => new { booking.TutorId, booking.Status, booking.StartAtUtc });

        var outbox = modelBuilder.Entity<OutboxMessage>();
        outbox.ToTable("outbox_messages");
        outbox.HasKey(message => message.Id);
        outbox.Property(message => message.Id).HasColumnName("id").ValueGeneratedNever();
        outbox.Property(message => message.AggregateType).HasColumnName("aggregate_type").HasMaxLength(80);
        outbox.Property(message => message.AggregateId).HasColumnName("aggregate_id");
        outbox.HasIndex(message => message.AggregateId);
        outbox.Property(message => message.EventType).HasColumnName("event_type").HasMaxLength(120);
        outbox.Property(message => message.EventVersion).HasColumnName("event_version");
        outbox.Property(message => message.RoutingKey).HasColumnName("routing_key").HasMaxLength(160);
        outbox.Property(message => message.Payload).HasColumnName("payload").HasColumnType("jsonb");
        outbox.Property(message => message.CorrelationId).HasColumnName("correlation_id");
        outbox.Property(message => message.CausationId).HasColumnName("causation_id");
        outbox.Property(message => message.Traceparent).HasColumnName("traceparent").HasMaxLength(128);
        outbox.Property(message => message.OccurredAtUtc).HasColumnName("occurred_at_utc");
        outbox.Property(message => message.PublishedAtUtc).HasColumnName("published_at_utc");
        outbox.Property(message => message.AttemptCount).HasColumnName("attempt_count");
        outbox.Property(message => message.NextAttemptAtUtc).HasColumnName("next_attempt_at_utc");
        outbox.Property(message => message.LockedUntilUtc).HasColumnName("locked_until_utc");
        outbox.Property(message => message.LastError).HasColumnName("last_error").HasMaxLength(1000);
        outbox.HasIndex(message => new { message.PublishedAtUtc, message.NextAttemptAtUtc });
    }
}

