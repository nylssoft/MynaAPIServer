/*
    Myna API Server
    Copyright (C) 2020-2021 Niels Stockfleth

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
    public class Program
    {
        public static void Main(string[] args)
        {
            var host = CreateHostBuilder(args).Build();
            var migrateSqlite2Postgres = args.Length > 0 && string.Equals(args[0], "--sqlite2postgres", StringComparison.InvariantCultureIgnoreCase);
            MigrateDatabase(host, migrateSqlite2Postgres);
            host.Run();
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .ConfigureWebHostDefaults(webBuilder =>
                {
                    webBuilder.UseStartup<Startup>();
                });

        private static void MigrateDatabase(IHost host, bool migrateSqlite2Postgres)
        {
            using var scope = host.Services.CreateScope();
            var services = scope.ServiceProvider;
            var logger = services.GetRequiredService<ILogger<Program>>();
            try
            {
                var pwdman = services.GetRequiredService<IPwdManService>();
                var dbContext = pwdman.GetDbContext();
                dbContext.Database.Migrate();
                if (migrateSqlite2Postgres)
                {
                    if (dbContext is DbPostgresContext)
                    {
                        MigrateSqlite2Postgres(host, logger);
                    }
                    else
                    {
                        logger.LogWarning("Migration is only allowed if Postgres is used as database connection.");
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "An error occurred creating the DB.");
            }
        }

        private static void MigrateSqlite2Postgres(IHost host, ILogger logger)
        {
            logger.LogInformation("Migrate SQLite database to Postgres database.");
            using var scope = host.Services.CreateScope();
            var services = scope.ServiceProvider;
            var postgres = services.GetRequiredService<DbPostgresContext>();
            if (postgres.DbUsers.Any())
            {
                logger.LogWarning("Postgres database already contains users. Migration aborted.");
                return;
            }
            var sqlite = services.GetRequiredService<DbSqliteContext>();
            logger.LogInformation("Migrate Users...");
            var users = sqlite.DbUsers.Include(u => u.Roles).Include(u => u.PasswordFile).OrderBy(u => u.Id);
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
                    Photo = user.Photo
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
                postgres.DbUsers.Add(pgUser);
            }
            postgres.SaveChanges();
            logger.LogInformation("Migrate Chats...");
            var chats = sqlite.DbChats.Include(c => c.DbUser).OrderBy(c => c.Id);
            foreach (var chat in chats)
            {
                var pgUser = postgres.DbUsers.Single(u => u.Name == chat.DbUser.Name);
                postgres.DbChats.Add(new DbChat
                {
                    DbUser = pgUser,
                    Message = chat.Message,
                    CreatedUtc = chat.CreatedUtc
                });
            }
            postgres.SaveChanges();
            logger.LogInformation("Migrate Diaries...");
            var diaries = sqlite.DbDiaries.Include(d => d.DbUser).OrderBy(d => d.Id);
            foreach (var diary in diaries)
            {
                var pgUser = postgres.DbUsers.Single(u => u.Name == diary.DbUser.Name);
                postgres.DbDiaries.Add(new DbDiary
                {
                    DbUser = pgUser,
                    Entry = diary.Entry,
                    Date = diary.Date                    
                });
            }
            postgres.SaveChanges();
            logger.LogInformation("Migrate Notes...");
            var notes = sqlite.DbNotes.Include(n => n.DbUser).OrderBy(n => n.Id);
            foreach (var note in notes)
            {
                var pgUser = postgres.DbUsers.Single(u => u.Name == note.DbUser.Name);
                postgres.DbNotes.Add(new DbNote
                {
                    DbUser = pgUser,
                    Content = note.Content,
                    Title = note.Title,
                    ModifiedUtc = note.ModifiedUtc
                });
            }
            postgres.SaveChanges();
            logger.LogInformation("Migrate LoginIpAddresses...");
            var loginIpAddresses = sqlite.DbLoginIpAddresses.Include(ip => ip.DbUser).OrderBy(ip => ip.Id);
            foreach (var loginIpAddress in loginIpAddresses)
            {
                var pgUser = postgres.DbUsers.Single(u => u.Name == loginIpAddress.DbUser.Name);
                postgres.DbLoginIpAddresses.Add(new DbLoginIpAddress
                {
                    DbUser = pgUser,
                    IpAddress = loginIpAddress.IpAddress,
                    LastUsedUtc = loginIpAddress.LastUsedUtc,
                    Succeeded = loginIpAddress.Succeeded,
                    Failed = loginIpAddress.Failed                    
                });
            }
            postgres.SaveChanges();
            logger.LogInformation("Migrate Registrations...");
            var registrations = sqlite.DbRegistrations.Include(r => r.ConfirmedBy).OrderBy(r => r.Id);
            foreach (var registration in registrations)
            {
                DbUser pgUser = null;
                if (registration.ConfirmedBy != null)
                {
                    pgUser = postgres.DbUsers.Single(u => u.Name == registration.ConfirmedBy.Name);
                }
                postgres.DbRegistrations.Add(new DbRegistration
                {
                    ConfirmedBy = pgUser,
                    ConfirmedUtc = registration.ConfirmedUtc,
                    Email = registration.Email,
                    IpAddress = registration.IpAddress,
                    RequestedUtc = registration.RequestedUtc,
                    Token = registration.Token                    
                });
            }
            postgres.SaveChanges();
            logger.LogInformation("Migrate ResetPasswords...");
            var resetPasswords = sqlite.DbResetPasswords.OrderBy(r => r.Id);
            foreach (var resetPassword in resetPasswords)
            {
                postgres.DbResetPasswords.Add(new DbResetPassword
                {
                    Email = resetPassword.Email,
                    IpAddress = resetPassword.IpAddress,
                    RequestedUtc = resetPassword.RequestedUtc,
                    Token = resetPassword.Token
                });
            }
            postgres.SaveChanges();
            logger.LogInformation("Migrate Settings...");
            var settings = sqlite.DbSettings.OrderBy(s => s.Id);
            foreach (var setting in settings)
            {
                postgres.DbSettings.Add(new DbSetting
                {
                    Key = setting.Key,
                    Value = setting.Value
                });
            }
            postgres.SaveChanges();
            logger.LogInformation("Migrate SkatResults...");
            var idmap = new Dictionary<long, long>();
            var skatResults = sqlite.DbSkatResults.OrderBy(r => r.Id);
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
                postgres.DbSkatResults.Add(pgSkatResult);
                postgres.SaveChanges();
                idmap[skatResult.Id] = pgSkatResult.Id;
            }
            logger.LogInformation("Migrate SkatGameHistories...");
            var skatGameHistories = sqlite.DbSkatGameHistories.OrderBy(h => h.Id);
            foreach (var skatGameHistory in skatGameHistories)
            {
                var pgSkatGameHistoy = new DbSkatGameHistory
                {
                    DbSkatResultId = idmap[skatGameHistory.DbSkatResultId],
                    History = skatGameHistory.History
                };
                postgres.DbSkatGameHistories.Add(pgSkatGameHistoy);
                postgres.SaveChanges();
            }
            logger.LogInformation("Migrate TetrisHighScores...");
            var tetrisHighScores = sqlite.DbTetrisHighScore.OrderBy(h => h.Id);
            foreach (var tetrisHighScore in tetrisHighScores)
            {
                postgres.DbTetrisHighScore.Add(new DbTetrisHighScore
                {
                    Created = tetrisHighScore.Created,
                    Level = tetrisHighScore.Level,
                    Lines = tetrisHighScore.Lines,
                    Name = tetrisHighScore.Name,
                    Score = tetrisHighScore.Score
                });
            }
            postgres.SaveChanges();
            logger.LogInformation("Migrate UserSkatResults...");
            var skatUsers = postgres.DbUsers.ToList();
            foreach (var skatUser in skatUsers)
            {
                MigrateSkatUserResults(postgres, skatUser.Name, skatUser.Id);
            }
            logger.LogInformation("Migration succeeded.");
        }

        private static void MigrateSkatUserResults(DbPostgresContext postgres, string userName, long userId)
        {
            var userSkatResults = postgres.DbSkatResults
                .Where(r => r.Player1 == userName || r.Player2 == userName || r.Player3 == userName || r.Player4 == userName)
                .Select(r => r.Id);
            if (userSkatResults.Any())
            {
                foreach (var skatResultId in userSkatResults)
                {
                    postgres.DbUserSkatResults.Add(new DbUserSkatResult { DbUserId = userId, DbSkatResultId = skatResultId });
                }
                postgres.SaveChanges();
            }
        }
    }
}
