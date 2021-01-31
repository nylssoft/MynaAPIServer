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
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;

namespace APIServer.Tetris
{
    public class TetrisService : ITetrisService
    {
        private readonly DbSqliteContext dbSqliteContext;
        private readonly DbPostgresContext dbPostgresContext;
        private readonly IConfiguration Configuration;

        public TetrisService(
            IConfiguration configuration,
            DbSqliteContext dbSqliteContext,
            DbPostgresContext dbPostgresContext)
        {
            Configuration = configuration;
            this.dbSqliteContext = dbSqliteContext;
            this.dbPostgresContext = dbPostgresContext;
        }

        public List<HighScore> GetHighScores()
        {
            var ret = new List<HighScore>();
            var dbContext = GetDbContext();
            var highScores = dbContext.DbTetrisHighScore.OrderByDescending(sc => sc.Score);            
            foreach (var hs in highScores)
            {
                ret.Add(new HighScore
                {
                    Name = hs.Name,
                    Created = DbMynaContext.GetUtcDateTime(hs.Created).Value,
                    Level = hs.Level,
                    Lines = hs.Lines,
                    Score = hs.Score
                });
                if (ret.Count >= 10)
                {
                    break;
                }
            }
            return ret;
        }

        public bool AddHighScore(HighScore highScore)
        {
            if (highScore == null ||
                highScore.Name == null || 
                highScore.Name.Length == 0 ||
                highScore.Name.Length > Limits.MAX_HIGHSCORE_NAME ||
                highScore.Score <= 0 ||
                highScore.Lines <= 0 ||
                highScore.Level < 0)
            {
                return false;
            }
            if (highScore.Lines / 10 != highScore.Level)
            {
                return false;
            }
            var dbContext = GetDbContext();
            var highScores = dbContext.DbTetrisHighScore.OrderByDescending(sc => sc.Score).ToList();
            if (highScores.Count >= 10)
            {
                if (highScores[9].Score >= highScore.Score)
                {
                    return false;
                }
            }
            var h = new DbTetrisHighScore
            {
                Created = DateTime.UtcNow,
                Name = highScore.Name,
                Level = highScore.Level,
                Lines = highScore.Lines,
                Score = highScore.Score
            };
            dbContext.DbTetrisHighScore.Add(h);
            dbContext.SaveChanges();
            return true;
        }

        // --- private

        private DbMynaContext GetDbContext()
        {
            var connectionType = Configuration.GetValue<string>("ConnectionType");
            return connectionType == "Postgres" ? dbPostgresContext : dbSqliteContext;
        }

    }
}
