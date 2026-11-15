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
using APIServer.PwdMan;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading;
using System.Threading.RateLimiting;
using System.Threading.Tasks;

namespace APIServer.Weather
{
    [ApiController]
    public class WeatherController : ControllerBase
    {
        private readonly IPwdManService pwdManService;
        private readonly IWeatherService weatherService;
        private readonly WeatherRateLimiter rateLimiter;

        public WeatherController(IPwdManService pwdManService, IWeatherService weatherService, WeatherRateLimiter rateLimiter)
        {
            this.pwdManService = pwdManService;
            this.weatherService = weatherService;
            this.rateLimiter = rateLimiter;
        }

        [HttpGet]
        [Route("api/weather")]
        public async Task<IActionResult> GetWeather([FromQuery] string city, [FromQuery] string countryCode, [FromQuery] long? locationId, [FromQuery] string locale, CancellationToken cancellationToken)
        {
            var user = pwdManService.GetUserFromToken(HttpContext.Request.Headers["token"]);
            using var lease = rateLimiter.Acquire(user.Id);
            if (!lease.IsAcquired)
            {
                Response.Headers.RetryAfter = "60";
                return Problem(title: "ERROR_WEATHER_RATE_LIMIT", statusCode: 429);
            }

            city = city?.Trim();
            countryCode = countryCode?.Trim();
            if (locationId.HasValue)
            {
                if (locationId <= 0 || !string.IsNullOrEmpty(city) || !string.IsNullOrEmpty(countryCode)) throw new InvalidParameterException();
            }
            else
            {
                if (string.IsNullOrEmpty(city)) throw new MissingParameterException();
                if (city.Length > 100) throw new InputValueTooLargeException();
                if (city.Length < 2 || (countryCode != null && (countryCode.Length != 2 || !IsAsciiLetter(countryCode[0]) || !IsAsciiLetter(countryCode[1])))) throw new InvalidParameterException();
            }

            Response.Headers.CacheControl = "private,no-store";
            var result = await weatherService.GetWeatherAsync(city, countryCode?.ToUpperInvariant(), locationId, locale, cancellationToken);
            if (result.Candidates != null)
            {
                return StatusCode(409, new { error = "ERROR_WEATHER_AMBIGUOUS_LOCATION", candidates = result.Candidates });
            }
            return new JsonResult(result.Weather);
        }

        private static bool IsAsciiLetter(char value) => (value >= 'A' && value <= 'Z') || (value >= 'a' && value <= 'z');
    }

    public sealed class WeatherRateLimiter : IDisposable
    {
        private readonly PartitionedRateLimiter<long> limiter = PartitionedRateLimiter.Create<long, long>(userId =>
            RateLimitPartition.GetFixedWindowLimiter(userId, _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));

        public RateLimitLease Acquire(long userId) => limiter.AttemptAcquire(userId);

        public void Dispose() => limiter.Dispose();
    }
}
