﻿using Microsoft.EntityFrameworkCore.Migrations;

namespace APIServer.Migrations.DbSqlite
{
    public partial class AddStorageQuota : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "StorageQuota",
                table: "Users",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StorageQuota",
                table: "Users");
        }
    }
}
