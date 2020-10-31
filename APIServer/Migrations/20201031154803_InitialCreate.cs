using System;
using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DbRegistrations",
                columns: table => new
                {
                    DbRegistrationId = table.Column<int>(nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Email = table.Column<string>(nullable: true),
                    Token = table.Column<string>(nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DbRegistrations", x => x.DbRegistrationId);
                });

            migrationBuilder.CreateTable(
                name: "DbSettings",
                columns: table => new
                {
                    DbSettingId = table.Column<int>(nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Key = table.Column<string>(nullable: true),
                    Value = table.Column<string>(nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DbSettings", x => x.DbSettingId);
                });

            migrationBuilder.CreateTable(
                name: "DbUsers",
                columns: table => new
                {
                    DbUserId = table.Column<int>(nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(nullable: true),
                    PasswordHash = table.Column<string>(nullable: true),
                    Salt = table.Column<string>(nullable: true),
                    PasswordFile = table.Column<string>(nullable: true),
                    Email = table.Column<string>(nullable: true),
                    Requires2FA = table.Column<bool>(nullable: false),
                    LoginTries = table.Column<int>(nullable: false),
                    LastLoginTryUtc = table.Column<DateTime>(nullable: true),
                    TOTPKey = table.Column<string>(nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DbUsers", x => x.DbUserId);
                });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DbRegistrations");

            migrationBuilder.DropTable(
                name: "DbSettings");

            migrationBuilder.DropTable(
                name: "DbUsers");
        }
    }
}
