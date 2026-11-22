# Diary API

Diary endpoints are under `/api/diary`. Send the signed-in user's login token in the `token` request header. The API reads and writes only the authenticated user's diary.

| Method | Path | Query/body | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/diary/entry` | JSON `DiaryEntryModel` | Create or replace an entry for its date; an empty entry removes that date's entry. |
| `GET` | `/api/diary/entry?date=2026-11-22` | `date` query parameter | Get the entry for a date. |
| `GET` | `/api/diary/month?date=2026-11-01` | `date` query parameter | Get entries for the month containing the date. |
| `GET` | `/api/diary/day?date=2026-11-01` | `date` query parameter | Get the day numbers with entries in the month containing the date. |
| `GET` | `/api/diary/all` | — | Get the dates that have diary entries. |

The request model is `{ "date": "2026-11-22", "entry": "<client-encrypted-content>" }`. The client encrypts protected diary content before sending it; the server stores and returns encrypted content. The entry text has a configured maximum length. Use a valid date value and preserve the intended calendar date when formatting it for the query string.

`POST /api/diary/entry` returns `true` on success. Other successful operations return JSON results. Invalid or missing authentication is rejected; API errors use Problem Details.
