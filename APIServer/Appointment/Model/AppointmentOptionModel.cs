﻿/*
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
using System.Collections.Generic;

namespace APIServer.Appointment.Model
{
    public class AppointmentOptionModel
    {
        public int Year { get; set; }

        public int Month { get; set; }

        public List<int> Days { get; set; } = new();
    }
}