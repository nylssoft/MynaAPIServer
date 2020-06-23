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
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

using APIServer.Skat.Model;

namespace APIServer.Skat
{
    [ApiController]
    public class SkatController : ControllerBase
    {
        public IConfiguration Configuration { get; }

        public ISkatService SkatService { get; }

        public SkatController(IConfiguration configuration, ISkatService skatService)
        {
            Configuration = configuration;
            SkatService = skatService;
        }

        // --- without authentication

        [HttpGet]
        [Route("api/skat/state")]
        public IActionResult GetState()
        {
            return new JsonResult(SkatService.GetState());
        }

        [HttpPost]
        [Route("api/skat/login")]
        public IActionResult Login([FromBody] string value)
        {
            return new JsonResult(SkatService.Login(value));
        }

        // --- with authentication

        [HttpPost]
        [Route("api/skat/logout")]
        public IActionResult Logout()
        {
            return new JsonResult(SkatService.Logout(GetTicket()));
        }

        [HttpPost]
        [Route("api/skat/bid")]
        public IActionResult PerformBidAction([FromBody] string value)
        {
            return new JsonResult(SkatService.PerformBidAction(GetTicket(), value));
        }

        [HttpPost]
        [Route("api/skat/newgame")]
        public IActionResult StartNewGame()
        {
            return new JsonResult(SkatService.StartNewGame(GetTicket()));
        }

        [HttpPost]
        [Route("api/skat/giveup")]
        public IActionResult GiveUp()
        {
            return new JsonResult(SkatService.GiveUp(GetTicket()));
        }

        [HttpPost]
        [Route("api/skat/collectstitch")]
        public IActionResult CollectStitch()
        {
            return new JsonResult(SkatService.CollectStitch(GetTicket()));
        }

        [HttpPost]
        [Route("api/skat/playcard")]
        public IActionResult PlayCard([FromBody] int value)
        {
            return new JsonResult(SkatService.PlayCard(GetTicket(), value));
        }

        [HttpPost]
        [Route("api/skat/pickupskat")]
        public IActionResult PickupSkat([FromBody] int value)
        {
            return new JsonResult(SkatService.PickupSkat(GetTicket(), value));
        }

        [HttpPost]
        [Route("api/skat/game")]
        public IActionResult SetGame([FromBody] GameModel value)
        {
            return new JsonResult(SkatService.SetGame(GetTicket(), value));
        }

        [HttpPost]
        [Route("api/skat/gameoption")]
        public IActionResult SetGameOption([FromBody] GameOptionModel value)
        {
            return new JsonResult(SkatService.SetGameOption(GetTicket(), value));
        }

        [HttpPost]
        [Route("api/skat/confirmstartgame")]
        public IActionResult ConfirmStartGame()
        {
            return new JsonResult(SkatService.ConfirmStartGame(GetTicket()));
        }

        [HttpGet]
        [Route("api/skat/model")]
        public IActionResult GetModel()
        {
            return new JsonResult(SkatService.GetSkatModel(GetTicket()));
        }

        // --- authentication with administrative privileges

        [HttpPost]
        [Route("api/skat/reset")]
        public IActionResult Reset()
        {
            return new JsonResult(SkatService.Reset(GetTicket()));
        }

        [HttpGet]
        [Route("api/skat/tickets")]
        public IActionResult GetLoggedInUsers()
        {
            return new JsonResult(SkatService.GetLoggedInUsers(GetTicket()));
        }

        // --- private

        private string GetTicket()
        {
            return HttpContext.Request.Headers["ticket"];
        }
    }
}
