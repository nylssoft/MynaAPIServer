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
using APIServer.PwdMan;

namespace APIServer.Skat
{
    [ApiController]
    public class SkatController : ControllerBase
    {
        public IConfiguration Configuration { get; }

        public ISkatService SkatService { get; }

        public IPwdManService PwdManService { get; }

        public SkatController(IConfiguration configuration, ISkatService skatService, IPwdManService pwdManService)
        {
            Configuration = configuration;
            SkatService = skatService;
            PwdManService = pwdManService;
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
        public IActionResult Login([FromBody] string username)
        {
            return new JsonResult(SkatService.Login(PwdManService, GetToken(), username));
        }

        [HttpGet]
        [Route("api/skat/chat")]
        public IActionResult GetChat()
        {
            return new JsonResult(SkatService.GetChatModel());
        }

        // --- with authentication

        [HttpPost]
        [Route("api/skat/chat")]
        public IActionResult Chat([FromBody] string value)
        {
            return new JsonResult(SkatService.Chat(GetTicket(), value));
        }

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
            return new JsonResult(SkatService.StartNewGame(PwdManService, GetTicket()));
        }

        [HttpPost]
        [Route("api/skat/giveup")]
        public IActionResult GiveUp()
        {
            return new JsonResult(SkatService.GiveUp(PwdManService, GetTicket()));
        }

        [HttpPost]
        [Route("api/skat/speedup")]
        public IActionResult SpeedUp()
        {
            return new JsonResult(SkatService.SpeedUp(GetTicket()));
        }

        [HttpPost]
        [Route("api/skat/collectstitch")]
        public IActionResult CollectStitch()
        {
            return new JsonResult(SkatService.CollectStitch(PwdManService, GetTicket()));
        }

        [HttpPost]
        [Route("api/skat/playcard")]
        public IActionResult PlayCard([FromBody] int value)
        {
            return new JsonResult(SkatService.PlayCard(PwdManService, GetTicket(), value));
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

        [HttpPost]
        [Route("api/skat/confirmspeedup")]
        public IActionResult ConfirmSpeedUp()
        {
            return new JsonResult(SkatService.ConfirmSpeedUp(PwdManService, GetTicket()));
        }

        [HttpPost]
        [Route("api/skat/continueplay")]
        public IActionResult ContinuePlay()
        {
            return new JsonResult(SkatService.ContinuePlay(GetTicket()));
        }

        [HttpGet]
        [Route("api/skat/model")]
        public IActionResult GetModel()
        {
            return new JsonResult(SkatService.GetSkatModel(GetTicket()));
        }

        [HttpGet]
        [Route("api/skat/gamehistory")]
        public IActionResult GetGameHistory()
        {
            return new JsonResult(SkatService.GetGameHistoryModel(GetTicket()));
        }

        [HttpGet]
        [Route("api/skat/result")]
        public IActionResult GetResult()
        {
            return new JsonResult(SkatService.GetResultModel(GetTicket()));
        }

        [HttpGet]
        [Route("api/skat/results")]
        public IActionResult GetResults()
        {
            return new JsonResult(SkatService.GetResultModels(PwdManService, GetToken()));
        }

        [HttpGet]
        [Route("api/skat/resultbyid")]
        public IActionResult GetResultByid([FromQuery]long id)
        {
            return new JsonResult(SkatService.GetResultModelById(PwdManService, GetToken(), id));
        }

        // --- authenticated users with skatadmin role

        [HttpDelete]
        [Route("api/skat/resultbyid")]
        public IActionResult DeleteResultByid([FromBody] long id)
        {
            return new JsonResult(SkatService.DeleteResultModelById(PwdManService, GetToken(), id));
        }

        [HttpGet]
        [Route("api/skat/reset")]
        public IActionResult Reset()
        {
            return new JsonResult(SkatService.Reset(PwdManService, GetToken()));
        }

        [HttpGet]
        [Route("api/skat/tickets")]
        public IActionResult GetLoggedInUsers()
        {
            return new JsonResult(SkatService.GetLoggedInUsers(PwdManService, GetToken()));
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
