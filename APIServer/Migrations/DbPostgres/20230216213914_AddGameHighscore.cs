﻿using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace APIServer.Migrations.DbPostgres
{
    public partial class AddGameHighscore : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Game",
                table: "TetrisHighScores",
                type: "text",
                nullable: true);
            migrationBuilder.Sql("UPDATE \"TetrisHighScores\" SET \"Game\" = 'tetris';");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Game",
                table: "TetrisHighScores");
        }
    }
}
