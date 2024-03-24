/*
    Myna API Server
    Copyright (C) 2020-2024 Niels Stockfleth

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

        long GetState();

        LoginModel Login(IPwdManService pwdManService, string authenticationToken, string username);

        ChatModel GetChatModel(IPwdManService pwdManService);

        bool Chat(IPwdManService pwdManService, string authenticationToken, string message);

        // --- computer game

        SkatModel GetComputerSkatModel(string currentPlayer, string state, string computer1, string computer2);

        string SetComputerGame(string currentPlayer, string state, GameModel skatGameModel);

        string SetComputerGameOption(string currentPlayer, string state, GameOptionModel skatGameOptionModel);

        string PerformComputerBidAction(string currentPlayer, string state, string bidAction);

        string PickupComputerSkat(string currentPlayer, string state, int internalCardNumber);

        string PlayComputerCard(string currentPlayer, string state, int internalCardNumber);

        string CollectComputerStitch(string currentPlayer, string state);

        string StartComputerNewGame(string currentPlayer, string state);

        ResultModel GetComputerResultModel(string state);

        GameHistoryModel GetComputerGameHistoryModel(string state);

        // --- with authentication (ticket)

        bool Logout(string ticket);

        SkatModel GetSkatModel(string ticket);

        GameHistoryModel GetGameHistoryModel(string ticket);

        ResultModel GetResultModel(string ticket);

        ResultModel GetResultModelById(IPwdManService pwdManService, string authenticationToken, long skatResultId);

        List<ResultModel> GetResultModels(IPwdManService pwdManService, string authenticationToken);

        StatisticModel CalculateStatistics(IPwdManService pwdManService, string authenticationToken, List<string> playerNames, int startYear);

        bool PerformBidAction(IPwdManService pwdManService, string ticket, string bidAction);

        bool StartNewGame(IPwdManService pwdManService, string ticket);

        bool GiveUp(IPwdManService pwdManService, string ticket);

        bool SetGame(string ticket, GameModel skatGameModel);

        bool SetGameOption(string ticket, GameOptionModel skatGameOptionModel);

        bool PlayCard(IPwdManService pwdManService, string ticket, int internalCardNumber);

        bool CollectStitch(IPwdManService pwdManService, string ticket);

        bool PickupSkat(string ticket, int internalCardNumber);

        bool ConfirmStartGame(string ticket);

        bool SpeedUp(string ticket);

        bool ConfirmSpeedUp(IPwdManService pwdManService, string ticket);

        bool ContinuePlay(string ticket);

        // --- with skatadmin user role

        bool DeleteResultModelById(IPwdManService pwdManService, string authenticationToken, long skatResultId);

        bool Reset(IPwdManService pwdManService, string authenticationToken);

        List<string> GetLoggedInUsers(IPwdManService pwdManService, string authenticationToken);

        // --- reservations

        List<ReservationModel> GetReservations(IPwdManService pwdManService);

        bool AddReservation(IPwdManService pwdManService, string authenticatioToken, ReservationModel reservationModel);

        bool DeleteReservation(IPwdManService pwdManService, string authenticatioToken, long id);
    }
}
