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
using System.Collections.Generic;

namespace APIServer.Skat.Core
{
    public class PlayerCards
    {
        public string PlayerName { get; set; }

        public List<Card> Cards { get; set; }
    }

    public class PlayerCard
    {
        public string PlayerName { get; set; }

        public Card Card { get; set; }
    }

    public class GameHistory
    {
        public List<string> GameTextLabels { get; set; } = new List<string>();

        public string GamePlayerName { get; set; } = "";

        public int GamePlayerScore { get; set; }

        public int GameValue { get; set; }

        public List<PlayerCards> PlayerCards { get; set; } = new List<PlayerCards>();

        public List<Card> Skat { get; set; } = new List<Card>();

        public List<Card> Back { get; set; } = new List<Card>();

        public List<PlayerCard> Played { get; set; } = new List<PlayerCard>();
    }
}
