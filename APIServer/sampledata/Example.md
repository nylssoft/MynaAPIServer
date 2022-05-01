# Example
## Heading 2
### Heading 3

$background(/images/skat/empty.png)

Template for a page with examples.

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

Internal Link: [Start](/view?page=welcome)

## Role based rendering

The following content will only be rendered if you are logged in and if you have the role *family* assigned.

$role-begin(family)
**PRIVATE**: Family based content
$role-end

## Setup and user registration

The first registered user is assumed to be the administrator of the portal.
The registration code will not be verified, any non empty value can be used for the setup.

## Slideshow setup

The **appsettings.json** file references two JSON files that are used for the slideshow.
The files define the pictures that are shown for all users, **SlideShowPublicPhotos**,
and the pictures that are additionally shown for users that have the role *family* assigned, **SlideShowFamilyPhotos**.
A few pictures are provived as example. Recommended resolution is 1920 x 1440 pixels.
For the mobile view the Url-43 image is used if configured.

## Chess engine setup

The **appsettings.json** file contains a list for chess engines
to play chess against the computer.

Example configuration for the stockfish chess engine:
    "ChessEngines": \[
      \{
        "Name": "Stockfish",
        "File": "chessengine/stockfish_14.1_win_x64_avx2.exe",
        "UseUCI": true
      \}]

The settings **UseUCI** defines whether the engine will use the Universal Chess Interface.

## SendGrid configuration

For email notification SendGrid is used. In **appsettings.json** or in user secrets the following parameters have to be set for **SendGridConfig**:
- APIKey: SendGrid API key, requires an account for SendGrid
- SenderAddress: email address of the sender
- SenderName: display name of the sender
- TemplateIdResetPassword: email template ID for the reset password email
- TemplateIdRegistrationRequest: email template ID for the registration request email
- TemplateIdRegistrationDenied: email template ID for the registration denied email
- TemplateIdRegistrationSuccess: email template ID for registration success email
- TemplateIdSecurityWarning: email template ID for the security warning email

The email templates in SendGrid can contain parameters that will be replaced.
- TemplateIdResetPassword: Name, Code, Valid, Hostname, Email, Next
- TemplateIdRegistrationRequest: Email
- TemplateIdRegistrationSuccess: Code, Hostname, Email, Next
- TemplateIdSecurityWarning: Name, Date, Time, IPAddress, Hostname, Next

## Security Configuration

For token generation the **appsettings.json** uses the **TokenConfig** section. The hostname in **PwdMan** is used only for email notification to
replace the Hostname parameter in the email templates.
The following data has to be provided either in the file or in user secrets:
- SignKey: used to sign the authentication token for a successfully logged-in user. 28 secure random characters are required.
- LongLivedSignKey: used to sign a long lived token (stored in local storage of the browser). 28 secure random characters are required.
- Issuer: issuer of the token, e.g. the website domain
- Audience: audience of the token

For development in Visual Studio 2019 User Secrets should be used for sensitve data like security configuration,
hostname, SendGrid configuration and PostgreSQL database connection string.

$backbutton