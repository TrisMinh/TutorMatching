using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TutorMatching.Identity.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PersistRegistrationName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "display_name",
                table: "user_accounts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "display_name",
                table: "user_accounts");
        }
    }
}
