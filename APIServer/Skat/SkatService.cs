/*
    Myna API Server
    Copyright (C) 2020-2021 Niels Stockfleth

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
using System.Linq;
using System.Text.Json;
using System.Threading;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

using APIServer.Skat.Model;
using APIServer.Skat.Core;
using APIServer.PwdMan;
using APIServer.Database;

namespace APIServer.Skat
{
    public class SkatService : ISkatService
    {
        public IConfiguration Configuration { get; }

        private DateTime? stateChanged;

        private readonly object mutex = new object();

        private readonly Dictionary<string, Context> userTickets = new Dictionary<string, Context>();

        private long chatState;

        private readonly ILogger logger;

        private SkatTable skatTable;
        
        private ReservationModel nextReservation;

        private long? skatResultId;

        private DateTime lastCardPlayed;

        public SkatService(IConfiguration configuration, ILogger<SkatService> logger)
        {
            Configuration = configuration;
            this.logger = logger;
        }

        // --- without authentication

        public long GetState()
        {
            lock (mutex)
            {
                var now = DateTime.Now;
                var nowUtc = DateTime.UtcNow;
                var removeTickets = new List<string>();
                int elapsed = 0;
                if (nextReservation != null)
                {
                    elapsed = (int)(nextReservation.ReservedUtc - nowUtc).TotalSeconds;
                }
                foreach (var pair in userTickets)
                {
                    var ctx = pair.Value;
                    var diff = (int)(now - ctx.LastAccess).TotalSeconds;
                    if (diff > GetOptions().SessionTimeout * 60) // reset game after inactivity
                    {
                        skatTable = null;
                        userTickets.Clear();
                        stateChanged = nowUtc;
                        break;
                    }
                    if (nextReservation != null &&
                        elapsed <= 600 &&
                        !ContainsCaseInsensitive(nextReservation.Players, ctx.Name))
                    {
                        if (elapsed <= 0)
                        {
                            removeTickets.Add(pair.Key);
                        }
                        else if (diff >= 60 || diff >= 1 && elapsed <= 120)
                        {
                            stateChanged = nowUtc;
                        }
                    }
                }
                if (removeTickets.Count > 0)
                {
                    foreach (var ticket in removeTickets)
                    {
                        userTickets.Remove(ticket);
                    }
                    skatTable = null;
                    stateChanged = nowUtc;
                }
                if (stateChanged.HasValue)
                {
                    return (long)(stateChanged.Value - DateTime.UnixEpoch).TotalMilliseconds;
                }
                return 0;
            }
        }

        public LoginModel Login(IPwdManService pwdManService, string authenticationToken, string username)
        {
            if (!VerifyReservation(pwdManService, new [] { username }))
            {
                throw new PwdManInvalidArgumentException("Der Tisch ist bereits reserviert.");
            }
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
                var allowedUsers = GetOptions().AllowedUsers;
                if (!userTickets.Values.Any((v) => string.Equals(v.Name, username, StringComparison.OrdinalIgnoreCase))
                    && skatTable == null && userTickets.Count < 4
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
                    ret.Ticket = ticket;
                    UpdateNextReservation(pwdManService);
                }
            }
            return ret;
        }

        public ChatModel GetChatModel(IPwdManService pwdManService)
        {
            var dbContext = pwdManService.GetDbContext();
            var chats = dbContext.DbChats.Include(c => c.DbUser).OrderBy(c => c.CreatedUtc);
            var chatModel = new ChatModel();
            lock (mutex)
            {
                chatModel.State = chatState;
            }
            foreach (var chat in chats)
            {
                chatModel.History.Add(new ChatTextModel
                {
                    CreatedUtc = DbMynaContext.GetUtcDateTime(chat.CreatedUtc).Value,
                    Username = chat.DbUser.Name,
                    Message = chat.Message
                });
            }
            return chatModel;
        }

        public bool Chat(IPwdManService pwdManService, string authenticationToken, string message)
        {
            string msg = message.Trim();
            if (msg.Length == 0) return false;
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            dbContext.DbChats.Add(new DbChat { CreatedUtc = DateTime.UtcNow, DbUserId = user.Id, Message = msg });
            dbContext.SaveChanges();
            lock (mutex)
            {
                stateChanged = DateTime.UtcNow;
                chatState = (long)(stateChanged.Value - DateTime.UnixEpoch).TotalMilliseconds;
            }
            return true;
        }

        // --- with authentication

        public bool Logout(string ticket)
        {
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null)
                {
                    skatTable = null;
                    userTickets.Remove(ticket);
                    stateChanged = DateTime.UtcNow;
                    return true;
                }
            }
            return false;
        }

        public SkatModel GetSkatModel(string ticket)
        {
            lock (mutex)
            {
                var ret = new SkatModel { State = GetState(), AllUsers = GetAllUsers(), IsTableFull = skatTable != null };
                var ctx = GetContext(ticket);
                if (ctx != null)
                {
                    ret.CurrentUser = GetCurrentUser(ctx);
                }
                if (skatTable != null)
                {
                    ret.SkatTable = GetTableModel(ctx);
                }
                ret.NextReservation = nextReservation;
                return ret;
            }
        }

        public GameHistoryModel GetGameHistoryModel(string ticket)
        {
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && skatTable != null && skatTable.CurrentHistory != null &&
                    skatTable.GameEnded)
                {
                    return GetGameHistoryModel(skatTable.CurrentHistory);
                }
                return null;
            }
        }

        public ResultModel GetResultModel(string ticket)
        {
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && skatTable != null)
                {
                    return GetSkatResultModel(skatTable.TablePlayers, skatTable.SkatResult);
                }
                return null;
            }
        }

        public ResultModel GetResultModelById(IPwdManService pwdManService, string authenticationToken, long skatResultId)
        {
            ResultModel ret = null;
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            DbSkatResult skatResult = null;
            if (pwdManService.HasRole(user, "skatadmin"))
            {
                skatResult = dbContext.DbSkatResults
                    .Include(r => r.SkatGameHistories)
                    .Single(r => r.Id == skatResultId);
            }
            else
            {
                var userSkatResults = dbContext.DbUserSkatResults
                    .Include(u => u.DbSkatResult).ThenInclude(s => s.SkatGameHistories)
                    .Where(u => u.DbSkatResultId == skatResultId && u.DbUserId == user.Id);
                if (userSkatResults.Count() == 1)
                {
                    skatResult = userSkatResults.First().DbSkatResult;
                }
            }
            if (skatResult != null)
            {
                ret = new ResultModel
                {
                    Id = skatResult.Id,
                    StartedUtc = DbMynaContext.GetUtcDateTime(skatResult.StartedUtc),
                    EndedUtc = DbMynaContext.GetUtcDateTime(skatResult.EndedUtc),
                    PlayerNames = new List<string>(),
                    History = new List<GameHistoryModel>()
                };
                ret.PlayerNames.Add(skatResult.Player1);
                ret.PlayerNames.Add(skatResult.Player2);
                ret.PlayerNames.Add(skatResult.Player3);
                if (!string.IsNullOrEmpty(skatResult.Player4))
                {
                    ret.PlayerNames.Add(skatResult.Player4);
                }
                foreach (var h in skatResult.SkatGameHistories)
                {
                    ret.History.Add(JsonSerializer.Deserialize<GameHistoryModel>(h.History));
                }
            }
            return ret;
        }

        public List<ResultModel> GetResultModels(IPwdManService pwdManService, string authenticationToken)
        {
            var ret = new List<ResultModel>();
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            List<DbSkatResult> skatResults;
            if (pwdManService.HasRole(user, "skatadmin"))
            {
                skatResults = dbContext.DbSkatResults.OrderByDescending(r => r.StartedUtc).ToList();
            }
            else
            {
                var userSkatResults = dbContext.DbUserSkatResults
                    .Include(u => u.DbSkatResult)
                    .Where(u => u.DbUserId == user.Id)
                    .OrderByDescending(u => u.DbSkatResult.StartedUtc);
                skatResults = new List<DbSkatResult>();
                foreach (var userSkatResult in userSkatResults)
                {
                    skatResults.Add(userSkatResult.DbSkatResult);
                }
            }
            foreach (var skatResult in skatResults)
            {
                var m = new ResultModel
                {
                    Id = skatResult.Id,
                    StartedUtc = DbMynaContext.GetUtcDateTime(skatResult.StartedUtc),
                    EndedUtc = DbMynaContext.GetUtcDateTime(skatResult.EndedUtc),
                    PlayerNames = new List<string>()
                };
                m.PlayerNames.Add(skatResult.Player1);
                m.PlayerNames.Add(skatResult.Player2);
                m.PlayerNames.Add(skatResult.Player3);
                if (!string.IsNullOrEmpty(skatResult.Player4))
                {
                    m.PlayerNames.Add(skatResult.Player4);
                }
                ret.Add(m);
            }
            return ret;
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

        public bool SpeedUp(string ticket)
        {
            var ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && skatTable != null)
                {
                    var player = GetPlayerByName(ctx.Name);
                    if (player != null && skatTable.CanSpeedUp(player))
                    {
                        skatTable.IsSpeedUp = true;
                        ctx.SpeedUpConfirmed = true;
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

        public bool ConfirmSpeedUp(IPwdManService pwdManService, string ticket)
        {
            var ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && skatTable?.IsSpeedUp == true && !ctx.SpeedUpConfirmed)
                {
                    ctx.SpeedUpConfirmed = true;
                    var playerNames = skatTable.Players.Select((p) => p.Name).ToList();
                    var confirmedCount = userTickets.Values.Count((ctx) => playerNames.Contains(ctx.Name) && ctx.SpeedUpConfirmed);
                    if (confirmedCount == 3)
                    {
                        skatTable.SpeedUpConfirmed();
                        AddGameHistory(pwdManService);
                    }
                    ret = true;
                }
                if (ret)
                {
                    stateChanged = DateTime.UtcNow;
                }
            }
            return ret;
        }

        public bool ContinuePlay(string ticket)
        {
            var ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && skatTable?.IsSpeedUp == true)
                {
                    skatTable.IsSpeedUp = false;
                    foreach (var c in userTickets.Values)
                    {
                        c.SpeedUpConfirmed = false;
                    }
                    ret = true;
                }
                if (ret)
                {
                    stateChanged = DateTime.UtcNow;
                }
            }
            return ret;
        }

        public bool PerformBidAction(IPwdManService pwdManService, string ticket, string bidAction)
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
                    if (player != null)
                    {
                        var stat = skatTable.GetPlayerStatus(player);
                        if (stat.ActionTypes.Contains(actionType))
                        {
                            skatTable.PerformPlayerAction(player, actionType);
                            if (skatTable.GameEnded)
                            {
                                AddGameHistory(pwdManService);
                            }
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

        public bool StartNewGame(IPwdManService pwdManService, string ticket)
        {
            var ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null)
                {
                    if (skatTable == null)
                    {
                        if (userTickets.Count >= 3 && userTickets.Count <= 4)
                        {
                            var users = userTickets.Values.OrderBy(ctx => ctx.Created).ToList();
                            var inactivePlayerName = userTickets.Count == 4 ? users[3].Name : null;
                            if (!VerifyReservation(pwdManService, new [] { users[0].Name, users[1].Name, users[2].Name, inactivePlayerName }))
                            {
                                userTickets.Clear();
                                stateChanged = DateTime.UtcNow;
                                return false;
                            }
                            skatTable = new SkatTable(users[0].Name, users[1].Name, users[2].Name, inactivePlayerName);
                            ret = true;
                            AddSkatResult(pwdManService);
                            UpdateNextReservation(pwdManService);
                        }
                    }
                    else if (skatTable != null && skatTable.CanStartNewGame())
                    {
                        var playerNames = skatTable.Players.Select((p) => p.Name).ToList();
                        if (userTickets.Values.Count((user) => playerNames.Contains(user.Name) && user.StartGameConfirmed == true) == 3)
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
                        user.SpeedUpConfirmed = false;
                    }
                    stateChanged = DateTime.UtcNow;
                }
            }
            return ret;
        }

        public bool GiveUp(IPwdManService pwdManService, string ticket)
        {
            var ret = false;
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && skatTable != null)
                {
                    var player = GetPlayerByName(ctx.Name);
                    if (player != null && skatTable.CanGiveUp(player))
                    {
                        skatTable.GiveUp();
                        ret = true;
                        AddGameHistory(pwdManService);
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
                    if (player != null && Enum.TryParse(skatGameModel.Type, true, out GameType gameType))
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
                    if (player != null)
                    {
                        skatTable.SetGameOption(player, gameOption);
                        ret = true;
                    }
                }
            }
            return ret;
        }

        public bool PlayCard(IPwdManService pwdManService, string ticket, int internalCardNumber)
        {
            var ret = false;
            int sleepms = 0;
            lock (mutex)
            {
                if (skatTable != null && skatTable.GameStarted && skatTable.Stitch.Count == 3)
                {
                    sleepms = 3000 - (int)(DateTime.Now - lastCardPlayed).TotalMilliseconds;
                }
            }
            if (sleepms > 0)
            {
                Thread.Sleep(sleepms);
            }
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && skatTable != null)
                {
                    var player = GetPlayerByName(ctx.Name);
                    if (player != null)
                    {
                        foreach (var c in player.Cards)
                        {
                            if (c.InternalNumber == internalCardNumber)
                            {
                                skatTable.PlayCard(player, c);
                                lastCardPlayed = DateTime.Now;
                                ret = true;
                                break;
                            }
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

        public bool CollectStitch(IPwdManService pwdManService, string ticket)
        {
            var ret = false;
            int sleepms = 0;
            lock (mutex)
            {
                sleepms = 3000 - (int)(DateTime.Now - lastCardPlayed).TotalMilliseconds;
            }
            if (sleepms > 0)
            {
                Thread.Sleep(sleepms);
            }
            lock (mutex)
            {
                var ctx = GetContext(ticket);
                if (ctx != null && skatTable != null)
                {
                    var player = GetPlayerByName(ctx.Name);
                    if (player != null && skatTable.CanCollectStitch(player))
                    {
                        skatTable.CollectStitch(player);
                        if (player.Cards.Count == 0)
                        {
                            AddGameHistory(pwdManService);
                        }
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
                    if (player != null && skatTable.CanPickupSkat(player))
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

        // --- with skatadmin user role

        public bool DeleteResultModelById(IPwdManService pwdManService, string authenticationToken, long skatResultId)
        {
            var user = pwdManService.GetUserFromToken(authenticationToken);
            if (!pwdManService.HasRole(user, "skatadmin"))
            {
                throw new AccessDeniedPermissionException();
            }
            var dbContext = pwdManService.GetDbContext();
            var skatResult = dbContext.DbSkatResults
                .Include(r => r.SkatGameHistories)
                .SingleOrDefault(r => r.Id == skatResultId);
            if (skatResult != null)
            {
                dbContext.DbSkatResults.Remove(skatResult);
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public bool Reset(IPwdManService pwdManService, string authenticationToken)
        {
            var user = pwdManService.GetUserFromToken(authenticationToken);
            if (!pwdManService.HasRole(user, "skatadmin"))
            {
                throw new AccessDeniedPermissionException();
            }
            var dbContext = pwdManService.GetDbContext();
            dbContext.DbChats.RemoveRange(dbContext.DbChats);
            dbContext.SaveChanges();
            lock (mutex)
            {
                skatTable = null;
                userTickets.Clear();
                stateChanged = DateTime.UtcNow;
                chatState = (long)(stateChanged.Value - DateTime.UnixEpoch).TotalMilliseconds;
            }
            return true;
        }

        public List<string> GetLoggedInUsers(IPwdManService pwdManService, string authenticationToken)
        {
            var user = pwdManService.GetUserFromToken(authenticationToken);
            if (!pwdManService.HasRole(user, "skatadmin"))
            {
                throw new AccessDeniedPermissionException();
            }
            lock (mutex)
            {
                var ret = new List<string>();
                foreach (var t in userTickets)
                {
                    ret.Add($"[{t.Key}] => {t.Value.Name} / {t.Value.Created} / {t.Value.LastAccess}");
                }
                return ret;
            }
        }

        // --- reservations

        public List<ReservationModel> GetReservations(IPwdManService pwdManService)
        {
            var ret = new List<ReservationModel>();
            var dbContext = pwdManService.GetDbContext();
            var now = DateTime.UtcNow;
            var reservations = dbContext.DbSkatReservations.Include(r => r.ReservedBy).OrderBy(r => r.ReservedUtc);
            var cleanup = new List<DbSkatReservation>();
            foreach (var r in reservations)
            {
                var reserved = DbMynaContext.GetUtcDateTime(r.ReservedUtc).Value;
                if (reserved.AddMinutes(r.Duration) < now)
                {
                    cleanup.Add(r);
                }
                else
                {
                    ret.Add(GetReservationModel(r));
                }
            }
            if (cleanup.Count > 0)
            {
                dbContext.DbSkatReservations.RemoveRange(cleanup);
                dbContext.SaveChanges();
                lock (mutex)
                {
                    stateChanged = DateTime.UtcNow;
                }
            }
            return ret;
        }

        public bool AddReservation(IPwdManService pwdManService, string authenticationToken, ReservationModel reservationModel)
        {
            var nowUtc = DateTime.UtcNow;
            var lowest = new DateTime(nowUtc.Year, nowUtc.Month, nowUtc.Day, nowUtc.Hour, 0, 0, DateTimeKind.Utc);
            var highest = nowUtc.AddMonths(2);
            if (reservationModel.ReservedUtc < lowest || reservationModel.ReservedUtc > highest)
            {
                throw new PwdManInvalidArgumentException("Ungültiges Reservierungsdatum.");
            }
            if (reservationModel.Duration < 60 || reservationModel.Duration > 240)
            {
                throw new PwdManInvalidArgumentException("Ungültige Reservierungsdauer.");
            }
            if (reservationModel.Players == null)
            {
                throw new PwdManInvalidArgumentException("Spielernamen sind ungültig.");
            }
            var playerNames = new List<string>();
            foreach (var p in reservationModel.Players)
            {
                var name = p.Trim();
                if (string.IsNullOrEmpty(name) || name.Length > Limits.MAX_USERNAME || ContainsCaseInsensitive(playerNames, name))
                {
                    throw new PwdManInvalidArgumentException("Ungültiger Spielername.");
                }
                playerNames.Add(name);
            }
            if (playerNames.Count < 3 || playerNames.Count > 4)
            {
                throw new PwdManInvalidArgumentException("Es sind mindestens 3 Spieler erforderlich für eine Reservierung.");
            }
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var dbSkatReservation = new DbSkatReservation
            {
                ReservedById = user.Id,
                Duration = reservationModel.Duration,
                ReservedUtc = reservationModel.ReservedUtc,
                Player1 = playerNames[0],
                Player2 = playerNames[1],
                Player3 = playerNames[2]
            };
            if (playerNames.Count > 3)
            {
                dbSkatReservation.Player4 = playerNames[3];
            }
            dbContext.DbSkatReservations.Add(dbSkatReservation);
            dbContext.SaveChanges();
            lock (mutex)
            {
                stateChanged = DateTime.UtcNow;
            }
            return true;
        }

        public bool DeleteReservation(IPwdManService pwdManService, string authenticatioToken, long id)
        {
            var user = pwdManService.GetUserFromToken(authenticatioToken);
            var dbContext = pwdManService.GetDbContext();
            DbSkatReservation reservation = null;
            if (pwdManService.HasRole(user, "skatadmin"))
            {
                reservation = dbContext.DbSkatReservations.SingleOrDefault(r => r.Id == id);
            }
            else
            {
                reservation = dbContext.DbSkatReservations.SingleOrDefault(r => r.ReservedById == user.Id && r.Id == id);
            }
            if (reservation != null)
            {
                dbContext.DbSkatReservations.Remove(reservation);
                dbContext.SaveChanges();
                lock (mutex)
                {
                    stateChanged = DateTime.UtcNow;
                }
                return true;
            }
            return false;
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

        private static UserModel GetCurrentUser(Context ctx)
        {
            return new UserModel { Name = ctx.Name, StartGameConfirmed = ctx.StartGameConfirmed };
        }

        private static GameModel GetSkatGameModel(Game game)
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

        private static ResultModel GetSkatResultModel(List<Player> players, SkatResult skatResult)
        {
            var ret = new ResultModel
            {
                StartedUtc = skatResult.StartedUtc,
                EndedUtc = skatResult.EndedUtc
            };
            foreach (var p in players)
            {
                ret.PlayerNames.Add(p.Name);
            }
            foreach (var h in skatResult.History)
            {
                ret.History.Add(GetGameHistoryModel(h));
            }
            return ret;
        }

        private static GameHistoryModel GetGameHistoryModel(GameHistory gameHistory)
        {
            var ret = new GameHistoryModel();
            ret.GameText = gameHistory.GameText;
            ret.GamePlayerName = gameHistory.GamePlayerName;
            ret.GamePlayerScore = gameHistory.GamePlayerScore;
            ret.GameValue = gameHistory.GameValue;
            foreach (var tuple in gameHistory.PlayerCards)
            {
                var playerCards = new List<CardModel>();
                foreach (var card in tuple.Item2)
                {
                    playerCards.Add(GetSkatCardModel(card));
                }
                ret.PlayerCards.Add(new PlayerCardsModel { PlayerName = tuple.Item1, Cards = playerCards });
            }
            foreach (var card in gameHistory.Skat)
            {
                ret.Skat.Add(GetSkatCardModel(card));
            }
            foreach (var card in gameHistory.Back)
            {
                ret.Back.Add(GetSkatCardModel(card));
            }
            foreach (var tuple in gameHistory.Played)
            {
                ret.Played.Add(new PlayedCardModel { Player = tuple.Item1, Card = GetSkatCardModel(tuple.Item2) });
            }
            return ret;
        }

        private static PlayerModel GetPlayerModel(Player player, string summary = "")
        {
            PlayerModel ret = null;
            if (player != null)
            {
                var game = GetSkatGameModel(player.Game);
                ret = new PlayerModel {
                    Name = player.Name,
                    Game = game,
                    Summary = summary,
                    BidStatus = player.BidStatus };
            }
            return ret;
        }

        private TableModel GetTableModel(Context ctx)
        {
            var model = new TableModel();
            var player = GetPlayerByName(ctx?.Name);
            if (player != null)
            {
                var stat = skatTable.GetPlayerStatus(player);
                model.Player = GetPlayerModel(player);
                model.Player.Tooltip = stat.Tooltip;
                model.Message = stat.Header;
                for (int idx = 0; idx < stat.ActionTypes.Count; idx++)
                {
                    model.Actions.Add(new ActionModel { Name = stat.ActionTypes[idx].ToString(), Description = stat.ActionLabels[idx] });
                }
            }
            if (skatTable.InactivePlayer != null)
            {
                model.InactivePlayer = GetPlayerModel(skatTable.InactivePlayer, $"{skatTable.InactivePlayer.Name}, {skatTable.InactivePlayer.Score} Punkte");
                if (skatTable.InactivePlayer.Name == ctx?.Name)
                {
                    var stat = skatTable.GetPlayerStatus(skatTable.InactivePlayer);
                    model.InactivePlayer.Tooltip = stat.Tooltip;
                    model.Message = stat.Header;
                }
            }
            if (ctx == null)
            {
                model.Message = skatTable.GetPlayerStatus(null).Header;
            }
            model.GamePlayer = GetPlayerModel(skatTable.GamePlayer);
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
            model.CurrentPlayer = GetPlayerModel(currentPlayer);
            model.SkatTaken = skatTable.SkatTaken;
            model.GameStarted = skatTable.GameStarted;
            model.GameEnded = skatTable.GameEnded;
            model.IsSpeedUp = skatTable.IsSpeedUp;
            model.CanCollectStitch = player != null && skatTable.CanCollectStitch(player);
            model.CanGiveUp = player != null && skatTable.CanGiveUp(player);
            model.CanSpeedUp = player != null && skatTable.CanSpeedUp(player);
            model.CanConfirmSpeedUp = player != null &&
                skatTable.GameStarted &&
                !skatTable.GameEnded &&
                skatTable.IsSpeedUp &&
                !ctx.SpeedUpConfirmed;
            model.CanPickupSkat = player != null && skatTable.CanPickupSkat(player);
            model.CanSetHand = player != null && skatTable.CanSetHand(player);
            model.CanSetOuvert = player != null && skatTable.CanSetOuvert(player);
            model.CanSetSchneider = player != null && skatTable.CanSetSchneider(player);
            model.CanSetSchwarz = player != null && skatTable.CanSetSchwarz(player);
            model.CanStartNewGame = skatTable.CanStartNewGame();
            model.CanViewLastStitch = player != null && skatTable.CanViewLastStitch(player);
            model.BidSaid = skatTable.BidSaid;
            model.CurrentBidValue = skatTable.CurrentBidValue;
            if (player != null)
            {
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
                if (player != skatTable.GamePlayer && 
                    (skatTable.GamePlayer.Game.Option.HasFlag(GameOption.Ouvert) || skatTable.IsSpeedUp))
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
                if (player != null)
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
            }
            model.GameCounter = skatTable.GameCounter;
            foreach (var p in skatTable.TablePlayers)
            {
                model.Players.Add(GetPlayerModel(p, $"{p.Name}, {p.Score} Punkte"));
            }
            return model;
        }

        private static CardModel GetSkatCardModel(Card card)
        {
            var cardmodel = new CardModel();
            cardmodel.OrderNumber = card.InternalNumber;
            cardmodel.Color = $"{card.Color}";
            cardmodel.Value = $"{card.Value}";
            cardmodel.Description = card.ToString();
            return cardmodel;
        }

        private static ReservationModel GetReservationModel(DbSkatReservation reservation)
        {
            var reservationModel = new ReservationModel
            {
                Id = reservation.Id,
                ReservedUtc = DbMynaContext.GetUtcDateTime(reservation.ReservedUtc).Value,
                Duration = reservation.Duration,
                Players = new List<string>()
            };
            reservationModel.ReservedBy = reservation.ReservedBy?.Name;
            foreach (var p in new[] { reservation.Player1, reservation.Player2, reservation.Player3, reservation.Player4 })
            {
                if (!string.IsNullOrEmpty(p))
                {
                    reservationModel.Players.Add(p);
                }
            }
            return reservationModel;
        }

        private static bool ContainsCaseInsensitive(ICollection<string> col, string playerName)
        {
            if (col != null)
            {
                foreach (var elem in col)
                {
                    if (string.Equals(elem, playerName, StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
            }
            return false;
        }

        // --- store skat result and game history

        private void AddSkatResult(IPwdManService pwdManService)
        {
            try
            {
                var dbContext = pwdManService.GetDbContext();
                var names = skatTable.TablePlayers.Select(p => p.Name).ToList();
                var result = new DbSkatResult
                {
                    Player1 = names[0],
                    Player2 = names[1],
                    Player3 = names[2],
                    Player4 = names.Count > 3 ? names[3] : null,
                    StartedUtc = DateTime.UtcNow
                };
                dbContext.DbSkatResults.Add(result);
                dbContext.SaveChanges();
                skatResultId = result.Id;
                var userIds = dbContext.DbUsers.Where(u => names.Contains(u.Name)).Select(u => u.Id);
                foreach (var userId in userIds)
                {
                    dbContext.DbUserSkatResults.Add(new DbUserSkatResult { DbUserId = userId, DbSkatResultId = result.Id });
                }
                dbContext.SaveChanges();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to add skat result.");
            }
        }

        private void AddGameHistory(IPwdManService pwdManService)
        {
            if (skatResultId.HasValue)
            {
                try
                {
                    var json = JsonSerializer.Serialize(GetGameHistoryModel(skatTable.CurrentHistory));
                    var dbContext = pwdManService.GetDbContext();
                    var skatResult = dbContext.DbSkatResults.Single((r) => r.Id == skatResultId);
                    var gameHistory = new DbSkatGameHistory { DbSkatResultId = skatResultId.Value, History = json };
                    dbContext.DbSkatGameHistories.Add(gameHistory);
                    skatResult.EndedUtc = DateTime.UtcNow;
                    dbContext.SaveChanges();
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to add game history.");
                }
            }
        }

        // --- reservations

        private bool VerifyReservation(IPwdManService pwdManService, string[] usernames)
        {
            var dbContext = pwdManService.GetDbContext();
            var nowUtc = DateTime.UtcNow;
            var reservations = dbContext.DbSkatReservations.Where(r => r.ReservedUtc <= nowUtc);
            if (reservations.Any())
            {
                foreach (var r in reservations)
                {
                    var end = r.ReservedUtc.AddMinutes(r.Duration);
                    if (nowUtc >= r.ReservedUtc && nowUtc <= end)
                    {
                        var players = new[] { r.Player1, r.Player2, r.Player3, r.Player4 };
                        foreach (var username in usernames)
                        {
                            if (string.IsNullOrEmpty(username)) continue;
                            var found = false;
                            foreach (var p in players)
                            {
                                if (!string.IsNullOrEmpty(p) &&
                                    string.Equals(username, p, StringComparison.OrdinalIgnoreCase))
                                {
                                    found = true;
                                }
                            }
                            if (!found)
                            {
                                return false;
                            }
                        }
                    }
                }
            }
            return true;
        }

        private void UpdateNextReservation(IPwdManService pwdManService)
        {
            nextReservation = null;
            var dbContext = pwdManService.GetDbContext();
            var regs = dbContext.DbSkatReservations
                .Where(r => r.ReservedUtc > DateTime.UtcNow)
                .OrderBy(r => r.ReservedUtc);
            if (regs.Any())
            {
                nextReservation = GetReservationModel(regs.First());
            }
        }
    }
}
