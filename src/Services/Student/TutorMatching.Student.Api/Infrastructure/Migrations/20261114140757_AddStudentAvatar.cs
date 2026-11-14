using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TutorMatching.Student.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStudentAvatar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "avatar_url",
                table: "student_profiles",
                type: "character varying(2000000)",
                maxLength: 2000000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "avatar_url",
                table: "student_profiles");
        }
    }
}
