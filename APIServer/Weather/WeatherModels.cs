/*
    Myna API Server
    Copyright (C) 2026 Niels Stockfleth

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
using System.Text.Json.Serialization;

namespace APIServer.Weather
{
    public class WeatherLocation
    {
        public long Id { get; set; }
        public string Name { get; set; }
        public string CountryCode { get; set; }
        public string Region { get; set; }
        public string TimeZone { get; set; }
        [JsonIgnore]
        public double? Latitude { get; set; }
        [JsonIgnore]
        public double? Longitude { get; set; }
    }

    public class WeatherResponse
    {
        public WeatherLocation Location { get; set; }
        public DateTimeOffset AsOfUtc { get; set; }
        public CurrentWeather Current { get; set; }
        public List<HourlyWeather> Hourly { get; set; }
        public List<DailyWeather> Daily { get; set; }
    }

    public class DailyWeather
    {
        public string Date { get; set; }
        public double? TemperatureMinC { get; set; }
        public double? TemperatureMaxC { get; set; }
        public int? WeatherCode { get; set; }
        public int? PrecipitationProbabilityMaxPercent { get; set; }
        public double? WindSpeedMaxKph { get; set; }
    }

    public class CurrentWeather
    {
        public DateTimeOffset TimeUtc { get; set; }
        public double? TemperatureC { get; set; }
        public int? WeatherCode { get; set; }
        public double? WindSpeedKph { get; set; }
    }

    public class HourlyWeather
    {
        public DateTimeOffset TimeUtc { get; set; }
        public double? TemperatureC { get; set; }
        public int? PrecipitationProbabilityPercent { get; set; }
        public int? WeatherCode { get; set; }
        public double? WindSpeedKph { get; set; }
    }

    public class WeatherLookupResult
    {
        public WeatherResponse Weather { get; set; }
        public List<WeatherLocation> Candidates { get; set; }
    }
}
