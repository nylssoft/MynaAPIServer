﻿// <auto-generated />
using System;
using APIServer.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace APIServer.Migrations
{
    [DbContext(typeof(DbMynaContext))]
    [Migration("20210124081525_AddLogoutUtc")]
    partial class AddLogoutUtc
    {
        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "3.1.9");

            modelBuilder.Entity("APIServer.Database.DbChat", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<DateTime>("CreatedUtc")
                        .HasColumnType("TEXT");

                    b.Property<long>("DbUserId")
                        .HasColumnType("INTEGER");

                    b.Property<string>("Message")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("DbUserId");

                    b.ToTable("Chats");
                });

            modelBuilder.Entity("APIServer.Database.DbDiary", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<DateTime>("Date")
                        .HasColumnType("TEXT");

                    b.Property<long>("DbUserId")
                        .HasColumnType("INTEGER");

                    b.Property<string>("Entry")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("DbUserId", "Date")
                        .IsUnique();

                    b.ToTable("Diaries");
                });

            modelBuilder.Entity("APIServer.Database.DbLoginIpAddress", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<long>("DbUserId")
                        .HasColumnType("INTEGER");

                    b.Property<int>("Failed")
                        .HasColumnType("INTEGER");

                    b.Property<string>("IpAddress")
                        .HasColumnType("TEXT");

                    b.Property<DateTime>("LastUsedUtc")
                        .HasColumnType("TEXT");

                    b.Property<int>("Succeeded")
                        .HasColumnType("INTEGER");

                    b.HasKey("Id");

                    b.HasIndex("DbUserId", "IpAddress")
                        .IsUnique();

                    b.ToTable("LoginIpAddresses");
                });

            modelBuilder.Entity("APIServer.Database.DbNote", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<string>("Content")
                        .HasColumnType("TEXT");

                    b.Property<long>("DbUserId")
                        .HasColumnType("INTEGER");

                    b.Property<DateTime>("ModifiedUtc")
                        .HasColumnType("TEXT");

                    b.Property<string>("Title")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("DbUserId");

                    b.ToTable("Note");
                });

            modelBuilder.Entity("APIServer.Database.DbPasswordFile", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<string>("Content")
                        .HasColumnType("TEXT");

                    b.Property<DateTime?>("LastWrittenUtc")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.ToTable("PasswordFiles");
                });

            modelBuilder.Entity("APIServer.Database.DbRegistration", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<long?>("ConfirmedById")
                        .HasColumnType("INTEGER");

                    b.Property<DateTime?>("ConfirmedUtc")
                        .HasColumnType("TEXT");

                    b.Property<string>("Email")
                        .HasColumnType("TEXT");

                    b.Property<string>("IpAddress")
                        .HasColumnType("TEXT");

                    b.Property<DateTime?>("RequestedUtc")
                        .HasColumnType("TEXT");

                    b.Property<string>("Token")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("ConfirmedById");

                    b.HasIndex("Email")
                        .IsUnique();

                    b.HasIndex("IpAddress");

                    b.ToTable("Registrations");
                });

            modelBuilder.Entity("APIServer.Database.DbResetPassword", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<string>("Email")
                        .HasColumnType("TEXT");

                    b.Property<string>("IpAddress")
                        .HasColumnType("TEXT");

                    b.Property<DateTime>("RequestedUtc")
                        .HasColumnType("TEXT");

                    b.Property<string>("Token")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("Email")
                        .IsUnique();

                    b.HasIndex("IpAddress");

                    b.ToTable("ResetPasswords");
                });

            modelBuilder.Entity("APIServer.Database.DbRole", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<long>("DbUserId")
                        .HasColumnType("INTEGER");

                    b.Property<string>("Name")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("DbUserId");

                    b.ToTable("Roles");
                });

            modelBuilder.Entity("APIServer.Database.DbSetting", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<string>("Key")
                        .HasColumnType("TEXT");

                    b.Property<string>("Value")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("Key")
                        .IsUnique();

                    b.ToTable("Settings");
                });

            modelBuilder.Entity("APIServer.Database.DbSkatGameHistory", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<long>("DbSkatResultId")
                        .HasColumnType("INTEGER");

                    b.Property<string>("History")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("DbSkatResultId");

                    b.ToTable("SkatGameHistories");
                });

            modelBuilder.Entity("APIServer.Database.DbSkatResult", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<DateTime?>("EndedUtc")
                        .HasColumnType("TEXT");

                    b.Property<string>("Player1")
                        .HasColumnType("TEXT");

                    b.Property<string>("Player2")
                        .HasColumnType("TEXT");

                    b.Property<string>("Player3")
                        .HasColumnType("TEXT");

                    b.Property<string>("Player4")
                        .HasColumnType("TEXT");

                    b.Property<DateTime>("StartedUtc")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.ToTable("SkatResults");
                });

            modelBuilder.Entity("APIServer.Database.DbTetrisHighScore", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<DateTime>("Created")
                        .HasColumnType("TEXT");

                    b.Property<int>("Level")
                        .HasColumnType("INTEGER");

                    b.Property<int>("Lines")
                        .HasColumnType("INTEGER");

                    b.Property<string>("Name")
                        .HasColumnType("TEXT");

                    b.Property<int>("Score")
                        .HasColumnType("INTEGER");

                    b.HasKey("Id");

                    b.ToTable("TetrisHighScores");
                });

            modelBuilder.Entity("APIServer.Database.DbUser", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<bool>("AllowResetPassword")
                        .HasColumnType("INTEGER");

                    b.Property<string>("Email")
                        .HasColumnType("TEXT");

                    b.Property<DateTime?>("LastLoginTryUtc")
                        .HasColumnType("TEXT");

                    b.Property<int>("LoginTries")
                        .HasColumnType("INTEGER");

                    b.Property<DateTime?>("LogoutUtc")
                        .HasColumnType("TEXT");

                    b.Property<string>("Name")
                        .HasColumnType("TEXT");

                    b.Property<long?>("PasswordFileId")
                        .HasColumnType("INTEGER");

                    b.Property<string>("PasswordHash")
                        .HasColumnType("TEXT");

                    b.Property<string>("Photo")
                        .HasColumnType("TEXT");

                    b.Property<DateTime?>("RegisteredUtc")
                        .HasColumnType("TEXT");

                    b.Property<bool>("Requires2FA")
                        .HasColumnType("INTEGER");

                    b.Property<string>("Salt")
                        .HasColumnType("TEXT");

                    b.Property<string>("TOTPKey")
                        .HasColumnType("TEXT");

                    b.Property<bool>("UseLongLivedToken")
                        .HasColumnType("INTEGER");

                    b.HasKey("Id");

                    b.HasIndex("Email")
                        .IsUnique();

                    b.HasIndex("Name")
                        .IsUnique();

                    b.HasIndex("PasswordFileId");

                    b.ToTable("Users");
                });

            modelBuilder.Entity("APIServer.Database.DbUserSkatResult", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<long>("DbSkatResultId")
                        .HasColumnType("INTEGER");

                    b.Property<long>("DbUserId")
                        .HasColumnType("INTEGER");

                    b.HasKey("Id");

                    b.HasIndex("DbSkatResultId");

                    b.HasIndex("DbUserId");

                    b.ToTable("UserSkatResults");
                });

            modelBuilder.Entity("APIServer.Database.DbChat", b =>
                {
                    b.HasOne("APIServer.Database.DbUser", "DbUser")
                        .WithMany()
                        .HasForeignKey("DbUserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();
                });

            modelBuilder.Entity("APIServer.Database.DbDiary", b =>
                {
                    b.HasOne("APIServer.Database.DbUser", "DbUser")
                        .WithMany()
                        .HasForeignKey("DbUserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();
                });

            modelBuilder.Entity("APIServer.Database.DbLoginIpAddress", b =>
                {
                    b.HasOne("APIServer.Database.DbUser", "DbUser")
                        .WithMany()
                        .HasForeignKey("DbUserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();
                });

            modelBuilder.Entity("APIServer.Database.DbNote", b =>
                {
                    b.HasOne("APIServer.Database.DbUser", "DbUser")
                        .WithMany()
                        .HasForeignKey("DbUserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();
                });

            modelBuilder.Entity("APIServer.Database.DbRegistration", b =>
                {
                    b.HasOne("APIServer.Database.DbUser", "ConfirmedBy")
                        .WithMany()
                        .HasForeignKey("ConfirmedById");
                });

            modelBuilder.Entity("APIServer.Database.DbRole", b =>
                {
                    b.HasOne("APIServer.Database.DbUser", null)
                        .WithMany("Roles")
                        .HasForeignKey("DbUserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();
                });

            modelBuilder.Entity("APIServer.Database.DbSkatGameHistory", b =>
                {
                    b.HasOne("APIServer.Database.DbSkatResult", null)
                        .WithMany("SkatGameHistories")
                        .HasForeignKey("DbSkatResultId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();
                });

            modelBuilder.Entity("APIServer.Database.DbUser", b =>
                {
                    b.HasOne("APIServer.Database.DbPasswordFile", "PasswordFile")
                        .WithMany()
                        .HasForeignKey("PasswordFileId");
                });

            modelBuilder.Entity("APIServer.Database.DbUserSkatResult", b =>
                {
                    b.HasOne("APIServer.Database.DbSkatResult", "DbSkatResult")
                        .WithMany()
                        .HasForeignKey("DbSkatResultId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.HasOne("APIServer.Database.DbUser", "DbUser")
                        .WithMany()
                        .HasForeignKey("DbUserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();
                });
#pragma warning restore 612, 618
        }
    }
}
