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
using APIServer.APIError;
using APIServer.PwdMan;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace APIServer.Weather
{
    public interface IWeatherService
    {
        Task<WeatherLookupResult> GetWeatherAsync(string city, string countryCode, long? locationId, string locale, CancellationToken cancellationToken);
    }

    public sealed class WeatherCache : IDisposable
    {
        public MemoryCache Cache { get; } = new(new MemoryCacheOptions { SizeLimit = 1000 });
        public void Dispose() => Cache.Dispose();
    }

    public class WeatherService : IWeatherService
    {
        private const string GeocodingBaseUrl = "https://geocoding-api.open-meteo.com/v1";
        private const string ForecastBaseUrl = "https://api.open-meteo.com/v1";

        private readonly HttpClient client;
        private readonly WeatherCache cache;
        private readonly TimeProvider timeProvider;
        private readonly JsonSerializerOptions jsonOptions = new() { PropertyNameCaseInsensitive = true };

        public WeatherService(HttpClient client, WeatherCache cache, TimeProvider timeProvider, IConfiguration configuration)
        {
            this.client = client;
            this.cache = cache;
            this.timeProvider = timeProvider;
        }

        public async Task<WeatherLookupResult> GetWeatherAsync(string city, string countryCode, long? locationId, string locale, CancellationToken cancellationToken)
        {
            var languageParameter = GetLanguageParameter(locale);
            WeatherLocation location;
            if (locationId.HasValue)
            {
                var geo = await GetAsync<GeoLocation>($"{GeocodingBaseUrl}/get?id={locationId.Value}{languageParameter}", true, cancellationToken);
                if (geo == null) throw new APIException("ERROR_WEATHER_LOCATION_NOT_FOUND", 404);
                location = MapLocation(geo);
            }
            else
            {
                var url = $"{GeocodingBaseUrl}/search?name={Uri.EscapeDataString(city)}&count=10{languageParameter}";
                if (!string.IsNullOrEmpty(countryCode)) url += $"&countryCode={Uri.EscapeDataString(countryCode)}";
                var results = await GetAsync<GeoSearch>(url, false, cancellationToken);
                var locations = (results.Results ?? Array.Empty<GeoLocation>()).Select(MapLocation).ToList();
                if (locations.Count == 0) throw new APIException("ERROR_WEATHER_LOCATION_NOT_FOUND", 404);
                if (locations.Count > 1) return new WeatherLookupResult { Candidates = locations };
                location = locations[0];
            }

            var cacheKey = location.Id;
            var cacheHit = cache.Cache.TryGetValue(cacheKey, out Forecast forecast);
            if (!cacheHit)
            {
                var lat = location.Latitude.Value.ToString(CultureInfo.InvariantCulture);
                var lon = location.Longitude.Value.ToString(CultureInfo.InvariantCulture);
                var url = $"{ForecastBaseUrl}/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&timezone=GMT&timeformat=unixtime&forecast_days=3";
                forecast = await GetAsync<Forecast>(url, false, cancellationToken);
                ValidateForecast(forecast);
            }

            var asOf = timeProvider.GetUtcNow();
            var hours = new List<HourlyWeather>();
            for (int i = 0; i < forecast.Hourly.Time.Length && hours.Count < 24; i++)
            {
                var time = DateTimeOffset.FromUnixTimeSeconds(forecast.Hourly.Time[i]);
                if (time <= asOf) continue;
                if (forecast.Hourly.Time[i] % 3600 != 0 || (hours.Count > 0 && time != hours[hours.Count - 1].TimeUtc.AddHours(1)))
                {
                    cache.Cache.Remove(cacheKey);
                    throw ProviderError();
                }
                hours.Add(new HourlyWeather { TimeUtc = time, TemperatureC = forecast.Hourly.Temperature[i], PrecipitationProbabilityPercent = forecast.Hourly.PrecipitationProbability[i], WeatherCode = forecast.Hourly.WeatherCode[i] });
            }
            if (hours.Count != 24 || hours[0].TimeUtc > asOf.AddHours(1))
            {
                cache.Cache.Remove(cacheKey);
                throw ProviderError();
            }
            if (!cacheHit) cache.Cache.Set(cacheKey, forecast, new MemoryCacheEntryOptions { Size = 1, AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10) });
            return new WeatherLookupResult
            {
                Weather = new WeatherResponse
                {
                    Location = location,
                    AsOfUtc = asOf,
                    Current = new CurrentWeather { TimeUtc = DateTimeOffset.FromUnixTimeSeconds(forecast.Current.Time.Value), TemperatureC = forecast.Current.Temperature, WeatherCode = forecast.Current.WeatherCode, WindSpeedKph = forecast.Current.WindSpeed },
                    Hourly = hours
                }
            };
        }

        private static string GetLanguageParameter(string locale)
        {
            if (string.IsNullOrWhiteSpace(locale)) return string.Empty;
            try
            {
                var culture = CultureInfo.GetCultureInfo(locale.Trim());
                var language = culture.TwoLetterISOLanguageName;
                if (language.Length != 2 || language.Any(c => c < 'a' || c > 'z')) throw new InvalidParameterException();
                return "&language=" + language;
            }
            catch (CultureNotFoundException)
            {
                throw new InvalidParameterException();
            }
        }

        private async Task<T> GetAsync<T>(string url, bool notFoundOnBadRequest, CancellationToken cancellationToken) where T : class
        {
            var providerHost = new Uri(url).Host;
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(10));
            try
            {
                using var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
                if (notFoundOnBadRequest && response.StatusCode == HttpStatusCode.NotFound) return null;
                if (notFoundOnBadRequest && response.StatusCode == HttpStatusCode.BadRequest)
                {
                    await using var errorStream = await response.Content.ReadAsStreamAsync(timeout.Token);
                    var error = await JsonSerializer.DeserializeAsync<ProviderErrorResponse>(errorStream, jsonOptions, timeout.Token);
                    if (error?.Reason == "Location ID not found.") return null;
                }
                if (!response.IsSuccessStatusCode)
                {
                    throw new APIException("ERROR_WEATHER_PROVIDER", 502);
                }
                await using var stream = await response.Content.ReadAsStreamAsync(timeout.Token);
                var result = await JsonSerializer.DeserializeAsync<T>(stream, jsonOptions, timeout.Token);
                return result ?? throw ProviderError();
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                throw new APIException("ERROR_WEATHER_TIMEOUT", 504);
            }
            catch (HttpRequestException)
            {
                throw new APIException("ERROR_WEATHER_PROVIDER", 502);
            }
            catch (JsonException)
            {
                throw ProviderError();
            }
            catch (IOException)
            {
                throw new APIException("ERROR_WEATHER_PROVIDER", 502);
            }
        }

        private WeatherLocation MapLocation(GeoLocation geo)
        {
            if (geo == null || geo.Id <= 0 || string.IsNullOrWhiteSpace(geo.Name) || string.IsNullOrWhiteSpace(geo.TimeZone) || !geo.Latitude.HasValue || !geo.Longitude.HasValue || geo.Latitude < -90 || geo.Latitude > 90 || geo.Longitude < -180 || geo.Longitude > 180) throw ProviderError();
            return new WeatherLocation { Id = geo.Id, Name = geo.Name, CountryCode = geo.CountryCode, Region = geo.Region, TimeZone = geo.TimeZone, Latitude = geo.Latitude, Longitude = geo.Longitude };
        }

        private void ValidateForecast(Forecast forecast)
        {
            var current = forecast?.Current;
            var hourly = forecast?.Hourly;
            if (current?.Time == null || hourly?.Time == null || hourly.Temperature == null || hourly.PrecipitationProbability == null || hourly.WeatherCode == null || hourly.Time.Length != hourly.Temperature.Length || hourly.Time.Length != hourly.PrecipitationProbability.Length || hourly.Time.Length != hourly.WeatherCode.Length) throw ProviderError();
            const long minUnix = -62135596800;
            const long maxUnix = 253402300799;
            if (current.Time < minUnix || current.Time > maxUnix || hourly.Time.Any(t => t < minUnix || t > maxUnix)) throw ProviderError();
        }

        private APIException ProviderError()
        {
            return new APIException("ERROR_WEATHER_PROVIDER", 502);
        }

        private class ProviderErrorResponse
        {
            public string Reason { get; set; }
        }

        private class GeoSearch
        {
            [JsonPropertyName("results")]
            public GeoLocation[] Results { get; set; }
        }

        private class GeoLocation
        {
            public long Id { get; set; }
            public string Name { get; set; }
            [JsonPropertyName("country_code")]
            public string CountryCode { get; set; }
            [JsonPropertyName("admin1")]
            public string Region { get; set; }
            [JsonPropertyName("timezone")]
            public string TimeZone { get; set; }
            public double? Latitude { get; set; }
            public double? Longitude { get; set; }
        }

        private class Forecast
        {
            public ProviderCurrent Current { get; set; }
            public ProviderHourly Hourly { get; set; }
        }

        private class ProviderCurrent
        {
            public long? Time { get; set; }
            [JsonPropertyName("temperature_2m")]
            public double? Temperature { get; set; }
            [JsonPropertyName("weather_code")]
            public int? WeatherCode { get; set; }
            [JsonPropertyName("wind_speed_10m")]
            public double? WindSpeed { get; set; }
        }

        private class ProviderHourly
        {
            public long[] Time { get; set; }
            [JsonPropertyName("temperature_2m")]
            public double?[] Temperature { get; set; }
            [JsonPropertyName("precipitation_probability")]
            public int?[] PrecipitationProbability { get; set; }
            [JsonPropertyName("weather_code")]
            public int?[] WeatherCode { get; set; }
        }
    }
}
