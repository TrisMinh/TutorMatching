using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TutorMatching.Tutor.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCourses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "courses",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    TutorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Image = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_courses", x => x.Id);
                    table.CheckConstraint("ck_course_capacity", "\"Capacity\" > 0");
                    table.ForeignKey(
                        name: "FK_courses_tutor_profiles_TutorId",
                        column: x => x.TutorId,
                        principalTable: "tutor_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "course_enrollments",
                columns: table => new
                {
                    CourseId = table.Column<string>(type: "character varying(100)", nullable: false),
                    StudentUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    EnrolledAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_course_enrollments", x => new { x.CourseId, x.StudentUserId });
                    table.ForeignKey(
                        name: "FK_course_enrollments_courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "course_sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(100)", nullable: false),
                    StartAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_course_sessions", x => x.Id);
                    table.CheckConstraint("ck_course_session_order", "\"EndAtUtc\" > \"StartAtUtc\"");
                    table.ForeignKey(
                        name: "FK_course_sessions_courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_course_sessions_CourseId",
                table: "course_sessions",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_courses_TutorId",
                table: "courses",
                column: "TutorId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "course_enrollments");

            migrationBuilder.DropTable(
                name: "course_sessions");

            migrationBuilder.DropTable(
                name: "courses");
        }
    }
}
