/*
    Myna API Server
    Copyright (C) 2020 Niels Stockfleth

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
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;

using APIServer.Skat.Model;
using APIServer.Skat.Core;

namespace APIServer.Skat
{
    public class SkatService : ISkatService
    {
        public IConfiguration Configuration { get; }

        private DateTime? stateChanged;

        private readonly object mutex = new object();

        private readonly Dictionary<string, Context> userTickets = new Dictionary<string, Context>();

        // @TODO: will be lost on restart => serialize e.g. into database
        private readonly List<string> loginHistory = new List<string>();

        private SkatTable skatTable;

        public SkatService(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        // --- without authentication

        public long GetState()
        {
            lock (mutex)
            {
                var now = DateTime.Now;
                foreach (var ctx in userTickets.Values)
                {
                    var diff = (int)(now - ctx.LastAccess).TotalMinutes;
                    if (diff > GetOptions().SessionTimeout) // reset game after inactivity
                    {
                        skatTable = null;
                        userTickets.Clear();
                        stateChanged = DateTime.UtcNow;
                    }
                }
                if (stateChanged.HasValue)
                {
                    return (long)(stateChanged.Value - DateTime.UnixEpoch).TotalMilliseconds;
                }
                return 0;
            }
        }

        public string Login(string username)
        {
            lock (mutex)
            {
                var allowedUsers = GetOptions().AllowedUsers;
                if (!userTickets.Values.Any((v) => v.Name.ToLowerInvariant() == username)
                    && userTickets.Count < 3
                    && username.Trim().Length > 0 &&
                    (allowedUsers == null || allowedUsers.Contains(username.ToLowerInvariant())))
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
                    if (loginHistory.Count == 100)
                    {
                        loginHistory.RemoveAt(0);
                    }
                    loginHistory.Add($"{ctx.Created} : {ctx.Name}");
                    return ticket;
                }
            }
            return null;
        }

        // --- with authentication

        public SkatModel GetSkatModel(string ticket)
        {
            lock (mutex)
            {
                var ret = new SkatModel { State = GetState(), AllUsers = GetAllUsers() };
                var ctx = GetContext(ticket);
                if (ctx != null)
                {
                    ret.CurrentUser = GetCurrentUser(ctx);
                    if (skatTable != null)
                    {
                        ret.SkatTable = GetSkatTableModel(ctx.Name);
                    }
                }
                return ret;
            }
        }

        public bool ConfirmStartGame(string ticket)
        {
            var ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null)
                {
                    ctx.StartGameConfirmed = true;
                    ret = true;
                }
                if (ret)
                {
                    stateChanged = DateTime.UtcNow;
                }
            }
            return ret;
        }

        public bool PerformBidAction(string ticket, string bidAction)
        {
            bool ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null &&
                    skatTable != null &&
                    Enum.TryParse(bidAction, true, out ActionType actionType))
                {
                    var player = GetPlayerByName(ctx.Name);
                    var stat = skatTable.GetPlayerStatus(player);
                    if (stat.ActionTypes.Contains(actionType))
                    {
                        skatTable.PerformPlayerAction(GetPlayerByName(ctx.Name), actionType);
                        ret = true;
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
                    if (skatTable == null)
                    {
                        if (userTickets.Count == 3)
                        {
                            var userNames = userTickets.Values
                                .OrderBy(ctx => ctx.Created)
                                .Select(ctx => ctx.Name).ToList();
                            skatTable = new SkatTable(userNames[0], userNames[1], userNames[2]);
                            ret = true;
                        }
                    }
                    else if (skatTable != null && skatTable.CanStartNewGame())
                    {
                        if (userTickets.Values.Count((user) => user.StartGameConfirmed == true) == 3)
                        {
                            skatTable.StartNewRound();
                            ret = true;
                        }
                    }
                }
                if (ret)
                {
                    foreach (var user in userTickets.Values)
                    {
                        user.StartGameConfirmed = false;
                    }
                    stateChanged = DateTime.UtcNow;
                }
            }
            return ret;
        }

        public bool GiveUp(string ticket)
        {
            var ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && skatTable != null)
                {
                    var player = GetPlayerByName(ctx.Name);
                    if (skatTable.CanGiveUp(player))
                    {
                        skatTable.GiveUp();
                        ret = true;
                    }
                }
                if (ret)
                {
                    stateChanged = DateTime.UtcNow;
                }
            }
            return ret;
        }

        public bool SetGame(string ticket, GameModel skatGameModel)
        {
            var ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && skatTable != null)
                {
                    var player = GetPlayerByName(ctx.Name);
                    if (Enum.TryParse(skatGameModel.Type, true, out GameType gameType))
                    {
                        if (gameType == GameType.Color)
                        {
                            if (Enum.TryParse(skatGameModel.Color, true, out CardColor gameColor))
                            {
                                player.Game.Type = gameType;
                                player.Game.Color = gameColor;
                                player.Game.Option = GameOption.None;
                                ret = true;
                            }
                        }
                        else
                        {
                            player.Game.Type = gameType;
                            player.Game.Option = GameOption.None;
                            ret = true;
                        }
                    }
                }
            }
            return ret;
        }

        public bool SetGameOption(string ticket, GameOptionModel gameOptionModel)
        {
            var ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && skatTable != null)
                {
                    GameOption gameOption = GameOption.None;
                    if (gameOptionModel.Ouvert)
                    {
                        gameOption |= GameOption.Ouvert;
                    }
                    if (gameOptionModel.Hand)
                    {
                        gameOption |= GameOption.Hand;
                    }
                    if (gameOptionModel.Schneider)
                    {
                        gameOption |= GameOption.Schneider;
                    }
                    if (gameOptionModel.Schwarz)
                    {
                        gameOption |= GameOption.Schwarz;
                    }
                    var player = GetPlayerByName(ctx.Name);
                    skatTable.SetGameOption(player, gameOption);
                    ret = true;
                }
            }
            return ret;
        }

        public bool PlayCard(string ticket, int internalCardNumber)
        {
            var ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && skatTable != null)
                {
                    var player = GetPlayerByName(ctx.Name);
                    foreach (var c in player.Cards)
                    {
                        if (c.InternalNumber == internalCardNumber)
                        {
                            skatTable.PlayCard(player, c);
                            ret = true;
                            break;
                        }
                    }
                }
                if (ret && skatTable.GameStarted)
                {
                    stateChanged = DateTime.UtcNow;
                }
            }
            return ret;
        }

        public bool CollectStitch(string ticket)
        {
            var ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && skatTable != null)
                {
                    var player = GetPlayerByName(ctx.Name);
                    if (skatTable.CanCollectStitch(player))
                    {
                        skatTable.CollectStitch(player);
                        ret = true;
                    }
                }
                if (ret)
                {
                    stateChanged = DateTime.UtcNow;
                }
            }
            return ret;
        }

        public bool PickupSkat(string ticket, int internalCardNumber)
        {
            var ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && skatTable != null)
                {
                    var player = GetPlayerByName(ctx.Name);
                    if (skatTable.CanPickupSkat(player))
                    {
                        foreach (var card in skatTable.Skat)
                        {
                            if (card.InternalNumber == internalCardNumber)
                            {
                                skatTable.PickupSkat(player, card);
                                ret = true;
                                break;
                            }
                        }
                    }
                }
            }
            return ret;
        }

        // --- with admin privileges

        public bool Reset(string ticket)
        {
            lock (mutex)
            {
                if (IsAdminTicket(ticket))
                {
                    skatTable = null;
                    userTickets.Clear();
                    stateChanged = DateTime.UtcNow;
                    return true;
                }
            }
            return false;
        }

        public List<string> GetLoggedInUsers(string ticket)
        {
            lock (mutex)
            {
                if (IsAdminTicket(ticket))
                {
                    var ret = new List<string>();
                    foreach (var t in userTickets)
                    {
                        ret.Add($"[{t.Key}] => {t.Value.Name} / {t.Value.Created} / {t.Value.LastAccess}");
                    }
                    ret.AddRange(loginHistory);
                    return ret;
                }
            }
            return null;
        }

        // --- private

        private SkatOptions GetOptions()
        {
            var opt = Configuration.GetSection("Skat").Get<SkatOptions>();
            return opt ?? new SkatOptions();
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

        private bool IsAdminTicket(string ticket)
        {
            return ticket == GetOptions().AdminTicket;
        }

        private Player GetPlayerByName(string username)
        {
            return skatTable.Players.FirstOrDefault((p) => p.Name == username);
        }

        private List<UserModel> GetAllUsers()
        {
            var ret = new List<UserModel>();
            var users = userTickets.Values.OrderBy(ctx => ctx.Created).ToList();
            foreach (var user in users)
            {
                ret.Add(new UserModel { Name = user.Name, StartGameConfirmed = user.StartGameConfirmed });
            }
            return ret;
        }

        private UserModel GetCurrentUser(Context ctx)
        {
            return new UserModel { Name = ctx.Name, StartGameConfirmed = ctx.StartGameConfirmed };
        }

        private GameModel GetSkatGameModel(Game game)
        {
            GameModel ret = null;
            if (game != null)
            {
                ret = new GameModel
                {
                    Name = game.GetGameText(),
                    Description = game.GetGameAndOptionText(),
                    Type = game.Type.ToString(),
                    Color = game.Color.ToString(),
                };
                ret.Option.Ouvert = game.Option.HasFlag(GameOption.Ouvert);
                ret.Option.Hand = game.Option.HasFlag(GameOption.Hand);
                ret.Option.Schneider = game.Option.HasFlag(GameOption.Schneider);
                ret.Option.Schwarz = game.Option.HasFlag(GameOption.Schwarz);
            }
            return ret;
        }

        private PlayerModel GetSkatPlayerModel(Player player, string summary = "")
        {
            PlayerModel ret = null;
            if (player != null)
            {
                var game = GetSkatGameModel(player.Game);
                ret = new PlayerModel { Name = player.Name, Game = game, Summary = summary };
            }
            return ret;
        }

        private TableModel GetSkatTableModel(string username)
        {
            var player = GetPlayerByName(username);
            var stat = skatTable.GetPlayerStatus(player);
            var model = new TableModel();
            model.Player = GetSkatPlayerModel(player);
            model.GamePlayer = GetSkatPlayerModel(skatTable.GamePlayer);
            var currentPlayer = skatTable.CurrentPlayer;
            if (currentPlayer == null && !skatTable.GameStarted && !skatTable.GameEnded)
            {
                if (skatTable.GamePlayer != null)
                {
                    currentPlayer = skatTable.GamePlayer;
                }
                else
                {
                    foreach (var p in skatTable.Players)
                    {
                        if (p.BidStatus == BidStatus.Accept && skatTable.BidSaid ||
                            p.BidStatus == BidStatus.Bid && !skatTable.BidSaid)
                        {
                            currentPlayer = p;
                            break;
                        }
                    }
                }
            }
            model.CurrentPlayer = GetSkatPlayerModel(currentPlayer);
            model.Message = stat.Header;
            model.SkatTaken = skatTable.SkatTaken;
            model.GameStarted = skatTable.GameStarted;
            model.GameEnded = skatTable.GameEnded;
            model.CanCollectStitch = skatTable.CanCollectStitch(player);
            model.CanGiveUp = skatTable.CanGiveUp(player);
            model.CanPickupSkat = skatTable.CanPickupSkat(player);
            model.CanSetHand = skatTable.CanSetHand(player);
            model.CanSetOuvert = skatTable.CanSetOuvert(player);
            model.CanSetSchneider = skatTable.CanSetSchneider(player);
            model.CanSetSchwarz = skatTable.CanSetSchwarz(player);
            model.CanStartNewGame = skatTable.CanStartNewGame();
            model.CanViewLastStitch = skatTable.CanViewLastStitch(player);
            for (int idx = 0; idx < stat.ActionTypes.Count; idx++)
            {
                model.Actions.Add(new ActionModel { Name = stat.ActionTypes[idx].ToString(), Description = stat.ActionLabels[idx] });
            }
            player.SortCards();
            foreach (var card in player.Cards)
            {
                model.Cards.Add(GetSkatCardModel(card));
            }
            if (!skatTable.GameStarted && skatTable.SkatTaken && skatTable.GamePlayer == player)
            {
                foreach (var card in skatTable.Skat)
                {
                    model.Skat.Add(GetSkatCardModel(card));
                }
            }
            if (skatTable.GamePlayer == player && skatTable.SkatTaken && !skatTable.GameStarted ||
                skatTable.GameStarted && skatTable.CurrentPlayer == player)
            {
                foreach (var card in player.Cards)
                {
                    if (skatTable.CanPlayCard(player, card))
                    {
                        model.PlayableCards.Add(GetSkatCardModel(card));
                    }
                }
            }
            if (skatTable.GameStarted)
            {
                foreach (var card in skatTable.LastStitch)
                {
                    model.LastStitch.Add(GetSkatCardModel(card));
                }
                foreach (var card in skatTable.Stitch)
                {
                    model.Stitch.Add(GetSkatCardModel(card));
                }
                if (player != skatTable.GamePlayer && skatTable.GamePlayer.Game.Option.HasFlag(GameOption.Ouvert))
                {
                    skatTable.GamePlayer.SortCards();
                    foreach (var card in skatTable.GamePlayer.Cards)
                    {
                        model.Ouvert.Add(GetSkatCardModel(card));
                    }
                }
            }
            if (skatTable.GameEnded)
            {
                foreach (var card in player.Stitches)
                {
                    model.Stitches.Add(GetSkatCardModel(card));
                }
                if (skatTable.GamePlayer == player)
                {
                    foreach (var card in skatTable.Skat)
                    {
                        model.Stitches.Add(GetSkatCardModel(card));
                    }
                }
            }
            foreach (var p in skatTable.Players)
            {
                var txt = $"{p.Name}, {p.GetPositionText()}";
                if (skatTable.GameStarted && skatTable.GamePlayer == p)
                {
                    txt += $", {p.Game.GetGameText()}";
                }
                txt += $", {p.Score} Punkte";
                if (player == p)
                {
                    txt += $", Spiel {skatTable.GameCounter}";
                }
                model.Players.Add(GetSkatPlayerModel(p, txt));
            }
            return model;
        }

        private CardModel GetSkatCardModel(Card card)
        {
            var cardmodel = new CardModel();
            cardmodel.OrderNumber = card.InternalNumber;
            cardmodel.Color = $"{card.Color}";
            cardmodel.Value = $"{card.Value}";
            cardmodel.Description = card.ToString();
            return cardmodel;
        }
    }
}
