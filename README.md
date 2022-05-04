# MynaAPIServer

Provides a portal server with games and applications that can be published using a web server. The portal server runs on Unix or Windows.

The following games are provided:
- Skat, a german card game
- Backgammon
- Chess
- Tetris

Skat requires 3 or 4 players, Backgammon and Chess 2 players. Tetris is a single player game.
Chess can be used as a single player game if a chess engine is configured, e.g. Zappa or Stockfish.

The following applications are provided:
- Diary, a secure online diary
- Documents, a simple and secure online document management system
- Notes, a secure online system to manage simple notes
- Password, a secure online password reader for passwords published with [MynaPasswordManager](https://github.com/nylssoft/MynaPasswordManager)
- Slideshow, an online picture galery

Visit [stockfleth.eu](https://www.stockfleth.eu) to see the portal server in action.

## Setup

First the project has to be compiled with Visual Studio 2019.
If you run the portal server you will see sample pages.
All games can be used without further configuration.
For the applications the [appsettings.json](/APIServer/appsettings.json) file has to be adjusted.
Details are explained on the page [Example](/APIServer/sampledata/Example.md).

## History

The project started as a learning project for ASP.NET Core.
The first goal was to write a REST API server with this framework.
This is the reason for the strange name of the repository.
The project was and is still also a learning project. Learn how to use .NET and modern JavaScript
with as few dependencies as possible.
And last but not least programming is fun.

### Skat

During the pandemic it was quite difficult to meet people in person.
With friends I started to play Skat on a commercial website to keep in touch.
This was the starting point for my first JavaScript project, the online Skat game.
We are playing it now for about 2 years with family and friends.

### Slideshow

I always wanted to provide a slideshow with pictures of memorable moments of my life.
This was the next JavaScript project. It was extended over time and now it provides personal pictures
that can only be viewed by logged-in users that have the role family assigned.
A JSON file is used to provide additional information, e.g. when the photo was taken and where and what is it about.
The pictures can be provided in two resolutions, one for the default view (usually 1920 width) and one for the
mobile view (usually 4 to 3 aspect ratio).

A few sample slideshow images are provided in the portal server. Sample slideshow configurations are available for
[public pictures](/APIServer/sampledata/public-pictures.json) and [family pictures](/APIServer/sampledata/family-pictures.json).

### Tetris

As it was fun to program games in JavaScript I started to build the next game I have played very often in my childhood: Tetris.
I didn't expect how easy it was to write an arcade game in JavaScript. It was the first time I used the canvas and I'm still
fascinated how powerfull the API is and how fast it runs in modern browsers. 
Also I have tried to provide a mobile view and use touch events for the first time.

### Passwords and user management

The next project was an extension of an existing project I use in my daily life,
the password manager [MynaPasswordManager](https://github.com/nylssoft/MynaPasswordManager).
The storage of passwords is the most sensitive part I can image and a password manager stores all passwords in a single place
which has to be as secure as possible.
There are hundreds of password managers available but in all cases you have to trust the product you are using,
even if the source code is published as open source.
And to trust software you have to understand each line of code and the impact it has.

I extended the portal server to provide a secure read-only view of the passwords stored with the desktop application.

The first version of a user management system was introduced. This was also the first project that used
the Entity Framework for .NET Core to model persistency, started with SQLite and now running on PostgreSQL server.
I really like this framework to abstract from concrete SQL statements, it is very powerfull and easy to use.
It is now used nearly for every project in the portal to manage persistent data.

The features of the user management system have been increased over time.
It now supports user registrations, two-factor authentication, password changes, password resets,
roles for administrators and family members, email notifications, locking and disabling of accounts,
long-lived tokens, profile photos and more. The user management system is now used in all applications and games in the portal.

### Diary

The next project motivated by the pandemic was an online secure diary.
It provides a calendar that allows you to store a simple text for a single day.
The text is stored encrypted in the database. Nobody can read the content without having the security key.
The programming exercise was how to securely encrypt and decrypt data in a modern browser using the crypto API.
I use the diary every day.

### Notes

The next project was a simple secure storage of online notes, similar to the Sticky Notes desktop application of Windows.
I use this very often, i.e. to track improvements for the portal or to store sensitive information or any knowledge
I will usually forget over time.
It uses the same technique as the diary project to encrypt and decrypt data.

### Markdown

As the size of the portal increased the management of the indidividual HTML pages became uncomfortable. The smart markup language
used e.g. for this README file is much easier and also much more fun to use.
I introduced the rendering of markup files in the portal to provide the start page and other pages linked by the start page.
I used an open source framework named [Markdig](https://github.com/xoofx/markdig) to implement the rendering service.
In the current version the markdown files and referenced images can be stored in the database and can be updated online
by the portal administrator. So in that sense this project is a very simple version of a website content management system.
I use this e.g. to update the start page if new features are available on the portal.

A few sample markdown pages are provided in the portal, e.g. the welcome page as the start page and the home page that contains
additional technical information about the portal server project.

### Documents

The next project was a very simple document management system to securely store documents with sensitive data. The main motivation was
to remove the physical papers I have collected in dozen of folders during my life time. Most of these documents do not need a
physical copy anymore in the digial information era. So I scanned these documents and uploaded them as PDF file in the portal.
Another benefit is that the portal allows to provide important documents of your life at anytime and at any place as long as an internet
connection is available. The documents are encrypted and decrypted in the browser only, the database only contains the encrypted content.
The same technique as of the diary and notes application is used here but for much larger data.
Each registered user has a default quota of 100 MB, i.e. can upload content up to this limit. The upload size of a document is also limited.

With the introduction of the markdown pages the portal administator can use the document management system to provide markdown pages.
A folder can be marked as public to contain markdown files and images used for rendering public pages. It can also be marked with the role family
to provide content only for logged-in users that have the role family assigned.

### Chess

Another game of my childhood was chess. I played it very often. This was the next project. The challenge with chess was the
implementation of the game logic and the rule system. Even though the rules look simple there are some special cases that have to be considered
carefully, e.g. the castling or en passent.
If a fast chess game is chosen as game option the rules are a bit different, e.g. a strike of the king is allowed.

As there are some open source chess engines available that can be used to play against a computer the project was extended to allow
the configuration of a chess engine, e.g. Zappa or Stockfish. If configured you can also play against a computer.

### Backgammon

This game is the last project I provided for now, also a game I loved to play in my childhood. It's quite nice for a break during work to play
against a colleque as it usually takes only a few minutes.
It is also the first project where I tried to use sprites in JavaScript in the sense of the old C64 days, i.e.
drawing of a figure that is smartly hovering over the playground.
The animation sequence for the winner and looser is based on sprites.
