# Games API

The Skat, Backgammon, and Chess APIs power the bundled multiplayer games. They use game-specific login/session state and action models rather than the standard account API's `token` header. State can be read or long-polled, while game actions are submitted as JSON POST requests.

| Game | Route prefix | Main API patterns |
| --- | --- | --- |
| Skat | `/api/skat` | `GET state`, `model`, `result(s)`, `gamehistory`; `POST` game actions such as `newgame`, `bid`, `playcard`, and `collectstitch`; `GET longpollstate/{clientState}`. |
| Backgammon | `/api/backgammon` | `GET state`, `model`; `POST` actions such as `newgame`, `roll`, `move`, `skip`, and `giveup`; `GET longpollstate/{clientState}`. |
| Chess | `/api/chess` | `GET state`, `model`; `POST` actions such as `newgame`, `place`, `endgame`, and `giveup`; `GET longpollstate/{clientState}`. |

Each game exposes its own login/logout and request/response models. A game's session is separate from the Myna account login. Clients should use the existing bundled game client as the authoritative example for session handshakes, action payloads, and long-poll state handling. Game routes are implementation-specific and are not a stable third-party API contract; inspect the matching controller and model classes before building an independent client.

High-score endpoints are available under `/api/tetris/highscore`, `/api/tstetris/highscore`, and `/api/arkanoid/highscore` (`GET` to read and `POST` to submit). The version endpoint is `GET /api/version`.
