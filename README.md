# MynaAPIServer

Provides a website with games and applications. The website runs on Unix or Windows using .NET 6 as backend server (Kestrel web server).

The following games are provided:
- [Skat](https://www.stockfleth.eu/skat), a german card game
- A clone of the arcade version of [Arkanoid](https://www.stockfleth.eu/arkanoid)
- [Backgammon](https://www.stockfleth.eu/backgammon)
- [Chess](https://www.stockfleth.eu/chess)
- A [Tetris](https://www.stockfleth.eu/tetris) clone

Skat requires 3 or 4 players, Backgammon and Chess 2 players. Arkanoid and Tetris are single player games.
Chess can be used as a single player game if a chess engine is configured, e.g. Zappa or Stockfish.

The following applications are provided:
- Contacts, a tool to manage contacts securely
- Diary, a secure online diary
- Documents, a simple and secure online document management system
- Notes, a secure online system to manage simple notes
- Password, a secure online password reader for passwords published with [MynaPasswordManager](https://github.com/nylssoft/MynaPasswordManager)
- Slideshow, an online picture galery

Visit [stockfleth.eu](https://www.stockfleth.eu) to see a customized version of the website.

The main goal of the applications is data protection. Nobody except the logged in user can access, read and manage the content.

The appliations store any content encrypted on the server.
The encryption key is stored locally in the client application, i.e. in the local storage of the web browser.
The key value itself is also encrypted in the browser storage and can only be decrypted after successfull login.
The server cannot decrypt the content, all decryption is done in the browser using the locally stored encryption key.

Each user must store or print the encryption key and place it securely, e.g. in a local password manager.
The data cannot be restored if the encryption key is lost.

Use a secure random encryption key, do not use any password as encryption key. After user registration the browser
generates a secure random encryption key.
 
The user's data stored in the cloud can be downloaded using the tool [Cloud Export](https://github.com/nylssoft/MynaCloudExport).

The encryption key cannot be changed. Use the Cloud Export tool to copy the data to a newly registered user account
with the changed encryption key and afterwards delete the previously used account. Change the login name and email address to the
previously used values if required.

An Android app is provided to access and manage the data on an Android device. This app allows to add, update or delete passwords,
manage notes, diary, contacts and download documents, see
[Password Reader](https://github.com/nylssoft/MynaPasswordReaderMAUI).

## Setup

The project can be compiled with Visual Studio 2022.
If you run the .NET 6 server you will see sample pages.
All games can be used without further configuration.
For the applications the [appsettings.json](/APIServer/appsettings.json) file has to be adjusted.
Details are explained on the page [Example](/APIServer/sampledata/Example.md).

### Slideshow

A JSON file is used to provide additional information, e.g. when the photo was taken and where and what is it about.
The pictures can be provided in two resolutions, one for the default view (usually 1920 width) and one for the
mobile view (usually 4 to 3 aspect ratio).

A few sample slideshow images are provided in the website. Sample slideshow configurations are available for
[public pictures](/APIServer/sampledata/public-pictures.json) and [family pictures](/APIServer/sampledata/family-pictures.json).

### User management

User management supports user registrations, two-factor authentication, password changes, password resets,
roles for administrators and family members, email notifications, locking and disabling of accounts,
long-lived tokens and profile photos.

### Markdown

Markdown files can be stored locally in the file system or in the database using the Documents application.
Different content can be provided for different languages.

A few sample markdown pages are provided in the website, e.g. the welcome page as the start page and the home page that contains
additional technical information about this project. See e.g. (/APIServer/sampledata/Welcome.md).

### Documents

The website administator can use the document management system to provide markdown pages.
A folder can be marked as public to contain markdown files and images used for rendering public pages. It can also be marked with the role family
to provide content only for logged-in users that have the role family assigned.

