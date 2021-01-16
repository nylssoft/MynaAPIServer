using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations
{
    public partial class AddIpAddress : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IpAddress",
                table: "ResetPasswords",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IpAddress",
                table: "Registrations",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ResetPasswords_IpAddress",
                table: "ResetPasswords",
                column: "IpAddress");

            migrationBuilder.CreateIndex(
                name: "IX_Registrations_IpAddress",
                table: "Registrations",
                column: "IpAddress");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ResetPasswords_IpAddress",
                table: "ResetPasswords");

            migrationBuilder.DropIndex(
                name: "IX_Registrations_IpAddress",
                table: "Registrations");

            migrationBuilder.DropColumn(
                name: "IpAddress",
                table: "ResetPasswords");

            migrationBuilder.DropColumn(
                name: "IpAddress",
                table: "Registrations");
        }
    }
}
