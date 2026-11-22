# Microsoft Azure Communication Services Email

MynaAPIServer sends account-related email through the Azure Communication Services (ACS) Email SDK. Configure the sender and connection details in the API's application configuration before enabling email-dependent workflows.

## Azure setup

1. Create an Azure Communication Services resource and an Email Communication Services resource, then connect them as required by Azure.
2. Configure and verify a sender domain in Azure. Use a sender address on that verified domain.
3. Obtain the ACS connection string from the resource. Treat it as a secret and grant access only to the API process.
4. Set the API configuration values below, deploy, and test delivery to an address you control. Follow Azure's current [Email Communication Services documentation](https://learn.microsoft.com/azure/communication-services/quickstarts/email/send-email) for resource and domain setup, sender restrictions, and current delivery requirements.

## API configuration

The settings are under `PwdMan:EmailServiceConfig`:

| Setting | Purpose |
| --- | --- |
| `ConnectionString` | ACS connection string. The API also supports the `PWDMAN_EMAILSERVICE_CONNECTIONSTRING` environment variable override. |
| `SenderAddress` | Sender address on a domain configured for ACS Email. |
| `AdminRecipientAddress` | Destination for registration-request notifications. |
| `Templates` | Email subject and plain-text content, configured by template ID and, where applicable, locale. |

Set these values in the existing `PwdMan:EmailServiceConfig` section of `APIServer/appsettings.json`. Start from `APIServer/appsettings-template.json` and retain its `Templates` entries; do not replace them with an empty list. Each template entry maps an ID to a JSON content file, with optional locale-specific file paths. Those files provide `Subject` and `PlainText` values. Localized messages use the locale-specific template where available. Do not put a real connection string in a committed settings file. Prefer a secret manager or the supported environment variable for the connection string; use the deployment's normal protected configuration mechanism for other values.

The configured template IDs cover registration requests, registration outcomes, password reset, and security warnings. Template text may substitute workflow-specific values such as the user's name or registration/reset code. `SenderAddress` must be configured for a template to be loaded. Registration-request notifications are sent to `AdminRecipientAddress`.

## Verification and troubleshooting

- Check API startup/configuration and application logs, then trigger a test flow that sends the specific configured template.
- Confirm the sender domain/address is verified and permitted, the connection string belongs to the correct ACS resource, and the recipient is valid.
- Check the ACS Email resource's delivery status and Azure diagnostics. A successful API request does not guarantee delivery to the recipient's inbox.
- The service logs a failure if the ACS send operation throws; it does not convert an unsuccessful send into proof of delivery. Investigate provider and configuration errors in the server logs.
