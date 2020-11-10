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
using APIServer.PwdMan;
using APIServer.Skat.Model;

namespace APIServer.Skat
{
    public interface ISkatService
    {
        // --- without authentication

        public long GetState();

        public LoginModel Login(IPwdManService pwdManService, string authenticationToken, string username);

        public ChatModel GetChatModel();

        public bool Chat(string ticket, string message);

        // --- with authentication (ticket)

        public bool Logout(string ticket);

        public SkatModel GetSkatModel(string ticket);

        public ResultModel GetResultModel(string ticket);

        public bool PerformBidAction(string ticket, string bidAction);

        public bool StartNewGame(IPwdManService pwdManService, string ticket);

        public bool GiveUp(IPwdManService pwdManService, string ticket);

        public bool SetGame(string ticket, GameModel skatGameModel);

        public bool SetGameOption(string ticket, GameOptionModel skatGameOptionModel);

        public bool PlayCard(IPwdManService pwdManService, string ticket, int internalCardNumber);

        public bool CollectStitch(IPwdManService pwdManService, string ticket);

        public bool PickupSkat(string ticket, int internalCardNumber);

        public bool ConfirmStartGame(string ticket);

        public bool SpeedUp(string ticket);

        public bool ConfirmSpeedUp(IPwdManService pwdManService, string ticket);

        public bool ContinuePlay(string ticket);

        // --- with admin privileges

        public bool Reset(string ticket);

        public List<string> GetLoggedInUsers(string ticket);

    }
}
