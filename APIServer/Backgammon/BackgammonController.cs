﻿/*
    Myna API Server
    Copyright (C) 2022 Niels Stockfleth

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
using APIServer.PwdMan;
using Microsoft.AspNetCore.Mvc;

namespace APIServer.Backgammon
{
    [ApiController]
    public class BackgammonController : ControllerBase
    {
        public IBackgammonService BackgammonService { get; }

        public IPwdManService PwdManService { get; }

        public BackgammonController(IBackgammonService backgammonService, IPwdManService pwdManService)
        {
            BackgammonService = backgammonService;
            PwdManService = pwdManService;
        }

        // --- without authentication

        [HttpGet]
        [Route("api/backgammon/state")]
        public IActionResult GetState()
        {
            return new JsonResult(BackgammonService.GetState());
        }

        [HttpPost]
        [Route("api/backgammon/login")]
        public IActionResult Login([FromBody] string username)
        {
            if (username?.Length > Limits.MAX_USERNAME) throw new InputValueTooLargeException();
            return new JsonResult(BackgammonService.Login(PwdManService, GetToken(), username));
        }

        // --- with authentication

        [HttpPost]
        [Route("api/backgammon/logout")]
        public IActionResult Logout()
        {
            return new JsonResult(BackgammonService.Logout(GetTicket()));
        }

        [HttpGet]
        [Route("api/backgammon/model")]
        public IActionResult GetModel()
        {
            return new JsonResult(BackgammonService.GetBackgammonModel(GetTicket()));
        }

        [HttpPost]
        [Route("api/backgammon/newgame")]
        public IActionResult StartNewGame()
        {
            return new JsonResult(BackgammonService.StartNewGame(GetTicket()));
        }

        [HttpPost]
        [Route("api/backgammon/roll")]
        public IActionResult Roll()
        {
            return new JsonResult(BackgammonService.Roll(GetTicket()));
        }

        [HttpPost]
        [Route("api/backgammon/giveup")]
        public IActionResult GiveUp()
        {
            return new JsonResult(BackgammonService.GiveUp(GetTicket()));
        }

        [HttpPost]
        [Route("api/backgammon/nextgame")]
        public IActionResult StartNextGame()
        {
            return new JsonResult(BackgammonService.StartNextGame(GetTicket()));
        }

        [HttpPost]
        [Route("api/backgammon/confirmnextgame")]
        public IActionResult ConfirmNextGame([FromBody] bool ok)
        {
            return new JsonResult(BackgammonService.ConfirmNextGame(GetTicket(), ok));
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
