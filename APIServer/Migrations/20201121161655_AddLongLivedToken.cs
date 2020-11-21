using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations
{
    public partial class AddLongLivedToken : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "UseLongLivedToken",
                table: "Users",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UseLongLivedToken",
                table: "Users");
        }
    }
}
