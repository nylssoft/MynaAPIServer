﻿// <auto-generated />
using System;
using APIServer.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace APIServer.Migrations
{
    [DbContext(typeof(DbMynaContext))]
    partial class DbMynaContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "3.1.9");

            modelBuilder.Entity("APIServer.Database.DbPasswordFile", b =>
                {
                    b.Property<int>("DbPasswordFileId")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<string>("Content")
                        .HasColumnType("TEXT");

                    b.Property<DateTime?>("LastWrittenUtc")
                        .HasColumnType("TEXT");

                    b.HasKey("DbPasswordFileId");

                    b.ToTable("DbPasswordFiles");
                });

            modelBuilder.Entity("APIServer.Database.DbRegistration", b =>
                {
                    b.Property<int>("DbRegistrationId")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<string>("Email")
                        .HasColumnType("TEXT");

                    b.Property<string>("Token")
                        .HasColumnType("TEXT");

                    b.HasKey("DbRegistrationId");

                    b.ToTable("DbRegistrations");
                });

            modelBuilder.Entity("APIServer.Database.DbSetting", b =>
                {
                    b.Property<int>("DbSettingId")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<string>("Key")
                        .HasColumnType("TEXT");

                    b.Property<string>("Value")
                        .HasColumnType("TEXT");

                    b.HasKey("DbSettingId");

                    b.ToTable("DbSettings");
                });

            modelBuilder.Entity("APIServer.Database.DbUser", b =>
                {
                    b.Property<int>("DbUserId")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<int?>("DbPasswordFileId")
                        .HasColumnType("INTEGER");

                    b.Property<string>("Email")
                        .HasColumnType("TEXT");

                    b.Property<DateTime?>("LastLoginTryUtc")
                        .HasColumnType("TEXT");

                    b.Property<int>("LoginTries")
                        .HasColumnType("INTEGER");

                    b.Property<string>("Name")
                        .HasColumnType("TEXT");

                    b.Property<string>("PasswordHash")
                        .HasColumnType("TEXT");

                    b.Property<DateTime?>("RegisteredUtc")
                        .HasColumnType("TEXT");

                    b.Property<bool>("Requires2FA")
                        .HasColumnType("INTEGER");

                    b.Property<string>("Salt")
                        .HasColumnType("TEXT");

                    b.Property<string>("TOTPKey")
                        .HasColumnType("TEXT");

                    b.HasKey("DbUserId");

                    b.HasIndex("DbPasswordFileId");

                    b.ToTable("DbUsers");
                });

            modelBuilder.Entity("APIServer.Database.DbUser", b =>
                {
                    b.HasOne("APIServer.Database.DbPasswordFile", "DbPasswordFile")
                        .WithMany()
                        .HasForeignKey("DbPasswordFileId");
                });
#pragma warning restore 612, 618
        }
    }
}