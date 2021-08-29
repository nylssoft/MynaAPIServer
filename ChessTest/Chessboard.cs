using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ChessTest
{
    public class Chessboard
    {
        private enum MoveResult { NotPossible, Free, Opponent };

        // --- members

        private readonly Figure[,] board = new Figure[8, 8];

        private Figure enpassentFigure = null;

        // --- constructors

        public Chessboard()
        {
        }

        public Chessboard(Chessboard b)
        {
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

        public static (int, int) ParsePosition(string posTxt)
        {
            if (posTxt.Length == 2)
            {
                char c = posTxt[0];
                if (c >= 'A' && c <= 'H')
                {
                    char r = posTxt[1];
                    if (r >= '1' && r <= '8')
                    {
                        return (7 - ('8' - r), 7 - ('H' - c));
                    }
                }
            }
            return (-1, -1);
        }

        public static Figure ParseFigure(string figureTxt)
        {
            if (figureTxt.Length == 2)
            {
                FigureType ft = figureTxt[0] switch
                {
                    'P' => FigureType.Pawn,
                    'N' => FigureType.Knight,
                    'B' => FigureType.Bishop,
                    'Q' => FigureType.Queen,
                    'K' => FigureType.King,
                    'R' => FigureType.Rook,
                    _ => throw new ArgumentException("Invalid figure type"),
                };
                FigureColor fc = figureTxt[1] switch
                {
                    'W' => FigureColor.White,
                    'B' => FigureColor.Black,
                    _ => throw new ArgumentException("Invalid figure color"),
                };
                return new Figure(ft, fc);
            }
            return null;
        }

        // --- public methods

        public void InitGame()
        {
            Init(FigureColor.White);
            Init(FigureColor.Black);
        }

        public bool IsFree(int row, int col)
        {
            if (IsValidPosition(row, col))
            {
                return board[row, col] == null;
            }
            return false;
        }

        public Figure Get(int row, int col)
        {
            if (IsValidPosition(row, col))
            {
                return board[row, col];
            }
            return null;
        }

        public void Place(string figureTxt, string posTxt)
        {
            var figure = ParseFigure(figureTxt);
            var pos = ParsePosition(posTxt);
            Place(figure, pos.Item1, pos.Item2);
        }

        public bool CanMove(string posTxt1, string posTxt2)
        {
            var pos1 = ParsePosition(posTxt1);
            var pos2 = ParsePosition(posTxt2);
            Figure figure = Get(pos1.Item1, pos2.Item2);
            if (figure != null)
            {
                return CanMove(figure, pos1.Item1, pos2.Item2);
            }
            return false;
        }

        public string GetFigure(string posTxt)
        {
            var pos = ParsePosition(posTxt);
            var figure = Get(pos.Item1, pos.Item2);
            if (figure != null)
            {
                return figure.ToString();
            }
            return null;
        }

        public Figure Place(Figure f, int row, int col, FigureType pawnReplacement = FigureType.Queen)
        {
            // strike or move
            Figure strike = null;
            if (IsValidPosition(row, col))
            {
                if (IsValidPosition(f.Row, f.Col))
                {
                    // disallow castling
                    if (f.Type == FigureType.Rook && f.MoveCount == 0)
                    {
                        var king = GetKing(f.Color);
                        if (king != null)
                        {
                            if (f.Col == 7)
                            {
                                king.AllowCastlingKingSide = false;
                            }
                            else if (f.Col == 0)
                            {
                                king.AllowCastlingQueenSide = false;
                            }
                        }
                    }
                    // castling
                    if (f.Type == FigureType.King && Math.Abs(f.Col - col) == 2)
                    {
                        // king size
                        if (col > f.Col)
                        {
                            var rook = Get(f.Row, 7);
                            if (rook != null)
                            {
                                board[f.Row, 7] = null;
                                board[f.Row, f.Col + 1] = rook;
                                rook.Col = f.Col + 1;
                            }
                        }
                        // queen size
                        else
                        {
                            var rook = Get(f.Row, 0);
                            if (rook != null)
                            {
                                board[f.Row, 0] = null;
                                board[f.Row, f.Col - 1] = rook;
                                rook.Col = f.Col - 1;
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
                            col == enpassentFigure.Col)
                        {
                            board[enpassentFigure.Row, enpassentFigure.Col] = null;
                            strike = enpassentFigure;
                            strike.Col = -1;
                            strike.Row = -1;
                        }
                        // pawn replacement
                        if (f.Color == FigureColor.White && row == 7 ||
                            f.Color == FigureColor.Black && row == 0)
                        {
                            f.Type = pawnReplacement;
                        }
                    }
                    board[f.Row, f.Col] = null;
                    if (f.Type == FigureType.Pawn &&
                        (f.Row == 6 && f.Color == FigureColor.Black && row == 4 ||
                        f.Row == 1 && f.Color == FigureColor.White && row == 3) )
                    {
                        enpassentFigure = f;
                    }
                    else
                    {
                        enpassentFigure = null;
                    }
                }
                if (strike == null)
                {
                    strike = Get(row, col);
                    if (strike != null)
                    {
                        strike.Row = -1;
                        strike.Col = -1;
                    }
                }
                f.Row = row;
                f.Col = col;
                board[f.Row, f.Col] = f;
                f.MoveCount += 1;
            }
            return strike;
        }

        public bool Remove(int row, int col)
        {
            var figure = Get(row, col);
            if (figure != null)
            {
                board[row, col] = null;
                figure.Row = -1;
                figure.Col = -1;
                return true;
            }
            return false;
        }

        public bool CanMove(Figure f, int row, int col, bool allowChessMoves = false)
        {
            foreach (var pt in GetMoves(f, filterChessMoves: !allowChessMoves))
            {
                if (row == pt.Item1 && col == pt.Item2)
                {
                    return true;
                }
            }            
            return false;
        }

        public bool IsStateMate(FigureColor color)
        {
            foreach(var figure in GetAll(color))
            {
                if (GetMoves(figure, filterChessMoves: true).Count > 0)
                {
                    return false;
                }
            }
            return true;
        }

        public bool IsCheckMate(FigureColor color)
        {
            // if king is in chess
            if (IsCheck(color))
            {
                // if king cannot move anymore
                var kingMoves = GetMoves(GetKing(color), filterChessMoves: true);
                if (kingMoves.Count == 0)
                {
                    // simulate if any other move will break the chess
                    foreach (var figure in GetAll(color))
                    {
                        var moves = GetMoves(figure, filterChessMoves: true);
                        if (moves.Count > 0)
                        {
                            return false;
                        }
                    }
                    // no move break the chess, checkmate
                    return true;
                }
            }
            return false;
        }

        public bool IsCheck(FigureColor color)
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
                        if (oppPt.Item1 == king.Row && oppPt.Item2 == king.Col)
                        {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        public List<(int, int)> GetMoves(Figure f, bool strikeOnly = false, bool filterChessMoves = false)
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
                return FilterStrikeOnlyMoves(f, moves);
            }
            if (filterChessMoves)
            {
                return FilterChessMoves(f, moves);
            }
            return moves;
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
            AddMove(f, f.Row + 1, f.Col, ret);
            AddMove(f, f.Row - 1, f.Col, ret);
            AddMove(f, f.Row, f.Col - 1, ret);
            AddMove(f, f.Row, f.Col + 1, ret);
            AddMove(f, f.Row - 1, f.Col - 1, ret);
            AddMove(f, f.Row - 1, f.Col + 1, ret);
            AddMove(f, f.Row + 1, f.Col + 1, ret);
            AddMove(f, f.Row + 1, f.Col - 1, ret);
            if (f.MoveCount == 0)
            {
                if (f.AllowCastlingKingSide &&
                    IsFree(f.Row, f.Col + 1) && 
                    IsFree(f.Row, f.Col + 2))
                {
                    ret.Add((f.Row, f.Col + 2));
                }
                if (f.AllowCastlingQueenSide &&
                    IsFree(f.Row, f.Col - 1) &&
                    IsFree(f.Row, f.Col - 2) &&
                    IsFree(f.Row, f.Col - 3))
                {
                    ret.Add((f.Row, f.Col - 2));
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
            var r = f.Row + 1;
            var c = f.Col + 1;
            while (r <= 7 && c <= 7)
            {
                if (AddMove(f, r, c, ret) != MoveResult.Free)
                {
                    break;
                }
                r++;
                c++;
            }
            r = f.Row - 1;
            c = f.Col - 1;
            while (r >= 0 && c >= 0)
            {
                if (AddMove(f, r, c, ret) != MoveResult.Free)
                {
                    break;
                }
                r--;
                c--;
            }
            r = f.Row + 1;
            c = f.Col - 1;
            while (r <= 7 && c >= 0)
            {
                if (AddMove(f, r, c, ret) != MoveResult.Free)
                {
                    break;
                }
                r++;
                c--;
            }
            r = f.Row - 1;
            c = f.Col + 1;
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
            AddMove(f, f.Row + 2, f.Col + 1, ret);
            AddMove(f, f.Row + 2, f.Col - 1, ret);
            AddMove(f, f.Row - 2, f.Col - 1, ret);
            AddMove(f, f.Row - 2, f.Col + 1, ret);
            AddMove(f, f.Row + 1, f.Col - 2, ret);
            AddMove(f, f.Row + 1, f.Col + 2, ret);
            AddMove(f, f.Row - 1, f.Col - 2, ret);
            AddMove(f, f.Row - 1, f.Col + 2, ret);
            return ret;
        }

        private List<(int, int)> GetRookMoves(Figure f)
        {
            var ret = new List<(int, int)>();
            for (var c = f.Col - 1; c >= 0; c--)
            {
                if (AddMove(f, f.Row, c, ret) != MoveResult.Free)
                {
                    break;
                }
            }
            for (var c = f.Col + 1; c <= 7; c++)
            {
                if (AddMove(f, f.Row, c, ret) != MoveResult.Free)
                {
                    break;
                }
            }
            for (var r = f.Row + 1; r <= 7; r++)
            {
                if (AddMove(f, r, f.Col, ret) != MoveResult.Free)
                {
                    break;
                }
            }
            // down
            for (var r = f.Row - 1; r >= 0; r--)
            {
                if (AddMove(f, r, f.Col, ret) != MoveResult.Free)
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
            if (IsFree(f.Row + dir, f.Col))
            {
                ret.Add(new(f.Row + dir, f.Col));
            }
            if (ContainsOpponent(f, f.Row + dir, f.Col - 1))
            {
                ret.Add(new(f.Row + dir, f.Col - 1));
            }
            if (ContainsOpponent(f, f.Row + dir, f.Col + 1))
            {
                ret.Add(new(f.Row + dir, f.Col + 1));
            }
            if ((f.Color == FigureColor.White && f.Row == 1) ||
                (f.Color == FigureColor.Black && f.Row == 6))
            {
                if (IsFree(f.Row + 2 * dir, f.Col))
                {
                    ret.Add(new(f.Row + 2 * dir, f.Col));
                }
            }
            AddEnpassant(f, dir, ret);
            // @TODO: bauer zu Wahl-Figur ausser Dame
            return ret;
        }

        private void AddEnpassant(Figure f, int dir, List<(int, int)> moves)
        {
            if (enpassentFigure != null &&
                enpassentFigure.Color != f.Color &&
                enpassentFigure.Row == f.Row)
            {
                if (enpassentFigure.Col == f.Col - 1)
                {
                    moves.Add((f.Row + dir, f.Col - 1));
                }
                else if (enpassentFigure.Col == f.Col + 1)
                {
                    moves.Add((f.Row + dir, f.Col + 1));
                }
            }
        }

        private List<(int, int)> FilterStrikeOnlyMoves(Figure figure, List<(int, int)> moves)
        {
            // return only moves that strike an opponent figure
            var filteredMoves = new List<(int, int)>();
            foreach (var pt in moves)
            {
                if (ContainsOpponent(figure, pt.Item1, pt.Item2))
                {
                    filteredMoves.Add(pt);
                }
            }
            return filteredMoves;
        }

        private List<(int, int)> FilterChessMoves(Figure figure, List<(int, int)> moves)
        {
            // filters all moves that would result in chess
            var filteredMoves = new List<(int, int)>();
            foreach (var pt in moves)
            {
                var nextBoard = new Chessboard(this);
                var nextFigure = nextBoard.Get(figure.Row, figure.Col);
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

