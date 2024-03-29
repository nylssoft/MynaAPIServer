﻿// <auto-generated />
using System;
using APIServer.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

namespace APIServer.Migrations.DbPostgres
{
    [DbContext(typeof(DbPostgresContext))]
    [Migration("20220306140343_AddUserClient")]
    partial class AddUserClient
    {
        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .UseIdentityByDefaultColumns()
                .HasAnnotation("Relational:MaxIdentifierLength", 63)
                .HasAnnotation("ProductVersion", "5.0.2");

            modelBuilder.Entity("APIServer.Database.DbChat", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<DateTime>("CreatedUtc")
                        .HasColumnType("timestamp without time zone");

                    b.Property<long>("DbUserId")
                        .HasColumnType("bigint");

                    b.Property<string>("Message")
                        .HasColumnType("text");

                    b.HasKey("Id");

                    b.HasIndex("DbUserId");

                    b.ToTable("Chats");
                });

            modelBuilder.Entity("APIServer.Database.DbDiary", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<DateTime>("Date")
                        .HasColumnType("timestamp without time zone");

                    b.Property<long>("DbUserId")
                        .HasColumnType("bigint");

                    b.Property<string>("Entry")
                        .HasColumnType("text");

                    b.HasKey("Id");

                    b.HasIndex("DbUserId", "Date")
                        .IsUnique();

                    b.ToTable("Diaries");
                });

            modelBuilder.Entity("APIServer.Database.DbDocContent", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<byte[]>("Data")
                        .HasColumnType("bytea");

                    b.HasKey("Id");

                    b.ToTable("DocContents");
                });

            modelBuilder.Entity("APIServer.Database.DbDocItem", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<string>("AccessRole")
                        .HasColumnType("text");

                    b.Property<int>("Children")
                        .HasColumnType("integer");

                    b.Property<long?>("ContentId")
                        .HasColumnType("bigint");

                    b.Property<string>("Name")
                        .HasColumnType("text");

                    b.Property<long>("OwnerId")
                        .HasColumnType("bigint");

                    b.Property<long?>("ParentId")
                        .HasColumnType("bigint");

                    b.Property<long>("Size")
                        .HasColumnType("bigint");

                    b.Property<int>("Type")
                        .HasColumnType("integer");

                    b.HasKey("Id");

                    b.HasIndex("ContentId");

                    b.HasIndex("OwnerId");

                    b.HasIndex("ParentId");

                    b.ToTable("DocItems");
                });

            modelBuilder.Entity("APIServer.Database.DbLoginIpAddress", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<long>("DbUserId")
                        .HasColumnType("bigint");

                    b.Property<int>("Failed")
                        .HasColumnType("integer");

                    b.Property<string>("IpAddress")
                        .HasColumnType("text");

                    b.Property<DateTime>("LastUsedUtc")
                        .HasColumnType("timestamp without time zone");

                    b.Property<int>("Succeeded")
                        .HasColumnType("integer");

                    b.HasKey("Id");

                    b.HasIndex("DbUserId", "IpAddress")
                        .IsUnique();

                    b.ToTable("LoginIpAddresses");
                });

            modelBuilder.Entity("APIServer.Database.DbNote", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<string>("Content")
                        .HasColumnType("text");

                    b.Property<long>("DbUserId")
                        .HasColumnType("bigint");

                    b.Property<DateTime>("ModifiedUtc")
                        .HasColumnType("timestamp without time zone");

                    b.Property<string>("Title")
                        .HasColumnType("text");

                    b.HasKey("Id");

                    b.HasIndex("DbUserId");

                    b.ToTable("Note");
                });

            modelBuilder.Entity("APIServer.Database.DbPasswordFile", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<string>("Content")
                        .HasColumnType("text");

                    b.Property<DateTime?>("LastWrittenUtc")
                        .HasColumnType("timestamp without time zone");

                    b.HasKey("Id");

                    b.ToTable("PasswordFiles");
                });

            modelBuilder.Entity("APIServer.Database.DbRegistration", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<long?>("ConfirmedById")
                        .HasColumnType("bigint");

                    b.Property<DateTime?>("ConfirmedUtc")
                        .HasColumnType("timestamp without time zone");

                    b.Property<string>("Email")
                        .HasColumnType("text");

                    b.Property<string>("IpAddress")
                        .HasColumnType("text");

                    b.Property<DateTime?>("RequestedUtc")
                        .HasColumnType("timestamp without time zone");

                    b.Property<string>("Token")
                        .HasColumnType("text");

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
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<string>("Email")
                        .HasColumnType("text");

                    b.Property<string>("IpAddress")
                        .HasColumnType("text");

                    b.Property<DateTime>("RequestedUtc")
                        .HasColumnType("timestamp without time zone");

                    b.Property<string>("Token")
                        .HasColumnType("text");

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
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<long>("DbUserId")
                        .HasColumnType("bigint");

                    b.Property<string>("Name")
                        .HasColumnType("text");

                    b.HasKey("Id");

                    b.HasIndex("DbUserId");

                    b.ToTable("Roles");
                });

            modelBuilder.Entity("APIServer.Database.DbSetting", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<string>("Key")
                        .HasColumnType("text");

                    b.Property<string>("Value")
                        .HasColumnType("text");

                    b.HasKey("Id");

                    b.HasIndex("Key")
                        .IsUnique();

                    b.ToTable("Settings");
                });

            modelBuilder.Entity("APIServer.Database.DbSkatGameHistory", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<long>("DbSkatResultId")
                        .HasColumnType("bigint");

                    b.Property<string>("History")
                        .HasColumnType("text");

                    b.HasKey("Id");

                    b.HasIndex("DbSkatResultId");

                    b.ToTable("SkatGameHistories");
                });

            modelBuilder.Entity("APIServer.Database.DbSkatReservation", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<int>("Duration")
                        .HasColumnType("integer");

                    b.Property<DateTime>("EndUtc")
                        .HasColumnType("timestamp without time zone");

                    b.Property<string>("Player1")
                        .HasColumnType("text");

                    b.Property<string>("Player2")
                        .HasColumnType("text");

                    b.Property<string>("Player3")
                        .HasColumnType("text");

                    b.Property<string>("Player4")
                        .HasColumnType("text");

                    b.Property<long>("ReservedById")
                        .HasColumnType("bigint");

                    b.Property<DateTime>("ReservedUtc")
                        .HasColumnType("timestamp without time zone");

                    b.HasKey("Id");

                    b.HasIndex("ReservedById");

                    b.HasIndex("ReservedUtc");

                    b.ToTable("SkatReservations");
                });

            modelBuilder.Entity("APIServer.Database.DbSkatResult", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<DateTime?>("EndedUtc")
                        .HasColumnType("timestamp without time zone");

                    b.Property<string>("Player1")
                        .HasColumnType("text");

                    b.Property<string>("Player2")
                        .HasColumnType("text");

                    b.Property<string>("Player3")
                        .HasColumnType("text");

                    b.Property<string>("Player4")
                        .HasColumnType("text");

                    b.Property<DateTime>("StartedUtc")
                        .HasColumnType("timestamp without time zone");

                    b.HasKey("Id");

                    b.ToTable("SkatResults");
                });

            modelBuilder.Entity("APIServer.Database.DbTetrisHighScore", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<DateTime>("Created")
                        .HasColumnType("timestamp without time zone");

                    b.Property<int>("Level")
                        .HasColumnType("integer");

                    b.Property<int>("Lines")
                        .HasColumnType("integer");

                    b.Property<string>("Name")
                        .HasColumnType("text");

                    b.Property<int>("Score")
                        .HasColumnType("integer");

                    b.HasKey("Id");

                    b.ToTable("TetrisHighScores");
                });

            modelBuilder.Entity("APIServer.Database.DbUser", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<bool>("AllowResetPassword")
                        .HasColumnType("boolean");

                    b.Property<string>("Email")
                        .HasColumnType("text");

                    b.Property<DateTime?>("LastLoginTryUtc")
                        .HasColumnType("timestamp without time zone");

                    b.Property<bool>("LoginEnabled")
                        .HasColumnType("boolean");

                    b.Property<int>("LoginTries")
                        .HasColumnType("integer");

                    b.Property<DateTime?>("LogoutUtc")
                        .HasColumnType("timestamp without time zone");

                    b.Property<string>("Name")
                        .HasColumnType("text");

                    b.Property<long?>("PasswordFileId")
                        .HasColumnType("bigint");

                    b.Property<string>("PasswordHash")
                        .HasColumnType("text");

                    b.Property<string>("Photo")
                        .HasColumnType("text");

                    b.Property<DateTime?>("RegisteredUtc")
                        .HasColumnType("timestamp without time zone");

                    b.Property<bool>("Requires2FA")
                        .HasColumnType("boolean");

                    b.Property<string>("Salt")
                        .HasColumnType("text");

                    b.Property<long>("StorageQuota")
                        .HasColumnType("bigint");

                    b.Property<string>("TOTPKey")
                        .HasColumnType("text");

                    b.Property<bool>("UseLongLivedToken")
                        .HasColumnType("boolean");

                    b.HasKey("Id");

                    b.HasIndex("Email")
                        .IsUnique();

                    b.HasIndex("Name")
                        .IsUnique();

                    b.HasIndex("PasswordFileId");

                    b.ToTable("Users");
                });

            modelBuilder.Entity("APIServer.Database.DbUserClient", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<string>("ClientName")
                        .HasColumnType("text");

                    b.Property<string>("ClientUUID")
                        .HasColumnType("text");

                    b.Property<long>("DbUserId")
                        .HasColumnType("bigint");

                    b.Property<string>("LastLoginIPAddress")
                        .HasColumnType("text");

                    b.Property<DateTime>("LastLoginUTC")
                        .HasColumnType("timestamp without time zone");

                    b.HasKey("Id");

                    b.HasIndex("DbUserId", "ClientUUID")
                        .IsUnique();

                    b.ToTable("UserClients");
                });

            modelBuilder.Entity("APIServer.Database.DbUserSkatResult", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .UseIdentityByDefaultColumn();

                    b.Property<long>("DbSkatResultId")
                        .HasColumnType("bigint");

                    b.Property<long>("DbUserId")
                        .HasColumnType("bigint");

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

                    b.Navigation("DbUser");
                });

            modelBuilder.Entity("APIServer.Database.DbDiary", b =>
                {
                    b.HasOne("APIServer.Database.DbUser", "DbUser")
                        .WithMany()
                        .HasForeignKey("DbUserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("DbUser");
                });

            modelBuilder.Entity("APIServer.Database.DbDocItem", b =>
                {
                    b.HasOne("APIServer.Database.DbDocContent", "Content")
                        .WithMany()
                        .HasForeignKey("ContentId");

                    b.HasOne("APIServer.Database.DbUser", "Owner")
                        .WithMany()
                        .HasForeignKey("OwnerId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.HasOne("APIServer.Database.DbDocItem", "Parent")
                        .WithMany()
                        .HasForeignKey("ParentId");

                    b.Navigation("Content");

                    b.Navigation("Owner");

                    b.Navigation("Parent");
                });

            modelBuilder.Entity("APIServer.Database.DbLoginIpAddress", b =>
                {
                    b.HasOne("APIServer.Database.DbUser", "DbUser")
                        .WithMany()
                        .HasForeignKey("DbUserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("DbUser");
                });

            modelBuilder.Entity("APIServer.Database.DbNote", b =>
                {
                    b.HasOne("APIServer.Database.DbUser", "DbUser")
                        .WithMany()
                        .HasForeignKey("DbUserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("DbUser");
                });

            modelBuilder.Entity("APIServer.Database.DbRegistration", b =>
                {
                    b.HasOne("APIServer.Database.DbUser", "ConfirmedBy")
                        .WithMany()
                        .HasForeignKey("ConfirmedById");

                    b.Navigation("ConfirmedBy");
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

            modelBuilder.Entity("APIServer.Database.DbSkatReservation", b =>
                {
                    b.HasOne("APIServer.Database.DbUser", "ReservedBy")
                        .WithMany()
                        .HasForeignKey("ReservedById")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("ReservedBy");
                });

            modelBuilder.Entity("APIServer.Database.DbUser", b =>
                {
                    b.HasOne("APIServer.Database.DbPasswordFile", "PasswordFile")
                        .WithMany()
                        .HasForeignKey("PasswordFileId");

                    b.Navigation("PasswordFile");
                });

            modelBuilder.Entity("APIServer.Database.DbUserClient", b =>
                {
                    b.HasOne("APIServer.Database.DbUser", "DbUser")
                        .WithMany()
                        .HasForeignKey("DbUserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("DbUser");
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

                    b.Navigation("DbSkatResult");

                    b.Navigation("DbUser");
                });

            modelBuilder.Entity("APIServer.Database.DbSkatResult", b =>
                {
                    b.Navigation("SkatGameHistories");
                });

            modelBuilder.Entity("APIServer.Database.DbUser", b =>
                {
                    b.Navigation("Roles");
                });
#pragma warning restore 612, 618
        }
    }
}
