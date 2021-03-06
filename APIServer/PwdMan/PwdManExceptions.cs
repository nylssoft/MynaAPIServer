﻿/*
    Myna API Server
    Copyright (C) 2020 Niels Stockfleth

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

namespace APIServer.PwdMan
{
    public class AccessDeniedPermissionException : APIException
    {
        public AccessDeniedPermissionException() :
            base("Der Zugriff wurde verweigert.", 403)
        {
        }
    }

    public class UnauthorizedException : APIException
    {
        public UnauthorizedException() :
            base("Ungültiger Benutzername oder ungültiges Kennwort.", 401)
        {
        }
    }

    public class UnauthorizedAndLockedException : APIException
    {
        public UnauthorizedAndLockedException() :
            base("Ungültiges Kennwort. Das Konto ist jetzt vorrübergehend gesperrt.", 401)
        {
        }
    }

    public class AccountLockedException : APIException
    {
        public AccountLockedException(int remain):
            base($"Das Konto ist vorrübergehend gesperrt.Versuche es in {remain} Minute(n) erneuert.", 401)
        {
        }
    }

    public class Requires2FAException : APIException
    {
        public Requires2FAException() :
            base("Die 2-Phasen-Überprüfung wurde noch nicht abgeschlossen.", 404)
        {
        }
    }

    public class InvalidTokenException : APIException
    {
        public InvalidTokenException() :
            base("Die Sitzung ist abgelaufen. Melde Dich neu an.", 401)
        {
        }
    }

    public class UserNotAllowedException : APIException
    {
        public UserNotAllowedException() :
            base("Der Benutzer ist nicht zugelassen.", 400)
        {
        }
    }

    public class InvalidOldPasswordException : APIException
    {
        public InvalidOldPasswordException() :
            base("Das alte Kennwort ist ungültig.", 400)
        {
        }
    }

    public class PasswordNotStrongEnoughException : APIException
    {
        public PasswordNotStrongEnoughException() :
            base("Das Kennwort ist nicht stark genug.", 400)
        {
        }
    }

    public class ChangedPasswordNotStrongEnoughException : APIException
    {
        public ChangedPasswordNotStrongEnoughException() :
            base("Das neue Kennwort ist nicht stark genug.", 400)
        {
        }
    }

    public class PasswordSameAsOldException : APIException
    {
        public PasswordSameAsOldException() :
            base("Das Kennwort ist identisch mit dem alten Kennwort.", 400)
        {
        }
    }

    public class SecretKeyNotStrongEnoughException : APIException
    {
        public SecretKeyNotStrongEnoughException() :
            base("Der Schlüssel ist nicht stark genug.", 400)
        {
        }
    }

    public class SecretKeySameAsPasswordException : APIException
    {
        public SecretKeySameAsPasswordException() :
            base("Der Schlüssel muss sich vom Kennwort unterscheiden.", 400)
        {
        }
    }

    public class PasswordFileNotFoundException : APIException
    {
        public PasswordFileNotFoundException() :
            base("Die Passworddatei wurde bisher nicht hochgeladen.", 400)
        {
        }
    }

    public class PwdManInvalidArgumentException : APIException
    {
        public PwdManInvalidArgumentException(string msg) : base(msg, 400)
        {
        }
    }
}
