/*
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
namespace APIServer.PwdMan
{
    public interface IPwdManService
    {
        public bool IsRegisteredUsername(string username);

        public bool IsRegisterAllowed(string email);

        public void Register(RegistrationProfile registrationProfile);

        public string ConfirmRegistration(string authenticationToken, Confirmation confirmation);

        public AuthenticationResult Authenticate(Authentication authenication);

        public string AuthenticateTOTP(string token, string totp);

        public void SendTOTP(string token);

        public string GetSalt(string token);

        public void ChangeUserPassword(string token, UserPasswordChange userPassswordChange);

        public void SavePasswordFile(string token, PasswordFile pwdFileContent);

        public string GetEncodedPasswordFile(string token);

        public bool HasPasswordFile(string authenticationToken);

        public string GetUsername(string authenticationToken);
    }
}
