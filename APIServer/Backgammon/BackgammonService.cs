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
using APIServer.Backgammon.Core;
using APIServer.Backgammon.Model;
using APIServer.PwdMan;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;

namespace APIServer.Backgammon
{
    public class BackgammonService : IBackgammonService
    {
        public IConfiguration Configuration { get; }

        private DateTime? stateChanged;

        private readonly object mutex = new object();

        private readonly Dictionary<string, Context> userTickets = new Dictionary<string, Context>();

        private BackgammonBoard board;

        private readonly ILogger logger;

        public BackgammonService(IConfiguration configuration, ILogger<BackgammonService> logger)
        {
            Configuration = configuration;
            this.logger = logger;
        }

        // --- without authentication

        public long GetState()
        {
            lock (mutex)
            {
                var options = GetOptions();
                var timeout = options.GameOverTimeout;
                if (board != null && board.GameStarted && !board.GameOver)
                {
                    timeout = options.SessionTimeout;
                }
                var now = DateTime.Now;
                foreach (var pair in userTickets)
                {
                    var ctx = pair.Value;
                    var diff = (int)(now - ctx.LastAccess).TotalSeconds;
                    if (diff > timeout * 60) // reset game after inactivity
                    {
                        board = null;
                        userTickets.Clear();
                        stateChanged = DateTime.UtcNow;
                        break;
                    }
                }
                return GetStateChanged();
            }
        }

        public LoginModel Login(IPwdManService pwdManService, string authenticationToken, string username)
        {
            var ret = new LoginModel();
            lock (mutex)
            {
                if (authenticationToken?.Length > 0)
                {
                    var user = pwdManService.GetUser(authenticationToken);
                    username = user.Name;
                    foreach (var e in userTickets)
                    {
                        if (e.Value.Name == username)
                        {
                            ret.Ticket = e.Key;
                            break;
                        }
                    }
                }
                else if (pwdManService.IsRegisteredUsername(username))
                {
                    ret.IsAuthenticationRequired = true;
                }
                if (string.IsNullOrEmpty(ret.Ticket) && !ret.IsAuthenticationRequired &&
                    !userTickets.Values.Any((v) => string.Equals(v.Name, username, StringComparison.OrdinalIgnoreCase))
                        && board == null
                        && userTickets.Count < 2
                        && username.Trim().Length > 0)
                {
                    // only lower chars and digits except 0 and o
                    var pwdgen = new PasswordGenerator.PwdGen()
                    {
                        Symbols = "",
                        UpperCharacters = "",
                        LowerCharacters = "abcdefghijklmnpqrstuvwxyz",
                        Digits = "123456789",
                        Length = 6
                    };
                    var ticket = pwdgen.Generate();
                    var ctx = new Context
                    {
                        Name = username,
                        Created = DateTime.Now,
                        LastAccess = DateTime.Now
                    };
                    userTickets[ticket] = ctx;
                    stateChanged = DateTime.UtcNow;
                    ret.Ticket = ticket;
                }
                ret.State = GetStateChanged();
                return ret;
            }
        }

        // --- with authentication

        public BackgammonModel GetBackgammonModel(string ticket)
        {
            lock (mutex)
            {
                var options = GetOptions();
                var ret = new BackgammonModel
                {
                    State = GetState(),
                    AllUsers = GetAllUsers(),
                    IsBoardFull = userTickets.Count == 2
                };
                var ctx = GetContext(ticket);
                if (ctx != null)
                {
                    ret.CurrentUser = GetCurrentUser(ctx);
                }
                if (board != null)
                {
                    ret.Board = new BoardModel();
                    // board options and status
                    ret.Board.WhitePlayer = board.WhitePlayer;
                    ret.Board.BlackPlayer = board.BlackPlayer;
                    ret.Board.GameOver = board.GameOver;
                    ret.Board.GameStarted = board.GameStarted;
                    ret.Board.NextGameRequested = board.NextGameRequested;
                    ret.Board.CurrentColor = ConvertCheckerColor(board.CurrentColor);
                    // reasons for game over and the winner
                    ret.Board.GiveUp = board.GiveUp;
                    if (board.Winner.HasValue)
                    {
                        ret.Board.Winner = board.Winner.Value == CheckerColor.White ? ret.Board.WhitePlayer : ret.Board.BlackPlayer;
                    }
                    ret.Board.HasStartRoll = false;
                    ret.Board.CurrentRollNumbers = new List<int>();
                    ret.Board.RemainingRollNumbers = new List<int>();
                    ret.Board.DoubleRoll = null;
                    if (!board.GameStarted)
                    {
                        // start rolls
                        var playerColor = GetPlayerColor(ctx.Name);
                        var opponentColor = GetOpponentColor(playerColor);
                        var startRollPlayer = board.GetStartRollNumber(playerColor);
                        var startRollOpponent = board.GetStartRollNumber(opponentColor);
                        ret.Board.HasStartRoll = startRollPlayer.HasValue;
                        if (startRollPlayer.HasValue)
                        {
                            ret.Board.CurrentRollNumbers.Add(startRollPlayer.Value);
                        }
                        else if (startRollOpponent.HasValue)
                        {
                            ret.Board.CurrentRollNumbers.Add(startRollOpponent.Value);
                        }
                        else if (board.CurrentRoll != null)
                        {
                            ret.Board.DoubleRoll = board.CurrentRoll.Number1;
                        }
                    }
                    else if (board.CurrentRoll != null)
                    {
                        // current rolls and remaining rolls
                        ret.Board.CurrentRollNumbers.Add(board.CurrentRoll.Number1);
                        ret.Board.CurrentRollNumbers.Add(board.CurrentRoll.Number2);
                        ret.Board.RemainingRollNumbers.AddRange(board.GetRemainingRollNumbers());
                    }
                    ret.Board.Items = new List<ItemModel>();
                    // items
                    foreach (var item in board.GetItems())
                    {
                        ret.Board.Items.Add(new ItemModel
                        {
                            Color = ConvertCheckerColor(item.Color),
                            Count = item.Count,
                            Position = item.Position
                        });
                    }
                    // moves
                    ret.Board.Moves = new List<MoveModel>();
                    foreach (var move in board.GetAllMoves())
                    {
                        ret.Board.Moves.Add(new MoveModel
                        {
                            From = move.Item1,
                            To = move.Item2
                        });
                    }
                }
                return ret;
            }
        }

        public long Logout(string ticket)
        {
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null)
                {
                    board = null;
                    userTickets.Remove(ticket);
                    foreach (var c in userTickets.Values)
                    {
                        c.StartGameConfirmed = false;
                    }
                    stateChanged = DateTime.UtcNow;
                }
                return GetStateChanged();
            }
        }

        public long StartNewGame(string ticket)
        {
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && board == null && userTickets.Count == 2)
                {
                    var users = userTickets.Values.OrderBy(ctx => ctx.Created).ToList();
                    board = new BackgammonBoard(users[0].Name, users[1].Name);
                    ctx.StartGameConfirmed = true;
                    stateChanged = DateTime.UtcNow;
                }
                return GetStateChanged();
            }
        }

        public long Roll(string ticket)
        {
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && board != null && !board.GameOver)
                {
                    var currentColor = GetPlayerColor(ctx.Name);
                    if (!board.GameStarted)
                    {
                        var startRollNumber = board.GetStartRollNumber(currentColor);
                        if (!startRollNumber.HasValue)
                        {
                            board.RollStartDice(currentColor);
                            stateChanged = DateTime.UtcNow;
                        }
                    }
                    else if (currentColor == board.CurrentColor && board.CurrentRoll == null)
                    {
                        board.RollDice();
                        stateChanged = DateTime.UtcNow;
                    }
                }
                return GetStateChanged();
            }
        }

        public long GiveUp(string ticket)
        {
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null &&
                    board != null &&
                    board.GameStarted &&
                    !board.GameOver &&
                    IsActiveUser(ctx))
                {
                    board.GiveUp = true;
                    stateChanged = DateTime.UtcNow;
                }
                return GetStateChanged();
            }
        }

        public long ConfirmNextGame(string ticket, bool ok)
        {
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null &&
                    board != null &&
                    board.GameStarted &&
                    board.GameOver &&
                    board.NextGameRequested)
                {
                    if (!ok)
                    {
                        foreach (var c in userTickets.Values)
                        {
                            c.StartGameConfirmed = false;
                        }
                        board.NextGameRequested = false;
                    }
                    else
                    {
                        ctx.StartGameConfirmed = true;
                        if (userTickets.Values.All((c) => c.StartGameConfirmed == true))
                        {
                            board = new BackgammonBoard(board.WhitePlayer, board.BlackPlayer);
                        }
                    }
                    stateChanged = DateTime.UtcNow;
                }
                return GetStateChanged();
            }
        }

        public long StartNextGame(string ticket)
        {
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null &&
                    board != null &&
                    board.GameStarted &&
                    board.GameOver &&
                    !board.NextGameRequested)
                {
                    foreach (var c in userTickets.Values)
                    {
                        c.StartGameConfirmed = false;
                    }
                    board.NextGameRequested = true;
                    ctx.StartGameConfirmed = true;
                    stateChanged = DateTime.UtcNow;
                }
                return GetStateChanged();
            }
        }

        public long Move(string ticket, MoveModel move)
        {
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null &&
                    board != null &&
                    board.GameStarted &&
                    !board.GameOver &&
                    IsActiveUser(ctx))
                {
                    board.Move(move.From, move.To);
                    stateChanged = DateTime.UtcNow;
                }
                return GetStateChanged();
            }
        }

        public long Skip(string ticket)
        {
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null &&
                    board != null &&
                    board.GameStarted &&
                    !board.GameOver &&
                    IsActiveUser(ctx))
                {
                    board.Skip();
                    stateChanged = DateTime.UtcNow;
                }
                return GetStateChanged();
            }
        }

        // --- private

        private bool IsActiveUser(Context ctx)
        {
            return GetPlayerColor(ctx.Name) == board.CurrentColor;
        }

        private CheckerColor GetPlayerColor(string playerName)
        {
            return (playerName == board.WhitePlayer) ? CheckerColor.White : CheckerColor.Black;
        }

        private CheckerColor GetOpponentColor(CheckerColor color)
        {
            return (color == CheckerColor.White) ? CheckerColor.Black : CheckerColor.White;
        }

        private BackgammonOptions GetOptions()
        {
            var opt = Configuration.GetSection("Backgammon").Get<BackgammonOptions>();
            return opt ?? new BackgammonOptions();
        }

        private Context GetContext(string ticket)
        {
            userTickets.TryGetValue(ticket ?? "", out Context ctx);
            if (ctx != null)
            {
                ctx.LastAccess = DateTime.Now;
            }
            return ctx;
        }

        private List<UserModel> GetAllUsers()
        {
            var ret = new List<UserModel>();
            var users = userTickets.Values.OrderBy(ctx => ctx.Created).ToList();
            foreach (var user in users)
            {
                ret.Add(new UserModel { Name = user.Name });
            }
            return ret;
        }

        private long GetStateChanged()
        {
            return stateChanged.HasValue ? (long)(stateChanged.Value - DateTime.UnixEpoch).TotalMilliseconds : 0;
        }

        // --- private static

        private static UserModel GetCurrentUser(Context ctx)
        {
            return new UserModel { Name = ctx.Name, StartGameConfirmed = ctx.StartGameConfirmed };
        }

        private static string ConvertCheckerColor(CheckerColor? c)
        {
            if (c.HasValue)
            {
                return c == CheckerColor.White ? "W" : "B";
            }
            return "";
        }
    }
}
