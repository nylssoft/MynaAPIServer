/*
    Myna API Server
    Copyright (C) 2020-2025 Niels Stockfleth

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
using APIServer.APIError;

namespace APIServer
{
    public class Limits
    {
        public const int MAX_USERNAME = 32;
        public const int MAX_HIGHSCORE_NAME = 10;
        public const int MAX_DIARY_ENTRY = 100 * 1024 * 2; // hex encoded string
        public const int MAX_NOTE_TITLE = 300 * 2; // hex encoded string
        public const int MAX_NOTE_CONTENT = 100 * 1024 * 2; // hex encoded string
        public const int MAX_2FA_CODE = 10;
        public const int MAX_RESETPWD_CODE = 16;
        public const int MAX_REGISTER_CODE = 16;
        public const int MAX_EMAIL_ADDRESS = 80;
        public const int MAX_PASSWORD = 100;
        public const int MAX_ROLE_NAME = 32;
        public const int MAX_PWDMAN_CONTENT = 1024 * 1024 * 10; // hex encoded string
        public const int MAX_DOCUMENT_UPLOAD = 1024 * 1024 * 20; // upload at most 20 MB
        public const int MAX_DOCUMENT_TITLE = 300;
        public const int MAX_CONTACTS_CONTENT = 1024 * 1024 * 10; // hex encoded string
        public const int MAX_APPOINTMENT_BATCH = 100;
        public const int MAX_APPOINTMENT_UUID = 100;
        public const int MAX_APPOINTMENT_OPTIONS = 13;
        public const int MAX_APPOINTMENT_PARTICIPANTS = 30;
    }

    public class InputValueTooLargeException : APIException
    {
        public InputValueTooLargeException() : base("Die Eingabewerte sind zu lang.", 400)
        {
        }
    }
}
