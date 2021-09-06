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
using System.Collections.Generic;

namespace APIServer.Chess.Model
{
    public class BoardModel
    {
        public List<FigureModel> Figures { get; set; }

        public string WhitePlayer { get; set; }

        public string BlackPlayer { get; set; }

        public bool GameStarted { get; set; }

        public string GameOption { get; set; }

        public bool NextGameRequested { get; set; }

        public string CurrentColor { get; set; }

        public bool Check { get; set; }

        public bool CheckMate { get; set; }

        public bool StaleMate { get; set; }

        public bool TimeOut { get; set; }

        public bool KingStrike { get; set; }

        public bool GiveUp { get; set; }

        public bool GameOver { get; set; }

        public string Winner { get; set; }

        public List<MoveModel> LastMoves { get; set; }

        public FigureModel LastStroke { get; set; }
    }
}
