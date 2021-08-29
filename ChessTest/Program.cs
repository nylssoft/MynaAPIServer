using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ChessTest
{
    class Program
    {
        static void Main(string[] args)
        {
            var chessboard = new Chessboard();
            chessboard.InitGame();
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
                            ShowBoard(chessboard, chessboard.GetMoves(figure, filterCheck: true));
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
                            var moves = chessboard.GetMoves(figure, filterCheck: true);
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
                            ShowBoard(chessboard, chessboard.GetMoves(selectedFigure, filterCheck: true));
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
                    else if (chessboard.IsStaleMate(currentColor))
                    {
                        Console.WriteLine("*** STALE MATE ***");
                        break;
                    }
                }
                catch
                {
                }
            }
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
