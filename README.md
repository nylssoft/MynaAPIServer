# MynaAPIServer

MynaAPIServer is the backend for [stockfleth.eu](https://www.stockfleth.eu/), a private portal for family and friends. It provides account management, data storage, document sharing, appointment polls, and weather forecasts. It also hosts browser games and a bundled legacy site with sample pages.

The server runs on Windows, macOS, and Linux using ASP.NET Core on .NET 10, Kestrel, and PostgreSQL. [TsMynaPortal](https://github.com/nylssoft/TsMynaPortal) is the separately built TypeScript web client. This repository contains the server and its bundled web assets, not the current portal client.

## Features

| Area | What the server provides |
| --- | --- |
| **Personal data** | Storage for notes, dated diary entries, contacts, and password-manager items. The web client also supports ZIP exports and imports; password backups can be opened locally without signing in. |
| **Documents** | File and folder management, private storage, and family or public sharing. Shared files can also supply content for Markdown pages. |
| **Appointments** | Polls with proposed dates and voting links so participants can indicate when they are available. |
| **Weather** | Authenticated city search, current conditions, 24 hourly forecasts, and seven daily forecasts from Open-Meteo. |
| **Accounts** | Registration requests and approvals, role management, storage quotas, profile photos, password changes and resets, two-factor authentication, long-lived sign-in tokens, and optional email notifications. |
| **Pages and photos** | Localized Markdown pages and slideshows with separate public and family content. |
| **Games** | [Skat](https://www.stockfleth.eu/skat), [Backgammon](https://www.stockfleth.eu/backgammon), [Chess](https://www.stockfleth.eu/chess), and single-player [Arkanoid](https://www.stockfleth.eu/arkanoid) and [Tetris](https://www.stockfleth.eu/tetris) clones. |

### Data protection and sharing

The browser encrypts protected content before sending it to the server and decrypts it using the user's data-protection key. The browser generates a random key during registration; the server does not hold that key and cannot recover protected content if it is lost. Keep a separate copy in a safe place, and do not use your sign-in password as the data-protection key. The authenticated notes list includes each note's last-modified UTC timestamp as metadata, alongside its encrypted title.

Encryption does not apply to everything the server stores. Files uploaded directly to shared folders are unencrypted. Public files can be downloaded without signing in; family files require the `family` role. Users with the `usermanager` role manage accounts and can configure sharing for folders they own. Changing a folder's visibility does not retroactively change its existing files or subfolders.

The portal's import and export tools are documented in the [TsMynaPortal README](https://github.com/nylssoft/TsMynaPortal#back-up-and-restore-your-data).

## Run locally

Install the .NET 10 SDK and have a PostgreSQL server available. The included Docker Compose setup is optional. Install Node.js 24 if you need to rebuild the bundled web assets or prepare a publish artifact.

### Start PostgreSQL

The supplied [compose.yaml](compose.yaml) starts PostgreSQL 17 on `127.0.0.1:5432` with database and user `apiserver`. From the repository root, choose a unique local password and set `POSTGRES_PASSWORD` in the same terminal you will use to start the API.

PowerShell:

```powershell
$env:POSTGRES_PASSWORD = 'replace-with-your-local-password'
```

Bash or Zsh:

```sh
export POSTGRES_PASSWORD='replace-with-your-local-password'
```

Then start the database:

```shell
docker compose up -d
docker compose ps
```

Data persists in the `myna-postgres-data` volume. Use `docker compose logs -f postgres` to diagnose startup issues and `docker compose stop` to stop the database without removing its data. **`docker compose down -v` deletes the local database volume and its data.**

### Configure and start the server

Use [appsettings-template.json](APIServer/appsettings-template.json) as a configuration reference. [New-AppSettings.ps1](APIServer/New-AppSettings.ps1), run from `APIServer`, creates an `appsettings.json` from the template only if that file does not already exist. For the Compose database, set the connection string without embedding the password:

```json
{
  "PostgresConnection": "Host=localhost;Port=5432;Database=apiserver;Username=apiserver"
}
```

Set your own signing keys and configure token issuer and audience before using account features. Keep secrets out of tracked configuration; use environment variables, .NET user secrets for local development, or your deployment's secret store. The following environment variables override the corresponding settings:

| Environment variable | Configuration setting |
| --- | --- |
| `POSTGRES_PASSWORD` | Password portion of `PostgresConnection` |
| `APPOINTMENT_SIGNKEY` | `Appointment:SignKey` |
| `PWDMAN_TOKEN_SIGNKEY` | `PwdMan:TokenConfig:SignKey` |
| `PWDMAN_TOKEN_LONGLIVEDSIGNKEY` | `PwdMan:TokenConfig:LongLivedSignKey` |
| `PWDMAN_FRIENDLYCAPTCHA_APIKEY` | `PwdMan:FriendlyCaptchaConfig:APIKey` |
| `PWDMAN_EMAILSERVICE_CONNECTIONSTRING` | `PwdMan:EmailServiceConfig:ConnectionString` |
| `PWDMAN_FAMILYACCESSTOKEN` | `PwdMan:FamilyAccessToken` |
| `WEATHER_API_KEY` | `Weather:ApiKey`; selects Open-Meteo's customer endpoints |

Run the server from the repository root:

```shell
dotnet run --project APIServer --launch-profile SkatAPI
```

The launch profile listens on `http://localhost:5000` and `https://localhost:5001`. If the development HTTPS certificate is missing or untrusted, configure it with `dotnet dev-certs https --trust` where supported. The server attempts to apply EF Core migrations at startup; check the startup log for database connection or migration errors before using account features.

Open [the bundled site](http://localhost:5000/) or check [the version endpoint](http://localhost:5000/api/version). To use the current web client instead, follow the [TsMynaPortal development instructions](https://github.com/nylssoft/TsMynaPortal#development-and-builds); its default dev proxy targets port 5000. Initialize the first administrator in a restricted environment before making a fresh instance publicly reachable. Subsequent accounts use the registration approval workflow.

## Weather API

`GET /api/weather?city=Berlin&countryCode=DE&locale=de` requires the existing login token in the `token` request header. A city must contain 2-100 characters; `countryCode` is an optional two-letter ISO country code. The optional `locale` (e.g. `de` or `de-DE`) selects the language for location names and regions, if Open-Meteo has translations. When omitted, Open-Meteo defaults to English; an invalid locale returns 400. Open-Meteo matches city prefixes, so a search with multiple matches returns HTTP 409 with `error: ERROR_WEATHER_AMBIGUOUS_LOCATION` and up to 10 `candidates` (ID, name, country, region and time zone). Select one with `GET /api/weather?locationId=<id>&locale=de`; use the same locale to keep the selected location's language consistent. Do not combine `locationId` with city or country code. A missing location returns 404.

A successful response contains `location`, `asOfUtc`, `current`, 24 `hourly` entries and seven `daily` entries. Daily entries cover today and the following six calendar days in the city's time zone. Each contains `date` (`yyyy-MM-dd`, a local date rather than a UTC timestamp), `temperatureMinC`, `temperatureMaxC`, `weatherCode`, `precipitationProbabilityMaxPercent` and `windSpeedMaxKph`. Daily precipitation and wind values are daily maxima. Daily aggregates are requested in the city's time zone separately from the UTC-aligned hourly forecast. The hourly timestamps are the next 24 hourly UTC instants strictly after `asOfUtc`; the location's IANA time zone is provided for display. Current data is model-based and includes its provider timestamp. Temperatures are degrees Celsius, wind speed (`windSpeedKph` in both `current` and each `hourly` entry) is km/h, and precipitation probability is a percentage for the preceding hour. Weather codes follow the [WMO interpretation codes](https://open-meteo.com/en/docs); unavailable values may be null. Weather data is provided by [Open-Meteo](https://open-meteo.com/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); timestamps and data are mapped to this API's response format.

Forecasts are cached in server memory for up to 10 minutes, and requests are limited to 30 per user per minute per server instance. Responses are marked `private, no-store`. Provider errors return 502, timeouts return 504, and rate-limited requests return 429. City searches are sent to Open-Meteo; do not include sensitive information in them. Open-Meteo's free service is for non-commercial use and has usage limits; review its [pricing and terms](https://open-meteo.com/en/pricing). Set `WEATHER_API_KEY` for a customer plan, or configure `Weather:ApiKey` using the normal configuration mechanism; keep the key out of source control.

## Customize the bundled site

- **Markdown:** Map page IDs to local files or document IDs in the `Markdown` settings. Different languages can use different content. Documents embedded in pages must have the appropriate public or family visibility. See the [example page](APIServer/sampledata/Example.md) and [sample welcome page](APIServer/sampledata/Welcome.md).
- **Slideshows:** Configure separate JSON lists for [public photos](APIServer/sampledata/public-pictures.json) and [family photos](APIServer/sampledata/family-pictures.json). Entries can include captions and an alternate image for mobile displays.

## Build and publish

Use the .NET 10 SDK and Node.js 24. The following commands build the bundled JavaScript and CSS, then publish the API for Linux x64 from the repository root:

```shell
npm --prefix APIServer ci
npm --prefix APIServer run build:assets
dotnet publish -c Release -r linux-x64 -p:PublishProfile=APIServer/Properties/PublishProfiles/FolderProfile.pubxml
```

The [publish profile](APIServer/Properties/PublishProfiles/FolderProfile.pubxml) produces a framework-dependent build in `APIServer/bin/Release/net10.0/linux-x64/publish`. It excludes `appsettings.json` and `appsettings.Development.json`; supply deployment configuration and secrets separately. Install the ASP.NET Core 10 runtime on the target host and serve the site over HTTPS. If deploying TsMynaPortal as the main UI, build it separately and configure routing for the API, translations, and server-hosted assets it uses.

The same build is available through **Actions > Build Myna API Server > Run workflow**. The [workflow](.github/workflows/build.yml) publishes the Linux x64 output as the `build-<run number>` artifact.

## License

MynaAPIServer is released under the GNU General Public License, version 3 or later. See [LICENSE](LICENSE) and the [third-party credits](APIServer/sampledata/Copyright.md).
