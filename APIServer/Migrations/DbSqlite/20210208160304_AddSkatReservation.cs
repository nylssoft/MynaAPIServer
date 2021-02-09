using System;
using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations.DbSqlite
{
    public partial class AddSkatReservation : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SkatReservations",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ReservedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ReservedById = table.Column<long>(type: "INTEGER", nullable: false),
                    Duration = table.Column<int>(type: "INTEGER", nullable: false),
                    Player1 = table.Column<string>(type: "TEXT", nullable: true),
                    Player2 = table.Column<string>(type: "TEXT", nullable: true),
                    Player3 = table.Column<string>(type: "TEXT", nullable: true),
                    Player4 = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SkatReservations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SkatReservations_Users_ReservedById",
                        column: x => x.ReservedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SkatReservations_ReservedById",
                table: "SkatReservations",
                column: "ReservedById");

            migrationBuilder.CreateIndex(
                name: "IX_SkatReservations_ReservedUtc",
                table: "SkatReservations",
                column: "ReservedUtc");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SkatReservations");
        }
    }
}
