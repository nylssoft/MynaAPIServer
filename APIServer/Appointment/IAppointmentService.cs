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
using System;
using System.Collections.Generic;

namespace APIServer.Appointment
{
    public interface IAppointmentService
    {
        DateTime AddAppointment(IPwdManService pwdManService, string authenticationToken, string uuid, AppointmentModel appointment, string securityKey);

        bool DeleteAppointment(IPwdManService pwdManService, string authenticationToken, string uuid);

        List<AppointmentModel> GetAppointments(IPwdManService pwdManService, string authenticationToken);

        AppointmentModel GetAppointment(IPwdManService pwdManService, string uuid, string securityKey);

        DateTime? UpdateAppointment(IPwdManService pwdManService, string authenticationToken, string uuid, AppointmentDefinitionModel definition, string securityKey);

        DateTime? UpdateVote(IPwdManService pwdManService, string uuid, AppointmentVoteModel vote, string securityKey);

        string GenerateRandomKey(IPwdManService pwdManService, string authenticationToken);
    }
}
