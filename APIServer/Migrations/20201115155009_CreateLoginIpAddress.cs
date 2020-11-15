using System;
using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations
{
    public partial class CreateLoginIpAddress : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LoginIpAddresses",
                columns: table => new
                {
                    Id = table.Column<long>(nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    DbUserId = table.Column<long>(nullable: false),
                    IpAddress = table.Column<string>(nullable: true),
                    LastUsedUtc = table.Column<DateTime>(nullable: false),
                    Succeeded = table.Column<int>(nullable: false),
                    Failed = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoginIpAddresses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LoginIpAddresses_Users_DbUserId",
                        column: x => x.DbUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LoginIpAddresses_DbUserId_IpAddress",
                table: "LoginIpAddresses",
                columns: new[] { "DbUserId", "IpAddress" },
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LoginIpAddresses");
        }
    }
}
