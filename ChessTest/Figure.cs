using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ChessTest
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
            Col = col;
            MoveCount = 0;
            AllowCastlingKingSide = t == FigureType.King;
            AllowCastlingQueenSide = AllowCastlingKingSide;
        }

        public Figure(Figure f)
        {
            Type = f.Type;
            Color = f.Color;
            Row = f.Row;
            Col = f.Col;
            MoveCount = f.MoveCount;
            AllowCastlingKingSide = f.AllowCastlingKingSide;
            AllowCastlingQueenSide = f.AllowCastlingQueenSide;
        }

        public FigureType Type { get; set; }

        public FigureColor Color { get; }

        public int Row { get; set; } = -1;

        public int Col { get; set; } = -1;

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
                _ => throw new ArgumentException("Invalid figure type"),
            };
            var c = Color == FigureColor.White ? "W" : "B";
            return $"{f}{c}";
        }
    }
}
