﻿/*
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
using System.Security.Cryptography;

namespace APIServer.Skat.Core
{
    public enum CardValue { Digit7 = 0, Digit8 = 1, Digit9 = 2, Digit10 = 3, Jack = 4, Queen = 5, King = 6, Ace = 7 };

    public enum CardColor { Diamonds = 0, Hearts = 1, Spades = 2, Clubs = 3 };

    public class Card
    {
        public int InternalNumber { get; set; }

        public CardValue Value { get; set; }

        public CardColor Color { get; set; }

        public Card() {}

        private Card(int nr)
        {
            if (nr < 0 || nr > 31) throw new ArgumentException("Invalid internal card number");
            int c = nr / 8;
            int v = nr - c * 8;
            InternalNumber = nr;
            Value = (CardValue)Enum.Parse(typeof(CardValue), v.ToString());
            Color = (CardColor)Enum.Parse(typeof(CardColor), c.ToString());
        }

        public static List<Card> GenerateDeck()
        {
            var deck = new List<Card>();
            for (int nr = 0; nr < 32; nr++)
            {
                deck.Add(new Card(nr));
            }
            return deck;
        }

        public static List<Card> Draw(List<Card> deck, int count)
        {
            var ret = new List<Card>();
            for (; count > 0; count--)
            {
                ret.Add(DrawOne(deck));
            }
            return ret;
        }

        public int GetOrderNumber(Game game)
        {
            var orderNumber = InternalNumber;
            if (game.Type == GameType.Grand ||
                game.Type == GameType.Color && !game.Color.HasValue)
            {
                if (Value == CardValue.Jack)
                {
                    orderNumber += 64;
                }
                else if (Value == CardValue.Digit10)
                {
                    orderNumber += 3;
                }
                else if (Value == CardValue.Queen || Value == CardValue.King)
                {
                    orderNumber -= 1;
                }
            }
            else if (game.Type == GameType.Color && game.Color.HasValue)
            {
                if (Color == game.Color && Value != CardValue.Jack)
                {
                    orderNumber += 32;
                }
                if (Value == CardValue.Jack)
                {
                    orderNumber += 64;
                }
                else if (Value == CardValue.Digit10)
                {
                    orderNumber += 3;
                }
                else if (Value == CardValue.Queen || Value == CardValue.King)
                {
                    orderNumber -= 1;
                }
            }
            return orderNumber;
        }

        public int Score
        {
            get
            {
                switch (Value)
                {
                    case CardValue.Jack:
                        return 2;
                    case CardValue.Queen:
                        return 3;
                    case CardValue.King:
                        return 4;
                    case CardValue.Digit10:
                        return 10;
                    case CardValue.Ace:
                        return 11;
                    default:
                        break;
                }
                return 0;
            }
        }

        public static int GetScore(List<Card> stitches, List<Card> skat)
        {
            var score = stitches.Sum(c => c.Score);
            if (skat != null)
            {
                score += skat.Sum(c => c.Score);
            }
            return score;
        }

        public static Card DrawOne(List<Card> deck)
        {
            var nr = Next(deck.Count);
            var card = deck[nr];
            deck.RemoveAt(nr);
            return card;
        }

        private static int Next(int limit)
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

        public override bool Equals(object obj)
        {
            var c = obj as Card;
            if (c != null)
            {
                return c.InternalNumber == InternalNumber;
            }
            return false;
        }

        public override int GetHashCode()
        {
            return InternalNumber;
        }
    }
}
