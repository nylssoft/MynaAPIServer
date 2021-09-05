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
using System;
using System.Collections.Generic;

namespace APIServer.Chess.Core
{
    public enum GameOption { FastChess, Chess15, Chess30, Chess60 };

    public class Chessboard
    {
        // --- enums

        private enum MoveResult { NotPossible, Free, Opponent };

        // --- properties

        public string WhitePlayer { get; set; }

        public string BlackPlayer { get; set; }

        public FigureColor CurrentColor { get; set; }

        public string CurrentPlayer
        {
            get
            {
                return CurrentColor == FigureColor.White ? WhitePlayer : BlackPlayer;
            }
        }

        public Figure LastMovedFigure { get; set; }

        public (int,int) LastMovedDestination { get; set; }

        public Figure LastStrokeFigure { get; set; }

        public bool Check { get; set; }

        public bool CheckMate { get; set; }

        public bool StaleMate { get; set; }

        public bool TimeOut { get; set; }

        public bool KingStrike { get; set; }

        public FigureColor? Winner { get; set; }

        public DateTime ClockStartedUtc { get; set; }

        public long WhiteClock { get; set; }

        public long BlackClock { get; set; }

        public bool GameOver
        {
            get
            {
                return CheckMate || StaleMate || TimeOut || KingStrike;
            }
        }

        public bool GameStarted
        {
            get
            {
                return gameStarted;
            }
            set
            {
                gameStarted = value;
                if (gameStarted)
                {
                    ClockStartedUtc = DateTime.UtcNow;
                }
            }
        }

        public bool NextGameRequested { get; set; }

        public GameOption GameOption { get; set; }

        // --- members

        private readonly Figure[,] board = new Figure[8, 8];

        private Figure enpassentFigure;

        private bool gameStarted;

        // --- constructors

        public Chessboard(string whitePlayer, string blackPlayer, GameOption gameOption)
        {
            Init(FigureColor.White);
            Init(FigureColor.Black);
            WhitePlayer = whitePlayer;
            BlackPlayer = blackPlayer;
            CurrentColor = FigureColor.White;
            enpassentFigure = null;
            Check = false;
            CheckMate = false;
            StaleMate = false;
            TimeOut = false;
            KingStrike = false;
            Winner = null;
            GameStarted = false;
            GameOption = gameOption;
            int clock = gameOption switch
            {
                GameOption.FastChess => 5 * 60 * 1000,
                GameOption.Chess15 => 15 * 60 * 1000,
                GameOption.Chess30 => 30 * 60 * 1000,
                GameOption.Chess60 => 60 * 60 * 1000,
                _ => throw new ArgumentException("Invalid game option")
            };
            WhiteClock = clock;
            BlackClock = clock;
            NextGameRequested = false;
        }

        private Chessboard(Chessboard b)
        {
            WhitePlayer = b.WhitePlayer;
            BlackPlayer = b.BlackPlayer;
            CurrentColor = b.CurrentColor;
            Check = b.Check;
            CheckMate = b.CheckMate;
            StaleMate = b.StaleMate;
            TimeOut = b.TimeOut;
            KingStrike = b.KingStrike;
            Winner = b.Winner;
            ClockStartedUtc = b.ClockStartedUtc;
            WhiteClock = b.WhiteClock;
            BlackClock = b.BlackClock;
            GameStarted = b.GameStarted;
            GameOption = b.GameOption;
            NextGameRequested = b.NextGameRequested;
            // deep copy of board figures
            for (int r = 0; r <= 7; r++)
            {
                for (int c = 0; c <= 7; c++)
                {
                    Figure f = b.board[r, c];
                    if (f != null)
                    {
                        board[r, c] = new Figure(f);
                    }
                }
            }
            if (b.enpassentFigure != null)
            {
                enpassentFigure = new Figure(b.enpassentFigure);
            }
            if (b.LastMovedFigure != null)
            {
                LastMovedFigure = new Figure(b.LastMovedFigure);
            }
            if (b.LastStrokeFigure != null)
            {
                LastStrokeFigure = new Figure(b.LastStrokeFigure);
            }
            LastMovedDestination = b.LastMovedDestination;
        }

        // --- static methods

        public static FigureColor GetOpponentColor(FigureColor color)
        {
            return color == FigureColor.White ? FigureColor.Black : FigureColor.White;
        }

        public static bool IsValidPosition(int row, int col)
        {
            return row >= 0 && row <= 7 && col >= 0 && col <= 7;
        }

        // --- public methods

        public List<Figure> GetAllFigures()
        {
            var ret = new List<Figure>();
            for (var r = 0; r <= 7; r++)
            {
                for (var c = 0; c <= 7; c++)
                {
                    var f = Get(r, c);
                    if (f != null)
                    {
                        ret.Add(f);
                    }
                }
            }
            return ret;
        }

        public Figure Get(int row, int col)
        {
            if (IsValidPosition(row, col))
            {
                return board[row, col];
            }
            return null;
        }

        public List<(int,int)> GetAllMoves(Figure figure, bool check)
        {
            var ret = new List<(int, int)>();
            if (!GameOver && GameStarted)
            {
                foreach (var move in GetMoves(figure, filterCheck: GameOption != GameOption.FastChess))
                {
                    if (check &&
                        figure.Type == FigureType.King &&
                        move.Item1 == figure.Row &&
                        Math.Abs(move.Item2 - figure.Column) == 2)
                    {
                        // castling is not allowed if in check
                        continue;
                    }
                    ret.Add(move);
                }
            }
            return ret;
        }

        public bool Place(Figure f, int row, int col, FigureType pawnReplacement = FigureType.Queen)
        {
            if (GameOver || !GameStarted ||
                !IsValidPosition(row, col) ||
                f == null ||
                f.Color != CurrentColor ||
                !IsValidPosition(f.Row, f.Column))
            {
                return false; // invalid, no change
            }
            LastStrokeFigure = null;
            // disallow castling
            if (f.Type == FigureType.Rook && f.MoveCount == 0)
            {
                var king = GetKing(f.Color);
                if (king != null)
                {
                    if (f.Column == 7)
                    {
                        king.AllowCastlingKingSide = false;
                    }
                    else if (f.Column == 0)
                    {
                        king.AllowCastlingQueenSide = false;
                    }
                }
            }
            // castling
            if (f.Type == FigureType.King && Math.Abs(f.Column - col) == 2)
            {
                // king size
                if (col > f.Column)
                {
                    var rook = Get(f.Row, 7);
                    if (rook != null)
                    {
                        board[f.Row, 7] = null;
                        board[f.Row, f.Column + 1] = rook;
                        rook.Column = f.Column + 1;
                    }
                }
                // queen size
                else
                {
                    var rook = Get(f.Row, 0);
                    if (rook != null)
                    {
                        board[f.Row, 0] = null;
                        board[f.Row, f.Column - 1] = rook;
                        rook.Column = f.Column - 1;
                    }
                }
            }
            if (f.Type == FigureType.Pawn)
            {
                // enpassent strike
                var dir = f.Color == FigureColor.White ? 1 : -1;
                if (enpassentFigure != null &&
                    f.Color != enpassentFigure.Color &&
                    row == enpassentFigure.Row + dir &&
                    col == enpassentFigure.Column)
                {
                    LastStrokeFigure = new Figure(enpassentFigure);
                    board[enpassentFigure.Row, enpassentFigure.Column] = null;
                    enpassentFigure.Column = -1;
                    enpassentFigure.Row = -1;
                }
                // pawn replacement
                if (f.Color == FigureColor.White && row == 7 ||
                    f.Color == FigureColor.Black && row == 0)
                {
                    f.Type = pawnReplacement;
                }
            }
            board[f.Row, f.Column] = null;
            if (f.Type == FigureType.Pawn &&
                (f.Row == 6 && f.Color == FigureColor.Black && row == 4 ||
                f.Row == 1 && f.Color == FigureColor.White && row == 3))
            {
                enpassentFigure = f;
            }
            else
            {
                enpassentFigure = null;
            }
            var strike = Get(row, col);
            if (strike != null)
            {
                LastStrokeFigure = new Figure(strike);
                strike.Row = -1;
                strike.Column = -1;
                if (strike.Type == FigureType.King)
                {
                    KingStrike = true;
                    Winner = f.Color;
                }
            }
            LastMovedFigure = new Figure(f);
            LastMovedDestination = (row, col);
            f.Row = row;
            f.Column = col;
            board[f.Row, f.Column] = f;
            f.MoveCount += 1;
            UpdateClocks();
            CurrentColor = GetOpponentColor(CurrentColor);
            return true;
        }

        public void UpdateClocks()
        {
            if (!GameOver && GameStarted)
            {
                var diff = Convert.ToInt32((DateTime.UtcNow - ClockStartedUtc).TotalMilliseconds);
                if (CurrentColor == FigureColor.White)
                {
                    WhiteClock = Math.Max(0, WhiteClock - diff);
                }
                else
                {
                    BlackClock = Math.Max(0, BlackClock - diff);
                }
                if (WhiteClock == 0 || BlackClock == 0)
                {
                    TimeOut = true;
                    Winner = WhiteClock == 0 ? FigureColor.Black : FigureColor.White;
                }
                ClockStartedUtc = DateTime.UtcNow;
            }
        }

        public void UpdateState()
        {
            if (!GameOver && GameStarted)
            {
                UpdateCheckMate(CurrentColor);
                if (!CheckMate)
                {
                    UpdateStaleMate(CurrentColor);
                }
            }
        }

        // --- private methods

        private void Init(FigureColor c)
        {
            var r1 = c == FigureColor.White ? 1 : 6;
            var r2 = c == FigureColor.White ? r1 - 1 : r1 + 1;
            for (var col = 0; col < 8; col++)
            {
                Create(FigureType.Pawn, c, r1, col);
            }
            Create(FigureType.Rook, c, r2, 0);
            Create(FigureType.Rook, c, r2, 7);
            Create(FigureType.Knight, c, r2, 1);
            Create(FigureType.Knight, c, r2, 6);
            Create(FigureType.Bishop, c, r2, 2);
            Create(FigureType.Bishop, c, r2, 5);
            Create(FigureType.Queen, c, r2, 3);
            Create(FigureType.King, c, r2, 4);
        }

        private void Create(FigureType t, FigureColor c, int row, int col)
        {
            board[row, col] = new Figure(t, c, row, col);
        }

        private bool IsFree(int row, int col)
        {
            if (IsValidPosition(row, col))
            {
                return board[row, col] == null;
            }
            return false;
        }

        private void UpdateStaleMate(FigureColor color)
        {
            // find any figures that can move
            foreach (var figure in GetAll(color))
            {
                if (GetMoves(figure, filterCheck: true).Count > 0)
                {
                    return;
                }
            }
            // no moves possible, stale mate
            StaleMate = true;
        }

        private void UpdateCheckMate(FigureColor color)
        {
            // if king is in check
            Check = IsCheck(color);
            if (Check)
            {
                // if king cannot move anymore
                var kingMoves = GetMoves(GetKing(color), filterCheck: true);
                if (kingMoves.Count == 0)
                {
                    // simulate if any other move will break the check
                    foreach (var figure in GetAll(color))
                    {
                        var moves = GetMoves(figure, filterCheck: true);
                        if (moves.Count > 0)
                        {
                            return;
                        }
                    }
                    // no move breaks the check, checkmate
                    Winner = GetOpponentColor(color);
                    CheckMate = true;
                }
            }
        }

        private bool IsCheck(FigureColor color)
        {
            var king = GetKing(color);
            if (king != null)
            {
                // get all figures of the opponent
                foreach (var oppFigure in GetAll(GetOpponentColor(color)))
                {
                    // check whether any figure move can strike the king
                    foreach (var oppPt in GetMoves(oppFigure, strikeOnly: true))
                    {
                        if (oppPt.Item1 == king.Row && oppPt.Item2 == king.Column)
                        {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        private List<(int, int)> GetMoves(Figure f, bool strikeOnly = false, bool filterCheck = false)
        {
            List<(int, int)> moves = f.Type switch
            {
                FigureType.Pawn => GetPawnMoves(f),
                FigureType.Rook => GetRookMoves(f),
                FigureType.Knight => GetKnightMoves(f),
                FigureType.Bishop => GetBishopMoves(f),
                FigureType.Queen => GetQueenMoves(f),
                FigureType.King => GetKingMoves(f),
                _ => throw new ArgumentException("Invalid figure type"),
            };
            if (strikeOnly)
            {
                return GetStrikeOnlyMoves(f, moves);
            }
            if (filterCheck)
            {
                return FilterCheckMoves(f, moves);
            }
            return moves;
        }

        private List<Figure> GetAll(FigureColor color)
        {
            var ret = new List<Figure>();
            for (var r = 0; r <= 7; r++)
            {
                for (var c = 0; c <= 7; c++)
                {
                    var f = Get(r, c);
                    if (f != null && f.Color == color)
                    {
                        ret.Add(f);
                    }
                }
            }
            return ret;
        }

        private Figure GetKing(FigureColor color)
        {
            foreach (var f in GetAll(color))
            {
                if (f.Type == FigureType.King)
                {
                    return f;
                }
            }
            return null;
        }

        private MoveResult AddMove(Figure f, int row, int col, List<(int, int)> moves)
        {
            if (IsFree(row, col))
            {
                moves.Add((row, col));
                return MoveResult.Free;
            }
            if (ContainsOpponent(f, row, col))
            {
                moves.Add((row, col));
                return MoveResult.Opponent;
            }
            return MoveResult.NotPossible;
        }

        private List<(int, int)> GetKingMoves(Figure f)
        {
            var ret = new List<(int, int)>();
            AddMove(f, f.Row + 1, f.Column, ret);
            AddMove(f, f.Row - 1, f.Column, ret);
            AddMove(f, f.Row, f.Column - 1, ret);
            AddMove(f, f.Row, f.Column + 1, ret);
            AddMove(f, f.Row - 1, f.Column - 1, ret);
            AddMove(f, f.Row - 1, f.Column + 1, ret);
            AddMove(f, f.Row + 1, f.Column + 1, ret);
            AddMove(f, f.Row + 1, f.Column - 1, ret);
            if (f.MoveCount == 0)
            {
                if (f.AllowCastlingKingSide &&
                    IsFree(f.Row, f.Column + 1) &&
                    IsFree(f.Row, f.Column + 2))
                {
                    ret.Add((f.Row, f.Column + 2));
                }
                if (f.AllowCastlingQueenSide &&
                    IsFree(f.Row, f.Column - 1) &&
                    IsFree(f.Row, f.Column - 2) &&
                    IsFree(f.Row, f.Column - 3))
                {
                    ret.Add((f.Row, f.Column - 2));
                }
            }
            return ret;
        }

        private List<(int, int)> GetQueenMoves(Figure f)
        {
            var ret = new List<(int, int)>();
            ret.AddRange(GetBishopMoves(f));
            ret.AddRange(GetRookMoves(f));
            return ret;
        }

        private List<(int, int)> GetBishopMoves(Figure f)
        {
            var ret = new List<(int, int)>();
            // up right
            var r = f.Row + 1;
            var c = f.Column + 1;
            while (r <= 7 && c <= 7)
            {
                if (AddMove(f, r, c, ret) != MoveResult.Free)
                {
                    break;
                }
                r++;
                c++;
            }
            // down left
            r = f.Row - 1;
            c = f.Column - 1;
            while (r >= 0 && c >= 0)
            {
                if (AddMove(f, r, c, ret) != MoveResult.Free)
                {
                    break;
                }
                r--;
                c--;
            }
            // up left
            r = f.Row + 1;
            c = f.Column - 1;
            while (r <= 7 && c >= 0)
            {
                if (AddMove(f, r, c, ret) != MoveResult.Free)
                {
                    break;
                }
                r++;
                c--;
            }
            // down right
            r = f.Row - 1;
            c = f.Column + 1;
            while (r >= 0 && c <= 7)
            {
                if (AddMove(f, r, c, ret) != MoveResult.Free)
                {
                    break;
                }
                r--;
                c++;
            }
            return ret;
        }

        private List<(int, int)> GetKnightMoves(Figure f)
        {
            var ret = new List<(int, int)>();
            AddMove(f, f.Row + 2, f.Column + 1, ret);
            AddMove(f, f.Row + 2, f.Column - 1, ret);
            AddMove(f, f.Row - 2, f.Column - 1, ret);
            AddMove(f, f.Row - 2, f.Column + 1, ret);
            AddMove(f, f.Row + 1, f.Column - 2, ret);
            AddMove(f, f.Row + 1, f.Column + 2, ret);
            AddMove(f, f.Row - 1, f.Column - 2, ret);
            AddMove(f, f.Row - 1, f.Column + 2, ret);
            return ret;
        }

        private List<(int, int)> GetRookMoves(Figure f)
        {
            var ret = new List<(int, int)>();
            // left
            for (var c = f.Column - 1; c >= 0; c--)
            {
                if (AddMove(f, f.Row, c, ret) != MoveResult.Free)
                {
                    break;
                }
            }
            // right
            for (var c = f.Column + 1; c <= 7; c++)
            {
                if (AddMove(f, f.Row, c, ret) != MoveResult.Free)
                {
                    break;
                }
            }
            // up
            for (var r = f.Row + 1; r <= 7; r++)
            {
                if (AddMove(f, r, f.Column, ret) != MoveResult.Free)
                {
                    break;
                }
            }
            // down
            for (var r = f.Row - 1; r >= 0; r--)
            {
                if (AddMove(f, r, f.Column, ret) != MoveResult.Free)
                {
                    break;
                }
            }
            return ret;
        }

        private List<(int, int)> GetPawnMoves(Figure f)
        {
            var dir = f.Color == FigureColor.White ? 1 : -1;
            var ret = new List<(int, int)>();
            if (IsFree(f.Row + dir, f.Column))
            {
                ret.Add(new(f.Row + dir, f.Column));
            }
            if (ContainsOpponent(f, f.Row + dir, f.Column - 1))
            {
                ret.Add(new(f.Row + dir, f.Column - 1));
            }
            if (ContainsOpponent(f, f.Row + dir, f.Column + 1))
            {
                ret.Add(new(f.Row + dir, f.Column + 1));
            }
            if ((f.Color == FigureColor.White && f.Row == 1) ||
                (f.Color == FigureColor.Black && f.Row == 6))
            {
                if (IsFree(f.Row + dir, f.Column) && IsFree(f.Row + 2 * dir, f.Column))
                {
                    ret.Add(new(f.Row + 2 * dir, f.Column));
                }
            }
            if (enpassentFigure != null &&
                enpassentFigure.Color != f.Color &&
                enpassentFigure.Row == f.Row)
            {
                if (enpassentFigure.Column == f.Column - 1)
                {
                    ret.Add((f.Row + dir, f.Column - 1));
                }
                else if (enpassentFigure.Column == f.Column + 1)
                {
                    ret.Add((f.Row + dir, f.Column + 1));
                }
            }
            return ret;
        }

        private List<(int, int)> GetStrikeOnlyMoves(Figure figure, List<(int, int)> moves)
        {
            // returns only moves that strikes an opponent figure
            var strikeMoves = new List<(int, int)>();
            foreach (var pt in moves)
            {
                if (figure.Type == FigureType.Pawn &&
                    enpassentFigure != null &&
                    figure.Color != enpassentFigure.Color)
                {
                    // enpassent strike
                    var dir = figure.Color == FigureColor.White ? 1 : -1;
                    if (pt.Item1 == enpassentFigure.Row + dir &&
                        pt.Item2 == enpassentFigure.Column)
                    {
                        strikeMoves.Add(pt);
                    }
                }
                if (ContainsOpponent(figure, pt.Item1, pt.Item2))
                {
                    strikeMoves.Add(pt);
                }
            }
            return strikeMoves;
        }

        private List<(int, int)> FilterCheckMoves(Figure figure, List<(int, int)> moves)
        {
            // filters all moves that would result in check
            var filteredMoves = new List<(int, int)>();
            foreach (var pt in moves)
            {
                // simulate move and verify if the move will not result in check
                var nextBoard = new Chessboard(this);
                var nextFigure = nextBoard.Get(figure.Row, figure.Column);
                nextBoard.Place(nextFigure, pt.Item1, pt.Item2);
                if (!nextBoard.IsCheck(nextFigure.Color))
                {
                    filteredMoves.Add(pt);
                }
            }
            return filteredMoves;
        }

        private bool ContainsOpponent(Figure me, int row, int col)
        {
            var other = Get(row, col);
            if (other != null && other.Color != me.Color)
            {
                return true;
            }
            return false;
        }
    }
}
