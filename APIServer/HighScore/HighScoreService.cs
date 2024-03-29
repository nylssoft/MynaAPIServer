/*
    Myna API Server
    Copyright (C) 2020-2023 Niels Stockfleth

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
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;

namespace APIServer.HighScore
{
    public class HighScoreService : IHighScoreService
    {
        private readonly DbSqliteContext dbSqliteContext;
        private readonly DbPostgresContext dbPostgresContext;
        private readonly IConfiguration Configuration;

        public HighScoreService(
            IConfiguration configuration,
            DbSqliteContext dbSqliteContext,
            DbPostgresContext dbPostgresContext)
        {
            Configuration = configuration;
            this.dbSqliteContext = dbSqliteContext;
            this.dbPostgresContext = dbPostgresContext;
        }

        public List<HighScore> GetHighScores(string game)
        {
            var opt = GetOptions();
            var ret = new List<HighScore>();
            var del = new List<DbHighScore>();
            var dbContext = GetDbContext();
            var highScores = dbContext.DbHighScores.Where(h => h.Game == game).OrderByDescending(sc => sc.Score);
            foreach (var hs in highScores)
            {
                var highScore = new HighScore
                {
                    Name = hs.Name,
                    Created = DbMynaContext.GetUtcDateTime(hs.Created).Value,
                    Level = hs.Level,
                    Lines = hs.Lines,
                    Score = hs.Score
                };
                var diff = DateTime.UtcNow - highScore.Created;
                if (diff.TotalDays > opt.Keep)
                {
                    del.Add(hs);
                    continue;
                }
                ret.Add(highScore);
                if (ret.Count >= 10)
                {
                    break;
                }
            }
            if (del.Any())
            {
                dbContext.DbHighScores.RemoveRange(del);
                dbContext.SaveChanges();
            }
            return ret;
        }

        public bool AddHighScore(string game, HighScore highScore)
        {
            if (highScore == null ||
                game != IHighScoreService.TETRIS && game != IHighScoreService.ARKANOID && game != IHighScoreService.TSTETRIS ||
                highScore.Name == null ||
                highScore.Name.Length == 0 ||
                highScore.Name.Length > Limits.MAX_HIGHSCORE_NAME ||
                highScore.Score <= 0 ||
                highScore.Level < 0)
            {
                return false;
            }
            if (game == IHighScoreService.TETRIS)
            {
                if (highScore.Lines <= 0 ||
                    highScore.Lines / 10 != highScore.Level)
                {
                    return false;
                }
            }
            var dbContext = GetDbContext();
            var highScores = dbContext.DbHighScores.Where(h => h.Game == game).OrderByDescending(sc => sc.Score).ToList();
            if (highScores.Count >= 10)
            {
                // avoid too many rows, it's just a game...
                if (highScores.Count > 1000)
                {
                    return false;
                }
                if (highScores[9].Score >= highScore.Score)
                {
                    return false;
                }
            }
            var h = new DbHighScore
            {
                Created = DateTime.UtcNow,
                Game = game,
                Name = highScore.Name,
                Level = highScore.Level,
                Lines = highScore.Lines,
                Score = highScore.Score
            };
            dbContext.DbHighScores.Add(h);
            dbContext.SaveChanges();
            return true;
        }

        // --- private

        private HighScoreOptions GetOptions()
        {
            var opt = Configuration.GetSection("HighScore").Get<HighScoreOptions>();
            return opt ?? new HighScoreOptions();
        }

        private DbMynaContext GetDbContext()
        {
            var connectionType = Configuration.GetValue<string>("ConnectionType");
            return connectionType == "Postgres" ? dbPostgresContext : dbSqliteContext;
        }

    }
}
