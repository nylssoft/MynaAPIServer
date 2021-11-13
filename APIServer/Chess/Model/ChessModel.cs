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
    public class ChessModel
    {
        public StateModel State { get; set; }

        public List<UserModel> AllUsers { get; set; }

        public UserModel CurrentUser { get; set; }

        public BoardModel Board { get; set; }

        public bool IsBoardFull { get; set; } = false;

        public bool IsComputerGame { get; set; } = false;

        public bool CanPlayAgainstComputer { get; set; } = false;

        public List<string> ChessEngineNames { get; set; } = new List<string>();
    }
}
