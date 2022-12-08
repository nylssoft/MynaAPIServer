/*
    Myna API Server
    Copyright (C) 2020-2022 Niels Stockfleth

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
using Microsoft.EntityFrameworkCore;
using System;

namespace APIServer.Database
{
    public abstract class DbMynaContext : DbContext
    {
        public DbMynaContext(DbContextOptions options) : base(options)
        {
        }

        public DbSet<DbUser> DbUsers { get; set; }

        public DbSet<DbResetPassword> DbResetPasswords { get; set; }

        public DbSet<DbLoginIpAddress> DbLoginIpAddresses { get; set; }

        public DbSet<DbUserClient> DbUserClients { get; set; }

        public DbSet<DbRole> DbRoles { get; set; }

        public DbSet<DbRegistration> DbRegistrations { get; set; }

        public DbSet<DbSetting> DbSettings { get; set; }

        public DbSet<DbPasswordFile> DbPasswordFiles { get; set; }

        public DbSet<DbSkatResult> DbSkatResults { get; set; }

        public DbSet<DbSkatGameHistory> DbSkatGameHistories { get; set; }

        public DbSet<DbUserSkatResult> DbUserSkatResults { get; set; }

        public DbSet<DbSkatReservation> DbSkatReservations { get; set; }

        public DbSet<DbChat> DbChats { get; set; }

        public DbSet<DbTetrisHighScore> DbTetrisHighScore { get; set; }

        public DbSet<DbDiary> DbDiaries { get; set; }

        public DbSet<DbNote> DbNotes { get; set; }

        public DbSet<DbDocItem> DbDocItems { get; set; }

        public DbSet<DbDocContent> DbDocContents { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            _ = builder.Entity<DbRegistration>()
                .HasIndex(r => r.Email)
                .IsUnique();
            _ = builder.Entity<DbRegistration>()
                .HasIndex(r => r.IpAddress);
            _ = builder.Entity<DbUser>()
                .HasIndex(u => u.LoginName)
                .IsUnique();
            _ = builder.Entity<DbUser>()
                .HasIndex(u => u.Email)
                .IsUnique();
            _ = builder.Entity<DbSetting>()
                .HasIndex(s => s.Key)
                .IsUnique();
            _ = builder.Entity<DbLoginIpAddress>()
                .HasIndex(ip => new { ip.DbUserId, ip.IpAddress })
                .IsUnique();
            _ = builder.Entity<DbResetPassword>()
                .HasIndex(r => r.Email)
                .IsUnique();
            _ = builder.Entity<DbResetPassword>()
                .HasIndex(r => r.IpAddress);
            _ = builder.Entity<DbDiary>()
                .HasIndex(d => new { d.DbUserId, d.Date })
                .IsUnique();
            _ = builder.Entity<DbNote>()
                .HasIndex(n => n.DbUserId);
            _ = builder.Entity<DbSkatReservation>()
                .HasIndex(r => r.ReservedUtc);
            _ = builder.Entity<DbUserClient>()
                .HasIndex(ip => new { ip.DbUserId, ip.ClientUUID })
                .IsUnique();
        }

        public static DateTime? GetUtcDateTime(DateTime? dbDateTime)
        {
            DateTime? ret = null;
            if (dbDateTime != null)
            {
                var ticks = dbDateTime.Value.Ticks;
                ret = new DateTime(ticks, DateTimeKind.Utc);
            }
            return ret;
        }

    }
}
