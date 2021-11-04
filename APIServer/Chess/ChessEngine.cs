/*
    Myna API Server
    Copyright (C) 2021 Niels Stockfleth

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
using Microsoft.Extensions.Logging;
using System;
using System.Diagnostics;
using System.IO;

namespace APIServer.Chess
{
    public class ChessEngine
    {
        private Process engineProcess;

        private StreamWriter engineStream;

        private MoveCompletedCallBack moveCompleted;

        private ILogger logger;

        public int Level { get; set; } = 1;

        public delegate void MoveCompletedCallBack(int fromRow, int fromColumn, int toRow, int toColumn);

        public ChessEngine(string fileName, MoveCompletedCallBack callback, ILogger logger)
        {
            moveCompleted = callback;
            this.logger = logger;
            InitEngine(fileName);
        }

        public void StartNewGame(bool playWhite)
        {
            Send("new");
            Send($"sd {Level}");
            if (playWhite)
            {
                Send("playother");
                Send("go");
            }
        }

        public void MoveUserFigure(int fromRow, int fromColumn, int toRow, int toColumn)
        {
            Send($"usermove {GetTextPosition(fromRow, fromColumn)}{GetTextPosition(toRow, toColumn)}");
        }

        public void Quit()
        {
            Send("quit");
            // @TODO:
            // delayed verification that the process has terminated
            // if not kill the process
        }

        private void Send(string cmd)
        {
            logger.LogDebug("PLAYER: {cmd}", cmd);
            engineStream.WriteLine(cmd);
        }

        private void InitEngine(string fileName)
        {
            engineProcess = new Process();
            engineProcess.StartInfo.FileName = fileName;
            engineProcess.StartInfo.WorkingDirectory = Path.GetDirectoryName(fileName);
            engineProcess.StartInfo.CreateNoWindow = true;
            engineProcess.StartInfo.UseShellExecute = false;
            engineProcess.StartInfo.RedirectStandardInput = true;
            engineProcess.StartInfo.RedirectStandardOutput = true;
            engineProcess.OutputDataReceived += new DataReceivedEventHandler(OnOutputReceived);
            engineProcess.ErrorDataReceived += new DataReceivedEventHandler(OnErrorReceived);
            engineProcess.Start();
            engineStream = engineProcess.StandardInput;
            engineStream.AutoFlush = true;
            engineProcess.BeginOutputReadLine();
            // @TODO
            // use xboard interface by now (uci might be supported in future versions)
            Send("xboard");
        }

        private void OnOutputReceived(object sender, DataReceivedEventArgs e)
        {
            logger.LogDebug("ENGINE: {data}", e.Data);
            if (!string.IsNullOrEmpty(e.Data) && e.Data.StartsWith("move "))
            {
                var posTxt = e.Data[5..];
                if (posTxt.Length == 4)
                {
                    var from = GetRowColumnPosition(posTxt[..2]);
                    var to = GetRowColumnPosition(posTxt[2..]);
                    moveCompleted(from.Item1, from.Item2, to.Item1, to.Item2);
                }
            }
        }

        private void OnErrorReceived(object sendingProcess, DataReceivedEventArgs e)
        {
            logger.LogError("ENGINE ERROR: {data}", e.Data);
        }

        private static string GetTextPosition(int row, int column)
        {
            return $"{Convert.ToChar(Convert.ToInt32('a') + column)}{row + 1}";
        }

        private static (int, int) GetRowColumnPosition(string pos)
        {
            return (pos[1] - '1', pos[0] - 'a');
        }
    }
}
