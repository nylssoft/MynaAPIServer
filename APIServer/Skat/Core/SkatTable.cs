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
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;

namespace APIServer.Skat.Core
{
    public enum ActionType { Bid, PassBid, HoldBid, PassHold, TakeSkat, StartGame, PlayHand, DoNotPlayHand };

    public class PlayerStatus
    {
        public string Header { get; set; } = "";

        public List<string> ActionLabels { get; set; } = new List<string>();

        public List<ActionType> ActionTypes { get; set; } = new List<ActionType>();

        public string Tooltip { get; set; } = "";
    };

    public class SkatTable
    {
        public int GameCounter { get; set; } = 1;

        public List<Player> Players { get; set; } = new List<Player>();

        public List<Player> TablePlayers { get; set; } = new List<Player>();

        public Player InactivePlayer { get; set; } = null;

        public List<Card> Skat { get; set; } = new List<Card>();

        public List<Card> Stitch { get; set; } = new List<Card>();

        public List<Card> LastStitch { get; set; } = new List<Card>();

        public Player GamePlayer { get; set; } = null;

        public bool GameStarted { get; set; } = false;

        public MatadorsJackStraight MatadorsJackStraight { get; set; }

        public GameValue GameValue { get; set; }

        public Player CurrentPlayer { get; set; } = null;

        public bool SkatTaken { get; set; } = false;

        public GameHistory CurrentHistory { get; set; }

        public SkatResult SkatResult { get; set; }

        public bool GameEnded
        {
            get
            {
                return GameStarted && GamePlayer != null && !GamePlayer.Cards.Any() && !Stitch.Any();
            }
        }

        public bool IsSpeedUp { get; set; } = false;

        public int CurrentBidValue
        {
            get
            {
                if (BidValueIndex >= 0)
                {
                    return BidValues[BidValueIndex];
                }
                return 0;
            }
        }

        public int NextBidValue
        {
            get
            {
                if (BidValueIndex < BidValues.Count - 1)
                {
                    return BidValues[BidValueIndex + 1];
                }
                return 0;
            }
        }

        public bool BidSaid { get; set; } = false;

        private int BidValueIndex { get; set; } = -1;

        private List<int> BidValues = new List<int>();

        public SkatTable(string player1, string player2, string player3, string player4 = null)
        {
            if (player4 != null)
            {
                Players.Add(new Player(player1, PlayerPosition.Forehand));
                Players.Add(new Player(player2, PlayerPosition.Middlehand));
                Players.Add(new Player(player3, PlayerPosition.Rearhand));
                InactivePlayer = new Player(player4, PlayerPosition.Inactive);
                TablePlayers.Add(InactivePlayer);
                TablePlayers.AddRange(Players);
            }
            else
            {
                Players.Add(new Player(player1, PlayerPosition.Rearhand));
                Players.Add(new Player(player2, PlayerPosition.Forehand));
                Players.Add(new Player(player3, PlayerPosition.Middlehand));
                TablePlayers.AddRange(Players);
            }
            SkatResult = new SkatResult();
            CurrentHistory = new GameHistory();
            using (var rng = new RNGCryptoServiceProvider())
            {
                var deck = Card.GenerateDeck();
                foreach (var player in Players)
                {
                    player.Cards.AddRange(Card.Draw(rng, deck, 10));
                    player.SortCards();
                    CurrentHistory.PlayerCards.Add((player.Name, new List<Card>(player.Cards)));
                }
                Skat.AddRange(Card.Draw(rng, deck, 2));
                CurrentHistory.Skat.AddRange(Skat);
            }
            var s = new HashSet<int>();
            // farbe
            for (int m = 2; m < 18; m++) // mit 10 spielt 11 hand 12 schneider 13 angesagt 14 schwarz 15 angesagt 16 ouvert 17
            {
                s.Add(m * 9);
                s.Add(m * 10);
                s.Add(m * 11);
                s.Add(m * 12);
            }
            // grand
            for (int m = 2; m < 12; m++) // mit 4 spielt 5 hand 6 schneider 7 angesagt 8 schwarz 9 angesagt 10 overt 11
            {
                s.Add(m * 24);
            }
            // null
            s.Add(23);
            // null hand
            s.Add(35);
            // null ouvert
            s.Add(46);
            // null ouvert hand
            s.Add(59);
            BidValues = s.ToList<int>();
            BidValues.Sort();
        }

        public void StartNewRound()
        {
            GameCounter += 1;
            if (InactivePlayer == null)
            {
                foreach (var p in Players)
                {
                    p.Stitches.Clear();
                    p.Cards.Clear();
                    p.Game = new Game(GameType.Grand);
                    switch (p.Position)
                    {
                        case PlayerPosition.Middlehand:
                            p.Position = PlayerPosition.Forehand;
                            p.BidStatus = BidStatus.Accept;
                            break;
                        case PlayerPosition.Rearhand:
                            p.Position = PlayerPosition.Middlehand;
                            p.BidStatus = BidStatus.Bid;
                            break;
                        case PlayerPosition.Forehand:
                            p.Position = PlayerPosition.Rearhand;
                            p.BidStatus = BidStatus.Wait;
                            break;
                        default:
                            break;
                    }
                }
            }
            else
            {
                var nextPlayers = new Player[3];
                var newPlayer = InactivePlayer;
                newPlayer.Position = PlayerPosition.Rearhand;
                newPlayer.BidStatus = BidStatus.Wait;
                newPlayer.Stitches.Clear();
                newPlayer.Cards.Clear();
                newPlayer.Game = new Game(GameType.Grand);
                nextPlayers[2] = newPlayer;
                foreach (var p in Players)
                {
                    p.Stitches.Clear();
                    p.Cards.Clear();
                    p.Game = new Game(GameType.Grand);
                    if (p.Position == PlayerPosition.Forehand)
                    {
                        InactivePlayer = p;
                        p.Position = PlayerPosition.Inactive;
                        p.BidStatus = BidStatus.Wait;
                    }
                    else if (p.Position == PlayerPosition.Middlehand)
                    {
                        p.Position = PlayerPosition.Forehand;
                        p.BidStatus = BidStatus.Accept;
                        nextPlayers[0] = p;
                    }
                    else if (p.Position == PlayerPosition.Rearhand)
                    {
                        p.Position = PlayerPosition.Middlehand;
                        p.BidStatus = BidStatus.Bid;
                        nextPlayers[1] = p;
                    }
                }
                Players.Clear();
                Players.AddRange(nextPlayers);
            }
            MatadorsJackStraight = null;
            GameStarted = false;
            GamePlayer = null;
            GameValue = null;
            IsSpeedUp = false;
            SkatTaken = false;
            CurrentPlayer = null;
            Stitch.Clear();
            Skat.Clear();
            LastStitch.Clear();
            CurrentHistory = new GameHistory();
            using (var rng = new RNGCryptoServiceProvider())
            {
                var deck = Card.GenerateDeck();
                foreach (var player in Players)
                {
                    player.Cards.AddRange(Card.Draw(rng, deck, 10));
                    player.SortCards();
                    CurrentHistory.PlayerCards.Add((player.Name, new List<Card>(player.Cards)));
                }
                Skat.AddRange(Card.Draw(rng, deck, 2));
                CurrentHistory.Skat.AddRange(Skat);
            }
            BidSaid = false;
            BidValueIndex = -1;
        }

        public void MoveNextBidValue()
        {
            if (BidValueIndex < BidValues.Count - 1)
            {
                BidValueIndex++;
            }
        }

        private int GetPlayerIdx(Player player)
        {
            int idx = 0;
            foreach (var p in Players)
            {
                if (p == player) return idx;
                idx++;
            }
            return -1;
        }

        public Player GetNextPlayer(Player player)
        {
            if (player != null)
            {
                var idx = GetPlayerIdx(player);
                var nextidx = (idx + 1) % Players.Count;
                return Players[nextidx];
            }
            return null;
        }

        public Player GetStitchPlayer()
        {
            Player stichPlayer = null;
            if (Stitch.Count == 3)
            {
                stichPlayer = CurrentPlayer;
                Player player = stichPlayer;
                Card greatestCard = Stitch[0];
                Card firstCard = greatestCard;
                for (int idx = 1; idx < 3; idx++)
                {
                    player = GetNextPlayer(player);
                    if (IsTrump(firstCard) && IsTrump(Stitch[idx]) && IsCardGreater(GamePlayer.Game, Stitch[idx], greatestCard))
                    {
                        stichPlayer = player;
                        greatestCard = Stitch[idx];
                    }
                    else if (!IsTrump(firstCard) && IsTrump(Stitch[idx]) && IsCardGreater(GamePlayer.Game, Stitch[idx], greatestCard))
                    {
                        stichPlayer = player;
                        greatestCard = Stitch[idx];
                    }
                    else if (!IsTrump(firstCard) && firstCard.Color == Stitch[idx].Color && IsCardGreater(GamePlayer.Game, Stitch[idx], greatestCard))
                    {
                        stichPlayer = player;
                        greatestCard = Stitch[idx];
                    }
                }
            }
            return stichPlayer;
        }

        public bool IsValidForStitch(Card card)
        {
            if (Stitch.Count == 0) return true;
            var first = Stitch[0];
            if (IsTrump(first))
            {
                if (IsTrump(card))
                {
                    return true;
                }
                var hasTrump = CurrentPlayer.Cards.Any(c => IsTrump(c));
                return !hasTrump;
            }
            bool hasColor = CurrentPlayer.Cards.Any((c) => !IsTrump(c) && c.Color == first.Color);
            return !IsTrump(card) && first.Color == card.Color || !hasColor;
        }

        public bool IsTrump(Card card)
        {
            Game game = GamePlayer.Game;
            if ((game.Type == GameType.Grand || game.Type == GameType.Color) && card.Value == CardValue.Jack)
            {
                return true;
            }
            if (game.Type == GameType.Color && card.Color == game.Color)
            {
                return true;
            }
            return false;
        }

        private bool IsCardGreater(Game game, Card card1, Card card2)
        {
            return card1.GetOrderNumber(game) > card2.GetOrderNumber(game);
        }

        public bool CanSpeedUp(Player player)
        {
            return
                GameStarted &&
                !GameEnded &&
                player == GamePlayer &&
                player.Cards.Count > 0 &&
                Stitch.Count == 0 &&
                !IsSpeedUp;
        }

        public void SpeedUpConfirmed()
        {
            IsSpeedUp = false;
            var game = GamePlayer.Game;
            if (game.Type != GameType.Null)
            {
                // add all remaining cards to the stitch of game player
                GamePlayer.Stitches.AddRange(Stitch);
                Stitch.Clear();
                foreach (var p in Players)
                {
                    GamePlayer.Stitches.AddRange(p.Cards);
                    p.Cards.Clear();
                }
            }
            else
            {
                // add all remaining cards to the stitch of an opponent player
                Player opponentPlayer = null;
                foreach (var p in Players)
                {
                    if (p != GamePlayer)
                    {
                        opponentPlayer = p;
                        break;
                    }
                }
                opponentPlayer.Stitches.AddRange(Stitch);
                Stitch.Clear();
                foreach (var p in Players)
                {
                    opponentPlayer.Stitches.AddRange(p.Cards);
                    p.Cards.Clear();
                }
            }
            GameValue = game.GetGameValue(MatadorsJackStraight, GamePlayer.Stitches, Skat, CurrentBidValue, true);
            GamePlayer.Score += GameValue.Score;
            CurrentHistory.GamePlayerScore = GetScore(GamePlayer);
            CurrentHistory.GameValue = GameValue.Score;
            SkatResult.History.Add(CurrentHistory);
            SkatResult.EndedUtc = DateTime.UtcNow;
        }

        public bool CanGiveUp(Player player)
        {
            return GameStarted &&
                player == GamePlayer &&
                player == CurrentPlayer &&
                player.Cards.Count >= 9;
        }

        public void GiveUp()
        {
            // add all cards on the game player's hand to the stitch of one opponent player
            Player opponentPlayer = null;
            foreach (var p in Players)
            {
                if (p != GamePlayer && opponentPlayer == null)
                {
                    opponentPlayer = p;
                    p.Stitches.AddRange(GamePlayer.Cards);
                    p.Stitches.AddRange(GamePlayer.Stitches);
                    p.Stitches.AddRange(p.Cards);
                    p.Stitches.AddRange(Skat);
                    p.Stitches.AddRange(Stitch);
                    p.Cards.Clear();
                    GamePlayer.Cards.Clear();
                    GamePlayer.Stitches.Clear();
                    Skat.Clear();
                    Stitch.Clear();
                }
                else if (p != GamePlayer && opponentPlayer != null)
                {
                    opponentPlayer.Stitches.AddRange(p.Cards);
                    p.Cards.Clear();
                }
            }
            var game = GamePlayer.Game;
            GameValue = game.GetGameValue(MatadorsJackStraight, GamePlayer.Stitches, Skat, CurrentBidValue, true);
            GamePlayer.Score += GameValue.Score;
            CurrentHistory.GamePlayerScore = GetScore(GamePlayer);
            CurrentHistory.GameValue = GameValue.Score;
            SkatResult.History.Add(CurrentHistory);
            SkatResult.EndedUtc = DateTime.UtcNow;
        }

        public bool CanShowOuvertCards(Player player)
        {
            return GameStarted &&
                GamePlayer != null &&
                GamePlayer.Game.Option.HasFlag(GameOption.Ouvert) &&
                GamePlayer != player &&
                GamePlayer.Cards.Any();
        }

        public bool CanViewLastStitch(Player player)
        {
            return GameStarted &&
                !GameEnded &&
                LastStitch.Count > 0 &&
                player.Cards.Count > 0;
        }

        public bool CanSetOuvert(Player player)
        {
            return !GameStarted && (
                GamePlayer == null ||
                GamePlayer == player && (GamePlayer.Game.Type == GameType.Null || !SkatTaken));
        }

        public bool CanSetHand(Player player)
        {
            return !GameStarted &&
                (GamePlayer == null && (!player.Game.Option.HasFlag(GameOption.Ouvert) || player.Game.Type == GameType.Null) ||
                GamePlayer == player && !SkatTaken );
        }

        public bool CanSetSchneider(Player player)
        {
            return CanSetHand(player) &&
                   player.Game.Type != GameType.Null &&
                   player.Game.Option.HasFlag(GameOption.Hand) &&
                   !player.Game.Option.HasFlag(GameOption.Ouvert);
        }

        public bool CanSetSchwarz(Player player)
        {
            return CanSetSchneider(player) &&
                   player.Game.Option.HasFlag(GameOption.Schneider);
        }

        public void SetGameOption(Player player, GameOption gameOption)
        {
            player.Game.Option = GameOption.None;
            if (player.Game.Type == GameType.Null)
            {
                if (gameOption.HasFlag(GameOption.Ouvert))
                {
                    player.Game.Option |= GameOption.Ouvert;
                }
                if (gameOption.HasFlag(GameOption.Hand))
                {
                    player.Game.Option |= GameOption.Hand;
                }
            }
            else
            {
                if (gameOption.HasFlag(GameOption.Ouvert))
                {
                    player.Game.Option |= GameOption.Ouvert | GameOption.Hand | GameOption.Schneider | GameOption.Schwarz;
                }
                else if (gameOption.HasFlag(GameOption.Hand))
                {
                    player.Game.Option |= GameOption.Hand;
                    if (gameOption.HasFlag(GameOption.Schneider))
                    {
                        player.Game.Option |= GameOption.Schneider;
                        if (gameOption.HasFlag(GameOption.Schwarz))
                        {
                            player.Game.Option |= GameOption.Schwarz;
                        }
                    }
                }
            }
        }

        public bool CanStartNewGame()
        {
            return GameStarted && GamePlayer != null && GamePlayer.Cards.Count == 0 && Stitch.Count == 0;
        }

        public void StartGame(Player player)
        {
            if (!player.Game.Option.HasFlag(GameOption.Hand))
            {
                CurrentHistory.Back.AddRange(Skat);
            }
            CurrentHistory.GameText = player.Game.GetGameAndOptionText();
            CurrentHistory.GamePlayerName = player.Name;
            GameStarted = true;
            foreach (var p in Players)
            {
                p.Game = player.Game; // same card sort order for everybody
                if (p.Position == PlayerPosition.Forehand)
                {
                    CurrentPlayer = p;
                }
            }
            // spitzen mit skat
            MatadorsJackStraight = player.Game.GetMatadorsJackStraight(player.Cards, Skat);
        }

        public Player GetActivePlayer()
        {
            Player activePlayer = null;
            foreach (var p in Players)
            {
                if (GamePlayer == null)
                {
                    if (p.BidStatus == BidStatus.Bid && !BidSaid ||
                        p.BidStatus == BidStatus.Accept && BidSaid)
                    {
                        activePlayer = p;
                        break;
                    }
                }
                else
                {
                    if (CurrentPlayer == null)
                    {
                        activePlayer = GamePlayer;
                        break;
                    }
                    activePlayer = CurrentPlayer;
                    break;
                }
            }
            return activePlayer;
        }

        public Player GetBidPlayer(BidStatus bidStatus)
        {
            foreach (var p in Players)
            {
                if (p.BidStatus == bidStatus)
                {
                    return p;
                }
            }
            return null;
        }

        public PlayerStatus GetPlayerStatus(Player player)
        {
            var ret = new PlayerStatus();
            // Bidding
            if (GamePlayer == null)
            {
                if (player.BidStatus == BidStatus.Accept && BidSaid)
                {
                    ret.ActionLabels.Add($"{CurrentBidValue} halten");
                    ret.ActionLabels.Add("Weg");
                    ret.ActionTypes.Add(ActionType.HoldBid);
                    ret.ActionTypes.Add(ActionType.PassHold);
                }
                else if (player.BidStatus == BidStatus.Bid && !BidSaid)
                {
                    ret.ActionLabels.Add($"{NextBidValue} sagen");
                    ret.ActionLabels.Add("Weg");
                    ret.ActionTypes.Add(ActionType.Bid);
                    ret.ActionTypes.Add(ActionType.PassBid);
                }
                if (ret.ActionTypes.Count > 0 && player.Game != null)
                {
                    var jacks = player.Game.GetMatadorsJackStraight(player.Cards, null);
                    ret.Tooltip = player.Game.GetBidValueTooptip(jacks);
                }
                foreach (var p in Players)
                {
                    if (p.Position == PlayerPosition.Forehand)
                    {
                        ret.Header += p == player ? "Du kommst raus. " : $"{p.Name} kommt raus. ";
                    }
                }
            }
            // Game selection
            else if (!GameStarted)
            {
                if (player == GamePlayer)
                {
                    if (Skat.Count < 2)
                    {
                        ret.Header += "Drücken! ";
                    }
                    else if (!SkatTaken && !player.Game.Option.HasFlag(GameOption.Hand))
                    {
                        ret.ActionLabels.Add("Skat nehmen");
                        ret.ActionLabels.Add("Hand spielen");
                        ret.ActionTypes.Add(ActionType.TakeSkat);
                        ret.ActionTypes.Add(ActionType.PlayHand);
                    }
                    else
                    {
                        ret.ActionLabels.Add("Los geht's!");
                        ret.ActionTypes.Add(ActionType.StartGame);
                        if (player.Game.Option.HasFlag(GameOption.Hand))
                        {
                            ret.ActionLabels.Add("Kein Handspiel!");
                            ret.ActionTypes.Add(ActionType.DoNotPlayHand);
                        }
                    }
                    ret.Header += $"Du wirst {player.Game.GetGameAndOptionText()} spielen mit {CurrentBidValue}. ";
                    if (ret.ActionTypes.Count > 0 && player.Game != null)
                    {
                        var jacks = player.Game.GetMatadorsJackStraight(player.Cards, null);
                        ret.Tooltip = player.Game.GetBidValueTooptip(jacks);
                    }
                }
                else
                {
                    ret.Header += $"{GamePlayer.Name} spielt mit {CurrentBidValue}. ";
                }
                foreach (var p in Players)
                {
                    if (p.Position == PlayerPosition.Forehand)
                    {
                        ret.Header += p == player ? "Du kommst raus. " : $"{p.Name} kommt raus. ";
                        break;
                    }
                }
            }
            // Game started
            else
            {
                // Game ended
                if (GamePlayer.Cards.Count == 0 && Stitch.Count == 0)
                {
                    ret.Header += "Das Spiel ist beendet. ";
                    if (GameValue.Score == 0)
                    {
                        ret.Header += "Alle Spieler haben gepasst. ";
                    }
                    else
                    {
                        Player next0 = player;
                        if (player.Position == PlayerPosition.Inactive)
                        {
                            next0 = Players.Single((p) => p.Position == PlayerPosition.Forehand);
                            ret.Header += $"{next0.Name} hat {GetScore(next0)} Augen. ";
                        }
                        else
                        {
                            ret.Header += $"Du hast {GetScore(player)} Augen. ";
                        }
                        var next1 = GetNextPlayer(next0);
                        var next2 = GetNextPlayer(next1);
                        ret.Header += $"{next1.Name} hat {GetScore(next1)} Augen. ";
                        ret.Header += $"{next2.Name} hat {GetScore(next2)} Augen. ";
                        if (player == GamePlayer)
                        {
                            ret.Header += "Du hast gespielt und ";
                        }
                        else
                        {
                            ret.Header += $"{GamePlayer.Name} hat gespielt und ";
                        }
                        if (GameValue.IsWinner)
                        {
                            ret.Header += "gewonnen. ";
                        }
                        else
                        {
                            ret.Header += "verloren. ";
                        }
                        ret.Header += $"{GameValue.Description} ";
                    }
                }
                // Game in progress
                else
                {
                    if (player == GamePlayer)
                    {
                        ret.Header += $"Du spielst {GamePlayer.Game.GetGameAndOptionText()} mit {CurrentBidValue}. ";
                    }
                    else
                    {
                        ret.Header += $"{GamePlayer.Name} spielt {GamePlayer.Game.GetGameAndOptionText()} mit {CurrentBidValue}. ";
                    }
                }
            }
            return ret;
        }

        public int GetScore(Player player)
        {
            List<Card> skat = null;
            if (player == GamePlayer && player.Game.Type != GameType.Null)
            {
                skat = Skat;
            }
            return Card.GetScore(player.Stitches, skat);
        }

        public void PerformPlayerAction(Player player, ActionType actionType)
        {
            switch (actionType)
            {
                case ActionType.TakeSkat:
                    SkatTaken = true;
                    break;
                case ActionType.PlayHand:
                    SetGameOption(player, player.Game.Option | GameOption.Hand);
                    break;
                case ActionType.StartGame:
                    StartGame(player);
                    break;
                case ActionType.DoNotPlayHand:
                    var gameOption = player.Game.Option & ~GameOption.Hand;
                    if (player.Game.Type != GameType.Null)
                    {
                        gameOption &= ~GameOption.Ouvert;
                    }
                    SetGameOption(player, gameOption);
                    break;
                case ActionType.Bid:
                    BidSaid = true;
                    MoveNextBidValue();
                    break;
                case ActionType.PassBid:
                    player.BidStatus = BidStatus.Pass;
                    foreach (var p in Players)
                    {
                        if (p.Position == PlayerPosition.Rearhand && p.BidStatus != BidStatus.Pass)
                        {
                            p.BidStatus = BidStatus.Bid;
                            break;
                        }
                    }
                    BidSaid = false;
                    break;
                case ActionType.HoldBid:
                    BidSaid = false;
                    break;
                case ActionType.PassHold:
                    BidSaid = false;
                    player.BidStatus = BidStatus.Pass;
                    foreach (var p in Players)
                    {
                        if (p.Position == PlayerPosition.Rearhand && p.BidStatus != BidStatus.Pass) // weitersagen
                        {
                            p.BidStatus = BidStatus.Bid;
                        }
                        else if (p.Position == PlayerPosition.Middlehand && p.BidStatus != BidStatus.Pass) // hoeren
                        {
                            p.BidStatus = BidStatus.Accept;
                        }
                    }
                    break;
                default:
                    break;
            }
            if (actionType == ActionType.PassBid ||
                actionType == ActionType.PassHold ||
                actionType == ActionType.Bid)
            {
                // find if all player have given up
                Player gamePlayer = null;
                var cntPassen = 0;
                foreach (var p in Players)
                {
                    if (p.BidStatus != BidStatus.Pass)
                    {
                        gamePlayer = p;
                        continue;
                    }
                    cntPassen++;
                }
                // all gave up
                if (cntPassen == 3)
                {
                    GamePlayer = Players[0];
                    GameValue = new GameValue { Score = 0 };
                    GameStarted = true;
                    foreach (var p in Players)
                    {
                        p.Cards.Clear();
                        p.Stitches.Clear();
                    }
                    Skat.Clear();
                    Stitch.Clear();
                    CurrentHistory.GamePlayerScore = 0;
                    CurrentHistory.GameValue = 0;
                    SkatResult.History.Add(CurrentHistory);
                    SkatResult.EndedUtc = DateTime.UtcNow;
                }
                // two player gave up, remaing playing is the game player
                else if (gamePlayer != null && cntPassen == 2)
                {
                    if (gamePlayer.Position == PlayerPosition.Forehand && CurrentBidValue == 0)
                    {
                        gamePlayer.BidStatus = BidStatus.Bid;
                    }
                    else
                    {
                        GamePlayer = gamePlayer;
                        GameStarted = false;
                        SkatTaken = false;
                    }
                }
            }
        }

        public bool CanCollectStitch(Player player)
        {
            return GameStarted && CurrentPlayer == player && Stitch.Count == 3;
        }

        public void CollectStitch(Player player)
        {
            LastStitch.Clear();
            LastStitch.AddRange(Stitch);
            Stitch.Clear();
            if (CurrentPlayer == player &&
                GamePlayer == player &&
                player.Game.Type == GameType.Null && player.Stitches.Any())
            {
                foreach (var p in Players)
                {
                    p.Cards.Clear();
                }
            }
            if (player.Cards.Count == 0)
            {
                var game = GamePlayer.Game;
                GameValue = game.GetGameValue(MatadorsJackStraight, GamePlayer.Stitches, Skat, CurrentBidValue, false);
                GamePlayer.Score += GameValue.Score;
                CurrentHistory.GamePlayerScore = GetScore(GamePlayer);
                CurrentHistory.GameValue = GameValue.Score;
                SkatResult.History.Add(CurrentHistory);
                SkatResult.EndedUtc = DateTime.UtcNow;
            }
        }

        public bool CanPlayCard(Player player, Card card)
        {
            if (!GameStarted && GamePlayer == player && SkatTaken)
            {
                return Skat.Count < 2; // move card to Skat
            }
            if (GameStarted && CurrentPlayer == player)
            {
                return Stitch.Count == 3 || IsValidForStitch(card); // collect stitch or play card
            }
            return true;
        }

        public void PlayCard(Player player, Card card)
        {
            // move card to Skat
            if (GamePlayer == player && SkatTaken && !GameStarted)
            {
                if (Skat.Count < 2)
                {
                    player.Cards.Remove(card);
                    Skat.Add(card);
                }
            }
            else if (GameStarted && CurrentPlayer == player)
            {
                if (Stitch.Count == 3)
                {
                    CollectStitch(player);
                    if (player.Cards.Count == 0)
                    {
                        return; // game ended
                    }
                }
                if (IsValidForStitch(card))
                {
                    CurrentHistory.Played.Add((player.Name, card));
                    player.Cards.Remove(card);
                    CurrentPlayer = GetNextPlayer(player);
                    Stitch.Add(card);
                    if (Stitch.Count == 3)
                    {
                        var stichPlayer = GetStitchPlayer();
                        stichPlayer.Stitches.AddRange(Stitch);
                        CurrentPlayer = stichPlayer;
                    }
                }
            }
        }

        public bool CanPickupSkat(Player player)
        {
            return GamePlayer == player && SkatTaken && !GameStarted;
        }

        public void PickupSkat(Player player, Card card)
        {
            Skat.Remove(card);
            player.Cards.Add(card);
        }
    }
}
