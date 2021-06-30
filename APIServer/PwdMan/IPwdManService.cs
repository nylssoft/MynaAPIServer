/*
    Myna API Server
    Copyright (C) 2020-2021 Niels Stockfleth

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
using System.IO;

namespace APIServer.PwdMan
{
    public interface IPwdManService
    {
        // --- reset password

        void RequestResetPassword(string email, string ipAddress);

        void ResetPassword(UserResetPasswordModel resetPasswordModel);

        // --- registration

        bool IsRegisterAllowed(string email, string ipAddress);

        List<OutstandingRegistrationModel> GetOutstandingRegistrations(string authenticationToken);

        string ConfirmRegistration(string authenticationToken, OutstandingRegistrationModel registration);

        void RegisterUser(UserRegistrationModel userRegistration);

        // --- user management

        string GetPhoto(string username);

        string UploadPhoto(string authenticationToken, string contentType, Stream contentStream);

        bool DeletePhoto(string authenticationToken);

        bool IsRegisteredUsername(string username);

        DbUser GetUserFromToken(string authenticationToken, bool useLongLivedToken = false);

        bool HasRole(DbUser user, string roleName);

        UserModel GetUser(string authenticationToken, bool getLoginIpAddresses = false, bool getDocumentStorage = false);

        List<UserModel> GetUsers(string authenticationToken);

        bool UnlockUser(string authenticationToken, string userName);

        bool DeleteUser(string authenticationToken, string userName);

        int DeleteLoginIpAddresses(string authenticiationToken);

        bool UpdateUser2FA(string authenticationToken, bool requires2FA);

        bool UpdateUserUseLongLivedToken(string authenticationToken, bool useLongLivedToken);

        bool UpdateUserAllowResetPassword(string authenticationToken, bool allowResetPassword);

        bool UpdateUserRole(string authenticationToken, UserUpdateRoleModel userUpdateRoleModel);

        void ChangeUserPassword(string authenticationToken, UserPasswordChangeModel userPassswordChange);

        // --- authentication

        AuthenticationResponseModel Authenticate(AuthenticationModel authenication, string ipAddress);

        AuthenticationResponseModel AuthenticateTOTP(string token, string totp);

        AuthenticationResponseModel AuthenticateLongLivedToken(string longLivedToken, string ipAddress);

        void SendTOTP(string token);

        bool Logout(string token);

        // --- password manager

        void SavePasswordFile(string authenticationToken, string encodedContent);

        bool DeletePasswordFile(string authenticationToken);

        string GetPasswordFile(string authenticationToken);

        bool HasPasswordFile(string authenticationToken);

        // --- slideshow

        SlideShowModel GetSlideShow(string authenticationToken);

        // --- markdown

        string GetMarkdown(string authenticationToken, string id);

        // --- database access

        DbMynaContext GetDbContext();
    }
}
