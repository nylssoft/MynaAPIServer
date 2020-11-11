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
using System;
using System.Collections.Generic;

namespace APIServer.Skat.Model
{
    public class ResultModel
    {
        public long Id { get; set; }

        public DateTime? StartedUtc { get; set; }

        public DateTime? EndedUtc { get; set; }

        public List<string> PlayerNames { get; set; } = new List<string>();

        public List<GameHistoryModel> History { get; set; } = new List<GameHistoryModel>();
    }
}
