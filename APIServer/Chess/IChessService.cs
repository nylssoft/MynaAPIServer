﻿/*
    Myna API Server
    Copyright (C) 2021 Niels Stockfleth

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
using APIServer.Chess.Model;
using APIServer.PwdMan;

namespace APIServer.Chess
{
    public interface IChessService
    {
        // --- without authentication

        StateModel GetState();

        LoginModel Login(IPwdManService pwdManService, string authenticationToken, string username);

        // --- with authentication (ticket)

        bool Logout(string ticket);

        ChessModel GetChessModel(string ticket);

        bool StartNewGame(string ticket, StartGameModel startGameModel);

        bool EndGame(string ticket);

        bool ConfirmStartGame(string ticket, bool ok);

        bool StartNextGame(string ticket);

        bool ConfirmNextGame(string ticket, bool ok);

        bool Place(string ticket, PlaceModel placeModel);
    }
}
