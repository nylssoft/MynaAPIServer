
# Impressum

## Impressum

Dies ist eine private Website.
Sie wird ausschließlich für persönliche oder familiäre Zwecke verwendet.

Die Website ist nicht kommerziell.
Sie enthält weder Werbung noch werden Benutzeraktivitäten verfolgt oder analysiert.
Die gespeicherten Daten werden an niemanden weitergegeben.

Nur Freunde und Familienmitglieder werden als registrierte Benutzer von mir zugelassen, d.h.
ich muss entweder alle persönlich kennen oder aber bereits registrierte Benutzer können die
Authenzität bestätigen.

## Datenschutz

### Skat

Es werden alle Skatspiele auf dem Server gespeichert. Registrierte Benutzer können alle Spiele einsehen,
bei denen sie mitgespielt haben. Eine nachträgliche Registrierung erlaubt auch den Zugriff auf alle
zuvor gespielten Spiele.

Registrierte Benutzer können ein Profilfoto hochladen, welches beim Skatspiel angezeigt wird.
Sie können den Chat beim Skat benutzen und einen Tisch für Skatspiele reservieren.

### Tagebuch, Notizen und Passwörter

Tagebuch, Notizen und Passwörter können nur von registrierten Benutzern verwendet werden.
Die Tagebucheinträge, Notizen und Passwörter werden verschlüsselt auf dem Server gespeichert,
wobei die Ver- und Entschlüsselung nur auf dem Client (im Browser) stattfindet.
Der verwendete Schlüssel kann im Browser gespeichert werden.
Da der Server den Schlüssel nicht kennt, sollte jeder Benutzer ihn *zusätzlich* an einem sicheren Ort
speichern. Bei Verlust des Schlüssels können die Daten nicht wiederhergestellt werden.

### Benutzer-Profil

Registrierte Benutzer können eine 2-Faktor-Authentifizierung verwenden.
Nachdem Anmelden mit dem Passwort wird ein Sicherheitscode an die hinterlegte E-Mail-Adresse verschickt.
Mit diesem Code wird dann die zweite Phase der Anmeldung abgeschlossen.

Weiterhin kann optional die Anmeldung im Browser über längere Zeit aufrecht erhalten werden
(bis zu 6 Monate seit der letzten Verwendung). Das zugehörige *Token* wird im Browser gespeichert.
Meldet sich ein Benutzer ab, werden alle gespeicherten Tokens auf allen verwendeten Geräten ungültig.
Damit ist eine Neuanmeldung an allen Geräten erforderlich.

Für jeden registrierten Benutzer wird ein Konto angelegt. Folgende Daten werden im Konto gespeichert:
- Email-Adresse
- Anmelde-Optionen
- Datum der letzten Anmeldung, Datum der Registrierung
- Datum aller Anmeldeversuche mit IP-Adresse (kann aufgeräumt werden)
- Tagebucheinträge, Notizen und Passwörter
- Profilfoto

Das Konto kann jederzeit gelöscht werden. Alle oben genannten Daten werden dann
unwiderruflich gelöscht.

Die Daten der Skatspiele (Chats, Spielverläufe und Spielergebnisse) können nicht gelöscht werden.
Sie werden auch für nicht registrierte Spieler gespeichert.

### Bildergalerie

Registrierte Benutzer können zusätzliche Bilder sehen, sofern
sie als Familienmitglied im weiteren Sinne markiert wurden.

## Kontakt

[Niels Stockfleth](/markdown?page=homepage), E-Mail an <nyls@aol.com>. 

## Open Source

Die Website verwendet folgende Software und Bilderbibliotheken für die Realisierung:

- Reverse-Proxy [NGINX](https://www.nginx.com){target="_blank" .external}
- Back-End [.NET 5](https://docs.microsoft.com/en-us/dotnet/core/dotnet-five){target="_blank" .external}
- Bilder [Open Icon Library](https://sourceforge.net/projects/openiconlibrary){target="_blank" .external}
- Skatkarten [XSkat](http://xskat.de/xskat-cards-de.html){target="_blank" .external}
- MarkDown-Inhalte [Markdig](https://github.com/xoofx/markdig){target="_blank" .external}
- Bildbearbeitung [ImageSharp](https://github.com/SixLabors/ImageSharp){target="_blank" .external}
- Datenmodellierung [Entity Framework Core 5](https://docs.microsoft.com/de-de/ef/core/what-is-new/ef-core-5.0/whatsnew){target="_blank" .external}
- Datenbanken [Sqlite](https://www.nuget.org/packages/Microsoft.EntityFrameworkCore.Sqlite){target="_blank" .external}, [PostgreSQL](https://www.nuget.org/packages/Npgsql){target="_blank" .external}

$backbutton