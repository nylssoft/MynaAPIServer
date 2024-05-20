/*
    Myna API Server
    Copyright (C) 2024 Niels Stockfleth

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
using APIServer.Appointment;
using APIServer.Appointment.Model;
using APIServer.PwdMan;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Primitives;
using System;
using System.Text;

namespace APIServer.Pages
{   
    public class MakeAdateModel : PageModel
    {
        public string OgTitle { get; private set; }
        public string OgDescription { get; private set; }
        public string OgImage { get; private set; }
        public string OgType { get; private set; }

        public IAppointmentService AppointmentService { get; }

        public IPwdManService PwdManService { get; }

        public MakeAdateModel(IAppointmentService appointmentService, IPwdManService pwdManService)
        {
            AppointmentService = appointmentService;
            PwdManService = pwdManService;
        }

        public void OnGet()
        {
            try
            {
                if (Request.Query.TryGetValue("id", out StringValues idValues))
                {
                    if (idValues.Count == 1)
                    {
                        string id = idValues[0];
                        byte[] base64 = Convert.FromBase64String(id);
                        string accessToken = Encoding.ASCII.GetString(base64);
                        string[] split = accessToken.Split('#');
                        if (split.Length == 3)
                        {
                            string uuid = split[1];
                            string secKey = AppointmentService.GetSecurityKey(uuid, accessToken);
                            AppointmentModel appModel = AppointmentService.GetAppointment(PwdManService, uuid, secKey);
                            AppointmentDefinitionModel defModel = appModel.Definition;
                            OgTitle = "Make a date!";
                            OgDescription = defModel.Description;
                            OgType = "website";
                            OgImage = $"{Request.Scheme}://{Request.Host}/images/social/makeadate.png";
                        }
                    }
                }
            }
            catch
            {
                // ignored
            }
        }
    }
}
