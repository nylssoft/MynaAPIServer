using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations.DbPostgres
{
    public partial class AddLoginEnabled : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "LoginEnabled",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LoginEnabled",
                table: "Users");
        }
    }
}
