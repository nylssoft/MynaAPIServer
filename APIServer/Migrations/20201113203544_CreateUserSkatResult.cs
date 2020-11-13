using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations
{
    public partial class CreateUserSkatResult : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserSkatResults",
                columns: table => new
                {
                    Id = table.Column<long>(nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    DbUserId = table.Column<long>(nullable: false),
                    DbSkatResultId = table.Column<long>(nullable: false)
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
                name: "UserSkatResults");
        }
    }
}
