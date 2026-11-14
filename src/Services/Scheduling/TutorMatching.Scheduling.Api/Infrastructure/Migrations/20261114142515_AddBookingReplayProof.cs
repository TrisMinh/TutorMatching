using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TutorMatching.Scheduling.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingReplayProof : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "source_hold_token_hash",
                table: "bookings",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "source_hold_token_hash",
                table: "bookings");
        }
    }
}
