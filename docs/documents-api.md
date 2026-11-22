# Documents and Contacts API

Document listing, management, upload, and contact endpoints require the signed-in user's login token in the `token` request header. The download endpoint permits requests without a token only for public files; family files require a signed-in user with the `family` role, and owner-only files require their owner. Folder sharing does not retroactively change existing files or subfolders.

## Documents

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/document/volume` | Create or retrieve the user's document volume; JSON string body with its name. |
| `GET` | `/api/document/items` | Get the volume, its path, and direct children. |
| `GET` | `/api/document/items/{id}` | Get a folder/item's path and direct children. |
| `POST` | `/api/document/folder/{id}` | Create a folder in the parent; JSON string body with its name. |
| `POST` | `/api/document/upload/{id}` | Upload a file to a parent folder using multipart form fields `document-file` (file) and `overwrite` (boolean). |
| `GET` | `/api/document/download/{id}` | Download a file by item ID. |
| `PUT` | `/api/document/item/{id}` | Rename an item; JSON string body with the new name. |
| `PUT` | `/api/document/items/{id}` | Move the JSON array of item IDs into the destination folder identified by `id`. |
| `DELETE` | `/api/document/items/{id}` | Delete the JSON array of item IDs from the folder identified by `id`. |
| `PUT` | `/api/document/folder/{id}/accessrole` | Set a folder's access role; JSON string body. Use the role names supported by the deployment. |
| `PUT` | `/api/document/updatemarkdown/{id}` | Replace Markdown content; JSON string body. |

List results are `ItemModel` objects with `id`, `parentId`, `name`, `size`, `type`, `children`, and `accessRole`. Uploads use multipart form data, not a JSON file body. The API enforces file-size, title-length, and storage-quota limits. Uploaded files are stored as-is and are not client-encrypted.

## Contacts

Contacts are stored as one client-provided encoded string. The client should encrypt protected content before sending it.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/contacts` | Get the user's contacts payload. |
| `PUT` | `/api/contacts` | Replace the payload with a JSON string body. |
| `DELETE` | `/api/contacts` | Delete the user's contacts. |

Invalid or missing authentication is rejected. Access-role or ownership violations are denied. API errors use Problem Details; file uploads can also fail for size or quota limits.
