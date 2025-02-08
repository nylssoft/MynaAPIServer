/*
    Myna API Server
    Copyright (C) 2020-2025 Niels Stockfleth

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
using APIServer.Database;
using APIServer.Document;
using APIServer.PwdMan;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;

namespace APIServer
{
    public enum MigrationMode { None, Sqlite2Postgres, Postgres2Sqlite };

    public class Program
    {
        public static void Main(string[] args)
        {
            var host = CreateHostBuilder(args).Build();
            var migrationMode = MigrationMode.None;
            if (args.Length > 0)
            {
                if (string.Equals(args[0], "--sqlite2postgres", StringComparison.InvariantCultureIgnoreCase))
                {
                    migrationMode = MigrationMode.Sqlite2Postgres;
                }
                else if (string.Equals(args[0], "--postgres2sqlite", StringComparison.InvariantCultureIgnoreCase))
                {
                    migrationMode = MigrationMode.Postgres2Sqlite;
                }
            }
            MigrateDatabase(host, migrationMode);
            host.Run();
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .ConfigureWebHostDefaults(webBuilder =>
                {
                    webBuilder
                        .ConfigureKestrel(options => options.AddServerHeader = false)
                        .UseStartup<Startup>();
                });

        private static void MigrateDatabase(IHost host, MigrationMode migrationMode)
        {
            using var scope = host.Services.CreateScope();
            var services = scope.ServiceProvider;
            var logger = services.GetRequiredService<ILogger<Program>>();
            try
            {
                var pwdman = services.GetRequiredService<IPwdManService>();
                var dbContext = pwdman.GetDbContext();
                dbContext.Database.Migrate();
                if (migrationMode != MigrationMode.None)
                {
                    var postgres = services.GetRequiredService<DbPostgresContext>();
                    var sqlite = services.GetRequiredService<DbSqliteContext>();
                    if (migrationMode == MigrationMode.Sqlite2Postgres && dbContext is DbPostgresContext)
                    {
                        MigrateDbContexts(logger, sqlite, postgres);
                    }
                    else if (migrationMode == MigrationMode.Postgres2Sqlite && dbContext is DbSqliteContext)
                    {
                        MigrateDbContexts(logger, postgres, sqlite);
                    }
                    else
                    {
                        logger.LogWarning("Migration is not allowed.");
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "An error occurred creating the DB.");
            }
        }

        private static void MigrateDbContexts(ILogger logger, DbMynaContext srcContext, DbMynaContext destContext)
        {
            if (destContext.DbUsers.Any())
            {
                logger.LogWarning("Destination database already contains users. Migration aborted.");
                return;
            }
            logger.LogInformation("Migrate Users...");
            var users = srcContext.DbUsers.Include(u => u.Roles).Include(u => u.PasswordFile).OrderBy(u => u.Id);
            foreach (var user in users)
            {
                var pgUser = new DbUser
                {
                    Name = user.Name,
                    PasswordHash = user.PasswordHash,
                    Salt = user.Salt,
                    Email = user.Email,
                    Requires2FA = user.Requires2FA,
                    LoginTries = user.LoginTries,
                    LastLoginTryUtc = user.LastLoginTryUtc,
                    RegisteredUtc = user.RegisteredUtc,
                    LogoutUtc = user.LogoutUtc,
                    TOTPKey = user.TOTPKey,
                    PasswordFileId = null,
                    PasswordFile = null,
                    Roles = null,
                    UseLongLivedToken = user.UseLongLivedToken,
                    AllowResetPassword = user.AllowResetPassword,
                    Photo = user.Photo,
                    StorageQuota = user.StorageQuota
                };
                if (user.Roles != null)
                {
                    pgUser.Roles = new List<DbRole>();
                    foreach (var role in user.Roles)
                    {
                        pgUser.Roles.Add(new DbRole { Name = role.Name });
                    }
                }
                if (user.PasswordFile != null)
                {
                    pgUser.PasswordFile = new DbPasswordFile
                    {
                        Content = user.PasswordFile.Content,
                        LastWrittenUtc = user.PasswordFile.LastWrittenUtc
                    };
                }
                destContext.DbUsers.Add(pgUser);
            }
            destContext.SaveChanges();
            logger.LogInformation("Migrate Diaries...");
            var diaries = srcContext.DbDiaries.Include(d => d.DbUser).OrderBy(d => d.Id);
            foreach (var diary in diaries)
            {
                var pgUser = destContext.DbUsers.Single(u => u.Name == diary.DbUser.Name);
                destContext.DbDiaries.Add(new DbDiary
                {
                    DbUser = pgUser,
                    Entry = diary.Entry,
                    Date = diary.Date
                });
            }
            destContext.SaveChanges();
            logger.LogInformation("Migrate Notes...");
            var notes = srcContext.DbNotes.Include(n => n.DbUser).OrderBy(n => n.Id);
            foreach (var note in notes)
            {
                var pgUser = destContext.DbUsers.Single(u => u.Name == note.DbUser.Name);
                destContext.DbNotes.Add(new DbNote
                {
                    DbUser = pgUser,
                    Content = note.Content,
                    Title = note.Title,
                    ModifiedUtc = note.ModifiedUtc
                });
            }
            destContext.SaveChanges();
            logger.LogInformation("Migrate LoginIpAddresses...");
            var loginIpAddresses = srcContext.DbLoginIpAddresses.Include(ip => ip.DbUser).OrderBy(ip => ip.Id);
            foreach (var loginIpAddress in loginIpAddresses)
            {
                var pgUser = destContext.DbUsers.Single(u => u.Name == loginIpAddress.DbUser.Name);
                destContext.DbLoginIpAddresses.Add(new DbLoginIpAddress
                {
                    DbUser = pgUser,
                    IpAddress = loginIpAddress.IpAddress,
                    LastUsedUtc = loginIpAddress.LastUsedUtc,
                    Succeeded = loginIpAddress.Succeeded,
                    Failed = loginIpAddress.Failed
                });
            }
            destContext.SaveChanges();
            logger.LogInformation("Migrate Registrations...");
            var registrations = srcContext.DbRegistrations.Include(r => r.ConfirmedBy).OrderBy(r => r.Id);
            foreach (var registration in registrations)
            {
                DbUser pgUser = null;
                if (registration.ConfirmedBy != null)
                {
                    pgUser = destContext.DbUsers.Single(u => u.Name == registration.ConfirmedBy.Name);
                }
                destContext.DbRegistrations.Add(new DbRegistration
                {
                    ConfirmedBy = pgUser,
                    ConfirmedUtc = registration.ConfirmedUtc,
                    Email = registration.Email,
                    IpAddress = registration.IpAddress,
                    RequestedUtc = registration.RequestedUtc,
                    Token = registration.Token
                });
            }
            destContext.SaveChanges();
            logger.LogInformation("Migrate ResetPasswords...");
            var resetPasswords = srcContext.DbResetPasswords.OrderBy(r => r.Id);
            foreach (var resetPassword in resetPasswords)
            {
                destContext.DbResetPasswords.Add(new DbResetPassword
                {
                    Email = resetPassword.Email,
                    IpAddress = resetPassword.IpAddress,
                    RequestedUtc = resetPassword.RequestedUtc,
                    Token = resetPassword.Token
                });
            }
            destContext.SaveChanges();
            logger.LogInformation("Migrate Settings...");
            var settings = srcContext.DbSettings.OrderBy(s => s.Id);
            foreach (var setting in settings)
            {
                destContext.DbSettings.Add(new DbSetting
                {
                    Key = setting.Key,
                    Value = setting.Value
                });
            }
            destContext.SaveChanges();
            logger.LogInformation("Migrate SkatResults...");
            var idmap = new Dictionary<long, long>();
            var skatResults = srcContext.DbSkatResults.OrderBy(r => r.Id);
            foreach (var skatResult in skatResults)
            {
                var pgSkatResult = new DbSkatResult
                {
                    StartedUtc = skatResult.StartedUtc,
                    EndedUtc = skatResult.EndedUtc,
                    Player1 = skatResult.Player1,
                    Player2 = skatResult.Player2,
                    Player3 = skatResult.Player3,
                    Player4 = skatResult.Player4
                };
                destContext.DbSkatResults.Add(pgSkatResult);
                destContext.SaveChanges();
                idmap[skatResult.Id] = pgSkatResult.Id;
            }
            logger.LogInformation("Migrate SkatGameHistories...");
            var skatGameHistories = srcContext.DbSkatGameHistories.OrderBy(h => h.Id);
            foreach (var skatGameHistory in skatGameHistories)
            {
                var pgSkatGameHistoy = new DbSkatGameHistory
                {
                    DbSkatResultId = idmap[skatGameHistory.DbSkatResultId],
                    History = skatGameHistory.History
                };
                destContext.DbSkatGameHistories.Add(pgSkatGameHistoy);
                destContext.SaveChanges();
            }
            logger.LogInformation("Migrate TetrisHighScores...");
            var tetrisHighScores = srcContext.DbTetrisHighScore.OrderBy(h => h.Id);
            foreach (var tetrisHighScore in tetrisHighScores)
            {
                destContext.DbTetrisHighScore.Add(new DbTetrisHighScore
                {
                    Created = tetrisHighScore.Created,
                    Level = tetrisHighScore.Level,
                    Lines = tetrisHighScore.Lines,
                    Name = tetrisHighScore.Name,
                    Score = tetrisHighScore.Score
                });
            }
            destContext.SaveChanges();
            logger.LogInformation("Migrate UserSkatResults...");
            var skatUsers = destContext.DbUsers.ToList();
            foreach (var skatUser in skatUsers)
            {
                MigrateSkatUserResults(destContext, skatUser.Name, skatUser.Id);
            }
            logger.LogInformation("Migrate SkatReservations...");
            var reservations = srcContext.DbSkatReservations.Include(r => r.ReservedBy).OrderBy(r => r.Id);
            foreach (var reservation in reservations)
            {
                DbUser pgUser = null;
                if (reservation.ReservedBy != null)
                {
                    pgUser = destContext.DbUsers.Single(u => u.Name == reservation.ReservedBy.Name);
                }
                destContext.DbSkatReservations.Add(new DbSkatReservation
                {
                    Duration = reservation.Duration,
                    Player1 = reservation.Player1,
                    Player2 = reservation.Player2,
                    Player3 = reservation.Player3,
                    Player4 = reservation.Player4,
                    ReservedBy = pgUser,
                    ReservedUtc = reservation.ReservedUtc,
                    EndUtc = reservation.EndUtc
                });
            }
            destContext.SaveChanges();
            logger.LogInformation("Migrate DocItems...");
            var pgAllUsers = destContext.DbUsers.ToList();
            foreach (var pgUser in pgAllUsers)
            {
                var sqliteUser = srcContext.DbUsers.SingleOrDefault(u => u.Name == pgUser.Name);
                if (sqliteUser == null) continue;
                var docItems = new Queue<DbDocItem>();
                var volume = DocumentService.GetVolume(srcContext, sqliteUser);
                if (volume != null)
                {
                    docItems.Enqueue(volume);
                }
                var idMap = new Dictionary<long, long>();
                var ids = new List<long>();
                while (docItems.Any())
                {
                    var docItem = docItems.Dequeue();
                    ids.Add(docItem.Id);
                    foreach (var child in DocumentService.GetChildren(srcContext, sqliteUser, docItem))
                    {
                        docItems.Enqueue(child);
                    }
                }
                foreach (var id in ids)
                {
                    var docItem = srcContext.DbDocItems
                        .Include(item => item.Content)
                        .Single(item => item.Id == id && item.OwnerId == sqliteUser.Id);
                    long? parentId = null;
                    if (docItem.ParentId.HasValue)
                    {
                        parentId = idMap[docItem.ParentId.Value];
                    }
                    var pgDocItem = new DbDocItem
                    {
                        Name = docItem.Name,
                        Type = docItem.Type,
                        OwnerId = pgUser.Id,
                        Size = docItem.Size,
                        Children = docItem.Children,
                        ParentId = parentId
                    };
                    if (docItem.Content != null)
                    {
                        pgDocItem.Content = new DbDocContent { Data = docItem.Content.Data };
                    }
                    destContext.DbDocItems.Add(pgDocItem);
                    destContext.SaveChanges();
                    idMap[docItem.Id] = pgDocItem.Id;
                }
            }
            logger.LogInformation("Migration succeeded.");
        }

        private static void MigrateSkatUserResults(DbMynaContext destContext, string userName, long userId)
        {
            var userSkatResults = destContext.DbSkatResults
                .Where(r => r.Player1 == userName || r.Player2 == userName || r.Player3 == userName || r.Player4 == userName)
                .Select(r => r.Id);
            if (userSkatResults.Any())
            {
                foreach (var skatResultId in userSkatResults)
                {
                    destContext.DbUserSkatResults.Add(new DbUserSkatResult { DbUserId = userId, DbSkatResultId = skatResultId });
                }
                destContext.SaveChanges();
            }
        }
    }
}
