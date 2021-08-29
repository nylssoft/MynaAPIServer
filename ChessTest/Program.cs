using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ChessTest
{
    class Program
    {
        static void Test()
        {
            var chess = new Chessboard();
            chess.Place(new Figure(FigureType.King, FigureColor.Black), 7, 0);
            chess.Place(new Figure(FigureType.King, FigureColor.White), 5, 1);
            chess.Place(new Figure(FigureType.Knight, FigureColor.White), 3, 3);

        }

        static void Main(string[] args)
        {
            // Test();
            var chessboard = new Chessboard();
            chessboard.InitGame();
            // chess.Place("KB", "H6");
            // chessboard.Place("KB", "A8");
            // chessboard.Place("KW", "B6");
            // chessboard.Place("NW", "D4");
            ShowBoard(chessboard);
            FigureColor currentColor = FigureColor.White;
            Figure selectedFigure = null;
            string prevInput = "";
            while (true)
            {
                try
                {
                    Console.WriteLine(prevInput);
                    Console.Write($"{currentColor} => ");
                    var input = Console.ReadLine();

                    if (input == "q" || input == "Q") break;

                    Console.Clear();

                    if (input.Length == 0)
                    {
                        selectedFigure = null;
                        prevInput = "";
                        ShowBoard(chessboard);
                        continue;
                    }

                    if (input.StartsWith("s"))
                    {
                        var p = Chessboard.ParsePosition(input.Substring(1));
                        var figure = chessboard.Get(p.Item1, p.Item2);
                        if (figure != null)
                        {
                            ShowBoard(chessboard, chessboard.GetMoves(figure, filterChessMoves: true));
                            continue;
                        }
                    }
                    var pos = Chessboard.ParsePosition(input);
                    var showBoard = true;
                    if (selectedFigure == null)
                    {
                        var figure = chessboard.Get(pos.Item1, pos.Item2);
                        if (figure != null && figure.Color == currentColor)
                        {
                            var moves = chessboard.GetMoves(figure, filterChessMoves: true);
                            if (moves.Any())
                            {
                                ShowBoard(chessboard, moves);
                                selectedFigure = figure;
                                prevInput = $"{input}-";
                                showBoard = false;
                            }
                        }
                    }
                    else if (selectedFigure != null)
                    {
                        if (chessboard.CanMove(selectedFigure, pos.Item1, pos.Item2))
                        {
                            chessboard.Place(selectedFigure, pos.Item1, pos.Item2);
                            ShowBoard(chessboard);
                            selectedFigure = null;
                            currentColor = Chessboard.GetOpponentColor(currentColor);
                            showBoard = false;
                            prevInput = $"{prevInput}{input}";
                        }
                        else
                        {
                            ShowBoard(chessboard, chessboard.GetMoves(selectedFigure, filterChessMoves: true));
                            showBoard = false;
                        }
                    }
                    if (showBoard)
                    {
                        ShowBoard(chessboard);
                    }
                    if (chessboard.IsCheck(currentColor))
                    {
                        if (chessboard.IsCheckMate(currentColor))
                        {
                            Console.WriteLine("*** CHECK MATE ***");
                            break;
                        }
                        Console.WriteLine("!! CHECK !!");
                    }
                    else if (chessboard.IsStateMate(currentColor))
                    {
                        Console.WriteLine("*** STATE MATE ***");
                        break;
                    }
                }
                catch
                {
                }
            }

            /*
            var pawn = chess.Get(1, 0);
            chess.Place(pawn, 5, 5);
            ShowBoard(chess, chess.GetMoves(pawn));
            var rook = chess.Get(0, 0);
            chess.Place(rook, 3, 4);
            ShowBoard(chess, chess.GetMoves(rook));
            var knight = chess.Get(0, 1);
            chess.Place(knight, 5, 3);
            ShowBoard(chess, chess.GetMoves(knight));
            chess.Place(chess.Get(1, 1), 2, 1);
            chess.Place(chess.Get(1, 3), 2, 4);
            var bishop = chess.Get(0, 2);
            ShowBoard(chess, chess.GetMoves(bishop));
            chess.Place(chess.Get(1, 2), 2, 2);
            var queen = chess.Get(0, 3);
            ShowBoard(chess, chess.GetMoves(queen));
            var king = chess.Get(0, 4);
            chess.Place(king, 4, 2);
            var moves = chess.GetMoves(king);
            ShowBoard(chess, moves);
            var filtered = chess.GetMoves(king, filterChessMoves: true);
            ShowBoard(chess, filtered);
            // Console.WriteLine(chess.IsCheckMate(FigureColor.White));
            // Console.WriteLine(chess.IsCheckMate(FigureColor.Black));
            chess.Remove(6, 2);
            chess.Remove(6, 4);
            chess.Remove(7, 5);
            chess.Place(new Figure(FigureType.Rook, FigureColor.Black), 7, 5);
            chess.Place(new Figure(FigureType.Rook, FigureColor.Black), 6, 4);
            ShowBoard(chess);
            Console.WriteLine(chess.IsCheckMate(FigureColor.Black));
            */
        }

        static void ShowBoard(Chessboard chess, List<(int,int)> moves = null)
        {
            Console.WriteLine($" {new string('-', 8 * 4 + 1)}");
            for (var row = 7; row >= 0; row--)
            {
                var sb = new StringBuilder();
                sb.Append($"{row+1}");
                for (var col = 0; col <= 7; col++)
                {
                    var str = "  ";
                    var f = chess.Get(row, col);
                    if (f != null)
                    {
                        str = f.ToString();
                    }
                    var m = " ";
                    if (moves != null && moves.Contains((row, col)))
                    {
                        m = "*";
                    }
                    var txt = $"|{m}{str}";
                    sb.Append(txt);
                }
                sb.Append("|");
                Console.WriteLine(sb);
                Console.WriteLine($" {new string('-', 8 * 4 + 1)}");
            }
            Console.WriteLine("  A   B   C   D   E   F   G   H");
        }
    }
}
