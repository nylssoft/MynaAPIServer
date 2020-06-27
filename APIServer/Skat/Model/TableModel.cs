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

namespace APIServer.Skat.Model
{
    public class TableModel
    {
        public PlayerModel Player { get; set; } = null;

        public PlayerModel CurrentPlayer { get; set; } = null;

        public PlayerModel GamePlayer { get; set; } = null;

        public string Message { get; set; } = "";

        public List<CardModel> Cards { get; set; } = new List<CardModel>();

        public List<CardModel> PlayableCards { get; set; } = new List<CardModel>();

        public List<CardModel> LastStitch { get; set; } = new List<CardModel>();

        public List<CardModel> Stitch { get; set; } = new List<CardModel>();

        public List<CardModel> Stitches { get; set; } = new List<CardModel>();

        public List<CardModel> Skat { get; set; } = new List<CardModel>();

        public List<CardModel> Ouvert { get; set; } = new List<CardModel>();

        public bool SkatTaken { get; set; } = false;

        public bool GameStarted { get; set; } = false;

        public bool GameEnded { get; set; } = false;

        public bool CanCollectStitch { get; set; } = false;
        public bool CanGiveUp { get; set; } = false;
        public bool CanPickupSkat { get; set; } = false;
        public bool CanSetHand { get; set; } = false;
        public bool CanSetOuvert { get; set; } = false;
        public bool CanSetSchneider { get; set; } = false;
        public bool CanSetSchwarz { get; set; } = false;
        public bool CanStartNewGame { get; set; } = false;
        public bool CanViewLastStitch { get; set; } = false;
        public List<ActionModel> Actions { get; set; } = new List<ActionModel>();
        public List<PlayerModel> Players { get; set; } = new List<PlayerModel>();

        public bool BidSaid { get; set; } = false;

        public int CurrentBidValue { get; set; } = 0;

        public int GameCounter { get; set; } = 0;
    }
}
