using System;
using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations
{
    public partial class AddLogoutUtc : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LogoutUtc",
                table: "Users",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LogoutUtc",
                table: "Users");
        }
    }
}
