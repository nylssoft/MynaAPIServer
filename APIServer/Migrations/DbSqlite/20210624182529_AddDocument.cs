using System;
using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations.DbSqlite
{
    public partial class AddDocument : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DocContents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Data = table.Column<byte[]>(type: "BLOB", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocContents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DocItems",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OwnerId = table.Column<long>(type: "INTEGER", nullable: false),
                    ParentId = table.Column<long>(type: "INTEGER", nullable: true),
                    Name = table.Column<string>(type: "TEXT", nullable: true),
                    Type = table.Column<int>(type: "INTEGER", nullable: false),
                    Size = table.Column<long>(type: "INTEGER", nullable: false),
                    Children = table.Column<int>(type: "INTEGER", nullable: false),
                    ContentId = table.Column<long>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DocItems_DocContents_ContentId",
                        column: x => x.ContentId,
                        principalTable: "DocContents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DocItems_DocItems_ParentId",
                        column: x => x.ParentId,
                        principalTable: "DocItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DocItems_Users_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DocItems_ContentId",
                table: "DocItems",
                column: "ContentId");

            migrationBuilder.CreateIndex(
                name: "IX_DocItems_OwnerId",
                table: "DocItems",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_DocItems_ParentId",
                table: "DocItems",
                column: "ParentId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DocItems");

            migrationBuilder.DropTable(
                name: "DocContents");
        }
    }
}
