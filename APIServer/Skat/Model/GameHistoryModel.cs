/*
    Myna API Server
    Copyright (C) 2020-2022 Niels Stockfleth

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

namespace APIServer.Skat.Model
{
    public class GameHistoryModel
    {
        public string GameText { get; set; } = "";
        
        public List<string> GameTextLabels { get; set; } = new List<string>();

        public string GamePlayerName { get; set; } = "";

        public int GamePlayerScore { get; set; }

        public int GameValue { get; set; }

        public List<PlayerCardsModel> PlayerCards { get; set; } = new List<PlayerCardsModel>();

        public List<CardModel> Skat { get; set; } = new List<CardModel>();

        public List<CardModel> Back { get; set; } = new List<CardModel>();

        public List<PlayedCardModel> Played { get; set; } = new List<PlayedCardModel>();
    }
}
