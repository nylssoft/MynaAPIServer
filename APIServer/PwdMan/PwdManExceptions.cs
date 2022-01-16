/*
    Myna API Server
    Copyright (C) 2020-2022 Niels Stockfleth

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

    public class InvalidUsernameException : APIException
    {
        public InvalidUsernameException() :
            base("Ungültiger Benutzername.", 401)
        {
        }
    }

    public class UnauthorizedException : APIException
    {
        public UnauthorizedException() :
            base("Ungültiges Kennwort.", 401)
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

    public class InvalidSecurityCodeException : APIException
    {
        public InvalidSecurityCodeException() :
            base("Der Sicherheitscode ist ungültig.", 401)
        {
        }
    }

    public class InvalidSecurityCodeAndLockedException : APIException
    {
        public InvalidSecurityCodeAndLockedException() :
            base("Der Sicherheitscode ist ungültig. Das Konto ist jetzt vorrübergehend gesperrt.", 401)
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

    public class ExpiredSecurityCodeException : APIException
    {
        public ExpiredSecurityCodeException() :
            base("Der Sicherheitscode ist abgelaufen.", 400)
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

    public class ResetPasswordNotAllowedException : APIException
    {
        public ResetPasswordNotAllowedException() :
            base("Kennwort zurücksetzen ist nicht erlaubt.", 400)
        {
        }
    }

    public class ResetPasswordLockedException : APIException
    {
        public ResetPasswordLockedException(int m) :
            base($"Kennwort zurücksetzen ist z.Zt. nicht möglich. Versuche es in {m} Minute(n) noch einmal.", 400)
        {
        }
    }

    public class InvalidEmailAddressException : APIException
    {
        public InvalidEmailAddressException() :
            base("Die E-Mail-Adresse ist ungültig.", 400)
        {
        }
    }

    public class EmailAddressAlreadyRegisteredException : APIException
    {
        public EmailAddressAlreadyRegisteredException() :
            base("Die E-Mail-Adresse wurde bereits registriert.", 400)
        {
        }
    }

    public class EmailAddressNotConfirmedException : APIException
    {
        public EmailAddressNotConfirmedException() :
            base("Die E-Mail-Adresse wurde bisher nicht bestätigt.", 400)
        {
        }
    }

    public class EmailAddressRegistrationLockedException : APIException
    {
        public EmailAddressRegistrationLockedException(int m) :
            base($"Registrieren ist z.Zt. nicht möglich. Versuche es in {m} Minute(n) noch einmal.", 400)
        {
        }
    }

    public class NoRegistrationRequestForEmailAddressException : APIException
    {
        public NoRegistrationRequestForEmailAddressException() :
            base("Es liegt keine Registrierungsanfrage für die E-Mail-Adresse vor.", 400)
        {
        }
    }

    public class InvalidRegistrationCodeException : APIException
    {
        public InvalidRegistrationCodeException() :
            base("Registrierungscode ist ungültig.", 400)
        {
        }
    }

    public class UsernameAlreadyUsedException : APIException
    {
        public UsernameAlreadyUsedException() :
            base("Der Benutzername wird schon verwendet.", 400)
        {
        }
    }

    public class UserManagerRequiredException : APIException
    {
        public UserManagerRequiredException() :
            base("Es muss mindestens ein Benutzer mit der Rolle 'usermanager' vorhanden sein.", 400)
        {
        }
    }

    public class SelfRemoveUserManagerRoleException : APIException
    {
        public SelfRemoveUserManagerRoleException() :
            base("Du kannst Dir selber nicht die Rolle 'usermanager' entziehen.", 400)
        {
        }
    }

    public class InvalidStorageQuoataException : APIException
    {
        public InvalidStorageQuoataException() :
            base("Ungültige Quota. Die Quota muss zwischen 2 MB und 1000 MB liegen.", 400)
        {
        }
    }

    public class TwoFactorAuthenticationAlreadyActivated : APIException
    {
        public TwoFactorAuthenticationAlreadyActivated() :
            base("Zwei-Schritt-Verifizierung ist bereits aktiviert.", 400)
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
