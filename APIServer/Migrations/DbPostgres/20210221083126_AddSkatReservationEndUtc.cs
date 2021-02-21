using System;
using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations.DbPostgres
{
    public partial class AddSkatReservationEndUtc : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EndUtc",
                table: "SkatReservations",
                type: "timestamp without time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EndUtc",
                table: "SkatReservations");
        }
    }
}
