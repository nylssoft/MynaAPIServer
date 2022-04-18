using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations.DbPostgres
{
    public partial class AddRegistrationLocale : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Locale",
                table: "Registrations",
                type: "text",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Locale",
                table: "Registrations");
        }
    }
}
