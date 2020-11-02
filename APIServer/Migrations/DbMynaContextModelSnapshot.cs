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

                    b.Property<DateTime?>("RequestedUtc")
                        .HasColumnType("TEXT");

                    b.Property<string>("Token")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("ConfirmedById");

                    b.HasIndex("Email")
                        .IsUnique();

                    b.ToTable("Registrations");
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

            modelBuilder.Entity("APIServer.Database.DbUser", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<string>("Email")
                        .HasColumnType("TEXT");

                    b.Property<DateTime?>("LastLoginTryUtc")
                        .HasColumnType("TEXT");

                    b.Property<int>("LoginTries")
                        .HasColumnType("INTEGER");

                    b.Property<string>("Name")
                        .HasColumnType("TEXT");

                    b.Property<long?>("PasswordFileId")
                        .HasColumnType("INTEGER");

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

                    b.HasKey("Id");

                    b.HasIndex("Email")
                        .IsUnique();

                    b.HasIndex("Name")
                        .IsUnique();

                    b.HasIndex("PasswordFileId");

                    b.ToTable("Users");
                });

            modelBuilder.Entity("APIServer.Database.DbRegistration", b =>
                {
                    b.HasOne("APIServer.Database.DbUser", "ConfirmedBy")
                        .WithMany()
                        .HasForeignKey("ConfirmedById");
                });

            modelBuilder.Entity("APIServer.Database.DbUser", b =>
                {
                    b.HasOne("APIServer.Database.DbPasswordFile", "PasswordFile")
                        .WithMany()
                        .HasForeignKey("PasswordFileId");
                });
#pragma warning restore 612, 618
        }
    }
}
