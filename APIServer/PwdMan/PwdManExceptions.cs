/*
    Myna API Server
    Copyright (C) 2020-2023 Niels Stockfleth

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
            base("ERROR_ACCESS_DENIED", 403)
        {
        }
    }

    public class InvalidUsernameException : APIException
    {
        public InvalidUsernameException() :
            base("ERROR_INVALID_USERNAME", 403)
        {
        }
    }

    public class UnauthorizedException : APIException
    {
        public UnauthorizedException() :
            base("ERROR_INVALID_PWD", 401)
        {
        }
    }

    public class UnauthorizedAndLockedException : APIException
    {
        public UnauthorizedAndLockedException() :
            base("ERROR_UNAUTHORIZED_AND_LOCKED", 401)
        {
        }
    }

    public class AccountLockedException : APIException
    {
        public AccountLockedException(int remain):
            base($"ERROR_ACCOUNT_LOCKED_1:{remain}", 401)
        {
        }
    }

    public class AccountLoginDisabledException : APIException
    {
        public AccountLoginDisabledException() :
            base("ERROR_ACCOUNT_LOGIN_DISABLED", 401)
        {
        }
    }

    public class SelfUpdateLoginEnabledException : APIException
    {
        public SelfUpdateLoginEnabledException() :
            base("ERROR_SELF_UPDATE_LOGIN_ENABLED", 400)
        {
        }
    }

    public class Requires2FAException : APIException
    {
        public Requires2FAException() :
            base("ERROR_REQUIRES_2FA", 404)
        {
        }
    }

    public class InvalidTokenException : APIException
    {
        public InvalidTokenException() :
            base("ERROR_INVALID_TOKEN", 401)
        {
        }
    }

    public class InvalidSecurityCodeException : APIException
    {
        public InvalidSecurityCodeException() :
            base("ERROR_INVALID_SEC_KEY", 401)
        {
        }
    }

    public class InvalidSecurityCodeAndLockedException : APIException
    {
        public InvalidSecurityCodeAndLockedException() :
            base("ERROR_INVALID_SEC_KEY_AND_LOCKED", 401)
        {
        }
    }

    public class InvalidPinException : APIException
    {
        public InvalidPinException() :
            base("ERROR_INVALID_PIN", 401)
        {
        }
    }

    public class InvalidPinLogoutException : APIException
    {
        public InvalidPinLogoutException() :
            base("ERROR_INVALID_PIN_LOGOUT", 401)
        {
        }
    }

    public class UserNotAllowedException : APIException
    {
        public UserNotAllowedException() :
            base("ERROR_USER_NOT_ALLOWED", 400)
        {
        }
    }

    public class ExpiredSecurityCodeException : APIException
    {
        public ExpiredSecurityCodeException() :
            base("ERROR_SEC_KEY_EXPIRED", 400)
        {

        }
    }
    public class InvalidOldPasswordException : APIException
    {
        public InvalidOldPasswordException() :
            base("ERROR_INVALID_OLD_PWD", 400)
        {
        }
    }

    public class ResetPasswordNotAllowedException : APIException
    {
        public ResetPasswordNotAllowedException() :
            base("ERROR_RESET_PWD_NOT_ALLOWED", 400)
        {
        }
    }

    public class ResetPasswordLockedException : APIException
    {
        public ResetPasswordLockedException(int m) :
            base($"ERROR_RESET_PWD_LOCKED_1:{m}", 400)
        {
        }
    }

    public class InvalidEmailAddressException : APIException
    {
        public InvalidEmailAddressException() :
            base("ERROR_INVALID_EMAIL", 400)
        {
        }
    }

    public class EmailAddressAlreadyRegisteredException : APIException
    {
        public EmailAddressAlreadyRegisteredException() :
            base("ERROR_EMAIL_ALREADY_REGISTERED", 400)
        {
        }
    }

    public class EmailAddressNotConfirmedException : APIException
    {
        public EmailAddressNotConfirmedException() :
            base("ERROR_EMAIL_NOT_CONFIRMED", 400)
        {
        }
    }

    public class EmailAddressRegistrationLockedException : APIException
    {
        public EmailAddressRegistrationLockedException(int m) :
            base($"ERROR_REG_LOCKED_1:{m}", 400)
        {
        }
    }

    public class NoRegistrationRequestForEmailAddressException : APIException
    {
        public NoRegistrationRequestForEmailAddressException() :
            base("ERROR_NO_REG_REQUEST_FOR_EMAIL", 400)
        {
        }
    }

    public class InvalidRegistrationCodeException : APIException
    {
        public InvalidRegistrationCodeException() :
            base("ERROR_INVALID_REG_CODE", 400)
        {
        }
    }

    public class UsernameAlreadyUsedException : APIException
    {
        public UsernameAlreadyUsedException() :
            base("ERROR_USERNAME_ALREADY_USED", 400)
        {
        }
    }

    public class UserManagerRequiredException : APIException
    {
        public UserManagerRequiredException() :
            base("ERROR_USERMANAGER_REQUIRED", 400)
        {
        }
    }

    public class SelfRemoveUserManagerRoleException : APIException
    {
        public SelfRemoveUserManagerRoleException() :
            base("ERROR_SELF_REMOVE_USERMANAGER", 400)
        {
        }
    }

    public class InvalidStorageQuotaException : APIException
    {
        public InvalidStorageQuotaException() :
            base("ERROR_INVALID_STORAGE_QUOTA", 400)
        {
        }
    }

    public class TwoFactorAuthenticationAlreadyActivated : APIException
    {
        public TwoFactorAuthenticationAlreadyActivated() :
            base("ERROR_TWO_FACTOR_AUTH_ALREADY_ACTIVATED", 400)
        {
        }
    }

    public class PasswordNotStrongEnoughException : APIException
    {
        public PasswordNotStrongEnoughException() :
            base("ERROR_PWD_NOT_STRONG_ENOUGH", 400)
        {
        }
    }

    public class ChangedPasswordNotStrongEnoughException : APIException
    {
        public ChangedPasswordNotStrongEnoughException() :
            base("ERROR_CHANGE_PWD_NOT_STRONG_ENOUGH", 400)
        {
        }
    }

    public class PasswordSameAsOldException : APIException
    {
        public PasswordSameAsOldException() :
            base("ERROR_PWD_SAME_AS_OLD", 400)
        {
        }
    }

    public class SecretKeyNotStrongEnoughException : APIException
    {
        public SecretKeyNotStrongEnoughException() :
            base("ERROR_SEC_KEY_NOT_STRONG_ENOUGH", 400)
        {
        }
    }

    public class SecretKeySameAsPasswordException : APIException
    {
        public SecretKeySameAsPasswordException() :
            base("ERROR_SEC_KEY_SAME_AS_PWD", 400)
        {
        }
    }

    public class PasswordFileNotFoundException : APIException
    {
        public PasswordFileNotFoundException() :
            base("ERROR_PWD_FILE_NOT_FOUND", 400)
        {
        }
    }

    public class MissingParameterException : APIException
    {
        public MissingParameterException()
            : base("ERROR_MISSING_PARAMETERS", 400)
        {
        }
    }

    public class InvalidParameterException : APIException
    {
        public InvalidParameterException()
            : base("ERROR_INVALID_PARAMETERS", 400)
        {
        }
    }

    public class FileTooLargeException : APIException
    {
        public FileTooLargeException()
            : base("ERROR_FILE_TOO_LARGE", 400)
        {
        }
    }

    public class StorageQuotaExceededException : APIException
    {
        public StorageQuotaExceededException()
            : base("ERROR_QUOTA_EXCEEDED", 400)
        {
        }        
    }

    public class TableAlreadyReservedException : APIException
    {
        public TableAlreadyReservedException()
            : base("ERROR_TABLE_ALREADY_RESERVED", 400)
        {
        }
    }

    public class InvalidReservationDateException : APIException
    {
        public InvalidReservationDateException()
            : base("ERROR_INVALID_RESERVATION_DATE", 400)
        {
        }
    }

    public class InvalidReservationDurationException : APIException
    {
        public InvalidReservationDurationException()
            : base("ERROR_INVALID_RESERVATION_DURATION", 400)
        {
        }
    }

    public class InvalidPlayerNamesException : APIException
    {
        public InvalidPlayerNamesException()
            : base("ERROR_INVALID_PLAYER_NAMES", 400)
        {
        }
    }

    public class InvalidPlayerNameException : APIException
    {
        public InvalidPlayerNameException()
            : base("ERROR_INVALID_PLAYER_NAME", 400)
        {
        }
    }

    public class ReservationRequirementException : APIException
    {
        public ReservationRequirementException()
            : base("ERROR_RESERVATION_REQUIREMENT", 400)
        {
        }
    }

    public class ReservationAlreadyExistsException : APIException
    {
        public ReservationAlreadyExistsException()
            : base("ERROR_RESERVATION_ALREADY_EXISTS", 400)
        {
        }
    }

    public class InvalidMoveException : APIException
    {
        public InvalidMoveException()
            : base("ERROR_INVALID_MOVE", 400)
        {
        }
    }

    public class SkipMoveNotAllowedException : APIException
    {
        public SkipMoveNotAllowedException()
            : base("ERROR_SKIP_MOVE_NOT_ALLOWED", 400)
        {
        }
    }

    public class RollDiceNotAllowedException : APIException
    {
        public RollDiceNotAllowedException()
            : base("ERROR_ROLL_DICE_NOT_ALLOWED", 400)
        {
        }
    }
}
