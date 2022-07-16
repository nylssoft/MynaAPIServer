/*
    Myna API Server
    Copyright (C) 2022 Niels Stockfleth

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
using APIServer.PwdMan;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;

namespace APIServer.Backgammon.Core
{
    public enum CheckerColor { White, Black };

    public class Checker
    {
        public Checker(int id, CheckerColor color, int position)
        {
            Id = id;
            Color = color;
            Position = position;
        }

        public Checker(Checker c)
        {
            Id = c.Id;
            Color = c.Color;
            Position = c.Position;
        }

        public int Id { get; }

        public CheckerColor Color { get; }

        public int Position { get; set; }
    }

    public class Point
    {
        public Point(int position)
        {
            Position = position;
            Checkers = new Stack<Checker>();
        }

        public Point(Point p)
        {
            Position = p.Position;
            Checkers = new Stack<Checker>();
            foreach (var checker in p.Checkers)
            {
                Checkers.Push(new Checker(checker));
            }
        }

        public int Position { get; }

        public Stack<Checker> Checkers { get; }
    }

    public class Roll
    {
        public Roll(int n1, int n2)
        {
            Number1 = n1;
            Number2 = n2;
        }

        public int Number1 { get; }

        public int Number2 { get; }

        public override string ToString()
        {
            return $"{Number1} - {Number2}";
        }
    }

    public class BackgammonBoard
    {
        // --- classes

        public class Item
        {
            public Item(CheckerColor color, int position, int count)
            {
                Color = color;
                Position = position;
                Count = count;
            }

            public CheckerColor Color { get; }

            public int Count { get; }

            public int Position { get; }
        }

        // --- constants

        public const int BAR = -1;

        public const int OFFBOARD = -2;

        // --- properties

        public string WhitePlayer { get; private set; }

        public string BlackPlayer { get; private set; }

        public CheckerColor? CurrentColor { get; private set; }

        public CheckerColor? Winner { get; private set; }

        public bool GameOver { get; private set; }

        public bool GameStarted { get; private set; }

        public bool Gammon { get; private set; }

        public bool Backgammon { get; private set; }

        public bool NextGameRequested { get; set; }

        public Roll CurrentRoll { get; private set; }

        public Roll LastRoll { get; private set; }

        public bool GiveUp
        {
            get
            {
                return giveUp;
            }
            set
            {
                giveUp = value;
                if (giveUp)
                {
                    var winnerColor = CurrentColor == CheckerColor.White ? CheckerColor.Black : CheckerColor.White;
                    SetWinner(winnerColor);
                }
            }
        }

        // --- members

        private readonly Point[] board;

        private List<Checker> bar;

        private List<Checker> offBoard;

        private Dictionary<CheckerColor, int> startRollNumbers;

        private List<int> remainingRollNumbers;

        private bool giveUp;

        private int nextCheckerId;

        // --- constructors

        public BackgammonBoard(string whitePlayer, string blackPlayer)
        {
            nextCheckerId = 1;
            WhitePlayer = whitePlayer;
            BlackPlayer = blackPlayer;
            remainingRollNumbers = new List<int>();
            startRollNumbers = new Dictionary<CheckerColor, int>();
            offBoard = new List<Checker>();
            bar = new List<Checker>();
            board = new Point[24];
            for (int pos = 0; pos <= 23; pos++)
            {
                board[pos] = new Point(pos);
            }
            AddNewCheckers(board[0], CheckerColor.White, 2);
            AddNewCheckers(board[11], CheckerColor.White, 5);
            AddNewCheckers(board[16], CheckerColor.White, 3);
            AddNewCheckers(board[18], CheckerColor.White, 5);
            AddNewCheckers(board[5], CheckerColor.Black, 5);
            AddNewCheckers(board[7], CheckerColor.Black, 3);
            AddNewCheckers(board[12], CheckerColor.Black, 5);
            AddNewCheckers(board[23], CheckerColor.Black, 2);
        }

        private BackgammonBoard(BackgammonBoard source)
        {
            WhitePlayer = source.WhitePlayer;
            BlackPlayer = source.BlackPlayer;
            CurrentColor = source.CurrentColor;
            Winner = source.Winner;
            GameOver = source.GameOver;
            GameStarted = source.GameStarted;
            Gammon = source.Gammon;
            Backgammon = source.Backgammon;
            CurrentRoll = source.CurrentRoll;
            LastRoll = source.LastRoll;
            remainingRollNumbers = new List<int>(source.remainingRollNumbers);
            board = new Point[24];
            for (int pos = 0; pos <= 23; pos ++)
            {
                board[pos] = new Point(source.board[pos]);
            }
            bar = new List<Checker>();
            foreach (var c in source.bar)
            {
                bar.Add(new Checker(c));
            }
            offBoard = new List<Checker>();
            foreach (var c in source.offBoard)
            {
                offBoard.Add(new Checker(c));
            }
            startRollNumbers = new Dictionary<CheckerColor, int>(source.startRollNumbers);
        }

        public void AddNewCheckers(Point p, CheckerColor color, int count)
        {
            for (; count > 0; count--)
            {
                p.Checkers.Push(new Checker(nextCheckerId++, color, p.Position));
            }
        }

        // state

        public List<Item> GetItems()
        {
            var ret = new List<Item>();
            foreach (var p in board)
            {
                if (p.Checkers.Any())
                {
                    var checker = p.Checkers.Peek();
                    ret.Add(new Item(checker.Color, checker.Position, p.Checkers.Count));
                }
            }
            var whiteCount = bar.Count((c) => c.Color == CheckerColor.White);
            if (whiteCount > 0)
            {
                ret.Add(new Item(CheckerColor.White, BAR, whiteCount));
            }
            var blackCount = bar.Count((c) => c.Color == CheckerColor.Black);
            if (blackCount > 0)
            {
                ret.Add(new Item(CheckerColor.Black, BAR, blackCount));
            }
            whiteCount = offBoard.Count((c) => c.Color == CheckerColor.White);
            if (whiteCount > 0)
            {
                ret.Add(new Item(CheckerColor.White, OFFBOARD, whiteCount));
            }
            blackCount = offBoard.Count((c) => c.Color == CheckerColor.Black);
            if (blackCount > 0)
            {
                ret.Add(new Item(CheckerColor.Black, OFFBOARD, blackCount));
            }
            return ret;
        }

        public List<int> GetRemainingRollNumbers()
        {
            return new List<int>(remainingRollNumbers);
        }

        public int? GetStartRollNumber(CheckerColor color)
        {
            if (startRollNumbers.TryGetValue(color, out int val))
            {
                return val;
            }
            return null;
        }

        public List<(int,int)> GetAllMoves()
        {
            // A player must use both numbers of a roll if this is legally possible
            // (or all four numbers of a double).
            // When only one number can be played, the player must play that number.
            // Or if either number can be played but not both,
            // the player must play the larger one.
            // When neither number can be used, the player loses his turn.
            // In the case of doubles, when all four numbers cannot be played,
            // the player must play as many numbers as he can.
            var allMoves = new List<(int, int)>();
            if (GameStarted && !GameOver && remainingRollNumbers.Any())
            {
                if (HasCheckersOnBar())
                {
                    if (remainingRollNumbers.Count == 1 ||
                        remainingRollNumbers[0] == remainingRollNumbers[1])
                    {
                        allMoves.AddRange(GetAllMoves(remainingRollNumbers[0]));
                    }
                    else
                    {
                        allMoves.AddRange(GetAllMoves(remainingRollNumbers[0]));
                        allMoves.AddRange(GetAllMoves(remainingRollNumbers[1]));
                    }
                }
                else if (remainingRollNumbers.Count == 1 ||
                    remainingRollNumbers[0] == remainingRollNumbers[1])
                {
                    allMoves.AddRange(GetAllMoves(remainingRollNumbers[0]));
                }
                else if (IsInHomeboard())
                {
                    allMoves.AddRange(GetAllMoves(remainingRollNumbers[0]));
                    allMoves.AddRange(GetAllMoves(remainingRollNumbers[1]));
                }
                else
                {
                    bool onlyMaxAllowed = false;
                    var max = Math.Max(remainingRollNumbers[0], remainingRollNumbers[1]);
                    var min = Math.Min(remainingRollNumbers[0], remainingRollNumbers[1]);
                    var maxMoves = GetAllMoves(max);
                    var minMoves = GetAllMoves(min);
                    if (maxMoves.Any() && minMoves.Any())
                    {
                        onlyMaxAllowed = true;
                        foreach (var move in minMoves)
                        {
                            var temp = new BackgammonBoard(this);
                            temp.MoveInternal(move.Item1, move.Item2);
                            var tempMaxMoves = temp.GetAllMoves(max);
                            if (tempMaxMoves.Any())
                            {
                                onlyMaxAllowed = false;
                                break;
                            }
                        }
                    }
                    allMoves.AddRange(maxMoves);
                    if (!onlyMaxAllowed)
                    {
                        allMoves.AddRange(minMoves);
                    }
                }
            }
            return allMoves;
        }

        // actions

        public int RollStartDice(CheckerColor color)
        {
            if (GameStarted || GameOver || startRollNumbers.ContainsKey(color))
            {
                throw new RollDiceNotAllowedException();
            }
            var ret = RollDiceOnce();
            startRollNumbers[color] = ret;
            if (startRollNumbers.Count == 2)
            {
                var rollNumber1 = startRollNumbers[CheckerColor.White];
                var rollNumber2 = startRollNumbers[CheckerColor.Black];
                CurrentRoll = new Roll(rollNumber1, rollNumber2);
                if (rollNumber1 != rollNumber2)
                {
                    GameStarted = true;
                    CurrentColor = rollNumber1 > rollNumber2 ? CheckerColor.White : CheckerColor.Black;
                    remainingRollNumbers.Add(CurrentRoll.Number1);
                    remainingRollNumbers.Add(CurrentRoll.Number2);
                }
                startRollNumbers.Clear();
            }
            return ret;
        }

        public (int,int) RollDice()
        {
            if (!GameStarted || GameOver || CurrentRoll != null)
            {
                throw new RollDiceNotAllowedException();
            }
            CurrentRoll = RollDiceTwice();
            remainingRollNumbers.Add(CurrentRoll.Number1);
            remainingRollNumbers.Add(CurrentRoll.Number2);
            if (CurrentRoll.Number1 == CurrentRoll.Number2)
            {
                remainingRollNumbers.Add(CurrentRoll.Number1);
                remainingRollNumbers.Add(CurrentRoll.Number1);
            }
            return (CurrentRoll.Number1, CurrentRoll.Number2);
        }

        public void Skip()
        {
            if (!GameStarted ||
                GameOver ||
                remainingRollNumbers.Count == 0 ||
                GetAllMoves().Count > 0)
            {
                throw new SkipMoveNotAllowedException();
            }
            CurrentColor = CurrentColor.Value == CheckerColor.White ? CheckerColor.Black : CheckerColor.White;
            LastRoll = CurrentRoll;
            CurrentRoll = null;
            remainingRollNumbers.Clear();
        }

        public void Move(int from, int to)
        {
            if (!GameStarted ||
                GameOver ||
                remainingRollNumbers.Count == 0 ||
                !GetAllMoves().Contains((from, to)))
            {
                throw new InvalidMoveException();
            }
            MoveInternal(from, to);
        }

        // --- private methods

        private void SetWinner(CheckerColor winnerColor)
        {
            GameOver = true;
            Winner = winnerColor;
            var looserItems = GetItems().Where((item) => item.Color != winnerColor);
            if (!looserItems.Any((item) => item.Position == OFFBOARD))
            {
                Gammon = true;
                if (looserItems.Any((item) => item.Position == BAR))
                {
                    Backgammon = true;
                }
                else
                {
                    var startPos = winnerColor == CheckerColor.White ? 18 : 0;
                    if (looserItems.Any((item) => item.Position >= startPos && item.Position <= startPos + 5))
                    {
                        Backgammon = true;
                    }
                }
            }
        }

        private bool HasCheckersOnBar()
        {
            return bar.Any((c) => c.Color == CurrentColor.Value);
        }

        private List<Checker> GetCheckers()
        {
            var ret = new List<Checker>();
            foreach (var p in board)
            {
                if (p.Checkers.Any() && p.Checkers.Peek().Color == CurrentColor)
                {
                    ret.AddRange(p.Checkers);
                }
            }
            ret.AddRange(bar.Where((c) => c.Color == CurrentColor));
            ret.AddRange(offBoard.Where((c) => c.Color == CurrentColor));
            return ret;
        }

        private List<(int, int)> GetAllMoves(int rollNumber)
        {
            var ret = new List<(int, int)>();
            var dir = CurrentColor == CheckerColor.White ? 1 : -1;
            var first = CurrentColor == CheckerColor.White ? 0 : 23;
            if (HasCheckersOnBar())
            {
                var to = first + dir * (rollNumber - 1);
                var toPoint = board[to];
                if (toPoint.Checkers.Count == 0 ||
                    toPoint.Checkers.Peek().Color == CurrentColor ||
                    toPoint.Checkers.Count < 2)
                {
                    ret.Add((BAR, to));
                }
            }
            else
            {
                foreach (var from in GetFromPositions())
                {
                    var to = from + dir * rollNumber;
                    if (to >= 0 && to <= 23)
                    {
                        var toPoint = board[to];
                        if (toPoint.Checkers.Count == 0 ||
                            toPoint.Checkers.Peek().Color == CurrentColor ||
                            toPoint.Checkers.Count < 2)
                        {
                            ret.Add((from, to));
                        }
                    }
                }
                if (IsInHomeboard())
                {
                    // Once a player has moved all of his fifteen checkers into his home board,
                    // he may commence bearing off. A player bears off a checker by rolling a
                    // number that corresponds to the point on which the checker resides,
                    // and then removing that checker from the board.
                    // Thus, rolling a 6 permits the player to remove a checker from the six point.
                    //
                    // If there is no checker on the point indicated by the roll,
                    // the player must make a legal move using a checker on a higher-numbered point.
                    // If there are no checkers on higher-numbered points,
                    // the player is permitted (and required) to remove a checker from the
                    // highest point on which one of his checkers resides.
                    // A player is under no obligation to bear off if he can make an otherwise legal move.
                    first = CurrentColor == CheckerColor.White ? 23 : 0;
                    dir = CurrentColor == CheckerColor.White ? -1 : 1;
                    var from = first + dir * (rollNumber - 1);
                    var point = board[from];
                    if (point.Checkers.Any() && point.Checkers.Peek().Color == CurrentColor)
                    {
                        ret.Add((from, OFFBOARD));
                    }
                    else
                    {
                        var higher = GetHigher(from);
                        if (higher == null)
                        {
                            var lower = GetLower(from);
                            if (lower != null)
                            {
                                ret.Add((lower.Position, OFFBOARD));
                            }
                        }
                    }
                }
            }
            return ret;
        }

        private Checker GetHigher(int from)
        {
            if (CurrentColor.Value == CheckerColor.White)
            {
                for (int next = from - 1; next >= 18; next--)
                {
                    if (board[next].Checkers.Any() &&
                        board[next].Checkers.Peek().Color == CurrentColor.Value)
                    {
                        return board[next].Checkers.Peek();
                    }
                }
            }
            else
            {
                for (int next = from + 1; next <= 5; next++)
                {
                    if (board[next].Checkers.Any() &&
                        board[next].Checkers.Peek().Color == CurrentColor.Value)
                    {
                        return board[next].Checkers.Peek();
                    }
                }
            }
            return null;
        }

        private Checker GetLower(int from)
        {
            if (CurrentColor.Value == CheckerColor.White)
            {
                for (int next = from + 1; next <= 23; next++)
                {
                    if (board[next].Checkers.Any() &&
                        board[next].Checkers.Peek().Color == CurrentColor.Value)
                    {
                        return board[next].Checkers.Peek();
                    }
                }
            }
            else
            {
                for (int next = from - 1; next >= 0; next--)
                {
                    if (board[next].Checkers.Any() &&
                        board[next].Checkers.Peek().Color == CurrentColor.Value)
                    {
                        return board[next].Checkers.Peek();
                    }
                }
            }
            return null;
        }

        private bool IsInHomeboard()
        {
            foreach (var checker in GetCheckers())
            {
                if (checker.Position != OFFBOARD)
                {
                    if (checker.Position == BAR ||
                        checker.Color == CheckerColor.White && checker.Position < 18 ||
                        checker.Color == CheckerColor.Black && checker.Position > 5)
                    {
                        return false;
                    }
                }
            }
            return true;
        }

        private List<int> GetFromPositions()
        {
            var ret = new List<int>();
            for (int pos = 0; pos <= 23; pos++)
            {
                if (board[pos].Checkers.Any() && board[pos].Checkers.Peek().Color == CurrentColor)
                {
                    ret.Add(pos);
                }
            }
            return ret;
        }

        private void MoveInternal(int from, int to)
        {
            var color = CurrentColor.Value;
            Checker checker = null;
            // bear off
            if (to == OFFBOARD)
            {
                var rollNumber = color == CheckerColor.White ? 24 - from : from + 1;
                // roll number can be higher for bear off, use highest roll number
                if (!remainingRollNumbers.Contains(rollNumber))
                {
                    if (remainingRollNumbers.Count == 1 ||
                        remainingRollNumbers[0] >= remainingRollNumbers[1])
                    {
                        rollNumber = remainingRollNumbers[0];
                    }
                    else
                    {
                        rollNumber = remainingRollNumbers[1];
                    }
                }
                remainingRollNumbers.Remove(rollNumber);
                checker = board[from].Checkers.Pop();
                offBoard.Add(checker);
                checker.Position = OFFBOARD;
                var countOnBoard = GetCheckers().Count((c) => c.Position >= 0 && c.Position <= 23);
                if (countOnBoard == 0)
                {
                    SetWinner(color);
                }
            }
            // remove from bar or move in board
            else
            {
                // remove from bar
                if (from == BAR)
                {
                    remainingRollNumbers.Remove(color == CheckerColor.White ? to + 1 : 24 - to);
                    checker = bar.Find((c) => c.Color == color);
                    bar.Remove(checker);
                }
                // move in board
                else
                {
                    remainingRollNumbers.Remove(Math.Abs(from - to));
                    checker = board[from].Checkers.Pop();
                }
                var toPoint = board[to];
                if (toPoint.Checkers.Any() && toPoint.Checkers.Peek().Color != color)
                {
                    // blot is hit
                    var hitChecker = toPoint.Checkers.Pop();
                    hitChecker.Position = BAR;
                    bar.Add(hitChecker);
                }
                toPoint.Checkers.Push(checker);
                checker.Position = to;
            }
            if (!GameOver && remainingRollNumbers.Count == 0)
            {
                CurrentColor = color == CheckerColor.White ? CheckerColor.Black : CheckerColor.White;
                LastRoll = CurrentRoll;
                CurrentRoll = null;
            }
        }

        // --- private static methods

        private static int RollDiceOnce()
        {
            return NextRNG(6) + 1;
        }

        private static Roll RollDiceTwice()
        {
            return new Roll(NextRNG(6) + 1, NextRNG(6) + 1);
        }

        private static int NextRNG(int limit)
        {
            if (limit <= 0)
            {
                throw new ArgumentException($"Invalid upper limit {limit}.");
            }
            if (limit == 1)
            {
                return 0;
            }
            return (int)(Next() % (uint)limit);
        }

        private static uint Next()
        {
            var randomNumber = RandomNumberGenerator.GetBytes(4);
            return BitConverter.ToUInt32(randomNumber, 0);
        }
    }
}
