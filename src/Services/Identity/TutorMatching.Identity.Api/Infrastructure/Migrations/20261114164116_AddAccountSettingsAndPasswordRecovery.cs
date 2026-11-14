using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TutorMatching.Identity.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountSettingsAndPasswordRecovery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "account_settings",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmailReminders = table.Column<bool>(type: "boolean", nullable: false),
                    InAppNotifications = table.Column<bool>(type: "boolean", nullable: false),
                    EnrollmentAlerts = table.Column<bool>(type: "boolean", nullable: false),
                    ProfileVisible = table.Column<bool>(type: "boolean", nullable: false),
                    CancellationNoticeHours = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_account_settings", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_account_settings_user_accounts_UserId",
                        column: x => x.UserId,
                        principalTable: "user_accounts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "password_resets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character(64)", fixedLength: true, maxLength: 64, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UsedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_password_resets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_password_resets_user_accounts_UserId",
                        column: x => x.UserId,
                        principalTable: "user_accounts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_password_resets_TokenHash",
                table: "password_resets",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_password_resets_UserId_CreatedAtUtc",
                table: "password_resets",
                columns: new[] { "UserId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "account_settings");

            migrationBuilder.DropTable(
                name: "password_resets");
        }
    }
}
