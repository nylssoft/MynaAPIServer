using System;
using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations
{
    public partial class CreateResetPassword : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AllowResetPassword",
                table: "Users",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "ResetPasswords",
                columns: table => new
                {
                    Id = table.Column<long>(nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Email = table.Column<string>(nullable: true),
                    Token = table.Column<string>(nullable: true),
                    RequestedUtc = table.Column<DateTime>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResetPasswords", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ResetPasswords_Email",
                table: "ResetPasswords",
                column: "Email",
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ResetPasswords");

            migrationBuilder.DropColumn(
                name: "AllowResetPassword",
                table: "Users");
        }
    }
}
