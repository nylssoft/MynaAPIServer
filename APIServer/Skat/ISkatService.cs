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

        public ChatModel GetChatModel(IPwdManService pwdManService);

        public bool Chat(IPwdManService pwdManService, string authenticationToken, string message);

        // --- with authentication (ticket)

        public bool Logout(string ticket);

        public SkatModel GetSkatModel(string ticket);

        public GameHistoryModel GetGameHistoryModel(string ticket);

        public ResultModel GetResultModel(string ticket);

        public ResultModel GetResultModelById(IPwdManService pwdManService, string authenticationToken, long skatResultId);

        public List<ResultModel> GetResultModels(IPwdManService pwdManService, string authenticationToken);
    
        public bool PerformBidAction(IPwdManService pwdManService, string ticket, string bidAction);

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

        // --- with skatadmin user role

        public bool DeleteResultModelById(IPwdManService pwdManService, string authenticationToken, long skatResultId);

        public bool Reset(IPwdManService pwdManService, string authenticationToken);

        public List<string> GetLoggedInUsers(IPwdManService pwdManService, string authenticationToken);

        // --- reservations

        public List<ReservationModel> GetReservations(IPwdManService pwdManService);

        public bool AddReservation(IPwdManService pwdManService, string authenticatioToken, ReservationModel reservationModel);

        public bool DeleteReservation(IPwdManService pwdManService, string authenticatioToken, long id);

    }
}
