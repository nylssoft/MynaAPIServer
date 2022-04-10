/*
    Myna API Server
    Copyright (C) 2021-2022 Niels Stockfleth

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
using System;

namespace APIServer.Chess.Core
{
    public enum FigureType { King, Queen, Rook, Knight, Bishop, Pawn };

    public enum FigureColor { White, Black };

    public class Figure
    {
        public Figure(FigureType t, FigureColor c, int row = -1, int col = -1)
        {
            Type = t;
            Color = c;
            Row = row;
            Column = col;
            MoveCount = 0;
            AllowCastlingKingSide = t == FigureType.King;
            AllowCastlingQueenSide = AllowCastlingKingSide;
        }

        public Figure(Figure f)
        {
            Type = f.Type;
            Color = f.Color;
            Row = f.Row;
            Column = f.Column;
            MoveCount = f.MoveCount;
            AllowCastlingKingSide = f.AllowCastlingKingSide;
            AllowCastlingQueenSide = f.AllowCastlingQueenSide;
        }

        public FigureType Type { get; set; }

        public FigureColor Color { get; }

        public int Row { get; set; } = -1;

        public int Column { get; set; } = -1;

        public int MoveCount { get; set; } = 0;

        public bool AllowCastlingKingSide { get; set; } = false;

        public bool AllowCastlingQueenSide { get; set; } = false;

        public override string ToString()
        {
            string f = Type switch
            {
                FigureType.Pawn => "P",
                FigureType.Rook => "R",
                FigureType.Knight => "N",
                FigureType.Bishop => "B",
                FigureType.Queen => "Q",
                FigureType.King => "K",
                _ => throw new ArgumentException("Invalid figure type")
            };
            var c = Color == FigureColor.White ? "W" : "B";
            return $"{f}{c}";
        }
    }
}
