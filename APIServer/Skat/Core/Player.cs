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
using System.Collections.Generic;

namespace APIServer.Skat.Core
{
    public enum PlayerPosition { Rearhand, Forehand, Middlehand, Inactive };

    public enum BidStatus { Bid, Accept, Pass, Wait };

    public class Player
    {
        public Player(string name, PlayerPosition position)
        {
            Name = name;
            Position = position;
            if (position == PlayerPosition.Middlehand)
            {
                BidStatus = BidStatus.Bid;
            }
            else if (position == PlayerPosition.Forehand)
            {
                BidStatus = BidStatus.Accept;
            }
            else
            {
                BidStatus = BidStatus.Wait;
            }
        }

        public string Name { get; set; }

        public PlayerPosition Position { get; set; }

        public Game Game { get; set; } = new Game(GameType.Grand);

        public List<Card> Cards { get; set; } = new List<Card>();

        public List<Card> Stitches { get; set; } = new List<Card>();

        public BidStatus BidStatus { get; set; } = BidStatus.Wait;

        public int Score { get; set; }

        public void SortCards()
        {
            Cards.Sort((b, a) => a.GetOrderNumber(Game).CompareTo(b.GetOrderNumber(Game)));
        }

        public override bool Equals(object obj)
        {
            var p = obj as Player;
            if (p != null)
            {
                return p.Name == Name;
            }
            return false;
        }

        public override int GetHashCode()
        {
            return System.HashCode.Combine(Name);
        }

        public override string ToString()
        {
            return Name;
        }
    }
}
