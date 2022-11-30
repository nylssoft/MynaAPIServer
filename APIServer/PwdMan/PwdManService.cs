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
using APIServer.Document.Model;
using APIServer.PasswordGenerator;
using APIServer.PwdMan.Model;
using Markdig;
using Microsoft.AspNetCore.Cryptography.KeyDerivation;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using SendGrid;
using SendGrid.Helpers.Mail;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace APIServer.PwdMan
{
    public class PwdManService : IPwdManService
    {
        public IConfiguration Configuration { get; }

        private readonly ILogger logger;

        private readonly DbMynaContext dbSqliteContext;

        private readonly DbPostgresContext dbPostgresContext;

        private readonly ISendGridClient sendGridClient;

        public PwdManService(
            IConfiguration configuration,
            ILogger<PwdManService> logger,
            DbSqliteContext dbSqliteContext,
            DbPostgresContext dbPostgresContext,
            ISendGridClient sendGridClient)
        {
            Configuration = configuration;
            this.logger = logger;
            this.dbSqliteContext = dbSqliteContext;
            this.dbPostgresContext = dbPostgresContext;
            this.sendGridClient = sendGridClient;
        }

        // --- reset password

        public async Task RequestResetPasswordAsync(string email, string ipAddress, string locale)
        {
            logger.LogDebug("Request password reset for email addresss '{email}' and locale '{locale}' from IP address {ipAddress}.", email, locale, ipAddress);
            if (!IsValidEmailAddress(email))
            {
                throw new InvalidEmailAddressException();
            }
            email = email.ToLowerInvariant();
            var dbContext = GetDbContext();
            var user = dbContext.DbUsers.SingleOrDefault((u) => u.Email == email);
            if (user == null)
            {
                throw new InvalidEmailAddressException();
            }
            if (!user.AllowResetPassword)
            {
                throw new ResetPasswordNotAllowedException();
            }
            var opt = GetOptions();
            var loginIpAddress = CheckLoginIpAddress(dbContext, user, ipAddress, opt);
            var lastRequestedUtc = dbContext.DbResetPasswords.Where((r) => r.IpAddress == ipAddress).Max<DbResetPassword,DateTime?>((r) => r.RequestedUtc);
            if (lastRequestedUtc != null)
            {
                int min = Convert.ToInt32((DateTime.UtcNow - lastRequestedUtc.Value).TotalMinutes);
                if (min < opt.ResetPasswordTokenExpireMinutes)
                {
                    throw new ResetPasswordLockedException(opt.ResetPasswordTokenExpireMinutes - min);
                }
            }
            var pwdgen = new PwdGen
            {
                Length = 12,
                LowerCharacters = "",
                Symbols = "",
                Digits = "123456789",
                UpperCharacters = "ABCDEFGHJKLMNPQRSTUVWXYZ",
                MinDigits = 2,
                MinUpperCharacters = 2,
                MinLowerCharacters = 0,
                MinSymbols = 0
            };
            var resetpwd = dbContext.DbResetPasswords.SingleOrDefault((r) => r.Email == email);
            if (resetpwd == null)
            {
                resetpwd = new DbResetPassword
                {
                    Email = email,
                    Token = pwdgen.Generate(),
                    RequestedUtc = DateTime.UtcNow,
                    IpAddress = ipAddress
                };
                dbContext.DbResetPasswords.Add(resetpwd);
            }
            else
            {
                resetpwd.Token = pwdgen.Generate();
                resetpwd.RequestedUtc = DateTime.UtcNow;
                resetpwd.IpAddress = ipAddress;
            }
            dbContext.SaveChanges();
            await SendResetPasswordEmailAsync(user, resetpwd.Token, email, opt, GetValidLocale(locale, dbContext, email));
        }

        public void ResetPassword(UserResetPasswordModel resetPasswordModel, string ipAddress)
        {
            logger.LogDebug("Reset password for email addresss '{email}'.", resetPasswordModel.Email);
            var email = resetPasswordModel.Email.ToLowerInvariant();
            var dbContext = GetDbContext();
            var user = dbContext.DbUsers.SingleOrDefault((u) => u.Email == email);
            if (user == null)
            {
                throw new InvalidEmailAddressException();
            }
            var resetpwd = dbContext.DbResetPasswords.SingleOrDefault((r) => r.Email == email);
            if (resetpwd == null || !user.AllowResetPassword)
            {
                throw new ResetPasswordNotAllowedException();
            }
            var opt = GetOptions();
            var loginIpAddress = CheckLoginIpAddress(dbContext, user, ipAddress, opt);
            if (resetpwd.Token != resetPasswordModel.Token)
            {
                loginIpAddress.Failed += 1;
                dbContext.SaveChanges();
                if (loginIpAddress.Failed >= opt.MaxLoginTryCount)
                {
                    throw new InvalidSecurityCodeAndLockedException();
                }
                throw new InvalidSecurityCodeException();
            }
            var diff = (DateTime.UtcNow - resetpwd.RequestedUtc).TotalMinutes;
            if (diff > opt.ResetPasswordTokenExpireMinutes)
            {
                throw new ExpiredSecurityCodeException();
            }
            if (!VerifyPasswordStrength(resetPasswordModel.Password))
            {
                throw new PasswordNotStrongEnoughException();
            }
            var hasher = new PasswordHasher<string>();
            var hash = hasher.HashPassword(user.Name, resetPasswordModel.Password);
            user.PasswordHash = hash;
            loginIpAddress.Failed = 0;
            dbContext.DbResetPasswords.Remove(resetpwd);
            dbContext.SaveChanges();
        }

        // --- registration

        public async Task<bool> RequestRegistrationAsync(string email, string ipAddress, string locale)
        {
            logger.LogDebug("Request registration for email addresss '{email}' and locale '{locale}' from IP address {ipAddress}...", email, locale, ipAddress);
            if (!IsValidEmailAddress(email))
            {
                throw new InvalidEmailAddressException();
            }
            email = email.ToLowerInvariant();
            var opt = GetOptions();
            // setup: first user can register without confirmation and token
            var dbContext = GetDbContext();
            if (!dbContext.DbUsers.Any())
            {
                return true;
            }
            var user = dbContext.DbUsers.SingleOrDefault(u => u.Email == email);
            bool userEmailExists = user != null;
            if (userEmailExists)
            {
                throw new EmailAddressAlreadyRegisteredException();
            }
            var registration = dbContext.DbRegistrations.SingleOrDefault((r) => r.Email == email);
            if (registration != null)
            {
                if (string.IsNullOrEmpty(registration.Token))
                {
                    throw new EmailAddressNotConfirmedException();
                }
                return true;
            }
            var lastRequestedUtc = dbContext.DbRegistrations.Where((r) => r.IpAddress == ipAddress).Max((r) => r.RequestedUtc);
            if (lastRequestedUtc != null)
            {
                int min = Convert.ToInt32((DateTime.UtcNow - lastRequestedUtc.Value).TotalMinutes);
                if (min < opt.ResetPasswordTokenExpireMinutes)
                {
                    throw new EmailAddressRegistrationLockedException(opt.ResetPasswordTokenExpireMinutes - min);
                }
            }
            dbContext.DbRegistrations.Add(new DbRegistration {
                Email = email,
                RequestedUtc = DateTime.UtcNow,               
                IpAddress = ipAddress,
                Locale = GetValidLocale(locale)
            });
            dbContext.SaveChanges();
            await SendRegistrationRequestEmailAsync(email, opt);
            return false;
        }

        public List<OutstandingRegistrationModel> GetOutstandingRegistrations(string authenticationToken)
        {
            logger.LogDebug("Returns outstanding registrations...");
            var user = GetUserFromToken(authenticationToken);
            if (!HasRole(user, "usermanager"))
            {
                throw new AccessDeniedPermissionException();
            }
            var dbContext = GetDbContext();
            var knownEmails = new HashSet<string>(dbContext.DbUsers.Select(u => u.Email).ToList());
            var confirmations = new List<OutstandingRegistrationModel>();
            var registrations = dbContext.DbRegistrations
                .Where(r => !knownEmails.Contains(r.Email))
                .Select(r => new { r.Email, r.RequestedUtc }).ToList();
            foreach (var registration in registrations)
            {
                confirmations.Add(new OutstandingRegistrationModel
                {
                    Email = registration.Email,
                    RequestedUtc = DbMynaContext.GetUtcDateTime(registration.RequestedUtc)
                });
            }
            return confirmations;
        }

        public async Task<string> ConfirmRegistrationAsync(string authenticationToken, OutstandingRegistrationModel confirmation)
        {
            logger.LogDebug("Confirm registration for email addresss '{email}'...", confirmation.Email);
            var email = confirmation.Email.ToLowerInvariant();
            var user = GetUserFromToken(authenticationToken);
            if (!HasRole(user, "usermanager"))
            {
                throw new AccessDeniedPermissionException();
            }
            var dbContext = GetDbContext();
            var emailUser = dbContext.DbUsers.SingleOrDefault(u => u.Email == email);
            if (emailUser != null)
            {
                throw new EmailAddressAlreadyRegisteredException();
            }
            var registration = dbContext.DbRegistrations.SingleOrDefault((r) => r.Email == email);
            if (registration == null)
            {
                throw new NoRegistrationRequestForEmailAddressException();
            }
            if (confirmation.Reject)
            {
                dbContext.DbRegistrations.Remove(registration);
                dbContext.SaveChanges();
                registration.Token = null;
            }
            else if (string.IsNullOrEmpty(registration.Token))
            {
                var pwdgen = new PwdGen
                {
                    Length = 6,
                    LowerCharacters = "",
                    Symbols = "",
                    Digits = "123456789",
                    UpperCharacters = "ABCDEFGHJKLMNPQRSTUVWXYZ",
                    MinDigits = 2,
                    MinUpperCharacters = 2,
                    MinLowerCharacters = 0,
                    MinSymbols = 0
                };
                registration.Token = pwdgen.Generate();
                registration.ConfirmedUtc = DateTime.UtcNow;
                registration.ConfirmedById = user.Id;
                dbContext.SaveChanges();
            }
            var opt = GetOptions();
            await SendConfirmationRegistrationEmailAsync(registration, confirmation.Reject, email, opt, GetValidLocale(registration.Locale));
            return registration.Token;
        }

        public void RegisterUser(UserRegistrationModel registrationProfile)
        {
            logger.LogDebug("Register user '{username}', email '{email}'...", registrationProfile.Username, registrationProfile.Email);
            if (!IsValidUsername(registrationProfile.Username))
            {
                throw new InvalidUsernameException();
            }
            if (!IsValidEmailAddress(registrationProfile.Email))
            {
                throw new InvalidEmailAddressException();
            }
            if (string.IsNullOrEmpty(registrationProfile.Token))
            {
                throw new InvalidRegistrationCodeException();
            }
            var email = registrationProfile.Email.ToLowerInvariant();
            var opt = GetOptions();
            // first user can register without token
            var dbContext = GetDbContext();
            var firstUser = dbContext.DbUsers.Count() == 0;
            if (!firstUser)
            {
                var registration = dbContext.DbRegistrations.SingleOrDefault((r) => r.Email == email);
                if (registration == null || registration.Token != registrationProfile.Token.ToUpperInvariant())
                {
                    throw new InvalidRegistrationCodeException();
                }
                var exsitingUser = GetDbUserByName(registrationProfile.Username);
                if (exsitingUser != null)
                {
                    throw new UsernameAlreadyUsedException();
                }
                exsitingUser = dbContext.DbUsers.SingleOrDefault(u => u.Email == email);
                if (exsitingUser != null)
                {
                    throw new EmailAddressAlreadyRegisteredException();
                }
            }
            if (!VerifyPasswordStrength(registrationProfile.Password))
            {
                throw new PasswordNotStrongEnoughException();
            }
            var pwdgen = new PwdGen { Length = 12 };
            var hasher = new PasswordHasher<string>();
            var hash = hasher.HashPassword(registrationProfile.Username, registrationProfile.Password);
            var user = new DbUser
            {
                Name = registrationProfile.Username,
                Salt = pwdgen.Generate(),
                PasswordHash = hash,
                Email = email,
                Requires2FA = false,
                UseLongLivedToken = true,
                AllowResetPassword = true,
                RegisteredUtc = DateTime.UtcNow,
                StorageQuota = 100 * 1024 * 1024, // 100 MB default storage
                LoginEnabled = true
            };
            // first user has the usermanager role
            if (firstUser)
            {
                user.Roles = new List<DbRole>();
                user.Roles.Add(new DbRole { Name = "usermanager" });
            }
            dbContext.DbUsers.Add(user);
            dbContext.SaveChanges();
            var skatResults = dbContext.DbSkatResults
                .Where(r => r.Player1 == user.Name || r.Player2 == user.Name || r.Player3 == user.Name || r.Player4 == user.Name)
                .Select(r => r.Id);
            if (skatResults.Any())
            {
                foreach (var skatResultId in skatResults)
                {
                    dbContext.DbUserSkatResults.Add(new DbUserSkatResult { DbUserId = user.Id, DbSkatResultId = skatResultId });
                }
                dbContext.SaveChanges();
            }
        }

        // --- user management

        public string GetPhoto(string username)
        {
            logger.LogDebug("Get photo for username '{username}'...", username);
            var user = GetDbUserByName(username);
            return user?.Photo;
        }

        public bool IsRegisteredUsername(string username)
        {
            logger.LogDebug("Check whether username '{username}' is registered...", username);
            var user = GetDbUserByName(username);
            return user != null;
        }

        public string UploadPhoto(string authenticationToken, string contentType, Stream contentStream)
        {
            logger.LogDebug("Upload photo...");
            var user = GetUserFromToken(authenticationToken);
            var pwdgen = new PwdGen
            {
                Length = 32,
                Symbols = "",
                UpperCharacters = "",
                MinDigits = 2,
                MinUpperCharacters = 0,
                MinLowerCharacters = 2,
                MinSymbols = 0
            };
            var prevPhotoFile = user.Photo;
            string extension = "jpg";
            if (contentType.EndsWith("png", StringComparison.InvariantCultureIgnoreCase))
            {
                extension = "png";
            }
            user.Photo = $"/images/profiles/{user.Id}-{pwdgen.Generate()}.{extension}";
            if (!Directory.Exists("wwwroot/images/profiles"))
            {
                Directory.CreateDirectory("wwwroot/images/profiles");
            }
            using (Image image = Image.Load(contentStream))
            {
                var opt = new ResizeOptions { Mode = ResizeMode.Crop, Size = new Size { Width = 90, Height = 90 } };
                image.Mutate(x => x.Resize(opt));
                image.Save($"wwwroot/{user.Photo}");
            }
            var dbContext = GetDbContext();
            dbContext.SaveChanges();
            // try to delete photo file if new photo has been successfully updated
            if (!string.IsNullOrEmpty(prevPhotoFile))
            {
                var fname = $"wwwroot/{prevPhotoFile}";
                if (File.Exists(fname))
                {
                    File.Delete(fname);
                }
            }
            return user.Photo;
        }

        public bool DeletePhoto(string authenticationToken)
        {
            logger.LogDebug("Delete photo...");
            var user = GetUserFromToken(authenticationToken);
            if (!string.IsNullOrEmpty(user.Photo))
            {
                var fname = $"wwwroot/{user.Photo}";
                if (File.Exists(fname))
                {
                    File.Delete(fname);
                }
                user.Photo = null;
                var dbContext = GetDbContext();
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public DbUser GetUserFromToken(string authenticationToken, bool useLongLivedToken = false)
        {
            logger.LogDebug("Get user from token, use long lived token: {useLongLivedToken}.", useLongLivedToken);
            var opt = GetOptions();
            if (!ValidateToken(authenticationToken, opt, useLongLivedToken))
            {
                logger.LogDebug("Token is invalid.");
                throw new InvalidTokenException();
            }
            var tokenHandler = new JwtSecurityTokenHandler();
            var securityToken = tokenHandler.ReadToken(authenticationToken) as JwtSecurityToken;
            var claim = securityToken.Claims.FirstOrDefault(claim => claim.Type == "unique_name");
            if (claim == null)
            {
                logger.LogDebug("Claim type 'unique_name' not found.");
                throw new InvalidTokenException();
            }
            var dbContext = GetDbContext();
            var user = dbContext.DbUsers.SingleOrDefault(u => u.Name == claim.Value);
            if (user == null)
            {
                logger.LogDebug("Invalid username in token.");
                throw new InvalidTokenException();
            }
            if (!user.LoginEnabled)
            {
                logger.LogDebug("Login is disabled.");
                throw new InvalidTokenException();
            }
            if (user.LogoutUtc > securityToken.IssuedAt)
            {
                logger.LogDebug("Token is expired.");
                throw new InvalidTokenException();
            }
            if (!useLongLivedToken && user.Requires2FA)
            {
                var amr = securityToken.Claims.FirstOrDefault(claim => claim.Type == "amr");
                if (amr != null)
                {
                    logger.LogDebug("2FA Token is required.");
                    throw new Requires2FAException();
                }
            }
            return user;
        }

        public bool HasRole(DbUser user, string roleName)
        {
            logger.LogDebug("Has user '{name}' role '{roleName}'.", user.Name, roleName);
            if (user.Roles == null)
            {
                var dbContext = GetDbContext();
                dbContext.Entry(user).Collection(user => user.Roles).Load();
            }
            foreach (var role in user.Roles)
            {
                if (role.Name == roleName)
                {
                    return true;
                }
            }
            return false;
        }

        public UserModel GetUser(string authenticationToken, bool details = false)
        {
            logger.LogDebug("Get user, details: {details}...", details);
            var user = GetUserFromToken(authenticationToken);
            var userModel = new UserModel
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                LastLoginUtc = DbMynaContext.GetUtcDateTime(user.LastLoginTryUtc),
                Requires2FA = user.Requires2FA,
                UseLongLivedToken = user.UseLongLivedToken,
                AllowResetPassword = user.AllowResetPassword,
                RegisteredUtc = DbMynaContext.GetUtcDateTime(user.RegisteredUtc),
                PasswordManagerSalt = user.Salt,
                Photo = user.Photo,
                StorageQuota = user.StorageQuota,
                LoginEnabled = user.LoginEnabled,
                HasContacts = false,
                HasDiary = false,
                HasDocuments = false,
                HasNotes = false,
                HasPasswordManagerFile = user.PasswordFileId != null,
            };
            var dbContext = GetDbContext();
            userModel.Roles = dbContext.DbRoles.Where(r => r.DbUserId == user.Id).Select(r => r.Name).ToList();
            if (details)
            {
                var sum = dbContext.DbDocItems.Where(item => item.Type == DbDocItemType.Item && item.OwnerId == user.Id).Sum(item => item.Size);
                userModel.UsedStorage = sum;
                userModel.HasContacts = dbContext.DbDocItems.Any(item => item.OwnerId == user.Id && item.Type == DbDocItemType.Contacts);
                userModel.HasDiary = dbContext.DbDiaries.Any(item => item.DbUserId == user.Id);
                userModel.HasDocuments = dbContext.DbDocItems.Any(item => item.OwnerId == user.Id && (item.Type == DbDocItemType.Item || item.Type == DbDocItemType.Folder));
                userModel.HasNotes = dbContext.DbNotes.Any(item => item.DbUserId == user.Id);
            }
            return userModel;
        }
        
        public bool UnlockUser(string authenticationToken, string username)
        {
            logger.LogDebug("Unlock username '{username}'...", username);
            var adminuser = GetUserFromToken(authenticationToken);
            if (!HasRole(adminuser, "usermanager"))
            {
                throw new AccessDeniedPermissionException();
            }
            var dbContext = GetDbContext();
            var user = dbContext.DbUsers.SingleOrDefault(u => u.Name == username);
            if (user == null)
            {
                throw new InvalidUsernameException();
            }
            var opt = GetOptions();
            var failedIpAddresses = dbContext.DbLoginIpAddresses
                .Where(ip => ip.DbUserId == user.Id && ip.Failed >= opt.MaxLoginTryCount);
            if (failedIpAddresses.Any())
            {
                foreach (var ip in failedIpAddresses)
                {
                    ip.Failed = 0;
                }
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public User2FAKeyModel GenerateUser2FAKey(string authenticationToken, bool forceNew)
        {
            logger.LogDebug("Generate user secret key for two factor authentication, forceNew: {forceNew}...", forceNew);
            var user = GetUserFromToken(authenticationToken);
            if (user.Requires2FA)
            {
                throw new TwoFactorAuthenticationAlreadyActivated();
            }
            if (forceNew || string.IsNullOrEmpty(user.TOTPKey))
            {
                var sharedSecret = RandomNumberGenerator.GetBytes(10);
                var totpKey = ConvertExtension.ToBase32String(sharedSecret);
                user.TOTPKey = totpKey;
                var dbContext = GetDbContext();
                dbContext.SaveChanges();
            }
            var opt = GetOptions();
            return new User2FAKeyModel
            {
                Issuer = opt.TOTPConfig.Issuer,
                SecretKey = user.TOTPKey
            };
        }

        public bool EnableUser2FA(string authenticationToken, string totp)
        {
            logger.LogDebug("Enable user two factor authentication...");
            var user = GetUserFromToken(authenticationToken);
            if (!user.Requires2FA && !string.IsNullOrEmpty(user.TOTPKey))
            {
                var opt = GetOptions();
                if (TOTP.IsValid(totp, user.TOTPKey, opt.TOTPConfig.ValidSeconds))
                {
                    user.Requires2FA = true;
                    var dbContext = GetDbContext();
                    dbContext.SaveChanges();
                    return true;
                }
            }
            return false;
        }

        public bool DisableUser2FA(string authenticationToken)
        {
            logger.LogDebug("Disable user two factor authentication...");
            var user = GetUserFromToken(authenticationToken);
            if (user.Requires2FA || !string.IsNullOrEmpty(user.TOTPKey))
            {
                user.Requires2FA = false;
                user.TOTPKey = "";
                var dbContext = GetDbContext();
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public bool UpdateUserUseLongLivedToken(string authenticationToken, bool useLongLivedToken)
        {
            logger.LogDebug("Update user long-lived token usage to {useLongLivedToken}...", useLongLivedToken);
            var user = GetUserFromToken(authenticationToken);
            if (user.UseLongLivedToken != useLongLivedToken)
            {
                user.UseLongLivedToken = useLongLivedToken;
                var dbContext = GetDbContext();
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public bool UpdateUserAllowResetPassword(string authenticationToken, bool allowResetPassword)
        {
            logger.LogDebug("Update user allow reset password to {allowResetPassword}...", allowResetPassword);
            var user = GetUserFromToken(authenticationToken);
            if (user.AllowResetPassword != allowResetPassword)
            {
                user.AllowResetPassword = allowResetPassword;
                var dbContext = GetDbContext();
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public bool UpdateUsername(string authenticationToken, string username)
        {
            logger.LogDebug("Update user name to {username}", username);
            if (!IsValidUsername(username))
            {
                throw new InvalidUsernameException();
            }
            var user = GetUserFromToken(authenticationToken);
            var dbContext = GetDbContext();
            if (username != user.Name)
            {
                if (dbContext.DbUsers.Any((user) => user.Name == username))
                {
                    throw new UsernameAlreadyUsedException();
                }
                user.Name = username;
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public bool UpdateUserEmailAddress(string authenticationToken, string emailAddress)
        {
            logger.LogDebug("Update user email address to {emailAddress}", emailAddress);
            if (!IsValidEmailAddress(emailAddress))
            {
                throw new InvalidEmailAddressException();
            }
            var user = GetUserFromToken(authenticationToken);
            emailAddress = emailAddress.ToLowerInvariant();
            if (emailAddress != user.Email)
            {
                var dbContext = GetDbContext();
                if (dbContext.DbUsers.Any((user) => user.Email == emailAddress))
                {
                    throw new EmailAddressAlreadyRegisteredException();
                }
                user.Email = emailAddress;
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public bool UpdateUserRole(string authenticationToken, UserUpdateRoleModel model)
        {
            logger.LogDebug("Update role '{roleName}' for user '{username}', set assigned to {assigned}...", model.RoleName, model.Username, model.Assigned);
            var adminuser = GetUserFromToken(authenticationToken);
            if (!HasRole(adminuser, "usermanager"))
            {
                throw new AccessDeniedPermissionException();
            }
            var changed = false;
            var dbContext = GetDbContext();
            var user = dbContext.DbUsers
                .Include((u) => u.Roles)
                .SingleOrDefault((u) => u.Name == model.Username);
            if (user == null)
            {
                throw new InvalidUsernameException();
            }
            var role = dbContext.DbRoles.SingleOrDefault((r) => r.DbUserId == user.Id && r.Name == model.RoleName);
            if (model.Assigned && role == null)
            {
                user.Roles.Add(new DbRole { DbUserId = user.Id, Name = model.RoleName });
                changed = true;
            }
            else if (!model.Assigned && role != null)
            {
                if (role.Name == "usermanager")
                {
                    if (adminuser.Id == user.Id)
                    {
                        throw new SelfRemoveUserManagerRoleException();
                    }
                    var cntUserManagers = dbContext.DbRoles.Count((r) => r.Name == "usermanager");
                    if (cntUserManagers == 1)
                    {
                        throw new UserManagerRequiredException();
                    }
                }
                user.Roles.Remove(role);
                changed = true;
            }
            if (changed)
            {
                dbContext.SaveChanges();
            }
            return changed;
        }

        public bool UpdateUserStorageQuota(string authenticationToken, long userId, long quota)
        {
            logger.LogDebug("Update storage quota for user ID {userId} to {quota}...", userId, quota);
            if (quota < 2 * 1024 * 1024 || quota > 1000 * 1024 * 1024)
            {
                throw new InvalidStorageQuotaException();
            }
            var adminuser = GetUserFromToken(authenticationToken);
            if (!HasRole(adminuser, "usermanager"))
            {
                throw new AccessDeniedPermissionException();
            }
            var dbContext = GetDbContext();
            var user = dbContext.DbUsers.SingleOrDefault((u) => u.Id == userId);
            if (user != null && user.StorageQuota != quota)
            {
                user.StorageQuota = quota;
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public bool UpdateUserLoginEnabled(string authenticationToken, long userId, bool loginEnabled)
        {
            logger.LogDebug("Update login enabled for user ID {userId} to {loginEnabled}...", userId, loginEnabled);
            var adminuser = GetUserFromToken(authenticationToken);
            if (!HasRole(adminuser, "usermanager"))
            {
                throw new AccessDeniedPermissionException();
            }
            var dbContext = GetDbContext();
            var user = dbContext.DbUsers.SingleOrDefault((u) => u.Id == userId);
            if (user != null && user.LoginEnabled != loginEnabled)
            {
                if (adminuser.Id == user.Id && !loginEnabled)
                {
                    throw new SelfUpdateLoginEnabledException();
                }
                user.LoginEnabled = loginEnabled;
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public int DeleteLoginIpAddresses(string authenticationToken)
        {
            logger.LogDebug("Delete login IP addresses...");
            var user = GetUserFromToken(authenticationToken);
            var dbContext = GetDbContext();
            var loginIpAddresses = dbContext.DbLoginIpAddresses
                .Where(ip => ip.DbUserId == user.Id);
            var ret = loginIpAddresses.Count();
            dbContext.DbLoginIpAddresses.RemoveRange(loginIpAddresses);
            dbContext.SaveChanges();
            return ret;
        }

        public long GetUsedStorage(string authenticationToken, long userId)
        {
            logger.LogDebug("Get used storage for user ID {userId}...", userId);
            var adminuser = GetUserFromToken(authenticationToken);
            if (!HasRole(adminuser, "usermanager"))
            {
                throw new AccessDeniedPermissionException();
            }
            var dbContext = GetDbContext();
            var sum = dbContext.DbDocItems.Where(item => item.Type == DbDocItemType.Item && item.OwnerId == userId).Sum(item => item.Size);
            return sum;
        }

        public List<UserModel> GetUsers(string authenticationToken)
        {
            logger.LogDebug("Get users...");
            var user = GetUserFromToken(authenticationToken);
            if (!HasRole(user, "usermanager"))
            {
                throw new AccessDeniedPermissionException();
            }
            var ret = new List<UserModel>();
            var opt = GetOptions();
            var dbContext = GetDbContext();
            var users = dbContext.DbUsers.Include(u => u.Roles).OrderBy(u => u.Name);
            var userModelMap = new Dictionary<long, UserModel>();
            foreach (var u in users)
            {
                var userModel = new UserModel
                {
                    Id = u.Id,
                    Name = u.Name,
                    Email = u.Email,
                    LastLoginUtc = DbMynaContext.GetUtcDateTime(u.LastLoginTryUtc),
                    RegisteredUtc = DbMynaContext.GetUtcDateTime(u.RegisteredUtc),
                    Photo = u.Photo,
                    StorageQuota = u.StorageQuota,
                    LoginEnabled = u.LoginEnabled,
                    Roles = u.Roles.Select(r => r.Name).ToList()
                };
                userModelMap[u.Id] = userModel;
                ret.Add(userModel);
            }
            var lockedUserIds = dbContext.DbLoginIpAddresses.Where(ip => ip.Failed >= opt.MaxLoginTryCount).Select(ip => ip.DbUserId);
            foreach (var userId in lockedUserIds)
            {
                if (userModelMap.TryGetValue(userId, out var userModel))
                {
                    userModel.AccountLocked = true;
                }
            }
            return ret;
        }

        // --- authentication

        public async Task<AuthenticationResponseModel> AuthenticateAsync(AuthenticationModel authentication, string ipAddress, string locale)
        {
            logger.LogDebug("Authenticate '{username}', locale '{locale}' with client IP address {ipAddress}...", authentication.Username, locale, ipAddress);
            var opt = GetOptions();
            var user = GetDbUserByName(authentication.Username);
            if (user == null)
            {
                throw new InvalidUsernameException();
            }
            if (!user.LoginEnabled)
            {
                throw new AccountLoginDisabledException();
            }
            var dbContext = GetDbContext();
            var loginIpAddress = CheckLoginIpAddress(dbContext, user, ipAddress, opt);
            var hasher = new PasswordHasher<string>();
            hasher.HashPassword(user.Name, authentication.Password);
            if (hasher.VerifyHashedPassword(
                user.Name,
                user.PasswordHash,
                authentication.Password) != PasswordVerificationResult.Success)
            {
                loginIpAddress.Failed += 1;
                dbContext.SaveChanges();
                if (loginIpAddress.Failed >= opt.MaxLoginTryCount)
                {
                    throw new UnauthorizedAndLockedException();
                }
                throw new UnauthorizedException();
            }
            // migration scenario, disable 2FA if TOTPKey is missing
            if (user.Requires2FA && string.IsNullOrEmpty(user.TOTPKey))
            {
                user.Requires2FA = false;
            }
            var token = GenerateToken(user.Name, opt, user.Requires2FA);
            loginIpAddress.Succeeded += 1;
            if (loginIpAddress.Failed > 0)
            {
                loginIpAddress.Failed = 0;
            }
            if (!user.Requires2FA)
            {
                user.LoginTries += 1;
                user.LastLoginTryUtc = DateTime.UtcNow;
            }
            var sendLoginWarning = true;
            if (!string.IsNullOrEmpty(authentication.ClientUUID))
            {
                sendLoginWarning = false;
                var userClient = dbContext.DbUserClients.SingleOrDefault(client => client.DbUserId == user.Id && client.ClientUUID == authentication.ClientUUID);
                if (userClient == null)
                {
                    // send warning only if at least one login from a different client was successfull
                    if (dbContext.DbUserClients.Any(client => client.DbUserId == user.Id))
                    {
                        sendLoginWarning = true;
                    }
                    userClient = new DbUserClient
                    {
                        DbUserId = user.Id,
                        ClientUUID = authentication.ClientUUID,
                        ClientName = authentication.ClientName
                    };
                    dbContext.DbUserClients.Add(userClient);
                }
                userClient.LastLoginIPAddress = ipAddress;
                userClient.LastLoginUTC = DateTime.UtcNow;
            }
            dbContext.SaveChanges();
            var ret = new AuthenticationResponseModel { Token = token, RequiresPass2 = user.Requires2FA };
            if (!user.Requires2FA && user.UseLongLivedToken)
            {
                ret.LongLivedToken = GenerateLongLivedToken(user.Name, opt);
            }
            // send security warning email if the an unknown client has been used to login
            if (sendLoginWarning)
            {
                await SendSecurityWarningEmailAsync(user, ipAddress, opt, GetValidLocale(locale, dbContext, user.Email));
            }
            return ret;
        }

        public AuthenticationResponseModel AuthenticateTOTP(string token, string totp, string ipAddress)
        {
            logger.LogDebug("Authenticate using Time-Based One-Time Password (TOTP) for IP address {ipAddress}...", ipAddress);
            var opt = GetOptions();
            if (!ValidateToken(token, opt)) // verify pass 1
            {
                throw new InvalidTokenException();
            }
            var tokenHandler = new JwtSecurityTokenHandler();
            var securityToken = tokenHandler.ReadToken(token) as JwtSecurityToken;
            var amr = securityToken.Claims.FirstOrDefault(claim => claim.Type == "amr");
            var claim = securityToken.Claims.FirstOrDefault(claim => claim.Type == "unique_name");
            if (claim == null || amr?.Value != "2fa")
            {
                logger.LogDebug("Claim type 'unique_name' not found or not a 2FA token.");
                throw new InvalidTokenException();
            }
            var dbContext = GetDbContext();
            var user = dbContext.DbUsers.SingleOrDefault(u => u.Name == claim.Value);
            if (user == null || string.IsNullOrEmpty(user.TOTPKey))
            {
                logger.LogDebug("User from token not found or TOTP token not configured.");
                throw new InvalidTokenException();
            }
            if (user.LogoutUtc > securityToken.IssuedAt)
            {
                logger.LogDebug("Token is expired.");
                throw new InvalidTokenException();
            }
            var loginIpAddress = CheckLoginIpAddress(dbContext, user, ipAddress, opt);
            if (!TOTP.IsValid(totp, user.TOTPKey, opt.TOTPConfig.ValidSeconds)) // verify pass 2
            {
                logger.LogDebug("Token is not valid anymore.");
                loginIpAddress.Failed += 1;
                if (loginIpAddress.Failed >= opt.MaxLoginTryCount)
                {
                    // invalidate all tokens => logout on all devices
                    user.LogoutUtc = DateTime.UtcNow;
                }
                dbContext.SaveChanges();
                if (loginIpAddress.Failed >= opt.MaxLoginTryCount)
                {
                    throw new InvalidSecurityCodeAndLockedException();
                }
                throw new InvalidSecurityCodeException();
            }
            var ret = new AuthenticationResponseModel
            {
                Token = GenerateToken(user.Name, opt, false),
                RequiresPass2 = true
            };
            if (user.UseLongLivedToken)
            {
                ret.LongLivedToken = GenerateLongLivedToken(user.Name, opt);
            }
            loginIpAddress.Failed = 0;
            user.LoginTries += 1;
            user.LastLoginTryUtc = DateTime.UtcNow;
            dbContext.SaveChanges();
            return ret;
        }

        public AuthenticationResponseModel AuthenticateLongLivedToken(string longLivedToken, string ipAddress)
        {
            logger.LogDebug("Authenticate long lived token for IP address {ipAddress}...", ipAddress);
            var user = GetUserFromToken(longLivedToken, true);
            if (!user.UseLongLivedToken)
            {
                logger.LogDebug("User not configured for long lived token usage.");
                throw new InvalidTokenException();
            }
            var dbContext = GetDbContext();
            var loginIpAddress = dbContext.DbLoginIpAddresses
                .SingleOrDefault(ip => ip.DbUserId == user.Id && ip.IpAddress == ipAddress);
            if (loginIpAddress == null)
            {
                CleanupLoginIpAddress(dbContext, user.Id);
                loginIpAddress = new DbLoginIpAddress { DbUserId = user.Id, IpAddress = ipAddress };
                dbContext.DbLoginIpAddresses.Add(loginIpAddress);
            }
            loginIpAddress.LastUsedUtc = DateTime.UtcNow;
            user.LastLoginTryUtc = loginIpAddress.LastUsedUtc;
            user.LoginTries += 1;
            loginIpAddress.Failed = 0;
            loginIpAddress.Succeeded += 1;
            dbContext.SaveChanges();
            var opt = GetOptions();
            var ret = new AuthenticationResponseModel
            {
                Token = GenerateToken(user.Name, opt, false),
                LongLivedToken = GenerateLongLivedToken(user.Name, opt),
                RequiresPass2 = false,
                Username = user.Name
            };
            return ret;
        }

        public void ChangeUserPassword(string authenticationToken, UserPasswordChangeModel userPassswordChange)
        {
            logger.LogDebug("Change user password...");
            var user = GetUserFromToken(authenticationToken);
            var hasher = new PasswordHasher<string>();
            hasher.HashPassword(user.Name, userPassswordChange.OldPassword);
            if (hasher.VerifyHashedPassword(
                user.Name,
                user.PasswordHash,
                userPassswordChange.OldPassword) != PasswordVerificationResult.Success)
            {
                throw new InvalidOldPasswordException();
            }
            if (userPassswordChange.OldPassword == userPassswordChange.NewPassword)
            {
                throw new PasswordSameAsOldException();
            }
            if (!VerifyPasswordStrength(userPassswordChange.NewPassword))
            {
                throw new ChangedPasswordNotStrongEnoughException();
            }
            var newhash = hasher.HashPassword(user.Name, userPassswordChange.NewPassword);
            user.PasswordHash = newhash;
            user.LogoutUtc = DateTime.UtcNow;
            var dbContext = GetDbContext();
            dbContext.SaveChanges();
        }

        public bool Logout(string authenticationToken)
        {
            logger.LogDebug("Logout user...");
            var opt = GetOptions();
            if (ValidateToken(authenticationToken, opt, false))
            {
                var tokenHandler = new JwtSecurityTokenHandler();
                var securityToken = tokenHandler.ReadToken(authenticationToken) as JwtSecurityToken;
                var claim = securityToken.Claims.FirstOrDefault(claim => claim.Type == "unique_name");
                if (claim != null)
                {
                    var dbContext = GetDbContext();
                    var user = dbContext.DbUsers.SingleOrDefault(u => u.Name == claim.Value);
                    if (user != null)
                    {
                        user.LogoutUtc = DateTime.UtcNow;
                        dbContext.SaveChanges();
                        return true;
                    }
                }
            }
            return false;
        }

        // --- password manager

        public void SavePasswordFile(string authenticationToken, string encodedContent)
        {
            logger.LogDebug("Save password file...");
            var user = GetUserFromToken(authenticationToken);
            var dbContext = GetDbContext();
            if (user.PasswordFileId == null)
            {
                user.PasswordFile = new DbPasswordFile();
            }
            else
            {
                dbContext.Entry(user).Reference(f => f.PasswordFile).Load();
            }
            user.PasswordFile.Content = encodedContent;
            user.PasswordFile.LastWrittenUtc = DateTime.UtcNow;
            dbContext.SaveChanges();
        }

        public string GetPasswordFile(string authenticationToken)
        {
            logger.LogDebug("Get password file...");
            var user = GetUserFromToken(authenticationToken);
            if (user.PasswordFileId == null)
            {
                throw new PasswordFileNotFoundException();
            }
            var dbContext = GetDbContext();
            dbContext.Entry(user).Reference(f => f.PasswordFile).Load();
            return user.PasswordFile.Content;
        }

        // --- locale

        public string GetLocaleUrl(string locale)
        {
            logger.LogDebug("Get locale url for '{locale}'...", locale);
            var languages = GetOptions().Languages;
            if (languages.Count == 0)
            {
                throw new ArgumentException("No languages configured in appsettings.json.");
            }
            var language = locale.ToLowerInvariant();
            var idx = language.IndexOf("-");
            if (idx >= 0)
            {
                language = language.Substring(0, idx);
            }
            if (!languages.Contains(language))
            {
                language = languages[0];
            }
            var filename = $"wwwroot/locale/{language}.json";
            if (!File.Exists(filename))
            {
                throw new ArgumentException($"Language file '{filename}' not found.");
            }
            using var md5 = MD5.Create();
            using var stream = File.OpenRead(filename);
            var hash = md5.ComputeHash(stream);
            var v = BitConverter.ToString(hash).Replace("-", "");
            return $"/locale/{language}.json?v={v}";
        }

        // --- slideshow

        public SlideShowModel GetSlideShow(string authenticationToken)
        {
            logger.LogDebug("Get slideshow...");
            var opt = GetOptions();
            var model = new SlideShowModel { Interval = 10, Pictures = new List<SlideShowPictureModel>() };
            try
            {
                if (!string.IsNullOrEmpty(authenticationToken) && authenticationToken != "undefined")
                {
                    var user = GetUserFromToken(authenticationToken);
                    if (HasRole(user, "family"))
                    {
                        if (!string.IsNullOrEmpty(opt.SlideShowFamilyPhotos) && File.Exists(opt.SlideShowFamilyPhotos))
                        {
                            var familyModel = JsonSerializer.Deserialize<SlideShowModel>(File.ReadAllText(opt.SlideShowFamilyPhotos, Encoding.UTF8));
                            model.Interval = familyModel.Interval;
                            foreach (var pic in familyModel.Pictures)
                            {
                                model.Pictures.Add(pic);
                            }
                        }
                    }
                }
            }
            catch
            {
                logger.LogDebug("Invalid token.");
            }
            if (!string.IsNullOrEmpty(opt.SlideShowPublicPhotos) && File.Exists(opt.SlideShowPublicPhotos))
            {
                var publicModel = JsonSerializer.Deserialize<SlideShowModel>(File.ReadAllText(opt.SlideShowPublicPhotos, Encoding.UTF8));
                model.Interval = publicModel.Interval;
                foreach (var pic in publicModel.Pictures)
                {
                    model.Pictures.Add(pic);
                }
            }
            return model;
        }

        // --- markdown

        public string GetMarkdown(string authenticationToken, string id, string locale)
        {
            logger.LogDebug("Get markdown for id '{id}' and locale '{locale}'...", id, locale);
            var opt = GetOptions();
            if (id == "startpage")
            {
                id = opt.StartPage;
            }
            if (int.TryParse(id, out int documentId))
            {
                return GetMarkdownByDocumentId(authenticationToken, documentId);
            }
            var contentConfig = GetContentById(id, locale, opt.Markdown);
            if (contentConfig != null)
            {
                if (int.TryParse(contentConfig.Content, out int docId))
                {
                    return GetMarkdownByDocumentId(authenticationToken, docId);
                }
                if (contentConfig.Content != null && File.Exists(contentConfig.Content))
                {
                    var render = string.IsNullOrEmpty(contentConfig.Role);
                    if (!render && !string.IsNullOrEmpty(authenticationToken))
                    {
                        try
                        {
                            render = HasRole(GetUserFromToken(authenticationToken), contentConfig.Role);
                        }
                        catch
                        {
                        }
                    }
                    if (render)
                    {
                        var pipeline = new MarkdownPipelineBuilder().UseAdvancedExtensions().Build();
                        var markdown = Markdown.ToHtml(File.ReadAllText(contentConfig.Content), pipeline);
                        return markdown;
                    }
                }
            }
            return "<p>Zugriff verweigert.</p>";
        }

        // --- data deletion

        public bool DeleteDiary(string authenticationToken)
        {
            logger.LogDebug("Delete diary...");
            var user = GetUserFromToken(authenticationToken);
            var dbContext = GetDbContext();
            var delDiaryEntries = dbContext.DbDiaries.Where(item => item.DbUserId == user.Id);
            if (delDiaryEntries.Any())
            {
                dbContext.DbDiaries.RemoveRange(delDiaryEntries);
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public bool DeleteDocuments(string authenticationToken)
        {
            logger.LogDebug("Delete documents...");
            var user = GetUserFromToken(authenticationToken);
            var dbContext = GetDbContext();
            var delDocItems = dbContext.DbDocItems.Where(item => item.OwnerId == user.Id && item.Type != DbDocItemType.Contacts);
            if (delDocItems.Any())
            {
                var delDocContents = new List<DbDocContent>();
                foreach (var item in delDocItems)
                {
                    if (item.ContentId.HasValue)
                    {
                        delDocContents.Add(new DbDocContent { Id = item.ContentId.Value });
                    }
                }
                dbContext.DbDocItems.RemoveRange(delDocItems);
                dbContext.DbDocContents.RemoveRange(delDocContents);
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public bool DeleteNotes(string authenticationToken)
        {
            logger.LogDebug("Delete notes...");
            var user = GetUserFromToken(authenticationToken);
            var dbContext = GetDbContext();
            var delNoteItems = dbContext.DbNotes.Where(item => item.DbUserId == user.Id);
            if (delNoteItems.Any())
            {
                dbContext.DbNotes.RemoveRange(delNoteItems);
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public bool DeletePasswordFile(string authenticationToken)
        {
            logger.LogDebug("Delete password file...");
            var user = GetUserFromToken(authenticationToken);
            if (user.PasswordFileId != null)
            {
                var dbContext = GetDbContext();
                dbContext.Entry(user).Reference(f => f.PasswordFile).Load();
                dbContext.DbPasswordFiles.Remove(user.PasswordFile);
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public bool DeleteUser(string authenticationToken, string username)
        {
            logger.LogDebug("Delete username '{username}'...", username);
            var user = GetUserFromToken(authenticationToken);
            var dbContext = GetDbContext();
            if (user.Name != username)
            {
                if (!HasRole(user, "usermanager"))
                {
                    throw new AccessDeniedPermissionException();
                }
                user = dbContext.DbUsers.SingleOrDefault(u => u.Name == username);
                if (user == null)
                {
                    throw new InvalidUsernameException();
                }
            }
            var usermanagerRole = dbContext.DbRoles.SingleOrDefault((r) => r.DbUserId == user.Id && r.Name == "usermanager");
            if (usermanagerRole != null)
            {
                var cntUserManagers = dbContext.DbRoles.Count((r) => r.Name == "usermanager");
                if (cntUserManagers == 1)
                {
                    throw new UserManagerRequiredException();
                }
            }
            var photoFile = user.Photo;
            if (user.PasswordFileId.HasValue)
            {
                var delpwdfile = new DbPasswordFile { Id = user.PasswordFileId.Value };
                dbContext.DbPasswordFiles.Attach(delpwdfile);
                dbContext.DbPasswordFiles.Remove(delpwdfile);
            }
            var regs = dbContext.DbRegistrations
                .Where(r => r.ConfirmedById == user.Id || r.Email == user.Email);
            dbContext.DbRegistrations.RemoveRange(regs);
            var delResetPasswords = dbContext.DbResetPasswords.Where(r => r.Email == user.Email);
            dbContext.DbResetPasswords.RemoveRange(delResetPasswords);
            var delDocItems = dbContext.DbDocItems.Where(item => item.OwnerId == user.Id);
            var delDocContents = new List<DbDocContent>();
            foreach (var item in delDocItems)
            {
                if (item.ContentId.HasValue)
                {
                    delDocContents.Add(new DbDocContent { Id = item.ContentId.Value });
                }
            }
            dbContext.DbDocItems.RemoveRange(delDocItems);
            dbContext.DbDocContents.RemoveRange(delDocContents);
            dbContext.DbUsers.Remove(user);
            dbContext.SaveChanges();
            // try to delete photo file if user has been successfully deleted
            if (!string.IsNullOrEmpty(photoFile))
            {
                var fname = $"wwwroot/{photoFile}";
                if (File.Exists(fname))
                {
                    File.Delete(fname);
                }
            }
            return true;
        }

        // --- database access

        public DbMynaContext GetDbContext()
        {
            var connectionType = Configuration.GetValue<string>("ConnectionType");
            return connectionType == "Postgres" ? dbPostgresContext : dbSqliteContext;
        }

        // --- private

        private string GetMarkdownByDocumentId(string authenticationToken, int docItemId)
        {
            var dbContext = GetDbContext();
            var docItem = dbContext.DbDocItems.SingleOrDefault(item => item.Type == DbDocItemType.Item && item.Id == docItemId);
            if (docItem != null && docItem.ContentId.HasValue)
            {
                var render = AccessRole.IsEverbody(docItem.AccessRole);
                if (!render &&
                    !string.IsNullOrEmpty(authenticationToken) &&
                    !AccessRole.IsOwner(docItem.AccessRole))
                {
                    try
                    {
                        render = HasRole(GetUserFromToken(authenticationToken), docItem.AccessRole);
                    }
                    catch
                    {
                    }
                }
                if (render)
                {
                    var docContent = dbContext.DbDocContents.SingleOrDefault(c => c.Id == docItem.ContentId.Value);
                    if (docContent != null)
                    {
                        var content = Encoding.UTF8.GetString(docContent.Data);
                        var pipeline = new MarkdownPipelineBuilder().UseAdvancedExtensions().Build();
                        var markdown = Markdown.ToHtml(content, pipeline);
                        return markdown;
                    }
                }
            }
            return "<p>Zugriff verweigert.</p>";
        }

        private DbUser GetDbUserByName(string username)
        {
            username = username.ToLowerInvariant();
            // EF Core 5.0 supports Collate function
            // var user = dbContext.DbUsers.SingleOrDefault(u => EF.Functions.Collate(u.Name, "SQL_Latin1_General_CP1_CI_AS") == username);
            var dbContext = GetDbContext();
            var users = dbContext.DbUsers.ToList();
            foreach (var user in users)
            {
                if (user.Name.Equals(username, StringComparison.InvariantCultureIgnoreCase))
                {
                    return user;
                }
            }
            // try login by email address
            if (username.Contains("@"))
            {
                return dbContext.DbUsers.SingleOrDefault(u => u.Email == username);
            }
            return null;
        }

        private T GetSetting<T>(string key)
        {
            var dbContext = GetDbContext();
            var setting = dbContext.DbSettings.SingleOrDefault((s) => s.Key == key);
            if (setting != null)
            {
                return JsonSerializer.Deserialize<T>(setting.Value);
            }
            return default;
        }

        private void SetSetting<T>(string key, T value)
        {
            var dbContext = GetDbContext();
            var setting = dbContext.DbSettings.SingleOrDefault((s) => s.Key == key);
            var json = JsonSerializer.Serialize(value);
            if (setting == null)
            {
                setting = new DbSetting { Key = key, Value = json };
                dbContext.DbSettings.Add(setting);
            }
            else
            {
                setting.Value = json;
            }
        }

        private bool ValidateToken(string token, PwdManOptions opt, bool useLongLived = false)
        {
            var signKey = useLongLived ? opt.TokenConfig.LongLivedSignKey : opt.TokenConfig.SignKey;
            var securityKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(signKey));
            var tokenHandler = new JwtSecurityTokenHandler();
            try
            {
                var vaildateParams = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidIssuer = opt.TokenConfig.Issuer,
                    ValidAudience = opt.TokenConfig.Audience,
                    IssuerSigningKey = securityKey,
                    ClockSkew = TimeSpan.FromMinutes(1) // 1 minute tolerance for the expiration date
                };
                tokenHandler.ValidateToken(token, vaildateParams, out SecurityToken validatedToken);
            }
            catch
            {
                logger.LogDebug("Invalid token specified.");
                return false;
            }
            return true;
        }

        private DbLoginIpAddress CheckLoginIpAddress(DbMynaContext dbContext, DbUser user, string ipAddress, PwdManOptions opt)
        {
            var loginIpAddress = dbContext.DbLoginIpAddresses
                .SingleOrDefault(ip => ip.DbUserId == user.Id && ip.IpAddress == ipAddress);
            if (loginIpAddress != null && loginIpAddress.Failed >= opt.MaxLoginTryCount)
            {
                var sec = (DateTime.UtcNow - loginIpAddress.LastUsedUtc).TotalSeconds;
                if (sec < opt.AccountLockTime)
                {
                    logger.LogDebug("Account disabled. Too many login tries.");
                    throw new AccountLockedException((opt.AccountLockTime - (int)sec) / 60 + 1);
                }
                loginIpAddress.Failed = 0;
            }
            if (loginIpAddress == null)
            {
                CleanupLoginIpAddress(dbContext, user.Id);
                loginIpAddress = new DbLoginIpAddress { DbUserId = user.Id, IpAddress = ipAddress };
                dbContext.DbLoginIpAddresses.Add(loginIpAddress);
            }
            loginIpAddress.LastUsedUtc = DateTime.UtcNow;
            return loginIpAddress;
        }

        private ContentConfig GetContentById(string id, string locale, List<ContentConfig> contents)
        {
            string language = null;
            if (locale != null)
            {
                var arr = locale.Split('-');
                if (arr.Length > 0)
                {
                    language = arr[0].ToLower();
                }
            }
            var contentConfig = contents.Find((c) => c.Id == id);
            if (contentConfig == null)
            {
                return null;
            }
            var content = contentConfig.Content;
            var role = contentConfig.Role;
            if (contentConfig.Languages?.Count > 0)
            {
                foreach (var c in contentConfig.Languages)
                {
                    if (string.IsNullOrEmpty(c.Language))
                    {
                        content = c.Content; // default
                    }
                    else if (c.Language == language)
                    {
                        content = c.Content;
                        break;
                    }
                }
            }
            return new ContentConfig { Id = id, Content = content, Role = role };
        }

        private string GetEmailTemplateId(string contentId, PwdManOptions opt, string locale = null)
        {
            if (!string.IsNullOrEmpty(opt.SendGridConfig.SenderAddress))
            {
                var contentConfig = GetContentById(contentId, locale, opt.SendGridConfig.Templates);
                if (!string.IsNullOrEmpty(contentConfig?.Content))
                {
                    return contentConfig.Content;
                }
            }
            return "";
        }

        private async Task SendSecurityWarningEmailAsync(DbUser user, string ipAddress, PwdManOptions opt, string locale)
        {
            var templateId = GetEmailTemplateId("TemplateIdSecurityWarning", opt, locale);
            if (templateId.Length > 0)
            {
                var now = DateTime.UtcNow;
                var ci = CultureInfo.CreateSpecificCulture(locale);
                var msg = new SendGridMessage();
                msg.SetFrom(new EmailAddress(opt.SendGridConfig.SenderAddress, opt.SendGridConfig.SenderName));
                msg.AddTo(user.Email, user.Name);
                msg.SetTemplateId(templateId);
                msg.SetTemplateData(new SecurityWarningTemplateData
                {
                    Name = user.Name,
                    Date = now.ToString("d", ci),
                    Time = $"{now.ToString("T", ci)} UTC",
                    IPAddress = ipAddress,
                    Hostname = opt.Hostname,
                    Locale = locale,
                    Next = WebUtility.UrlEncode("/index")
                });
                var response = await sendGridClient.SendEmailAsync(msg);
                if (!response.IsSuccessStatusCode)
                {
                    logger.LogError("Failed to send security warning email: {statusCode}.", response.StatusCode);
                }
            }
        }

        private async Task SendResetPasswordEmailAsync(DbUser user, string code, string email, PwdManOptions opt, string locale)
        {
            var templateId = GetEmailTemplateId("TemplateIdResetPassword", opt, locale);
            if (templateId.Length > 0)
            {
                var msg = new SendGridMessage();
                msg.SetFrom(new EmailAddress(opt.SendGridConfig.SenderAddress, opt.SendGridConfig.SenderName));
                msg.AddTo(user.Email, user.Name);
                msg.SetTemplateId(templateId);
                msg.SetTemplateData(new ResetPasswordTemplateData
                {
                    Name = user.Name,
                    Code = code,
                    Valid = opt.ResetPasswordTokenExpireMinutes,
                    Hostname = opt.Hostname,
                    Email = WebUtility.UrlEncode(email),
                    Locale = locale,
                    Next = WebUtility.UrlEncode("/index")
                });
                var response = await sendGridClient.SendEmailAsync(msg);
                if (!response.IsSuccessStatusCode)
                {
                    logger.LogError("Failed to send reset password email: {statusCode}.", response.StatusCode);
                }
            }
        }

        private async Task SendRegistrationRequestEmailAsync(string email, PwdManOptions opt)
        {
            var templateId = GetEmailTemplateId("TemplateIdRegistrationRequest", opt);
            if (templateId.Length > 0)
            {
                var msg = new SendGridMessage();
                msg.SetFrom(new EmailAddress(opt.SendGridConfig.SenderAddress, opt.SendGridConfig.SenderName));
                msg.AddTo(new EmailAddress(opt.SendGridConfig.SenderAddress, opt.SendGridConfig.SenderName));
                msg.SetTemplateId(templateId);
                msg.SetTemplateData(new RequestRegistrationTemplateData { Email = email });
                var response = await sendGridClient.SendEmailAsync(msg);
                if (!response.IsSuccessStatusCode)
                {
                    logger.LogError("Failed to send registration request email: {statusCode}.", response.StatusCode);
                }
            }
        }

        private async Task SendConfirmationRegistrationEmailAsync(DbRegistration registration, bool reject, string email, PwdManOptions opt, string locale)
        {
            var templateDeniedId = GetEmailTemplateId("TemplateIdRegistrationDenied", opt, locale);
            var templateSuccessId = GetEmailTemplateId("TemplateIdRegistrationSuccess", opt, locale);
            if (templateDeniedId.Length > 0 && templateSuccessId.Length > 0)
            {
                var msg = new SendGridMessage();
                msg.SetFrom(new EmailAddress(opt.SendGridConfig.SenderAddress, opt.SendGridConfig.SenderName));
                msg.AddTo(new EmailAddress(email));
                if (reject)
                {
                    msg.SetTemplateId(templateDeniedId);
                }
                else
                {
                    msg.SetTemplateId(templateSuccessId);
                    msg.SetTemplateData(new ConfirmRegistrationTemplateData
                    {
                        Code = registration.Token,
                        Hostname = opt.Hostname,
                        Email = WebUtility.UrlEncode(email),
                        Locale = locale,
                        Next = WebUtility.UrlEncode("/index")
                    });
                }
                var response = await sendGridClient.SendEmailAsync(msg);
                if (!response.IsSuccessStatusCode)
                {
                    logger.LogError("Failed to send confirmation email for successfull registration: {statusCode}.", response.StatusCode);
                }
            }
        }

        private PwdManOptions GetOptions()
        {
            var opt = Configuration.GetSection("PwdMan").Get<PwdManOptions>();
            return opt ?? new PwdManOptions();
        }

        private string GetValidLocale(string locale, DbMynaContext dbContext = null, string email = null)
        {
            if (locale == null && dbContext != null)
            {
                var registration = dbContext.DbRegistrations.SingleOrDefault((r) => r.Email == email);
                locale = registration?.Locale;
            }
            if (locale != null)
            {
                try
                {
                    CultureInfo.CreateSpecificCulture(locale);
                }
                catch
                {
                    locale = null;
                }
            }
            if (locale == null)
            {
                var languages = GetOptions().Languages;
                if (languages.Count == 0)
                {
                    throw new ArgumentException("No languages configured in appsettings.json.");
                }
                locale = CultureInfo.CreateSpecificCulture(languages[0]).IetfLanguageTag;
            }
            return locale;
        }

        // --- private static

        private static void CleanupLoginIpAddress(DbMynaContext dbContext, long userId)
        {
            var cnt = dbContext.DbLoginIpAddresses.Count(ip => ip.DbUserId == userId);
            if (cnt > 99)
            {
                var cleanup = dbContext.DbLoginIpAddresses.Where(ip => ip.DbUserId == userId).OrderBy(ip => ip.LastUsedUtc).ToList();
                var idx = 0;
                while (cnt > 99 && idx < cleanup.Count)
                {
                    dbContext.DbLoginIpAddresses.Remove(cleanup[idx++]);
                    cnt--;
                }
            }
        }

        private static bool VerifyPasswordStrength(string pwd)
        {
            var pwdGen = new PwdGen();
            if (pwd.Length >= 8)
            {
                var cntSymbols = pwd.Count((c) => pwdGen.Symbols.Contains(c));
                var cntUpper = pwd.Count((c) => pwdGen.UpperCharacters.Contains(c));
                var cntLower = pwd.Count((c) => pwdGen.LowerCharacters.Contains(c));
                var cntDigits = pwd.Count((c) => pwdGen.Digits.Contains(c));
                if (cntSymbols >= 1 && cntUpper >= 1 && cntLower >= 1 && cntDigits >= 1)
                {
                    return true;
                }
            }
            return false;
        }

        private static byte[] EncodeSecret(byte[] salt, string password, byte[] secret)
        {
            var iv = new byte[12];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(iv);
            }
            var key = KeyDerivation.Pbkdf2(password, salt, KeyDerivationPrf.HMACSHA256, 1000, 256 / 8);
            var encoded = new byte[secret.Length];
            var tag = new byte[16];
            using (var cipher = new AesGcm(key))
            {
                cipher.Encrypt(iv, secret, encoded, tag);
            }
            var ret = new byte[iv.Length + encoded.Length + tag.Length];
            iv.CopyTo(ret, 0);
            encoded.CopyTo(ret, iv.Length);
            tag.CopyTo(ret, iv.Length + encoded.Length);
            return ret;
        }

        private static string GenerateToken(string username, PwdManOptions opt, bool requires2FA)
        {
            return GenerateTokenPerType(false, username, opt, requires2FA);
        }

        private static string GenerateLongLivedToken(string username, PwdManOptions opt)
        {
            return GenerateTokenPerType(true, username, opt);
        }

        private static string GenerateTokenPerType(bool useLongLivedToken, string username, PwdManOptions opt, bool requires2FA = false)
        {
            var signKey = useLongLivedToken ? opt.TokenConfig.LongLivedSignKey : opt.TokenConfig.SignKey;
            var securityKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(signKey));
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                NotBefore = DateTime.UtcNow,
                Issuer = opt.TokenConfig.Issuer,
                Audience = opt.TokenConfig.Audience,
                SigningCredentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256Signature)
            };
            if (useLongLivedToken)
            {
                tokenDescriptor.Expires = DateTime.UtcNow.AddDays(60);
            }
            else
            {
                tokenDescriptor.Expires = DateTime.UtcNow.AddMinutes(opt.TokenConfig.ExpireMinutes);
            }
            tokenDescriptor.Claims = new Dictionary<string, object>();
            tokenDescriptor.Claims[ClaimTypes.Name] = username;
            if (requires2FA)
            {
                tokenDescriptor.Claims["amr"] = "2fa";
            }
            var tokenHandler = new JwtSecurityTokenHandler();
            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        private static bool IsValidUsername(string username)
        {
            if (string.IsNullOrEmpty(username))
            {
                return false;
            }
            foreach (var ch in username)
            {
                if (!char.IsLetterOrDigit(ch))
                {
                    return false;
                }
            }
            return true;
        }

        private static bool IsValidEmailAddress(string email)
        {
            if (string.IsNullOrEmpty(email))
            {
                return false;
            }
            var atidx = email.IndexOf("@");
            if (atidx <= 0 || atidx == email.Length - 1)
            {
                return false;
            }
            var dotIdx = -1;
            var test = email[..atidx] + email[(atidx + 1)..];
            var idx = 0;
            foreach (var ch in test)
            {
                if (ch == '.')
                {
                    dotIdx = idx;
                }
                else if (!char.IsLetterOrDigit(ch) && ch != '-')
                {
                    return false;
                }
                idx++;
            }
            if (dotIdx <= atidx || dotIdx == test.Length - 1)
            {
                return false;
            }
            return true;
        }

        private static string ConvertToHexString(byte[] ba)
        {
            var hex = new StringBuilder(ba.Length * 2);
            foreach (byte b in ba)
            {
                hex.AppendFormat("{0:x2}", b);
            }
            return hex.ToString();
        }
    }
}
