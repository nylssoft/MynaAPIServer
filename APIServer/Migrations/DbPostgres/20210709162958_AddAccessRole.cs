using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations.DbPostgres
{
    public partial class AddAccessRole : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccessRole",
                table: "DocItems",
                type: "text",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AccessRole",
                table: "DocItems");
        }
    }
}
