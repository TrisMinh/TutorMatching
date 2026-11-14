using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TutorMatching.Tutor.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEnrollmentNoticeAvatar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AvatarUrl",
                table: "enrollment_notices",
                type: "character varying(2000000)",
                maxLength: 2000000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AvatarUrl",
                table: "enrollment_notices");
        }
    }
}
