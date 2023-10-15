/*
    Myna API Server
    Copyright (C) 2023 Niels Stockfleth

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
using APIServer.Appointment.Model;
using APIServer.PwdMan;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.Collections.Generic;

namespace APIServer.Appointment
{
    [ApiController]
    public class AppointmentController : ControllerBase
    {
        public IAppointmentService AppointmentService { get; }

        public IPwdManService PwdManService { get; set; }

        public AppointmentController(IAppointmentService appointmentsService, IPwdManService pwdManService)
        {
            AppointmentService = appointmentsService;
            PwdManService = pwdManService;
        }

        [HttpGet]
        [Route("api/appointment")]
        public IActionResult GetApppointments()
        {
            return new JsonResult(AppointmentService.GetAppointments(PwdManService, GetToken()));
        }

        [HttpGet]
        [Route("api/appointment/{uuid}")]
        public IActionResult GetAppointment(string uuid)
        {
            if (uuid.IsNullOrEmpty()) throw new MissingParameterException();
            if (uuid.Length > Limits.MAX_APPOINTMENT_UUID) throw new InputValueTooLargeException();
            return new JsonResult(AppointmentService.GetAppointment(PwdManService, uuid, GetSecurityKey()));
        }


        [HttpDelete]
        [Route("api/appointment/{uuid}")]
        public IActionResult DeleteAppointment(string uuid)
        {
            if (string.IsNullOrEmpty(uuid)) throw new MissingParameterException();
            if (uuid.Length > Limits.MAX_APPOINTMENT_UUID) throw new InputValueTooLargeException();
            return new JsonResult(AppointmentService.DeleteAppointment(PwdManService, GetToken(), uuid));
        }

        [HttpPut]
        [Route("api/appointment/{uuid}")]
        public IActionResult UpdateAppointment(string uuid, [FromBody] AppointmentDefinitionModel definition)
        {
            if (uuid.IsNullOrEmpty() || definition == null) throw new MissingParameterException();
            if (uuid.Length > Limits.MAX_APPOINTMENT_UUID) throw new InputValueTooLargeException();
            return new JsonResult(AppointmentService.UpdateAppointment(PwdManService, GetToken(), uuid, definition, GetSecurityKey()));
        }

        [HttpPost]
        [Route("api/appointment/{uuid}")]
        public IActionResult AddAppointment(string uuid, [FromBody] AppointmentModel appointment)
        {
            if (uuid.IsNullOrEmpty() || appointment == null) throw new MissingParameterException();
            if (uuid.Length > Limits.MAX_APPOINTMENT_UUID) throw new InputValueTooLargeException();
            return new JsonResult(AppointmentService.AddAppointment(PwdManService, GetToken(), uuid, appointment, GetSecurityKey()));
        }

        [HttpPut]
        [Route("api/appointment/{uuid}/vote")]
        public IActionResult UpdateVote(string uuid, [FromBody] AppointmentVoteModel vote)
        {
            if (uuid.IsNullOrEmpty() || vote == null || vote.UserUuid.IsNullOrEmpty()) throw new MissingParameterException();
            if (vote.UserUuid.Length > Limits.MAX_APPOINTMENT_UUID) throw new InputValueTooLargeException();
            return new JsonResult(AppointmentService.UpdateVote(PwdManService, uuid, vote, GetSecurityKey()));
        }

        [HttpGet]
        [Route("api/appointment/randomkey")]
        public IActionResult GenerateRandomKey()
        {
            return new JsonResult(AppointmentService.GenerateRandomKey(PwdManService, GetToken()));
        }

        [HttpPost]
        [Route("api/appointment/batch")]
        public IActionResult GetAppointmentsBatch([FromBody] List<AppointmentGetRequest> requests)
        {
            if (requests.IsNullOrEmpty()) throw new MissingParameterException();
            if (requests.Count > Limits.MAX_APPOINTMENT_BATCH) throw new InputValueTooLargeException();
            List<AppointmentModel> ret = new();
            foreach (var request in requests)
            {
                if (request.Uuid.IsNullOrEmpty()) throw new MissingParameterException();
                if (request.Uuid.Length > Limits.MAX_APPOINTMENT_UUID) throw new InputValueTooLargeException();
                if (request.SecurityKey.IsNullOrEmpty()) throw new MissingParameterException();
                if (request.Method == "GET")
                {
                    ret.Add(AppointmentService.GetAppointment(PwdManService, request.Uuid, request.SecurityKey));
                }
                else if (request.Method == "DELETE")
                {
                    var deleted = AppointmentService.DeleteAppointment(PwdManService, GetToken(), request.Uuid);
                    var model = new AppointmentModel();
                    var prefix = deleted ? "DELETED" : "NOTFOUND";
                    model.Uuid = $"{prefix}:{request.Uuid}";
                    ret.Add(model);
                }
            }
            return new JsonResult(ret);
        }

        // --- private

        private string GetToken() => HttpContext.Request.Headers["token"];

        private string GetSecurityKey() => HttpContext.Request.Headers["securitykey"];
    }
}
