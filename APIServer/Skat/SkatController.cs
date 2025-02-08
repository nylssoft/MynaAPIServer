/*
    Myna API Server
    Copyright (C) 2020-2025 Niels Stockfleth

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

using APIServer.Skat.Model;
using APIServer.PwdMan;
using System.Collections.Generic;

namespace APIServer.Skat
{
    [ApiController]
    public class SkatController : ControllerBase
    {
        public ISkatService SkatService { get; }

        public IPwdManService PwdManService { get; }

        public SkatController(ISkatService skatService, IPwdManService pwdManService)
        {
            SkatService = skatService;
            PwdManService = pwdManService;
        }

        // --- without authentication

        [HttpGet]
        [Route("api/skat/longpollstate/{clientState}")]
        public IActionResult GetLongPollState(long clientState)
        {
            return new JsonResult(SkatService.GetLongPollState(clientState));
        }

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
            if (username?.Length > Limits.MAX_USERNAME) throw new InputValueTooLargeException();
            return new JsonResult(SkatService.Login(PwdManService, GetToken(), username));
        }

        // --- computer game (stateless)

        [HttpPost]
        [Route("api/skat/computer/model")]
        public IActionResult GetComputerSkatModel([FromBody] ComputerRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.CurrentPlayerName)) throw new MissingParameterException();
            if (string.IsNullOrEmpty(request.InternalState) && (string.IsNullOrEmpty(request.ComputerPlayerName1) || string.IsNullOrEmpty(request.ComputerPlayerName2))) throw new MissingParameterException();
            if (request.CurrentPlayerName?.Length > Limits.MAX_USERNAME) throw new InputValueTooLargeException();
            if (request.ComputerPlayerName1?.Length > Limits.MAX_USERNAME) throw new InputValueTooLargeException();
            if (request.ComputerPlayerName2?.Length > Limits.MAX_USERNAME) throw new InputValueTooLargeException();
            if (request.InternalState?.Length > Limits.MAX_PWDMAN_CONTENT) throw new InputValueTooLargeException();
            return new JsonResult(SkatService.GetComputerSkatModel(request.CurrentPlayerName, request.InternalState, request.ComputerPlayerName1, request.ComputerPlayerName2));
        }

        [HttpPost]
        [Route("api/skat/computer/game")]
        public IActionResult SetComputerGame([FromBody] ComputerRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.InternalState) || string.IsNullOrEmpty(request.CurrentPlayerName) || request.GameModel == null) throw new MissingParameterException();
            if (request.CurrentPlayerName.Length > Limits.MAX_USERNAME) throw new InputValueTooLargeException();
            if (request.InternalState.Length > Limits.MAX_PWDMAN_CONTENT) throw new InputValueTooLargeException();
            return new JsonResult(SkatService.SetComputerGame(request.CurrentPlayerName, request.InternalState, request.GameModel));
        }

        [HttpPost]
        [Route("api/skat/computer/gameoption")]
        public IActionResult SetComputerGameOption([FromBody] ComputerRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.InternalState) || string.IsNullOrEmpty(request.CurrentPlayerName) || request.GameOptionModel == null) throw new MissingParameterException();
            if (request.CurrentPlayerName.Length > Limits.MAX_USERNAME) throw new InputValueTooLargeException();
            if (request.InternalState.Length > Limits.MAX_PWDMAN_CONTENT) throw new InputValueTooLargeException();
            return new JsonResult(SkatService.SetComputerGameOption(request.CurrentPlayerName, request.InternalState, request.GameOptionModel));
        }

        [HttpPost]
        [Route("api/skat/computer/bid")]
        public IActionResult PerformComputerBidAction([FromBody] ComputerRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.InternalState)|| string.IsNullOrEmpty(request.CurrentPlayerName) || string.IsNullOrEmpty(request.Action)) throw new MissingParameterException();
            if (request.CurrentPlayerName.Length > Limits.MAX_USERNAME) throw new InputValueTooLargeException();
            if (request.InternalState.Length > Limits.MAX_PWDMAN_CONTENT) throw new InputValueTooLargeException();
            return new JsonResult(SkatService.PerformComputerBidAction(request.CurrentPlayerName, request.InternalState, request.Action));
        }

        [HttpPost]
        [Route("api/skat/computer/pickupskat")]
        public IActionResult PickupComputerSkat([FromBody] ComputerRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.InternalState) || string.IsNullOrEmpty(request.CurrentPlayerName)) throw new MissingParameterException();
            if (request.CurrentPlayerName.Length > Limits.MAX_USERNAME) throw new InputValueTooLargeException();
            if (request.InternalState.Length > Limits.MAX_PWDMAN_CONTENT) throw new InputValueTooLargeException();
            return new JsonResult(SkatService.PickupComputerSkat(request.CurrentPlayerName, request.InternalState, request.Card));
        }

        [HttpPost]
        [Route("api/skat/computer/playcard")]
        public IActionResult PlayComputerCard([FromBody] ComputerRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.InternalState) || string.IsNullOrEmpty(request.CurrentPlayerName)) throw new MissingParameterException();
            if (request.CurrentPlayerName.Length > Limits.MAX_USERNAME) throw new InputValueTooLargeException();
            if (request.InternalState.Length > Limits.MAX_PWDMAN_CONTENT) throw new InputValueTooLargeException();
            return new JsonResult(SkatService.PlayComputerCard(request.CurrentPlayerName, request.InternalState, request.Card));
        }

        [HttpPost]
        [Route("api/skat/computer/collectstitch")]
        public IActionResult CollectComputerStitch([FromBody] ComputerRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.InternalState) || string.IsNullOrEmpty(request.CurrentPlayerName)) throw new MissingParameterException();
            if (request.CurrentPlayerName.Length > Limits.MAX_USERNAME) throw new InputValueTooLargeException();
            if (request.InternalState.Length > Limits.MAX_PWDMAN_CONTENT) throw new InputValueTooLargeException();
            return new JsonResult(SkatService.CollectComputerStitch(request.CurrentPlayerName, request.InternalState));
        }

        [HttpPost]
        [Route("api/skat/computer/newgame")]
        public IActionResult StartComputerNewGame([FromBody] ComputerRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.InternalState) || string.IsNullOrEmpty(request.CurrentPlayerName)) throw new MissingParameterException();
            if (request.CurrentPlayerName.Length > Limits.MAX_USERNAME) throw new InputValueTooLargeException();
            if (request.InternalState.Length > Limits.MAX_PWDMAN_CONTENT) throw new InputValueTooLargeException();
            return new JsonResult(SkatService.StartComputerNewGame(request.CurrentPlayerName, request.InternalState));
        }

        [HttpPost]
        [Route("api/skat/computer/result")]
        public IActionResult GetComputerResult([FromBody] ComputerRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.InternalState)) throw new MissingParameterException();
            if (request.InternalState.Length > Limits.MAX_PWDMAN_CONTENT) throw new InputValueTooLargeException();
            return new JsonResult(SkatService.GetComputerResultModel(request.InternalState));
        }

        [HttpPost]
        [Route("api/skat/computer/gamehistory")]
        public IActionResult GetComputerGameHistory([FromBody] ComputerRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.InternalState)) throw new MissingParameterException();
            if (request.InternalState.Length > Limits.MAX_PWDMAN_CONTENT) throw new InputValueTooLargeException();
            return new JsonResult(SkatService.GetComputerGameHistoryModel(request.InternalState));
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
            return new JsonResult(SkatService.PerformBidAction(PwdManService, GetTicket(), value));
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

        [HttpPost]
        [Route("api/skat/statistics/{startYear}")]
        public IActionResult CalculateStatistics(int startYear, [FromBody] List<string> playerNames)
        {
            return new JsonResult(SkatService.CalculateStatistics(PwdManService, GetToken(), playerNames, startYear));
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

        // --- reservations

        [HttpGet]
        [Route("api/skat/reservation")]
        public IActionResult GetReservations()
        {
            return new JsonResult(SkatService.GetReservations(PwdManService));
        }

        [HttpPost]
        [Route("api/skat/reservation")]
        public IActionResult AddReservation([FromBody] ReservationModel reservationModel)
        {
            return new JsonResult(SkatService.AddReservation(PwdManService, GetToken(), reservationModel));
        }

        [HttpDelete]
        [Route("api/skat/reservation")]
        public IActionResult DeleteReservation([FromBody] long id)
        {
            return new JsonResult(SkatService.DeleteReservation(PwdManService, GetToken(), id));
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
