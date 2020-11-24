# MynaAPIServer
REST API server and websites for Myna products using ASP.NET core.
The whole project builds a portal as website (Myna Portal).
The current version contains Skat (german card game) as online game, a Tetris game and a slideshow.
The user management supports registration of new users, password changes, password resets, deletion of accounts
and account settings, e.g. long-lived access token like used by Facebook and two-factor authentication.
It provides a download section to download Myna desktop applications for Windows.
The latest Myna Password Manager can be used to upload passwords in the cloud (read only access from the portal).
Password in the cloud are encrypted and decrypted only on the client (in the browser). The file stored in the cloud cannot be decrypted without the knowledge of the client-side encryption key.


