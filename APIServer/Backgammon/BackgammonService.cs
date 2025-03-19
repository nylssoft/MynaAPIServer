/*
    Myna API Server
    Copyright (C) 2022-2025 Niels Stockfleth

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
using APIServer.APIError;
using APIServer.Backgammon.Core;
using APIServer.Backgammon.Model;
using APIServer.Extensions;
using APIServer.PwdMan;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Threading;

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

        private int pollCounter;

        public BackgammonService(IConfiguration configuration, ILogger<BackgammonService> logger)
        {
            Configuration = configuration;
            this.logger = logger;
        }

        // --- without authentication

        public long GetLongPollState(long clientState)
        {
            int newval = Interlocked.Increment(ref pollCounter);
            try
            {
                if (newval > 100)
                {
                    throw new APIException("Too many requests.", 409);
                }
                long state;
                var start = DateTime.Now;
                do
                {
                    state = GetState();
                    if (clientState != state)
                    {
                        break;
                    }
                    Task.Delay(1000).Wait();
                } while ((DateTime.Now - start).TotalSeconds < 45);
                return state;
            }
            finally
            {
                Interlocked.Decrement(ref pollCounter);
            }
        }

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

        // --- computer game (stateless)

        public BackgammonModel GetModel(string currentPlayerName, string opponentPlayerName, bool buildMoveTree, string state)
        {
            BackgammonBoard b;
            Context ctx = null;
            if (state != null)
            {
                b = GetBoard(state);
                ctx = new Context { Name = currentPlayerName };
            }
            else
            {
                b = new BackgammonBoard(currentPlayerName, opponentPlayerName);
            }
            var ret = new BackgammonModel();
            ret.CurrentUser = new UserModel() { Name = currentPlayerName, StartGameConfirmed = true };
            ret.Board = CreateBoardModel(ctx, b, buildMoveTree);
            ret.InternalState = GetInternalState(b);
            return ret;
        }

        public BackgammonModel Roll(string currentPlayerName, string state)
        {
            var ctx = new Context { Name = currentPlayerName };
            var b = GetBoard(state);
            if (!b.GameOver)
            {
                var currentColor = GetPlayerColor(currentPlayerName, b);
                if (!b.GameStarted)
                {
                    var startRollNumber = b.GetStartRollNumber(currentColor);
                    if (!startRollNumber.HasValue)
                    {
                        b.RollStartDice(currentColor);
                    }
                }
                else if (currentColor == b.CurrentColor && b.CurrentRoll == null)
                {
                    b.RollDice();
                }
            }
            return GetModel(ctx, b);
        }

        public BackgammonModel Move(string currentPlayerName, string state, MoveModel move)
        {
            var ctx = new Context { Name = currentPlayerName };
            var b = GetBoard(state);
            if (b.GameStarted &&
                !b.GameOver &&
                IsActiveUser(ctx, b))
            {
                b.Move(move.From, move.To);
            }
            return GetModel(ctx, b);
        }

        public BackgammonModel Skip(string currentPlayerName, string state)
        {
            var ctx = new Context { Name = currentPlayerName };
            var b = GetBoard(state);
            if (b.GameStarted &&
                !b.GameOver &&
                IsActiveUser(ctx, b))
            {
                b.Skip();
            }
            return GetModel(ctx, b);
        }

        public BackgammonModel GiveUp(string currentPlayerName, string state)
        {
            var ctx = new Context { Name = currentPlayerName };
            var b = GetBoard(state);
            if (b.GameStarted &&
                !b.GameOver &&
                IsActiveUser(ctx, b))
            {
                b.GiveUp = true;
            }
            return GetModel(ctx, b);
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
                    ret.Board = CreateBoardModel(ctx, board);
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
                    var currentColor = GetPlayerColor(ctx.Name, board);
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
                    IsActiveUser(ctx, board))
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
                    IsActiveUser(ctx, board))
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
                    IsActiveUser(ctx, board))
                {
                    board.Skip();
                    stateChanged = DateTime.UtcNow;
                }
                return GetStateChanged();
            }
        }

        // --- private

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

        private static BoardModel CreateBoardModel(Context ctx, BackgammonBoard b, bool buildMoveTree = false)
        {
            var m = new BoardModel();
            // board options and status
            m.WhitePlayer = b.WhitePlayer;
            m.BlackPlayer = b.BlackPlayer;
            m.GameOver = b.GameOver;
            m.GameStarted = b.GameStarted;
            m.NextGameRequested = b.NextGameRequested;
            m.CurrentColor = ConvertCheckerColor(b.CurrentColor);
            // reasons for game over and the winner
            m.GiveUp = b.GiveUp;
            m.Gammon = b.Gammon;
            m.Backgammon = b.Backgammon;
            if (b.Winner.HasValue)
            {
                m.Winner = b.Winner.Value == CheckerColor.White ? m.WhitePlayer : m.BlackPlayer;
            }
            m.HasStartRoll = false;
            m.CurrentRollNumbers = new List<int>();
            m.RemainingRollNumbers = new List<int>();
            m.DoubleRoll = null;
            m.Items = new List<ItemModel>();
            m.Moves = new List<MoveModel>();
            if (!b.GameStarted)
            {
                // start rolls
                var playerColor = ctx != null ? GetPlayerColor(ctx.Name, b) : CheckerColor.White;
                var opponentColor = GetOpponentColor(playerColor);
                var startRollPlayer = b.GetStartRollNumber(playerColor);
                var startRollOpponent = b.GetStartRollNumber(opponentColor);
                m.HasStartRoll = startRollPlayer.HasValue;
                if (startRollPlayer.HasValue)
                {
                    m.CurrentRollNumbers.Add(startRollPlayer.Value);
                }
                else if (startRollOpponent.HasValue)
                {
                    m.CurrentRollNumbers.Add(startRollOpponent.Value);
                }
                else if (b.CurrentRoll != null)
                {
                    m.DoubleRoll = b.CurrentRoll.Number1;
                }
            }
            else // game started
            {
                if (b.CurrentRoll != null)
                {
                    // current rolls and remaining rolls
                    m.CurrentRollNumbers.Add(b.CurrentRoll.Number1);
                    m.CurrentRollNumbers.Add(b.CurrentRoll.Number2);
                    m.RemainingRollNumbers.AddRange(b.GetRemainingRollNumbers());
                }
                // moves
                foreach (var move in b.GetAllMoves())
                {
                    m.Moves.Add(new MoveModel
                    {
                        From = move.Item1,
                        To = move.Item2
                    });
                }
                if (buildMoveTree)
                {
                    m.MoveTree = b.BuildMoveTree();
                }
            }
            // items
            foreach (var item in b.GetItems())
            {
                m.Items.Add(new ItemModel
                {
                    Color = ConvertCheckerColor(item.Color),
                    Count = item.Count,
                    Position = item.Position
                });
            }
            return m;
        }

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

        private static bool IsActiveUser(Context ctx, BackgammonBoard b)
        {
            return ctx != null && GetPlayerColor(ctx.Name, b) == b.CurrentColor;
        }

        private static CheckerColor GetPlayerColor(string playerName, BackgammonBoard b)
        {
            return (playerName == b.WhitePlayer) ? CheckerColor.White : CheckerColor.Black;
        }

        private static CheckerColor GetOpponentColor(CheckerColor color)
        {
            return (color == CheckerColor.White) ? CheckerColor.Black : CheckerColor.White;
        }

        private static BackgammonModel GetModel(Context ctx, BackgammonBoard b)
        {
            var ret = new BackgammonModel();
            ret.CurrentUser = new UserModel() { Name = ctx.Name, StartGameConfirmed = true };
            ret.Board = CreateBoardModel(ctx, b);
            ret.InternalState = GetInternalState(b);
            return ret;
        }

        private static BackgammonBoard GetBoard(string state)
        {
            return new BackgammonBoard(JsonSerializer.Deserialize<InternalState>(state.Decompress()));
        }

        private static string GetInternalState(BackgammonBoard b)
        {
            return JsonSerializer.Serialize(b.GetInternalState()).Compress();
        }
    }
}
