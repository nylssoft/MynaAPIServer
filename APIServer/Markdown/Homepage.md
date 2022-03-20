# Heading 1
## Heading 2
### Heading 3

$background(/images/skat/empty.png)

Template for a home page with examples.

Images
![](/images/backgammon/roll.png)

## Markdown

The page rendering is based on [Markdown](https://de.wikipedia.org/wiki/Markdown){target="_blank" .external}.
Customize the look and feel in the **markdown.css** file.

## Database usage

To use images stored in the database use the link */api/document/download/\{id\}*.

Markdown pages like this one can also be stored in the database.
Adjust the file **appsettings.json** that contains the mapping from page name to content (file or document ID).

Example:
"Markdown": \[\{"Id": "help-backgammon", "Content": "484"\},...\]

*Note*: Documents have to be marked as *public* to be used in a markdown page or as *family* if used for family-role restricted content.
## External and internal links

Add additional attributes or a CSS class to a link with \{ and \}.

External Link: [Source Code](https://github.com/nylssoft){target="_blank" .external}

Internal Link: [Start](/markdown?page=welcome)

## Role based rendering

The following content will only be rendered if you are logged in and if you have the role *family* assigned.

$role-begin(family)
**PRIVATE**: Family based content
$role-end

## Setup and user registration

The first registered user is assumed to by the administrator of the portal.
The registration code will not be verified, any non empty value can be used for the setup.

## Open Source

- [.NET 5](https://docs.microsoft.com/en-us/dotnet/core/dotnet-five){target="_blank" .external}
- [Entity Framework Core 5](https://docs.microsoft.com/de-de/ef/core/what-is-new/ef-core-5.0/whatsnew){target="_blank" .external}
- [ImageSharp](https://github.com/SixLabors/ImageSharp){target="_blank" .external}
- [Markdig](https://github.com/xoofx/markdig){target="_blank" .external}
- [NGINX](https://www.nginx.com){target="_blank" .external}
- [Open Icon Library](https://sourceforge.net/projects/openiconlibrary){target="_blank" .external}
- [PostgreSQL](https://www.nuget.org/packages/Npgsql){target="_blank" .external}
- [qrcode.js](https://github.com/davidshimjs/qrcodejs){target="_blank" .external}
- [SendGrid](https://github.com/sendgrid/sendgrid-csharp){target="_blank" .external}
- [Sqlite](https://www.nuget.org/packages/Microsoft.EntityFrameworkCore.Sqlite){target="_blank" .external}
- [uuid](https://github.com/uuidjs/uuid){target="_blank" .external}
- [XSkat](http://xskat.de/xskat-cards-de.html){target="_blank" .external}

$backbutton