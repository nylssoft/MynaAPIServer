/*
    Myna API Server
    Copyright (C) 2022-2025 Niels Stockfleth

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
using APIServer.Backgammon.Model;
using APIServer.PwdMan;

namespace APIServer.Backgammon
{
    public interface IBackgammonService
    {
        // --- without authentication

        long GetLongPollState(long clientState);

        long GetState();

        LoginModel Login(IPwdManService pwdManService, string authenticationToken, string username);

        // --- computer game (stateless)

        BackgammonModel GetModel(string currentPlayerName, string opponentPlayerName, bool buildMoveTree, string state);

        BackgammonModel Roll(string currentPlayerName, string state);

        BackgammonModel Move(string currentPlayerName, string state, MoveModel move);

        BackgammonModel Skip(string currentPlayerName, string state);

        BackgammonModel GiveUp(string currentPlayerName, string state);

        // --- with authentication (ticket)

        BackgammonModel GetBackgammonModel(string ticket);

        // following actions return the service state

        long Logout(string ticket);

        long StartNewGame(string ticket);

        long GiveUp(string ticket);

        long StartNextGame(string ticket);

        long ConfirmNextGame(string ticket, bool ok);

        long Roll(string ticket);

        long Move(string ticket, MoveModel move);

        long Skip(string ticket);
    }
}
