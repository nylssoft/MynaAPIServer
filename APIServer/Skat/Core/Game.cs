/*
    Myna API Server
    Copyright (C) 2020-2023 Niels Stockfleth

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

namespace APIServer.Skat.Core
{
    public enum GameType { Grand, Color, Null };

    [Flags]
    public enum GameOption { None = 0, Ouvert = 1, Hand = 2, Schneider = 4, Schwarz = 8 };

    public class Game
    {
        public GameType Type { get; set; } = GameType.Grand;

        public GameOption Option { get; set; } = GameOption.None;

        public CardColor? Color { get; set; } = null;

        public Game() {}

        public Game(GameType gameType, CardColor? gameColor = null)
        {
            Type = gameType;
            Color = gameColor;
        }

        public string GetGameTextLabel()
        {
            if (Type == GameType.Null)
            {
                return "TEXT_NULL";
            }
            if (Type == GameType.Grand)
            {
                return "TEXT_GRAND";
            }
            return $"TEXT_{Color.Value.ToString().ToUpper()}";
        }

        public List<string> GetGameAndOptionTextLabels()
        {
            var labels = new List<string>
            {
                GetGameTextLabel()
            };
            if (Type == GameType.Grand || Type == GameType.Color)
            {
                if (Option.HasFlag(GameOption.Ouvert))
                {
                    labels.Add("TEXT_OUVERT");
                }
                else
                {
                    if (Option.HasFlag(GameOption.Hand))
                    {
                        labels.Add("TEXT_HAND");
                    }
                    if (Option.HasFlag(GameOption.Schneider))
                    {
                        labels.Add("TEXT_SCHNEIDER_SAID");
                    }
                    if (Option.HasFlag(GameOption.Schwarz))
                    {
                        labels.Add("TEXT_SCHWARZ_SAID");
                    }
                }
            }
            else if (Type == GameType.Null)
            {
                if (Option.HasFlag(GameOption.Ouvert))
                {
                    labels.Add("TEXT_OUVERT");
                }
                if (Option.HasFlag(GameOption.Hand))
                {
                    labels.Add("TEXT_HAND");
                }
            }
            return labels;
        }

        public MatadorsJackStraight GetMatadorsJackStraight(List<Card> playerCards, List<Card> skat)
        {
            if (Type == GameType.Null) return new MatadorsJackStraight();
            var cards = new List<Card>();
            cards.AddRange(playerCards);
            if (skat != null)
            {
                cards.AddRange(skat);
            }
            bool with = cards.Any((c) => c.Value == CardValue.Jack && c.Color == CardColor.Clubs);
            int value = 1;
            foreach (var col in new[] { CardColor.Spades, CardColor.Hearts, CardColor.Diamonds })
            {
                var hasBube = cards.Any((c) => c.Value == CardValue.Jack && c.Color == col);
                if (with && !hasBube || !with && hasBube)
                {
                    break;
                }
                value += 1;
            }
            if (value == 4 && Type == GameType.Color)
            {
                foreach (var v in new[] { CardValue.Ace, CardValue.Digit10, CardValue.King, CardValue.Queen, CardValue.Digit9, CardValue.Digit8, CardValue.Digit7 })
                {
                    var hasValue = cards.Any((c) => c.Color == Color.Value && c.Value == v);
                    if (with && !hasValue || !with && hasValue)
                    {
                        break;
                    }
                    value += 1;
                }
            }
            return new MatadorsJackStraight { With = with, Count = value };
        }

        public bool IsWinner(List<Card> stitches, List<Card> skat)
        {
            if (Type == GameType.Null)
            {
                return stitches.Count == 0; // no stitches
            }
            if (Option.HasFlag(GameOption.Schwarz))
            {
                return stitches.Count == 30; // all stitches (10 x 3 cards)
            }
            var score = Card.GetScore(stitches, skat);
            if (Option.HasFlag(GameOption.Schneider))
            {
                return score >= 90;
            }
            return score >= 61;
        }

        public GameValue GetGameValue(MatadorsJackStraight spitzen, List<Card> stitches, List<Card> skat, int bidValue, bool giveUp)
        {
            bool schneider = false;
            bool schwarz = false;
            bool gamePlayerSchneider = false;
            bool gamePlayerSchwarz = false;
            if (Type != GameType.Null)
            {
                var score = Card.GetScore(stitches, skat);
                schneider = score >= 90;
                schwarz = stitches.Count == 30;
                if (!giveUp)
                {
                    if (stitches.Count == 0)
                    {
                        gamePlayerSchwarz = true;
                    }
                    gamePlayerSchneider = score <= 30;
                }
            }
            var gameValue = new GameValue();
            // check if bid value is exceeded considering schneider and schwarz
            var gameBidValue = GetBidValue(spitzen, schneider, schwarz);
            if (gameBidValue < bidValue)
            {
                int baseValue;
                if (Type == GameType.Null)
                {
                    baseValue = GetNullBaseValue();
                }
                else
                {
                    baseValue = GetGrandOrColorBaseValue();
                }
                gameValue.Score = baseValue;
                int factor = 1;
                while (gameValue.Score < bidValue)
                {
                    gameValue.Score += baseValue;
                    factor++;
                }
                var calc = factor == 1 ? $"{baseValue}" : $"{factor} x {baseValue}";
                gameValue.BidExceeded = true;
                gameValue.IsWinner = false;
                gameValue.Score *= -2;
                gameValue.DescriptionLabels.Add($"INFO_GAME_OVER_BID_1:{bidValue}");
                gameValue.DescriptionLabels.AddRange(GetGameAndOptionTextLabels());
                gameValue.DescriptionLabels.Add($"INFO_GAME_LOST_CALC_1_2:{calc}:{gameValue.Score}");
            }
            else
            {
                var isWinner = IsWinner(stitches, skat);
                if (!isWinner)
                {
                    schneider = false;
                    schwarz = false;
                }
                string calc;
                var gameLabels = new List<string>();
                int baseValue;
                int factor = 1;
                if (Type == GameType.Null)
                {
                    baseValue = GetNullBaseValue();
                    gameValue.Score = baseValue;
                    gameLabels.AddRange(GetGameAndOptionTextLabels());
                }
                else
                {
                    gameLabels.Add(spitzen.With ? "TEXT_WITH" : "TEXT_WITHOUT");
                    gameLabels.Add($"INFO_PLAY_1_2:{spitzen.Count}:{spitzen.Play}");
                    factor = spitzen.Play;
                    if (Option.HasFlag(GameOption.Hand))
                    {
                        factor++;
                        gameLabels.Add($"INFO_HAND_FACTOR_1:{factor}");
                    }
                    if (Option.HasFlag(GameOption.Ouvert))
                    {
                        factor++;
                        gameLabels.Add($"INFO_OUVERT_FACTOR_1:{factor}");
                    }
                    if (schneider || gamePlayerSchneider)
                    {
                        factor++;
                        gameLabels.Add($"INFO_SCHNEIDER_FACTOR_1:{factor}");
                    }
                    if (Option.HasFlag(GameOption.Schneider))
                    {
                        factor++;
                        if (!schneider && !gamePlayerSchneider)
                        {
                            gameLabels.Add($"TEXT_SCHNEIDER");
                        }
                        gameLabels.Add($"INFO_SAID_FACTOR_1:{factor}");
                    }
                    if (schwarz || gamePlayerSchwarz)
                    {
                        factor++;
                        gameLabels.Add($"INFO_SCHWARZ_FACTOR_1:{factor}");
                    }
                    if (Option.HasFlag(GameOption.Schwarz))
                    {
                        factor++;
                        if (!schwarz && !gamePlayerSchwarz)
                        {
                            gameLabels.Add("TEXT_SCHWARZ");
                        }
                        gameLabels.Add($"INFO_SAID_FACTOR_1:{factor}");
                    }
                    gameLabels.Add(GetGameTextLabel());
                    baseValue = GetGrandOrColorBaseValue();
                }
                gameValue.Score = factor * baseValue;
                calc = $"{factor} x {baseValue}";
                if (!isWinner)
                {
                    gameValue.Score *= -2;
                    gameValue.IsWinner = false;
                    gameValue.DescriptionLabels.AddRange(gameLabels);
                    gameValue.DescriptionLabels.Add($"INFO_GAME_LOST_CALC_1_2:{calc}:{gameValue.Score}");
                }
                else
                {
                    gameValue.DescriptionLabels.AddRange(gameLabels);
                    gameValue.DescriptionLabels.Add($"INFO_GAME_WON_CALC_1_2:{calc}:{gameValue.Score}");
                }
            }
            return gameValue;
        }

        public int GetBidValue(MatadorsJackStraight jackStraight, bool schneider = false, bool schwarz = false)
        {
            if (Type == GameType.Null)
            {
                return GetNullBaseValue();
            }
            int mult = jackStraight.Play;
            if (Option.HasFlag(GameOption.Hand))
            {
                mult++;
            }
            if (Option.HasFlag(GameOption.Ouvert))
            {
                mult++;
            }
            if (Option.HasFlag(GameOption.Schneider))
            {
                mult++;
            }
            if (Option.HasFlag(GameOption.Schwarz))
            {
                mult++;
            }
            if (schneider)
            {
                mult++;
            }
            if (schwarz)
            {
                mult++;
            }
            return mult * GetGrandOrColorBaseValue();
        }

        public int GetNullBaseValue()
        {
            if (Type == GameType.Null)
            {
                if (Option.HasFlag(GameOption.Ouvert))
                {
                    if (Option.HasFlag(GameOption.Hand))
                    {
                        return 59;
                    }
                    return 46;
                }
                if (Option.HasFlag(GameOption.Hand))
                {
                    return 35;
                }
                return 23;
            }
            return 0;
        }

        public int GetGrandOrColorBaseValue()
        {
            if (Type == GameType.Grand)
            {
                return 24;
            }
            if (Type == GameType.Color)
            {
                switch (Color)
                {
                    case CardColor.Clubs:
                        return 12;
                    case CardColor.Spades:
                        return 11;
                    case CardColor.Hearts:
                        return 10;
                    case CardColor.Diamonds:
                        return 9;
                    default:
                        break;
                }
            }
            return 0;
        }

        public List<string> GetBidValueTooptipLabels(MatadorsJackStraight jacks)
        {
            var labels = new List<string>();
            if (Type == GameType.Null)
            {
                labels.AddRange(GetGameAndOptionTextLabels());
                labels.Add($"INFO_GAME_CALC_1:{GetNullBaseValue()}");
                return labels;
            }
            labels.Add(jacks.With ? "TEXT_WITH" : "TEXT_WITHOUT");
            labels.Add($"INFO_PLAY_1_2:{jacks.Count}:{jacks.Play}");
            var factor = jacks.Play;
            if (Option.HasFlag(GameOption.Hand))
            {
                factor++;
                labels.Add($"INFO_HAND_FACTOR_1:{factor}");
            }
            if (Option.HasFlag(GameOption.Ouvert))
            {
                factor++;
                labels.Add($"INFO_OUVERT_FACTOR_1:{factor}");
            }
            if (Option.HasFlag(GameOption.Schneider))
            {
                factor++;
                labels.Add($"INFO_SCHNEIDER_SAID_FACTOR_1:{factor}");
            }
            if (Option.HasFlag(GameOption.Schwarz))
            {
                factor++;
                labels.Add($"INFO_SCHWARZ_SAID_FACTOR_1:{factor}");
            }
            labels.Add(GetGameTextLabel());
            labels.Add($"INFO_GAME_CALC_1_2_3:{factor}:{GetGrandOrColorBaseValue()}:{factor * GetGrandOrColorBaseValue()}");
            return labels;
        }

        public override bool Equals(object obj)
        {
            var g = obj as Game;
            if (g != null)
            {
                return g.Type == Type && g.Color == Color && g.Option == Option;
            }
            return false;
        }

        public override int GetHashCode()
        {
            var ret = Type.GetHashCode();
            if (Color != null)
            {
                ret += Color.GetHashCode() * 27;
            }
            ret += (int)Option * 113;
            return ret;
        }
    }
}
