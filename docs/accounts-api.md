# Accounts API

Account endpoints are under `/api/pwdman`. Authenticated requests send the login token in the `token` header. Some administrative operations require the `usermanager` role. Registration, login, and password reset are workflows that do not all use an authenticated token; profile photo content is served by a separate endpoint using photo and user identifiers.

## Authentication and account setup

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/pwdman/auth?locale={locale}` | Authenticate with a JSON username/password request; may require the second factor. |
| `POST` | `/api/pwdman/auth2` | Complete two-factor authentication using a JSON string code and the pending token in `token`. |
| `GET` | `/api/pwdman/auth/lltoken` | Authenticate a long-lived token; send the token and client UUID (`uuid` header). |
| `POST` | `/api/pwdman/auth/pin` | Unlock with a PIN using the long-lived token in `token`. |
| `GET` | `/api/pwdman/logout` | Revoke/log out the token in `token`. |
| `POST` | `/api/pwdman/register?locale={locale}&captcha={response}` | Request registration; JSON string email body. |
| `POST` | `/api/pwdman/profile` | Complete registration with a JSON `UserRegistrationModel`. |
| `POST` | `/api/pwdman/resetpwd?locale={locale}&captcha={response}` | Request a reset; JSON string email body. |
| `POST` | `/api/pwdman/resetpwd2` | Complete reset with JSON email, reset token, and new password. |
| `POST` | `/api/pwdman/userpwd` | Change password with JSON old/new passwords; requires login token. |

The registration request must be approved before profile creation. Registration and reset requests may require a Friendly Captcha response; see the [Friendly Captcha guide](friendly-captcha.md). The login response supplies the token used by authenticated endpoints. If 2FA is enabled, complete the second-factor step before using account APIs.

## Profile and administration

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/pwdman/user` | Get the signed-in user's profile; `details=true` requests additional details. |
| `PUT` | `/api/pwdman/user/name` | Change the user's display name; JSON string body. |
| `PUT` | `/api/pwdman/user/email` | Change email; JSON string body. |
| `PUT` | `/api/pwdman/user/pin` | Set/clear PIN; JSON string body. |
| `PUT` / `POST` / `DELETE` | `/api/pwdman/user/2fa` | Generate a 2FA key, enable using a JSON string code, or disable. |
| `GET` | `/api/pwdman/users` | List users; `usermanager` role required. |
| `GET` | `/api/pwdman/confirmation` | List pending registrations; `usermanager` role required. |
| `POST` | `/api/pwdman/confirmation` | Approve/reject a registration using a JSON confirmation model; `usermanager` role required. |
| `PUT` | `/api/pwdman/user/role` | Change a user's role; `usermanager` role required. |
| `PUT` | `/api/pwdman/user/{id}/storage` | Change a user's storage quota; `usermanager` role required. |
| `PUT` | `/api/pwdman/user/{id}/loginenabled` | Enable/disable login; `usermanager` role required. |
| `GET` | `/api/pwdman/user/audit?max={count}&before={utc}` | Read audit history; `usermanager` role required; `max` defaults to 25 and is limited to 1–1000. |

## Password backup and account data

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` / `POST` / `DELETE` | `/api/pwdman/file` | Read, save, or delete the user's encoded password-backup payload. |
| `DELETE` | `/api/pwdman/diary` | Delete the user's diary. |
| `DELETE` | `/api/pwdman/documents` | Delete the user's documents. |
| `DELETE` | `/api/pwdman/notes` | Delete the user's notes. |
| `DELETE` | `/api/pwdman/user` | Delete a user by JSON string username; administrative authorization applies. |
| `GET` | `/api/pwdman/photo?username={username}` | Get a profile-photo reference for a username. |
| `GET` | `/api/pwdman/photo/content?photoId={id}&userId={id}` | Fetch photo bytes by identifier. |

Additional routes support photo upload/removal, storage usage, account unlock, and password-reset preference. See `PwdManController.cs` for their exact request models. Account and authorization errors are returned as Problem Details with a status code and an `ERROR_*` title. Never log or expose login, long-lived, reset, or appointment access tokens.
