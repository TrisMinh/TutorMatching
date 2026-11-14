using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TutorMatching.Tutor.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCourseLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "courses",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CancelledAtUtc",
                table: "courses",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "courses",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Open");

            migrationBuilder.AddColumn<int>(
                name: "Version",
                table: "courses",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "WithdrawnAtUtc",
                table: "course_enrollments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "course_lifecycle_notices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RecipientUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Body = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ActorName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    AvatarUrl = table.Column<string>(type: "character varying(2000000)", maxLength: 2000000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ReadAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_course_lifecycle_notices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_course_lifecycle_notices_courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_course_lifecycle_notices_CourseId",
                table: "course_lifecycle_notices",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_course_lifecycle_notices_RecipientUserId_CreatedAtUtc",
                table: "course_lifecycle_notices",
                columns: new[] { "RecipientUserId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "course_lifecycle_notices");

            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "CancelledAtUtc",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "WithdrawnAtUtc",
                table: "course_enrollments");
        }
    }
}
