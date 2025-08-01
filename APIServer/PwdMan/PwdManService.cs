﻿/*
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
using APIServer.Database;
using APIServer.Document.Model;
using APIServer.PasswordGenerator;
using APIServer.PwdMan.Model;
using Azure;
using Azure.Communication.Email;
using Markdig;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace APIServer.PwdMan
{
    public class PwdManService(
        IConfiguration configuration,
        ILogger<PwdManService> logger,
        DbSqliteContext dbSqliteContext,
        DbPostgresContext dbPostgresContext,
        IMemoryCache memoryCache) : IPwdManService
    {
        public IConfiguration Configuration { get; } = configuration;

        private readonly ILogger logger = logger;

        private readonly DbMynaContext dbSqliteContext = dbSqliteContext;

        private readonly DbPostgresContext dbPostgresContext = dbPostgresContext;

        private readonly IMemoryCache memoryCache = memoryCache;

        // --- reset password

        public async Task RequestResetPasswordAsync(string email, string ipAddress, string locale, string captcha)
        {
            logger.LogDebug("Request password reset for email addresss '{email}' and locale '{locale}' from IP address {ipAddress}.", email, locale, ipAddress);
            var opt = GetOptions();
            await ValidateCaptchaAsync(captcha, opt.FriendlyCaptchaConfig);
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
            var loginIpAddress = CheckLoginIpAddress(dbContext, user, ipAddress, opt);
            var lastRequestedUtc = dbContext.DbResetPasswords.Where((r) => r.IpAddress == ipAddress).Max<DbResetPassword, DateTime?>((r) => r.RequestedUtc);
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

        public async Task<bool> RequestRegistrationAsync(string email, string ipAddress, string locale, string captcha)
        {
            logger.LogDebug("Request registration for email addresss '{email}' and locale '{locale}' from IP address {ipAddress}...", email, locale, ipAddress);
            var opt = GetOptions();
            await ValidateCaptchaAsync(captcha, opt.FriendlyCaptchaConfig);
            if (!IsValidEmailAddress(email))
            {
                throw new InvalidEmailAddressException();
            }
            email = email.ToLowerInvariant();
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
            dbContext.DbRegistrations.Add(new DbRegistration
            {
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
            var adminuser = GetUserFromToken(authenticationToken);
            if (!HasRole(adminuser, "usermanager"))
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
                registration.ConfirmedById = adminuser.Id;
                dbContext.SaveChanges();
            }
            var opt = GetOptions();
            if (confirmation.Notification)
            {
                await SendConfirmationRegistrationEmailAsync(registration, confirmation.Reject, email, opt, GetValidLocale(registration.Locale));
            }
            return registration.Token;
        }

        public UserModel RegisterUser(UserRegistrationModel registrationProfile)
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
            var loginName = registrationProfile.Username.ToLowerInvariant();
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
                LoginName = loginName,
                Salt = pwdgen.Generate(),
                PasswordHash = hash,
                Email = email,
                Requires2FA = false,
                UseLongLivedToken = true,
                PinHash = null,
                AllowResetPassword = true,
                RegisteredUtc = DateTime.UtcNow,
                StorageQuota = 100 * 1024 * 1024, // 100 MB default storage
                LoginEnabled = true
            };
            // first user has the usermanager role
            List<string> roleNames = new();
            if (firstUser)
            {
                user.Roles = new List<DbRole>
                {
                    new DbRole { Name = "usermanager" }
                };
                roleNames.Add("usermanager");
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
            var userModel = new UserModel
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                LastLoginUtc = DbMynaContext.GetUtcDateTime(user.LastLoginTryUtc),
                Requires2FA = user.Requires2FA,
                UseLongLivedToken = user.UseLongLivedToken,
                UsePin = !string.IsNullOrEmpty(user.PinHash),
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
                Roles = roleNames,
                SecKey = GenerateSecKey()
            };
            return userModel;
        }

        // --- user management

        public string GetPhoto(string username)
        {
            logger.LogDebug("Get photo for username '{username}'...", username);
            var user = GetDbUserByName(username);
            if (user != null && user.AllowResetPassword && user.Photo != null)
            {
                return user.Photo;
            }
            return null;
        }

        public bool IsRegisteredUsername(string username)
        {
            logger.LogDebug("Check whether username '{username}' is registered...", username);
            var user = GetDbUserByName(username);
            return user != null && user.AllowResetPassword;
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
            var loginName = claim.Value.ToLowerInvariant();
            var user = dbContext.DbUsers.SingleOrDefault(u => u.LoginName == loginName);
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
                UsePin = !string.IsNullOrEmpty(user.PinHash),
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
                SecKey = user.SecKey
            };
            var dbContext = GetDbContext();
            if (string.IsNullOrEmpty(userModel.SecKey))
            {
                // upgrade on the fly
                user.SecKey = GenerateSecKey();
                dbContext.SaveChanges();
                userModel.SecKey = user.SecKey;
            }
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
            var loginName = username.ToLowerInvariant();
            var user = dbContext.DbUsers.SingleOrDefault(u => u.LoginName == loginName);
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

        public string UpdateUserUseLongLivedToken(string authenticationToken, bool useLongLivedToken)
        {
            logger.LogDebug("Update user long-lived token usage to {useLongLivedToken}...", useLongLivedToken);
            var user = GetUserFromToken(authenticationToken);
            if (user.UseLongLivedToken != useLongLivedToken)
            {
                user.PinHash = null;
                user.UseLongLivedToken = useLongLivedToken;
                var dbContext = GetDbContext();
                dbContext.SaveChanges();
                if (user.UseLongLivedToken)
                {
                    return GenerateLongLivedToken(user.Name, GetOptions());
                }
            }
            return "";
        }

        public bool UpdateUserPin(string authenticationToken, string pin)
        {
            logger.LogDebug("Update user pin...");
            var user = GetUserFromToken(authenticationToken);
            if (!user.UseLongLivedToken)
            {
                logger.LogDebug("User not configured for long lived token usage.");
                throw new InvalidTokenException();
            }
            var dbContext = GetDbContext();
            string pinHash = null;
            if (!string.IsNullOrEmpty(pin))
            {
                var hasher = new PasswordHasher<string>();
                pinHash = hasher.HashPassword(user.Name, pin);
            }
            if (pinHash != user.PinHash)
            {
                user.PinHash = pinHash;
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
                var existingUser = GetDbUserByName(username);
                if (existingUser != null && user.Id != existingUser.Id)
                {
                    throw new UsernameAlreadyUsedException();
                }
                user.Name = username;
                user.LoginName = username.ToLowerInvariant();
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
            var loginName = model.Username.ToLowerInvariant();
            var user = dbContext.DbUsers
                .Include((u) => u.Roles)
                .SingleOrDefault((u) => u.LoginName == loginName);
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
            var verifyResult = hasher.VerifyHashedPassword(user.Name, user.PasswordHash, authentication.Password);
            if (verifyResult == PasswordVerificationResult.Failed)
            {
                loginIpAddress.Failed += 1;
                dbContext.SaveChanges();
                if (loginIpAddress.Failed >= opt.MaxLoginTryCount)
                {
                    throw new UnauthorizedAndLockedException();
                }
                throw new UnauthorizedException();
            }
            else if (verifyResult == PasswordVerificationResult.SuccessRehashNeeded)
            {
                user.PasswordHash = hasher.HashPassword(user.Name, authentication.Password);
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
            string auditAction;
            if (!user.Requires2FA)
            {
                user.LoginTries += 1;
                user.LastLoginTryUtc = DateTime.UtcNow;
                auditAction = "AUDIT_LOGIN_BASIC_1";
            }
            else
            {
                auditAction = "AUDIT_LOGIN_BASIC_2FA_1";
            }
            string auditParam = ipAddress;
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
                auditParam += $" [{userClient.ClientName},{userClient.ClientUUID}]";
            }
            Audit(dbContext, user, auditAction, auditParam);
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
            var loginName = claim.Value.ToLowerInvariant();
            var user = dbContext.DbUsers.SingleOrDefault(u => u.LoginName == loginName);
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
            Audit(dbContext, user, "AUDIT_LOGIN_2FA_1", loginIpAddress.IpAddress);
            dbContext.SaveChanges();
            return ret;
        }

        public AuthenticationResponseModel AuthenticateLongLivedToken(string longLivedToken, string clientUUID, string ipAddress)
        {
            logger.LogDebug("Authenticate long lived token for IP address {ipAddress}...", ipAddress);
            var user = GetUserFromToken(longLivedToken, true);
            if (!user.UseLongLivedToken)
            {
                logger.LogDebug("User not configured for long lived token usage.");
                throw new InvalidTokenException();
            }
            var opt = GetOptions();
            var dbContext = GetDbContext();
            var loginIpAddress = CheckLoginIpAddress(dbContext, user, ipAddress, opt);
            var auditParam = $"{loginIpAddress.IpAddress}";
            if (!string.IsNullOrEmpty(clientUUID))
            {
                var userClient = dbContext.DbUserClients.SingleOrDefault(client => client.DbUserId == user.Id && client.ClientUUID == clientUUID);
                if (userClient != null)
                {
                    auditParam += $" [{userClient.ClientName},{userClient.ClientUUID}]";
                }
            }
            if (!string.IsNullOrEmpty(user.PinHash))
            {
                Audit(dbContext, user, "AUDIT_LOGIN_LLTOKEN_PIN_1", auditParam);
                dbContext.SaveChanges();
                return new AuthenticationResponseModel { RequiresPin = true };
            }
            user.LastLoginTryUtc = loginIpAddress.LastUsedUtc;
            user.LoginTries += 1;
            loginIpAddress.Failed = 0;
            loginIpAddress.Succeeded += 1;
            Audit(dbContext, user, "AUDIT_LOGIN_LLTOKEN_1", auditParam);
            dbContext.SaveChanges();
            var ret = new AuthenticationResponseModel
            {
                Token = GenerateToken(user.Name, opt, false),
                LongLivedToken = GenerateLongLivedToken(user.Name, opt),
                RequiresPass2 = false,
                Username = user.Name
            };
            return ret;
        }

        public AuthenticationResponseModel AuthenticatePin(string longLivedToken, string pin, string ipAddress)
        {
            logger.LogDebug("Authenticate with PIN for IP address {ipAddress}...", ipAddress);
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
            var opt = GetOptions();
            var hasher = new PasswordHasher<string>();
            var verifyResult = hasher.VerifyHashedPassword(user.Name, user.PinHash, pin);
            if (verifyResult == PasswordVerificationResult.Failed)
            {
                bool logout = false;
                loginIpAddress.Failed += 1;
                if (loginIpAddress.Failed >= opt.MaxLoginTryCount)
                {
                    // invalidate all tokens => logout on all devices
                    user.LogoutUtc = DateTime.UtcNow;
                    loginIpAddress.Failed = 0;
                    logout = true;
                }
                dbContext.SaveChanges();
                if (logout)
                {
                    throw new InvalidPinLogoutException();
                }
                throw new InvalidPinException();
            }
            else if (verifyResult == PasswordVerificationResult.SuccessRehashNeeded)
            {
                user.PinHash = hasher.HashPassword(user.Name, pin);
            }
            loginIpAddress.LastUsedUtc = DateTime.UtcNow;
            user.LastLoginTryUtc = loginIpAddress.LastUsedUtc;
            user.LoginTries += 1;
            loginIpAddress.Failed = 0;
            loginIpAddress.Succeeded += 1;
            Audit(dbContext, user, "AUDIT_LOGIN_PIN_1", loginIpAddress.IpAddress);
            dbContext.SaveChanges();
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
            var verifyResult = hasher.VerifyHashedPassword(user.Name, user.PasswordHash, userPassswordChange.OldPassword);
            if (verifyResult == PasswordVerificationResult.Failed)
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
            user.PasswordHash = hasher.HashPassword(user.Name, userPassswordChange.NewPassword);
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
                    var loginName = claim.Value.ToLowerInvariant();
                    var user = dbContext.DbUsers.SingleOrDefault(u => u.LoginName == loginName);
                    if (user != null)
                    {
                        user.LogoutUtc = DateTime.UtcNow;
                        Audit(dbContext, user, "AUDIT_LOGOUT");
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
            string cacheKey = $"locale-{language}";
            if (memoryCache.TryGetValue(cacheKey, out string cachedUrl))
            {
                logger.LogDebug("Locale url returned from memory cache.");
                return cachedUrl;
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
            string url = $"/locale/{language}.json?v={v}";
            var options = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(TimeSpan.FromHours(24))
                .SetSlidingExpiration(TimeSpan.FromHours(1));
            memoryCache.Set(cacheKey, url, options);
            logger.LogDebug("Locale url added to memory cache.");
            return url;
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

        // --- photo frame URLs

        public List<string> GetPhotoFrameUrls(string authenticationToken)
        {
            logger.LogDebug("Get photo frame URLs...");
            List<string> urls = new();
            var opt = GetOptions();
            try
            {
                if (!string.IsNullOrEmpty(authenticationToken) && authenticationToken != "undefined")
                {
                    bool isFamily = authenticationToken == opt.FamilyAccessToken;
                    if (!isFamily)
                    {
                        var user = GetUserFromToken(authenticationToken);
                        isFamily = HasRole(user, "family");
                    }
                    if (isFamily)
                    {
                        if (!string.IsNullOrEmpty(opt.PhotoFrameFamilyUrls) && File.Exists(opt.PhotoFrameFamilyUrls))
                        {
                            var familyUrls = JsonSerializer.Deserialize<List<string>>(File.ReadAllText(opt.PhotoFrameFamilyUrls, Encoding.UTF8));
                            if (familyUrls != null)
                            {
                                urls.AddRange(familyUrls);
                            }
                        }
                    }
                }
            }
            catch
            {
                logger.LogDebug("Invalid token.");
            }
            if (!string.IsNullOrEmpty(opt.PhotoFramePublicUrls) && File.Exists(opt.PhotoFramePublicUrls))
            {
                var publicUrls = JsonSerializer.Deserialize<List<string>>(File.ReadAllText(opt.PhotoFramePublicUrls, Encoding.UTF8));
                if (publicUrls != null)
                {
                    urls.AddRange(publicUrls);
                }
            }
            return urls;
        }

        public string GetFamilyAccessToken(string authenticationToken)
        {
            logger.LogDebug("Get family access token...");
            var user = GetUserFromToken(authenticationToken);
            if (HasRole(user, "family"))
            {
                var opt = GetOptions();
                return opt.FamilyAccessToken;
            }
            return null;
        }

        // --- markdown

        public string GetMarkdown(string authenticationToken, string host, string id, string locale)
        {
            logger.LogDebug("Get markdown for id '{id}' and locale '{locale}'...", id, locale);
            var opt = GetOptions();
            if (id == "startpage")
            {
                id = GetStartPage(host);
            }
            if (int.TryParse(id, out int documentId))
            {
                return GetMarkdownByDocumentId(authenticationToken, documentId, locale);
            }
            var contentConfig = GetContentById(id, locale, opt.Markdown);
            if (contentConfig != null)
            {
                if (int.TryParse(contentConfig.Content, out int docId))
                {
                    return GetMarkdownByDocumentId(authenticationToken, docId, locale);
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
            return $"<p>{GetAccessDeniedMessage(locale)}.</p>";
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
            var loginName = username.ToLowerInvariant();
            if (user.LoginName != loginName)
            {
                if (!HasRole(user, "usermanager"))
                {
                    throw new AccessDeniedPermissionException();
                }
                user = dbContext.DbUsers.SingleOrDefault(u => u.LoginName == loginName);
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

        // --- audit

        public List<AuditModel> GetAudit(string authenticationToken, int maxResults, DateTime? beforeUtc)
        {
            logger.LogDebug("Get {maxResults} audit items before {beforeUtc}...", maxResults, beforeUtc);
            var ret = new List<AuditModel>();
            var user = GetUserFromToken(authenticationToken);
            var dbContext = GetDbContext();
            Func<DbAudit, bool> where;
            if (!beforeUtc.HasValue)
            {
                where = a => a.DbUserId == user.Id;
            }
            else
            {
                where = a => a.DbUserId == user.Id && a.PerformedUtc < beforeUtc;
            }
            var auditItems = dbContext.DbAuditItems
                .Where(where)
                .OrderByDescending(a => a.PerformedUtc)
                .ThenByDescending(a => a.Id)
                .Take(maxResults);
            foreach (var auditItem in auditItems)
            {
                ret.Add(new AuditModel { PerformedUtc = auditItem.PerformedUtc, Action = auditItem.Action });
            }
            return ret;
        }

        // --- database access

        public DbMynaContext GetDbContext()
        {
            var connectionType = Configuration.GetValue<string>("ConnectionType");
            return connectionType == "Postgres" ? dbPostgresContext : dbSqliteContext;
        }

        // --- private

        private string GetMarkdownByDocumentId(string authenticationToken, int docItemId, string locale)
        {
            string cacheKey = $"markdown-{docItemId}";
            if (memoryCache.TryGetValue(cacheKey, out string cachedMarkdown))
            {
                logger.LogDebug("Markdown returned from memory cache.");
                return cachedMarkdown;
            }
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
                        if (AccessRole.IsEverbody(docItem.AccessRole))
                        {
                            var options = new MemoryCacheEntryOptions()
                                .SetAbsoluteExpiration(TimeSpan.FromHours(24))
                                .SetSlidingExpiration(TimeSpan.FromHours(1));
                            memoryCache.Set(cacheKey, markdown, options);
                            logger.LogDebug("Markdown added to memory cache.");
                        }
                        return markdown;
                    }
                }
            }
            return $"<p>{GetAccessDeniedMessage(locale)}.</p>";
        }

        private static string GetAccessDeniedMessage(string locale)
        {
            return locale != null && locale.StartsWith("de-") ? "Zugriff verweigert" : "Access denied";
        }

        private DbUser GetDbUserByName(string username)
        {
            var loginName = username.ToLowerInvariant();
            var dbContext = GetDbContext();
            DbUser ret = null;
            if (loginName.Contains('@'))
            {
                // login by email address restricted
                var user = dbContext.DbUsers.SingleOrDefault(u => u.Email == loginName);
                if (user != null && user.AllowResetPassword)
                {
                    ret = user;
                }
            }
            else
            {
                ret = dbContext.DbUsers.SingleOrDefault(u => u.LoginName == loginName);
            }
            return ret;
        }

        private bool ValidateToken(string token, PwdManOptions opt, bool useLongLived = false)
        {
            var signKey = useLongLived ? opt.TokenConfig.LongLivedSignKey : opt.TokenConfig.SignKey;
            var securityKey = GetSymmetricSecurityKey(signKey);
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

        private static ContentConfig GetContentById(string id, string locale, List<ContentConfig> contents)
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

        private static EmailTemplateConfig GetEmailTemplateConfig(string contentId, PwdManOptions opt, string locale = null)
        {
            if (!string.IsNullOrEmpty(opt.EmailServiceConfig.SenderAddress))
            {
                ContentConfig contentConfig = GetContentById(contentId, locale, opt.EmailServiceConfig.Templates);
                if (!string.IsNullOrEmpty(contentConfig?.Content))
                {
                    string json = File.ReadAllText(contentConfig.Content);
                    return JsonSerializer.Deserialize<EmailTemplateConfig>(json);
                }
            }
            return null;
        }

        private async Task SendEmail(string subject, string recipient, string plainText, PwdManOptions opt)
        {
            EmailClient emailClient = new(opt.EmailServiceConfig.ConnectionString);
            EmailContent emailContent = new(subject)
            {
                PlainText = plainText
            };
            EmailMessage emailMessage = new(opt.EmailServiceConfig.SenderAddress, recipient, emailContent);
            try
            {
                _ = await emailClient.SendAsync(WaitUntil.Started, emailMessage);
            }
            catch (Exception ex)
            {
                logger.LogError("Failed to send email '{subject}' to {recipient}: {msg}.", subject, recipient, ex.Message);
            }
        }

        private async Task SendSecurityWarningEmailAsync(DbUser user, string ipAddress, PwdManOptions opt, string locale)
        {
            EmailTemplateConfig securityConfig = GetEmailTemplateConfig("TemplateIdSecurityWarning", opt, locale);
            if (securityConfig != null)
            {
                DateTime now = DateTime.UtcNow;
                CultureInfo ci = CultureInfo.CreateSpecificCulture(locale);
                string plainText = securityConfig.PlainText
                    .Replace("{{Name}}", user.Name)
                    .Replace("{{Date}}", now.ToString("d", ci))
                    .Replace("{{Time}}", $"{now.ToString("T", ci)} UTC")
                    .Replace("{{IPAddress}}", ipAddress);
                await SendEmail(securityConfig.Subject, user.Email, plainText, opt);
            }
        }

        private async Task SendResetPasswordEmailAsync(DbUser user, string code, string email, PwdManOptions opt, string locale)
        {
            EmailTemplateConfig resetPasswordConfig = GetEmailTemplateConfig("TemplateIdResetPassword", opt, locale);
            if (resetPasswordConfig != null)
            {
                string plainText = resetPasswordConfig.PlainText
                    .Replace("{{Name}}", user.Name)
                    .Replace("{{Code}}", code)
                    .Replace("{{Valid}}", opt.ResetPasswordTokenExpireMinutes.ToString());
                await SendEmail(resetPasswordConfig.Subject, email, plainText, opt);
            }
        }

        private async Task SendRegistrationRequestEmailAsync(string email, PwdManOptions opt)
        {
            EmailTemplateConfig registrationConfig = GetEmailTemplateConfig("TemplateIdRegistrationRequest", opt);
            if (registrationConfig != null)
            {
                string plainText = registrationConfig.PlainText.Replace("{{Email}}", email);
                await SendEmail(registrationConfig.Subject, opt.EmailServiceConfig.AdminRecipientAddress, plainText, opt);
            }
        }

        private async Task SendConfirmationRegistrationEmailAsync(DbRegistration registration, bool reject, string email, PwdManOptions opt, string locale)
        {
            if (reject)
            {
                EmailTemplateConfig deniedConfig = GetEmailTemplateConfig("TemplateIdRegistrationDenied", opt, locale);
                if (deniedConfig != null)
                {
                    await SendEmail(deniedConfig.Subject, email, deniedConfig.PlainText, opt);
                }
            }
            else
            {
                EmailTemplateConfig successConfig = GetEmailTemplateConfig("TemplateIdRegistrationSuccess", opt, locale);
                if (successConfig != null)
                {
                    string plainText = successConfig.PlainText.Replace("{{Code}}", registration.Token);
                    await SendEmail(successConfig.Subject, email, plainText, opt);
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

        private string GetStartPage(string host)
        {
            string startPage = GetOptions().StartPage;
            if (host != null && GetOptions().StartPagePerHost != null)
            {
                foreach (var cfg in GetOptions().StartPagePerHost)
                {
                    if (host.Contains(cfg.Host, StringComparison.OrdinalIgnoreCase))
                    {
                        startPage = cfg.StartPage;
                        break;
                    }
                }
            }
            return startPage;
        }

        private async Task ValidateCaptchaAsync(string captcha, FriendlyCaptchaConfig config)
        {
            if (config.APIKey == null || config.SiteKey == null || config.VerifyURI == null)
            {
                logger.LogDebug("Friendly captcha is not configured.");
                return;
            }
            HttpClient client = new();
            CaptchaValidationPayload payload = new()
            {
                Response = captcha,
                Sitekey = config.SiteKey
            };
            client.DefaultRequestHeaders.Add("X-API-Key", config.APIKey);
            try
            {
                HttpResponseMessage response = await client.PostAsJsonAsync(config.VerifyURI, payload);
                response.EnsureSuccessStatusCode();
                CaptchaValidationResponse captchaResponse = await response.Content.ReadFromJsonAsync<CaptchaValidationResponse>();
                if (!captchaResponse.Success)
                {
                    throw new AccessDeniedPermissionException();
                }
            }
            catch (HttpRequestException ex)
            {
                // ignore failures if captcha server is not reachable
                logger.LogWarning("Failed to verify captcha: {msg}", ex.Message);
            }
        }

        private class CaptchaValidationPayload
        {
            [JsonPropertyName("response")]
            public string Response { get; set; }
            [JsonPropertyName("sitekey")]
            public string Sitekey { get; set; }
        }

        private class CaptchaValidationResponse
        {
            [JsonPropertyName("success")]
            public bool Success { get; set; }
        }

        // --- private static

        private static void Audit(DbMynaContext dbContext, DbUser user, string action, params string[] actionParams)
        {
            if (actionParams.Any())
            {
                foreach (var param in actionParams)
                {
                    var p = param.Replace(@"\", @"\\").Replace(":", @"\;");
                    action += $":{p}";
                }
            }
            dbContext.DbAuditItems.Add(new DbAudit { DbUserId = user.Id, PerformedUtc = DateTime.UtcNow, Action = action });
        }

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

        private static string GenerateToken(string username, PwdManOptions opt, bool requires2FA)
        {
            return GenerateTokenPerType(false, username, opt, requires2FA);
        }

        private static string GenerateLongLivedToken(string username, PwdManOptions opt)
        {
            return GenerateTokenPerType(true, username, opt);
        }

        private static SymmetricSecurityKey GetSymmetricSecurityKey(string signKey)
        {
            // using HmacSha256Signature => 32 bytes key length required since .net 8
            byte[] signKeyBytes = Encoding.ASCII.GetBytes(signKey);
            // see workaround https://github.com/dotnet/aspnetcore/issues/52369#issuecomment-1872286954
            // to avoid invalid JSON web tokens on upgrade
            if (signKeyBytes.Length < 32)
            {
                var newKey = new byte[32]; // zeros by default
                signKeyBytes.CopyTo(newKey, 0);
                return new SymmetricSecurityKey(newKey);
            }
            return new SymmetricSecurityKey(signKeyBytes);
        }

        private static string GenerateTokenPerType(bool useLongLivedToken, string username, PwdManOptions opt, bool requires2FA = false)
        {
            var signKey = useLongLivedToken ? opt.TokenConfig.LongLivedSignKey : opt.TokenConfig.SignKey;
            if (string.IsNullOrEmpty(signKey)) throw new ArgumentException("Token signing key configuration is missing.");
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                NotBefore = DateTime.UtcNow,
                Issuer = opt.TokenConfig.Issuer,
                Audience = opt.TokenConfig.Audience,
                SigningCredentials = new SigningCredentials(GetSymmetricSecurityKey(signKey), SecurityAlgorithms.HmacSha256Signature)
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

        private static string GenerateSecKey()
        {
            return Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        }
    }
}
