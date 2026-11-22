# Weather API

`GET /api/weather` requires the existing login token in the `token` request header. Weather is provided by Open-Meteo.

## Search by city

```http
GET /api/weather?city=Berlin&countryCode=DE&locale=de
 token: <login-token>
```

A city must contain 2–100 characters. `countryCode` is an optional two-letter ISO country code. The optional `locale` (for example `de` or `de-DE`) selects the language for location names and regions when Open-Meteo provides a translation. If omitted, Open-Meteo defaults to English; an invalid locale returns HTTP 400.

Open-Meteo matches city prefixes. If a search has multiple matches, the API returns HTTP 409 with `error: ERROR_WEATHER_AMBIGUOUS_LOCATION` and up to 10 `candidates`, each containing an ID, name, country, region, and time zone. Select a candidate with its ID:

```http
GET /api/weather?locationId=<id>&locale=de
 token: <login-token>
```

Use the same locale to keep the selected location's language consistent. Do not combine `locationId` with city or country code. A location that cannot be found returns HTTP 404.

## Response

A successful response contains `location`, `asOfUtc`, `current`, 24 `hourly` entries, and seven `daily` entries. Daily entries cover today and the following six calendar days in the city's time zone. Each daily entry contains `date` (`yyyy-MM-dd`, a local date rather than a UTC timestamp), `temperatureMinC`, `temperatureMaxC`, `weatherCode`, `precipitationProbabilityMaxPercent`, and `windSpeedMaxKph`. Daily precipitation and wind values are daily maxima. Daily aggregates are requested in the city's time zone separately from the UTC-aligned hourly forecast.

The hourly timestamps are the next 24 hourly UTC instants strictly after `asOfUtc`; the location's IANA time zone is included for display. Current data is model-based and includes its provider timestamp. Temperatures are degrees Celsius, wind speed (`windSpeedKph` in both `current` and each `hourly` entry) is km/h, and precipitation probability is a percentage for the preceding hour. Weather codes follow the [WMO interpretation codes](https://open-meteo.com/en/docs). Unavailable values may be `null`.

## Limits, errors, and provider terms

Forecasts are cached in server memory for up to 10 minutes. Requests are limited to 30 per user per minute per server instance. Responses are marked `private, no-store`. Provider errors return HTTP 502, timeouts return 504, and rate-limited requests return 429.

City searches are sent to Open-Meteo; do not include sensitive information in a search. Open-Meteo's free service is for non-commercial use and has usage limits; review its [pricing and terms](https://open-meteo.com/en/pricing). Set `WEATHER_API_KEY` for a customer plan, or configure `Weather:ApiKey` using the normal configuration mechanism. Keep keys out of source control.

Weather data is provided by [Open-Meteo](https://open-meteo.com/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Timestamps and data are mapped to this API's response format.
