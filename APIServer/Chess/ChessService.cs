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
using APIServer.Chess.Core;
using APIServer.Chess.Model;
using APIServer.PwdMan;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;

namespace APIServer.Chess
{
    public class ChessService : IChessService
    {
        public IConfiguration Configuration { get; }

        private DateTime? stateChanged;

        private readonly object mutex = new object();

        private readonly Dictionary<string, Context> userTickets = new Dictionary<string, Context>();

        private Chessboard chessboard;

        public ChessService(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        // --- without authentication

        public StateModel GetState()
        {
            var ret = new StateModel();
            lock (mutex)
            {
                var now = DateTime.Now;
                var nowUtc = DateTime.UtcNow;
                foreach (var pair in userTickets)
                {
                    var ctx = pair.Value;
                    var diff = (int)(now - ctx.LastAccess).TotalSeconds;
                    if (diff > GetOptions().SessionTimeout * 60) // reset game after inactivity
                    {
                        chessboard = null;
                        userTickets.Clear();
                        stateChanged = nowUtc;
                        break;
                    }
                }
                if (chessboard != null)
                {
                    if (!chessboard.GameOver)
                    {
                        chessboard.UpdateClocks();
                        if (chessboard.GameOver)
                        {
                            stateChanged = DateTime.UtcNow;
                        }
                    }
                    ret.BlackClock = chessboard.BlackClock;
                    ret.WhiteClock = chessboard.WhiteClock;
                }
                if (stateChanged.HasValue)
                {
                    ret.State = (long)(stateChanged.Value - DateTime.UnixEpoch).TotalMilliseconds;
                }
            }
            return ret;
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
                            return ret;
                        }
                    }
                }
                else if (pwdManService.IsRegisteredUsername(username))
                {
                    ret.IsAuthenticationRequired = true;
                    return ret;
                }
                if (!userTickets.Values.Any((v) => string.Equals(v.Name, username, StringComparison.OrdinalIgnoreCase))
                    && chessboard == null && userTickets.Count < 2
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
            }
            return ret;
        }

        // --- with authentication

        public bool Logout(string ticket)
        {
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null)
                {
                    chessboard = null;
                    userTickets.Remove(ticket);
                    stateChanged = DateTime.UtcNow;
                    return true;
                }
            }
            return false;
        }

        public ChessModel GetChessModel(string ticket)
        {
            lock (mutex)
            {
                var ret = new ChessModel
                {
                    State = GetState(),
                    AllUsers = GetAllUsers(),
                    IsBoardFull = chessboard != null
                };
                var ctx = GetContext(ticket);
                if (ctx != null)
                {
                    ret.CurrentUser = GetCurrentUser(ctx);
                }
                if (chessboard != null)
                {
                    ret.Board = new BoardModel();
                    ret.Board.WhitePlayer = chessboard.WhitePlayer;
                    ret.Board.BlackPlayer = chessboard.BlackPlayer;
                    ret.Board.CurrentColor = ConvertFigureColor(chessboard.CurrentColor);
                    ret.Board.LastMovedFigure = null;
                    ret.Board.LastMovedDestination = null;
                    if (chessboard.LastMovedFigure != null)
                    {
                        ret.Board.LastMovedFigure = ConvertFigure(chessboard.LastMovedFigure);
                        ret.Board.LastMovedDestination = new MoveModel
                        {
                            Row = chessboard.LastMovedDestination.Item1,
                            Column = chessboard.LastMovedDestination.Item2
                        };
                    }
                    ret.Board.TimeOut = chessboard.TimeOut;
                    ret.Board.KingStrike = chessboard.KingStrike;
                    ret.Board.CheckMate = chessboard.CheckMate;
                    ret.Board.StaleMate = chessboard.StaleMate;
                    ret.Board.Check = chessboard.Check;
                    ret.Board.GameOver = chessboard.GameOver;
                    if (chessboard.Winner.HasValue)
                    {
                        ret.Board.Winner = chessboard.Winner.Value == FigureColor.White ? ret.Board.WhitePlayer : ret.Board.BlackPlayer;
                    }
                    ret.Board.Figures = new List<FigureModel>();
                    foreach (var figure in chessboard.GetAllFigures())
                    {
                        var fm = ConvertFigure(figure);
                        if (!chessboard.GameOver &&
                            ret.CurrentUser != null &&
                            ret.CurrentUser.Name == chessboard.CurrentPlayer &&
                            figure.Color == chessboard.CurrentColor)
                        {
                            foreach (var move in chessboard.GetAllMoves(figure, ret.Board.Check))
                            {
                                fm.Moves.Add(new MoveModel { Row = move.Item1, Column = move.Item2 });
                            }
                        }
                        ret.Board.Figures.Add(fm);
                    }
                }
                return ret;
            }
        }

        public bool Place(string ticket, PlaceModel placeModel)
        {
            var ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null &&
                    chessboard != null &&
                    !chessboard.GameOver &&
                    ctx.Name == chessboard.CurrentPlayer)
                {
                    var figure = chessboard.Get(placeModel.FromRow, placeModel.FromColumn);
                    if (figure != null && figure.Color == chessboard.CurrentColor)
                    {
                        foreach (var move in chessboard.GetAllMoves(figure, chessboard.Check))
                        {
                            if (move.Item1 == placeModel.ToRow && move.Item2 == placeModel.ToColumn)
                            {
                                // ok to move
                                ret = chessboard.Place(figure, placeModel.ToRow, placeModel.ToColumn);
                                if (ret)
                                {
                                    chessboard.UpdateState();
                                }
                                break;
                            }
                        }
                    }
                }
                if (ret)
                {
                    stateChanged = DateTime.UtcNow;
                }
            }
            return ret;
        }

        public bool StartNewGame(string ticket)
        {
            var ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null)
                {
                    if (chessboard == null)
                    {
                        if (userTickets.Count == 2)
                        {
                            var users = userTickets.Values.OrderBy(ctx => ctx.Created).ToList();
                            chessboard = new Chessboard(users[0].Name, users[1].Name);
                            ret = true;
                        }
                    }
                }
                if (ret)
                {
                    stateChanged = DateTime.UtcNow;
                }
            }
            return ret;
        }

        // --- private

        private static UserModel GetCurrentUser(Context ctx)
        {
            return new UserModel { Name = ctx.Name };
        }

        private ChessOptions GetOptions()
        {
            var opt = Configuration.GetSection("Chess").Get<ChessOptions>();
            return opt ?? new ChessOptions();
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

        private static string ConvertFigureColor(FigureColor fc)
        {
            return fc == FigureColor.White ? "W" : "B";
        }

        private static string ConvertFigureType(FigureType ft)
        {
            var t = ft switch
            {
                FigureType.Rook => "R",
                FigureType.Knight => "N",
                FigureType.Bishop => "B",
                FigureType.Queen => "Q",
                FigureType.King => "K",
                FigureType.Pawn => "P",
                _ => throw new ArgumentException("Invalid figure type")
            };
            return t;
        }

        private static FigureModel ConvertFigure(Figure figure)
        {
            var fm = new FigureModel
            {
                Color = ConvertFigureColor(figure.Color),
                Type = ConvertFigureType(figure.Type),
                Row = figure.Row,
                Column = figure.Column,
                Moves = new List<MoveModel>()
            };
            return fm;
        }
    }
}
