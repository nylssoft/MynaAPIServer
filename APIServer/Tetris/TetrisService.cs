/*
    Myna API Server
    Copyright (C) 2020 Niels Stockfleth

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
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace APIServer.Tetris
{
    public class TetrisService : ITetrisService
    {
        public IConfiguration Configuration { get; }

        private readonly ILogger logger;

        private List<HighScore> highScores = new List<HighScore>();

        private readonly object mutex = new object();

        public TetrisService(
            IConfiguration configuration,
            ILogger<TetrisService> logger,
            IHostApplicationLifetime appLifetime)
        {
            Configuration = configuration;
            this.logger = logger;
            appLifetime.ApplicationStarted.Register(OnStarted);
            appLifetime.ApplicationStopped.Register(OnStopped);
        }

        public List<HighScore> GetHighScores()
        {
            lock (mutex)
            {
                var ret = new List<HighScore>();
                foreach (var h in highScores)
                {
                    ret.Add(new HighScore(h));
                }
                return ret;
            }
        }

        public bool AddHighScore(HighScore highScore)
        {
            lock (mutex)
            {
                if (highScore == null ||
                    highScore.Name == null || 
                    highScore.Name.Length == 0 ||
                    highScore.Name.Length > 10 ||
                    highScore.Score <= 0 ||
                    highScore.Lines <= 0 ||
                    highScore.Level < 0)
                {
                    return false;
                }
                if (highScores.Count == 10)
                {
                    highScores.RemoveAt(9);
                }
                highScores.Add(highScore);
                highScores.Sort((a,b) => b.Score.CompareTo(a.Score));
            }
            return true;
        }

        // --- private

        private TetrisOptions GetOptions()
        {
            var opt = Configuration.GetSection("Tetris").Get<TetrisOptions>();
            return opt ?? new TetrisOptions();
        }

        // --- application life time events

        private const string highScoreFilename = "highScore.txt";

        private void OnStarted()
        {
            try
            {
                var opt = GetOptions();
                if (!string.IsNullOrEmpty(opt.DataDirectoy) && Directory.Exists(opt.DataDirectoy))
                {
                    var fn = Path.Combine(opt.DataDirectoy, highScoreFilename);
                    if (File.Exists(fn))
                    {
                        logger.LogInformation("Read high scores.");
                        highScores.AddRange(
                            JsonSerializer.Deserialize<List<HighScore>>(
                                File.ReadAllText(fn)));
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to high scores.");
            }
        }

        private void OnStopped()
        {
            try
            {
                var opt = GetOptions();
                if (!string.IsNullOrEmpty(opt.DataDirectoy) && Directory.Exists(opt.DataDirectoy))
                {
                    logger.LogInformation("Write high scores.");
                    File.WriteAllText(
                        Path.Combine(opt.DataDirectoy, highScoreFilename),
                        JsonSerializer.Serialize(highScores));
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to write high scores.");
            }
        }

    }
}
