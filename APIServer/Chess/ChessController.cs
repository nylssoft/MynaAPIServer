/*
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
using Microsoft.AspNetCore.Mvc;

namespace APIServer.Chess
{
    [ApiController]
    public class ChessController : ControllerBase
    {
        public IChessService ChessService { get; }

        public IPwdManService PwdManService { get; }

        public ChessController(IChessService chessService, IPwdManService pwdManService)
        {
            ChessService = chessService;
            PwdManService = pwdManService;
        }

        // --- without authentication

        [HttpGet]
        [Route("api/chess/state")]
        public IActionResult GetState()
        {
            return new JsonResult(ChessService.GetState());
        }

        [HttpPost]
        [Route("api/chess/login")]
        public IActionResult Login([FromBody] string username)
        {
            if (username?.Length > Limits.MAX_USERNAME) throw new InputValueTooLargeException();
            return new JsonResult(ChessService.Login(PwdManService, GetToken(), username));
        }

        // --- with authentication

        [HttpPost]
        [Route("api/chess/logout")]
        public IActionResult Logout()
        {
            return new JsonResult(ChessService.Logout(GetTicket()));
        }

        [HttpGet]
        [Route("api/chess/model")]
        public IActionResult GetModel()
        {
            return new JsonResult(ChessService.GetChessModel(GetTicket()));
        }

        [HttpPost]
        [Route("api/chess/newgame")]
        public IActionResult StartNewGame([FromBody] StartGameModel startGameModel)
        {
            return new JsonResult(ChessService.StartNewGame(GetTicket(), startGameModel));
        }

        [HttpPost]
        [Route("api/chess/confirmstartgame")]
        public IActionResult ConfirmStartGame([FromBody] bool ok)
        {
            return new JsonResult(ChessService.ConfirmStartGame(GetTicket(), ok));
        }

        [HttpPost]
        [Route("api/chess/endgame")]
        public IActionResult EndGame()
        {
            return new JsonResult(ChessService.EndGame(GetTicket()));
        }

        [HttpPost]
        [Route("api/chess/place")]
        public IActionResult Place([FromBody] PlaceModel value)
        {
            return new JsonResult(ChessService.Place(GetTicket(), value));
        }

        // --- private

        private string GetTicket()
        {
            return HttpContext.Request.Headers["ticket"];
        }

        private string GetToken()
        {
            return HttpContext.Request.Headers["token"];
        }
    }
}
