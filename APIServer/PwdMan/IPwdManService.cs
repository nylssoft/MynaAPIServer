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
using APIServer.Database;
using APIServer.PwdMan.Model;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

namespace APIServer.PwdMan
{
    public interface IPwdManService
    {
        // --- reset password

        Task RequestResetPasswordAsync(string email, string ipAddress, string locale);

        void ResetPassword(UserResetPasswordModel resetPasswordModel, string ipAddress);

        // --- registration

        Task<bool> RequestRegistrationAsync(string email, string ipAddress, string locale);

        List<OutstandingRegistrationModel> GetOutstandingRegistrations(string authenticationToken);

        Task<string> ConfirmRegistrationAsync(string authenticationToken, OutstandingRegistrationModel registration);

        void RegisterUser(UserRegistrationModel userRegistration);

        // --- user management

        string GetPhoto(string username);

        string UploadPhoto(string authenticationToken, string contentType, Stream contentStream);

        bool DeletePhoto(string authenticationToken);

        bool IsRegisteredUsername(string username);

        DbUser GetUserFromToken(string authenticationToken, bool useLongLivedToken = false);

        bool HasRole(DbUser user, string roleName);

        UserModel GetUser(string authenticationToken, bool details = false);

        List<UserModel> GetUsers(string authenticationToken);

        long GetUsedStorage(string authenticationToken, long userId);

        bool UnlockUser(string authenticationToken, string username);

        bool DeleteUser(string authenticationToken, string username);

        int DeleteLoginIpAddresses(string authenticiationToken);

        User2FAKeyModel GenerateUser2FAKey(string authenticationToken, bool forceNew);

        bool EnableUser2FA(string authenticationToken, string totp);

        bool DisableUser2FA(string authenticationToken);

        bool UpdateUserUseLongLivedToken(string authenticationToken, bool useLongLivedToken);

        bool UpdateUserAllowResetPassword(string authenticationToken, bool allowResetPassword);

        bool UpdateUsername(string authenticationToken, string username);

        bool UpdateUserEmailAddress(string authenticationToken, string emailAddress);

        bool UpdateUserRole(string authenticationToken, UserUpdateRoleModel userUpdateRoleModel);

        bool UpdateUserStorageQuota(string authenticationToken, long userId, long quota);

        bool UpdateUserLoginEnabled(string authenticationToken, long userId, bool loginEnabled);

        void ChangeUserPassword(string authenticationToken, UserPasswordChangeModel userPassswordChange);

        // --- authentication

        Task<AuthenticationResponseModel> AuthenticateAsync(AuthenticationModel authenication, string ipAddress, string locale);

        AuthenticationResponseModel AuthenticateTOTP(string token, string totp, string ipAddress);

        AuthenticationResponseModel AuthenticateLongLivedToken(string longLivedToken, string ipAddress);

        bool Logout(string token);

        // --- password manager

        void SavePasswordFile(string authenticationToken, string encodedContent);

        bool DeletePasswordFile(string authenticationToken);

        string GetPasswordFile(string authenticationToken);

        // --- locale

        string GetLocaleUrl(string locale);

        // --- slideshow

        SlideShowModel GetSlideShow(string authenticationToken);

        // --- markdown

        string GetMarkdown(string authenticationToken, string id, string locale);

        // --- database access

        DbMynaContext GetDbContext();
    }
}
