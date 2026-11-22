# Friendly Captcha integration

The API can verify Friendly Captcha responses for password-manager registration and password-reset requests. Configure both the browser-facing widget and server-side verification; the site key is public, while the API key is a secret.

## Friendly Captcha setup

Create a Friendly Captcha application/widget and configure its site key and verification endpoint. Follow Friendly Captcha's current [integration documentation](https://docs.friendlycaptcha.com/) for account setup and the correct verification URI for your plan and API version.

Configure the API under `PwdMan:FriendlyCaptchaConfig`:

| Setting | Purpose |
| --- | --- |
| `SiteKey` | Public site key used by the widget displayed to users. |
| `APIKey` | Secret key sent by the API to Friendly Captcha during token verification. `PWDMAN_FRIENDLYCAPTCHA_APIKEY` overrides this value. |
| `VerifyURI` | Friendly Captcha token-verification endpoint. |

`SiteKey` and `VerifyURI` must be supplied through the application's normal configuration mechanism; only `APIKey` has a dedicated environment-variable override. Do not commit the API key. Keep the site key and verification endpoint consistent between the frontend widget and API configuration.

The repository's bundled `/pwdman` UI loads the Friendly Captcha browser SDK from jsDelivr and uses the configured `SiteKey`; the API's CSP permits the SDK and the Friendly Captcha widget frame for that route. If hosting a different frontend or applying a separate Content Security Policy, allow the domains required by the Friendly Captcha SDK/widget according to its current documentation. The widget response is sent as the `captcha` query parameter to the registration and password-reset API requests.

## Validation behavior and security caveat

The API verifies tokens for registration and password-reset requests by posting the token response and configured site key to `VerifyURI`, authenticating with `APIKey`. A rejected or invalid token is not accepted.

**Captcha verification is not fail-closed in the current implementation.** If any of `APIKey`, `SiteKey`, or `VerifyURI` is empty, the API skips verification. If the verification request raises an `HttpRequestException`—including a transport failure or a non-success HTTP status—the API logs a warning and continues the request flow. Therefore, ensure all settings are present and monitor the logs; this integration alone does not guarantee blocking requests during provider errors or outages. Consider this behavior when assessing abuse controls.

## Troubleshooting

- Confirm the widget's site key matches `SiteKey`, and that the browser can load the SDK and widget resources under the active CSP.
- Confirm `APIKey` and `VerifyURI` belong to the same Friendly Captcha setup and are current.
- Inspect API logs for the warning emitted when verification cannot be completed. Also verify the API host can make outbound HTTPS requests to the configured endpoint.
- Test both registration and password reset in a non-production environment, including an invalid token and a provider-unavailable case, so the current failure behavior is understood.
