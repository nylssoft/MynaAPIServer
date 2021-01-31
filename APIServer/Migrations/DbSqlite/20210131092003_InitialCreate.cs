using System;
using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations.DbSqlite
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PasswordFiles",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Content = table.Column<string>(type: "TEXT", nullable: true),
                    LastWrittenUtc = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordFiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ResetPasswords",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Email = table.Column<string>(type: "TEXT", nullable: true),
                    Token = table.Column<string>(type: "TEXT", nullable: true),
                    RequestedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IpAddress = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResetPasswords", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Settings",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Key = table.Column<string>(type: "TEXT", nullable: true),
                    Value = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SkatResults",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    StartedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndedUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Player1 = table.Column<string>(type: "TEXT", nullable: true),
                    Player2 = table.Column<string>(type: "TEXT", nullable: true),
                    Player3 = table.Column<string>(type: "TEXT", nullable: true),
                    Player4 = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SkatResults", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TetrisHighScores",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: true),
                    Score = table.Column<int>(type: "INTEGER", nullable: false),
                    Lines = table.Column<int>(type: "INTEGER", nullable: false),
                    Level = table.Column<int>(type: "INTEGER", nullable: false),
                    Created = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TetrisHighScores", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: true),
                    PasswordHash = table.Column<string>(type: "TEXT", nullable: true),
                    Salt = table.Column<string>(type: "TEXT", nullable: true),
                    Email = table.Column<string>(type: "TEXT", nullable: true),
                    Requires2FA = table.Column<bool>(type: "INTEGER", nullable: false),
                    LoginTries = table.Column<int>(type: "INTEGER", nullable: false),
                    LastLoginTryUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    RegisteredUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LogoutUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    TOTPKey = table.Column<string>(type: "TEXT", nullable: true),
                    PasswordFileId = table.Column<long>(type: "INTEGER", nullable: true),
                    UseLongLivedToken = table.Column<bool>(type: "INTEGER", nullable: false),
                    AllowResetPassword = table.Column<bool>(type: "INTEGER", nullable: false),
                    Photo = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_PasswordFiles_PasswordFileId",
                        column: x => x.PasswordFileId,
                        principalTable: "PasswordFiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SkatGameHistories",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    DbSkatResultId = table.Column<long>(type: "INTEGER", nullable: false),
                    History = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SkatGameHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SkatGameHistories_SkatResults_DbSkatResultId",
                        column: x => x.DbSkatResultId,
                        principalTable: "SkatResults",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Chats",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    DbUserId = table.Column<long>(type: "INTEGER", nullable: false),
                    Message = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Chats", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Chats_Users_DbUserId",
                        column: x => x.DbUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Diaries",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    DbUserId = table.Column<long>(type: "INTEGER", nullable: false),
                    Date = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Entry = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Diaries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Diaries_Users_DbUserId",
                        column: x => x.DbUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LoginIpAddresses",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    DbUserId = table.Column<long>(type: "INTEGER", nullable: false),
                    IpAddress = table.Column<string>(type: "TEXT", nullable: true),
                    LastUsedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Succeeded = table.Column<int>(type: "INTEGER", nullable: false),
                    Failed = table.Column<int>(type: "INTEGER", nullable: false)
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

            migrationBuilder.CreateTable(
                name: "Note",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    DbUserId = table.Column<long>(type: "INTEGER", nullable: false),
                    ModifiedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: true),
                    Content = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Note", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Note_Users_DbUserId",
                        column: x => x.DbUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Registrations",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Email = table.Column<string>(type: "TEXT", nullable: true),
                    Token = table.Column<string>(type: "TEXT", nullable: true),
                    RequestedUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ConfirmedUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ConfirmedById = table.Column<long>(type: "INTEGER", nullable: true),
                    IpAddress = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Registrations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Registrations_Users_ConfirmedById",
                        column: x => x.ConfirmedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    DbUserId = table.Column<long>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Roles_Users_DbUserId",
                        column: x => x.DbUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserSkatResults",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    DbUserId = table.Column<long>(type: "INTEGER", nullable: false),
                    DbSkatResultId = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSkatResults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserSkatResults_SkatResults_DbSkatResultId",
                        column: x => x.DbSkatResultId,
                        principalTable: "SkatResults",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserSkatResults_Users_DbUserId",
                        column: x => x.DbUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Chats_DbUserId",
                table: "Chats",
                column: "DbUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Diaries_DbUserId_Date",
                table: "Diaries",
                columns: new[] { "DbUserId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LoginIpAddresses_DbUserId_IpAddress",
                table: "LoginIpAddresses",
                columns: new[] { "DbUserId", "IpAddress" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Note_DbUserId",
                table: "Note",
                column: "DbUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Registrations_ConfirmedById",
                table: "Registrations",
                column: "ConfirmedById");

            migrationBuilder.CreateIndex(
                name: "IX_Registrations_Email",
                table: "Registrations",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Registrations_IpAddress",
                table: "Registrations",
                column: "IpAddress");

            migrationBuilder.CreateIndex(
                name: "IX_ResetPasswords_Email",
                table: "ResetPasswords",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ResetPasswords_IpAddress",
                table: "ResetPasswords",
                column: "IpAddress");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_DbUserId",
                table: "Roles",
                column: "DbUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Settings_Key",
                table: "Settings",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SkatGameHistories_DbSkatResultId",
                table: "SkatGameHistories",
                column: "DbSkatResultId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Name",
                table: "Users",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_PasswordFileId",
                table: "Users",
                column: "PasswordFileId");

            migrationBuilder.CreateIndex(
                name: "IX_UserSkatResults_DbSkatResultId",
                table: "UserSkatResults",
                column: "DbSkatResultId");

            migrationBuilder.CreateIndex(
                name: "IX_UserSkatResults_DbUserId",
                table: "UserSkatResults",
                column: "DbUserId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Chats");

            migrationBuilder.DropTable(
                name: "Diaries");

            migrationBuilder.DropTable(
                name: "LoginIpAddresses");

            migrationBuilder.DropTable(
                name: "Note");

            migrationBuilder.DropTable(
                name: "Registrations");

            migrationBuilder.DropTable(
                name: "ResetPasswords");

            migrationBuilder.DropTable(
                name: "Roles");

            migrationBuilder.DropTable(
                name: "Settings");

            migrationBuilder.DropTable(
                name: "SkatGameHistories");

            migrationBuilder.DropTable(
                name: "TetrisHighScores");

            migrationBuilder.DropTable(
                name: "UserSkatResults");

            migrationBuilder.DropTable(
                name: "SkatResults");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "PasswordFiles");
        }
    }
}
