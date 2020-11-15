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
using APIServer.Database;
using APIServer.PwdMan.Model;
using System.Collections.Generic;

namespace APIServer.PwdMan
{
    public interface IPwdManService
    {
        // --- registration

        bool IsRegisterAllowed(string email);

        List<OutstandingRegistrationModel> GetOutstandingRegistrations(string authenticationToken);

        string ConfirmRegistration(string authenticationToken, OutstandingRegistrationModel registration);

        void RegisterUser(UserRegistrationModel userRegistration);

        // --- user management

        bool IsRegisteredUsername(string username);

        DbUser GetUserFromToken(string authenticationToken);

        bool HasRole(DbUser user, string roleName);

        UserModel GetUser(string authenticationToken);

        bool DeleteUser(string authenticationToken, string userName);

        bool UpdateUser2FA(string authenticationToken, bool requires2FA);

        List<UserModel> GetUsers(string authenticationToken);

        // --- authentication

        AuthenticationResponseModel Authenticate(AuthenticationModel authenication, string ipAddress);

        string AuthenticateTOTP(string token, string totp);

        void SendTOTP(string token);

        void ChangeUserPassword(string token, UserPasswordChangeModel userPassswordChange);

        // --- password manager

        void SavePasswordFile(string token, PasswordFileModel pwdFileContent);

        string GetEncodedPasswordFile(string token);

        bool HasPasswordFile(string authenticationToken);

        // --- database access

        DbMynaContext GetDbContext();

    }
}
