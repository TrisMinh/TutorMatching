using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NpgsqlTypes;

#nullable disable

namespace TutorMatching.Scheduling.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialScheduling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:btree_gist", ",,");

            migrationBuilder.CreateTable(
                name: "bookings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    student_id = table.Column<Guid>(type: "uuid", nullable: false),
                    student_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tutor_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tutor_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    subject_id = table.Column<Guid>(type: "uuid", nullable: false),
                    start_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    end_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    source_hold_id = table.Column<Guid>(type: "uuid", nullable: false),
                    confirmed_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    cancelled_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    cancelled_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    cancellation_reason = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    slot_range = table.Column<NpgsqlRange<DateTimeOffset>>(type: "tstzrange", nullable: false, computedColumnSql: "tstzrange(start_at_utc, end_at_utc, '[)')", stored: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bookings", x => x.id);
                    table.CheckConstraint("ck_booking_duration", "end_at_utc = start_at_utc + interval '60 minutes'");
                    table.CheckConstraint("ck_booking_status", "status IN ('Confirmed', 'Cancelled')");
                });

            migrationBuilder.CreateTable(
                name: "outbox_messages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    aggregate_type = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    aggregate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_type = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    event_version = table.Column<int>(type: "integer", nullable: false),
                    routing_key = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    payload = table.Column<string>(type: "jsonb", nullable: false),
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    causation_id = table.Column<Guid>(type: "uuid", nullable: true),
                    traceparent = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    occurred_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    published_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    attempt_count = table.Column<int>(type: "integer", nullable: false),
                    next_attempt_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    locked_until_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_error = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outbox_messages", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bookings_source_hold_id",
                table: "bookings",
                column: "source_hold_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bookings_student_id_status_start_at_utc",
                table: "bookings",
                columns: new[] { "student_id", "status", "start_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_bookings_tutor_id_status_start_at_utc",
                table: "bookings",
                columns: new[] { "tutor_id", "status", "start_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_outbox_messages_aggregate_id",
                table: "outbox_messages",
                column: "aggregate_id");

            migrationBuilder.CreateIndex(
                name: "IX_outbox_messages_published_at_utc_next_attempt_at_utc",
                table: "outbox_messages",
                columns: new[] { "published_at_utc", "next_attempt_at_utc" });

            migrationBuilder.Sql(
                """
                ALTER TABLE bookings
                ADD CONSTRAINT ex_booking_tutor_overlap
                EXCLUDE USING gist (tutor_id WITH =, slot_range WITH &&)
                WHERE (status = 'Confirmed');
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE bookings
                ADD CONSTRAINT ex_booking_student_overlap
                EXCLUDE USING gist (student_id WITH =, slot_range WITH &&)
                WHERE (status = 'Confirmed');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bookings");

            migrationBuilder.DropTable(
                name: "outbox_messages");
        }
    }
}
