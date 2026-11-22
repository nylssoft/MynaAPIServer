# Notes API

Notes endpoints are under `/api/notes`. Send the signed-in user's login token in the `token` request header. All note operations apply to that user only.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/notes/note` | List the user's notes. Each result includes `id`, encrypted `title`, and `lastModifiedUtc` (not the content). |
| `GET` | `/api/notes/note/{id}` | Retrieve a note, including its encrypted `content`, by ID. |
| `POST` | `/api/notes/note` | Create a note from a JSON `NoteModel`. |
| `PUT` | `/api/notes/note` | Update a note from a JSON `NoteModel` including its ID. |
| `DELETE` | `/api/notes/note/{id}` | Delete a note by ID. |

`NoteModel` has `id`, `title`, `lastModifiedUtc`, and `content` properties. Protected note content is encrypted by the client before it is sent; the server stores and returns the encrypted values. Do not treat the timestamp or encrypted title as decrypted user content. The API enforces configured maximum lengths for title and content.

Example create request (the values shown for title/content are illustrative; protected values should be client-encrypted):

```http
POST /api/notes/note
Content-Type: application/json
 token: <login-token>

{"id":0,"title":"<encrypted-title>","content":"<encrypted-content>"}
```

API errors use the server's Problem Details response. Invalid or missing authentication is rejected; oversized values return a client error. See the [API README](../README.md) for running the server.
