using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TutorMatching.Scheduling.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCancellationPolicySnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "cancellation_reason",
                table: "bookings",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50,
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "cancellation_notice_hours",
                table: "bookings",
                type: "integer",
                nullable: false,
                defaultValue: 12);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "cancellation_notice_hours",
                table: "bookings");

            migrationBuilder.AlterColumn<string>(
                name: "cancellation_reason",
                table: "bookings",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(300)",
                oldMaxLength: 300,
                oldNullable: true);
        }
    }
}
