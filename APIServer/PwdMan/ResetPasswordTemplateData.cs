/*
    Myna API Server
    Copyright (C) 2021-2022 Niels Stockfleth

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
using Newtonsoft.Json;

namespace APIServer.PwdMan
{
    public class ResetPasswordTemplateData
    {
        [JsonProperty("Email")]
        public string Email { get; set; }

        [JsonProperty("Name")]
        public string Name { get; set; }

        [JsonProperty("Code")]
        public string Code { get; set; }

        [JsonProperty("Valid")]
        public int Valid { get; set; }

        [JsonProperty("Hostname")]
        public string Hostname { get; set; }

        [JsonProperty("Locale")]
        public string Locale { get; set; }

        [JsonProperty("Next")]
        public string Next { get; set; }
    }
}
