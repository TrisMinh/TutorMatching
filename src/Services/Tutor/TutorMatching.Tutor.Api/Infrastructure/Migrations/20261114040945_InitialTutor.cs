using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NpgsqlTypes;

#nullable disable

namespace TutorMatching.Tutor.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialTutor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:btree_gist", ",,");

            migrationBuilder.CreateTable(
                name: "subjects",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subjects", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tutor_profiles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    display_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    bio = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    experience_years = table.Column<short>(type: "smallint", nullable: false),
                    avatar_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tutor_profiles", x => x.id);
                    table.CheckConstraint("ck_tutor_experience_years", "experience_years BETWEEN 0 AND 80");
                    table.CheckConstraint("ck_tutor_status", "status IN ('Active', 'Suspended')");
                });

            migrationBuilder.CreateTable(
                name: "availability_windows",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tutor_id = table.Column<Guid>(type: "uuid", nullable: false),
                    start_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    end_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    slot_range = table.Column<NpgsqlRange<DateTimeOffset>>(type: "tstzrange", nullable: false, computedColumnSql: "tstzrange(start_at_utc, end_at_utc, '[)')", stored: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_availability_windows", x => x.id);
                    table.CheckConstraint("ck_availability_order", "end_at_utc > start_at_utc");
                    table.ForeignKey(
                        name: "FK_availability_windows_tutor_profiles_tutor_id",
                        column: x => x.tutor_id,
                        principalTable: "tutor_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tutor_subjects",
                columns: table => new
                {
                    tutor_id = table.Column<Guid>(type: "uuid", nullable: false),
                    subject_id = table.Column<Guid>(type: "uuid", nullable: false),
                    proficiency_level = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tutor_subjects", x => new { x.tutor_id, x.subject_id });
                    table.ForeignKey(
                        name: "FK_tutor_subjects_subjects_subject_id",
                        column: x => x.subject_id,
                        principalTable: "subjects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_tutor_subjects_tutor_profiles_tutor_id",
                        column: x => x.tutor_id,
                        principalTable: "tutor_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_availability_windows_tutor_id",
                table: "availability_windows",
                column: "tutor_id");

            migrationBuilder.CreateIndex(
                name: "IX_subjects_code",
                table: "subjects",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tutor_profiles_user_id",
                table: "tutor_profiles",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tutor_subjects_subject_id",
                table: "tutor_subjects",
                column: "subject_id");

            migrationBuilder.Sql(
                """
                ALTER TABLE availability_windows
                ADD CONSTRAINT ex_availability_tutor_overlap
                EXCLUDE USING gist (tutor_id WITH =, slot_range WITH &&);
                """);

            migrationBuilder.Sql(
                """
                INSERT INTO subjects (id, code, name, is_active, created_at_utc, updated_at_utc)
                VALUES
                  ('11111111-1111-1111-1111-111111111111', 'MATH', 'Mathematics', TRUE, NOW(), NOW()),
                  ('22222222-2222-2222-2222-222222222222', 'ENGLISH', 'English', TRUE, NOW(), NOW()),
                  ('33333333-3333-3333-3333-333333333333', 'PHYSICS', 'Physics', TRUE, NOW(), NOW())
                ON CONFLICT (code) DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "availability_windows");

            migrationBuilder.DropTable(
                name: "tutor_subjects");

            migrationBuilder.DropTable(
                name: "subjects");

            migrationBuilder.DropTable(
                name: "tutor_profiles");
        }
    }
}
