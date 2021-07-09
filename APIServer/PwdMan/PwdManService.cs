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
using APIServer.Document.Model;
using APIServer.Email;
using APIServer.PasswordGenerator;
using APIServer.PwdMan.Model;
using Markdig;
using Microsoft.AspNetCore.Cryptography.KeyDerivation;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace APIServer.PwdMan
{
    public class PwdManService : IPwdManService
    {
        public IConfiguration Configuration { get; }

        private readonly ILogger logger;

        private readonly DbMynaContext dbSqliteContext;

        private readonly DbPostgresContext dbPostgresContext;

        private readonly INotificationService notificationService;

        public PwdManService(
            IConfiguration configuration,
            ILogger<PwdManService> logger,
            DbSqliteContext dbSqliteContext,
            DbPostgresContext dbPostgresContext,
            INotificationService notificationService)
        {
            Configuration = configuration;
            this.logger = logger;
            this.dbSqliteContext = dbSqliteContext;
            this.dbPostgresContext = dbPostgresContext;
            this.notificationService = notificationService;
        }

        // --- reset password

        public void RequestResetPassword(string email, string ipAddress)
        {
            logger.LogDebug("Request password reset for email addresss '{email}' from IP address {ipAddress}.", email, ipAddress);
            if (!IsValidEmailAddress(email)) throw new PwdManInvalidArgumentException("E-Mail-Adresse ungültig.");
            email = email.ToLowerInvariant();
            var dbContext = GetDbContext();
            var user = dbContext.DbUsers.SingleOrDefault((u) => u.Email == email);
            if (user == null)
            {
                throw new PwdManInvalidArgumentException("Die E-Mail-Adresse ist ungültig.");
            }
            if (!user.AllowResetPassword)
            {
                throw new PwdManInvalidArgumentException("Kennwort zurücksetzen ist nicht erlaubt.");
            }
            var opt = GetOptions();
            if (user.LoginTries >= opt.MaxLoginTryCount)
            {
                var sec = (DateTime.UtcNow - user.LastLoginTryUtc.Value).TotalSeconds;
                if (sec < opt.AccountLockTime)
                {
                    throw new AccountLockedException((opt.AccountLockTime - (int)sec) / 60 + 1);
                }
            }
            var lastRequestedUtc = dbContext.DbResetPasswords.Where((r) => r.IpAddress == ipAddress).Max<DbResetPassword,DateTime?>((r) => r.RequestedUtc);
            if (lastRequestedUtc != null)
            {
                int min = Convert.ToInt32((DateTime.UtcNow - lastRequestedUtc.Value).TotalMinutes);
                if (min < 5)
                {
                    throw new PwdManInvalidArgumentException($"Kennwort zurücksetzen ist z.Zt. nicht möglich. Versuche es in {5 - min} Minuten noch einmal.");
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
            string subject = $"Myna Portal Kennwort zurücksetzen";
            string body = $"Hallo {user.Name}!\n\n{resetpwd.Token} ist Dein Sicherheitscode. Er ist 5 Minuten gültig.\n\n" +
                "Du kannst jetzt Dein Kennwort neu vergeben.\n\n\n\n";
            if (!string.IsNullOrEmpty(opt.Hostname))
            {
                body += $"https://{opt.Hostname}/pwdman?resetcode={resetpwd.Token}" +
                    $"&email={WebUtility.UrlEncode(email)}" +
                    $"&nexturl={WebUtility.UrlEncode(@"\index")}\n\n\n\n";
            }
            body += "Viele Grüsse!";
            notificationService.Send(email, subject, body);
        }

        public void ResetPassword(UserResetPasswordModel resetPasswordModel)
        {
            logger.LogDebug("Reset password for email addresss '{email}'.", resetPasswordModel.Email);
            var email = resetPasswordModel.Email.ToLowerInvariant();
            var dbContext = GetDbContext();
            var user = dbContext.DbUsers.SingleOrDefault((u) => u.Email == email);
            var resetpwd = dbContext.DbResetPasswords.SingleOrDefault((r) => r.Email == email);
            if (user == null || resetpwd == null || !user.AllowResetPassword)
            {
                throw new PwdManInvalidArgumentException("Kennwort zurücksetzen ist nicht erlaubt.");
            }
            if (resetpwd.Token != resetPasswordModel.Token)
            {
                throw new PwdManInvalidArgumentException("Der Sicherheitscode ist ungültig.");
            }
            var diff = (DateTime.UtcNow - resetpwd.RequestedUtc).TotalMinutes;
            if (diff > 5)
            {
                throw new PwdManInvalidArgumentException("Der Sicherheitscode ist abgelaufen.");
            }
            if (!VerifyPasswordStrength(resetPasswordModel.Password))
            {
                throw new PasswordNotStrongEnoughException();
            }
            var hasher = new PasswordHasher<string>();
            var hash = hasher.HashPassword(user.Name, resetPasswordModel.Password);
            user.PasswordHash = hash;
            dbContext.DbResetPasswords.Remove(resetpwd);
            dbContext.SaveChanges();
        }

        // --- registration

        public bool IsRegisterAllowed(string email, string ipAddress)
        {
            logger.LogDebug("Check whether email addresss '{email}' is allowed to register from IP address {ipAddress}...", email, ipAddress);
            if (!IsValidEmailAddress(email)) throw new PwdManInvalidArgumentException("E-Mail-Adresse ungültig.");
            email = email.ToLowerInvariant();
            var opt = GetOptions();
            if (string.IsNullOrEmpty(opt.RegistrationEmail))
            {
                throw new PwdManInvalidArgumentException("Registrieren ist deaktiviert.");
            }
            // setup: first user can register without confirmation and token
            var dbContext = GetDbContext();
            if (dbContext.DbUsers.Count() == 0)
            {
                return true;
            }
            var user = dbContext.DbUsers.SingleOrDefault(u => u.Email == email);
            bool userEmailExists = user != null;
            if (userEmailExists)
            {
                throw new PwdManInvalidArgumentException("Die E-Mail-Adresse wurde bereits registriert.");
            }
            var registration = dbContext.DbRegistrations.SingleOrDefault((r) => r.Email == email);
            if (registration != null)
            {
                if (string.IsNullOrEmpty(registration.Token))
                {
                    throw new PwdManInvalidArgumentException("Die E-Mail-Adresse wurde bisher nicht bestätigt.");
                }
                return true;
            }
            var lastRequestedUtc = dbContext.DbRegistrations.Where((r) => r.IpAddress == ipAddress).Max((r) => r.RequestedUtc);
            if (lastRequestedUtc != null)
            {
                int min = Convert.ToInt32((DateTime.UtcNow - lastRequestedUtc.Value).TotalMinutes);
                if (min < 5)
                {
                    throw new PwdManInvalidArgumentException($"Registrieren ist z.Zt. nicht möglich. Versuche es in {5-min} Minuten noch einmal.");
                }
            }
            dbContext.DbRegistrations.Add(new DbRegistration { Email = email, RequestedUtc = DateTime.UtcNow, IpAddress = ipAddress });
            dbContext.SaveChanges();
            var subject = "Myna Portal Registrierungsanfrage";
            var body = $"Ein Benutzer möchte sich mit folgender E-Mail-Adresse registrieren:\n\n{email}.";
            notificationService.Send(opt.RegistrationEmail, subject, body);
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

        public string ConfirmRegistration(string authenticationToken, OutstandingRegistrationModel confirmation)
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
                throw new PwdManInvalidArgumentException("Die E-Mail-Adresse wurde schon registriert.");
            }
            var registration = dbContext.DbRegistrations.SingleOrDefault((r) => r.Email == email);
            if (registration == null)
            {
                throw new PwdManInvalidArgumentException("Es liegt keine Registrierungsanfrage für die E-Mail-Adresse vor.");
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
            if (confirmation.Notification)
            {
                string subject;
                string body;
                if (confirmation.Reject)
                {
                    subject = $"Myna Portal Registrierung";
                    body = $"Hallo!\n\n" +
                        "Deine E-Mail-Adresse konnten nicht verifiziert werden. Die Registrierung wurde abgelehnt.\n\n" +
                        "Verwende eine E-Mail-Adresse, die mir bekannt ist oder kontaktiere mich auf anderem Wege.\n\n\n\n" +
                        "Viele Grüsse!";
                }
                else
                {
                    subject = $"Myna Portal Registrierung";
                    body = $"Hallo!\n\n{registration.Token} ist Dein Registrierungscode.\n\n" +
                        "Deine E-Mail-Adresse wurde jetzt freigeschaltet und Du kannst Dich auf dem Portal registrieren.\n\n\n\n";
                    var opt = GetOptions();
                    if (!string.IsNullOrEmpty(opt.Hostname))
                    {                        
                        body += $"https://{opt.Hostname}/pwdman?confirm={registration.Token}" +
                            $"&email={WebUtility.UrlEncode(email)}" +
                            $"&nexturl={WebUtility.UrlEncode(@"\index")}\n\n\n\n";
                    }
                    body += "Viele Grüsse!";
                }
                notificationService.Send(email, subject, body);
            }
            return registration.Token;
        }

        public void RegisterUser(UserRegistrationModel registrationProfile)
        {
            logger.LogDebug("Register user '{username}', email '{email}'...", registrationProfile.Username, registrationProfile.Email);
            if (!IsValidUsername(registrationProfile.Username)) throw new PwdManInvalidArgumentException("Benutzername ungültig.");
            if (!IsValidEmailAddress(registrationProfile.Email)) throw new PwdManInvalidArgumentException("E-Mail-Adresse ungültig.");
            if (string.IsNullOrEmpty(registrationProfile.Token)) throw new PwdManInvalidArgumentException("Registrierungscode ist ungültig.");
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
                    throw new PwdManInvalidArgumentException("Der Registrierungscode ist ungültig.");
                }
                var exsitingUser = GetDbUserByName(registrationProfile.Username);
                if (exsitingUser != null)
                {
                    throw new PwdManInvalidArgumentException("Der Benutzername wird schon verwendet.");
                }
                exsitingUser = dbContext.DbUsers.SingleOrDefault(u => u.Email == email);
                if (exsitingUser != null)
                {
                    throw new PwdManInvalidArgumentException("Die E-Mail-Adresse wurde schon registriert.");
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
                Requires2FA = registrationProfile.Requires2FA,
                UseLongLivedToken = registrationProfile.UseLongLivedToken,
                AllowResetPassword = registrationProfile.AllowResetPassword,
                RegisteredUtc = DateTime.UtcNow,
                StorageQuota = 100 * 1024 * 1024 // 100 MB default storage
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
            if (!string.IsNullOrEmpty(user.Photo))
            {
                var fname = $"wwwroot/{user.Photo}";
                if (File.Exists(fname))
                {
                    File.Delete(fname);
                }
            }
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
            }
            var dbContext = GetDbContext();
            dbContext.SaveChanges();
            return true;
        }

        public DbUser GetUserFromToken(string authenticationToken, bool useLongLivedToken = false)
        {
            var opt = GetOptions();
            if (ValidateToken(authenticationToken, opt, useLongLivedToken))
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
                        if (user.LogoutUtc > securityToken.IssuedAt)
                        {
                            throw new InvalidTokenException();
                        }
                        if (!useLongLivedToken && user.Requires2FA)
                        {
                            var amr = securityToken.Claims.FirstOrDefault(claim => claim.Type == "amr");
                            if (amr != null) throw new Requires2FAException();
                        }
                        return user;
                    }
                }
                logger.LogDebug("Claim type 'unique_name' not found.");
            }
            throw new InvalidTokenException();
        }

        public bool HasRole(DbUser user, string roleName)
        {
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
            logger.LogDebug("Get user...");
            var user = GetUserFromToken(authenticationToken);
            var userModel = new UserModel
            {
                Name = user.Name,
                Email = user.Email,
                LastLoginUtc = DbMynaContext.GetUtcDateTime(user.LastLoginTryUtc),
                Requires2FA = user.Requires2FA,
                UseLongLivedToken = user.UseLongLivedToken,
                AllowResetPassword = user.AllowResetPassword,
                RegisteredUtc = DbMynaContext.GetUtcDateTime(user.RegisteredUtc),
                HasPasswordManagerFile = user.PasswordFileId != null,
                PasswordManagerSalt = user.Salt,
                Photo = user.Photo,
                StorageQuota = user.StorageQuota                
            };
            var dbContext = GetDbContext();
            userModel.Roles = dbContext.DbRoles.Where(r => r.DbUserId == user.Id).Select(r => r.Name).ToList();
            userModel.LoginIpAddresses = new List<LoginIpAddressModel>();
            if (details)
            {
                var loginIpAddresses = dbContext.DbLoginIpAddresses
                    .Where(ip => ip.DbUserId == user.Id)
                    .OrderByDescending(ip => ip.LastUsedUtc);
                foreach (var ip in loginIpAddresses)
                {
                    userModel.LoginIpAddresses.Add(new LoginIpAddressModel
                    {
                        IpAddress = ip.IpAddress,
                        LastUsedUtc = DbMynaContext.GetUtcDateTime(ip.LastUsedUtc).Value,
                        Succeeded = ip.Succeeded,
                        Failed = ip.Failed
                    });
                }
                var sum = dbContext.DbDocItems.Where(item => item.Type == DbDocItemType.Item && item.OwnerId == user.Id).Sum(item => item.Size);
                userModel.UsedStorage = sum;
            }
            return userModel;
        }

        public bool UnlockUser(string authenticationToken, string userName)
        {
            logger.LogDebug($"Unlock username '{userName}'...");
            var adminuser = GetUserFromToken(authenticationToken);
            if (!HasRole(adminuser, "usermanager"))
            {
                throw new AccessDeniedPermissionException();
            }
            var opt = GetOptions();
            var dbContext = GetDbContext();
            var user = dbContext.DbUsers.SingleOrDefault(u => u.Name == userName);
            if (user != null && user.LoginTries >= opt.MaxLoginTryCount)
            {
                var sec = (DateTime.UtcNow - user.LastLoginTryUtc.Value).TotalSeconds;
                if (sec < opt.AccountLockTime)
                {
                    user.LoginTries = 0;
                    dbContext.SaveChanges();
                    return true;
                }
            }
            return false;
        }

        public bool DeleteUser(string authenticationToken, string userName)
        {
            logger.LogDebug($"Delete username '{userName}'...");
            var user = GetUserFromToken(authenticationToken);
            var dbContext = GetDbContext();
            if (user.Name != userName)
            {
                if (!HasRole(user, "usermanager"))
                {
                    throw new AccessDeniedPermissionException();
                }
                user = dbContext.DbUsers.SingleOrDefault(u => u.Name == userName);
                if (user == null)
                {
                    return false;
                }
            }
            var usermanagerRole = dbContext.DbRoles.SingleOrDefault((r) => r.DbUserId == user.Id && r.Name == "usermanager");
            if (usermanagerRole != null)
            {
                var cntUserManagers = dbContext.DbRoles.Count((r) => r.Name == "usermanager");
                if (cntUserManagers == 1)
                {
                    throw new PwdManInvalidArgumentException("Es muss mindestens ein Benutzer mit der Rolle 'usermanager' vorhanden sein.");
                }
            }
            if (user.PasswordFileId.HasValue)
            {
                var delpwdfile = new DbPasswordFile { Id = user.PasswordFileId.Value };
                dbContext.DbPasswordFiles.Attach(delpwdfile);
                dbContext.DbPasswordFiles.Remove(delpwdfile);
            }
            var regs = dbContext.DbRegistrations
                .Where(r => r.ConfirmedById == user.Id || r.Email == user.Email);
            dbContext.DbRegistrations.RemoveRange(regs);
            dbContext.DbUsers.Remove(user);
            dbContext.SaveChanges();
            return true;
        }

        public bool UpdateUser2FA(string authenticationToken, bool requires2FA)
        {
            logger.LogDebug($"Update user two factor authentication to {requires2FA}...");
            var user = GetUserFromToken(authenticationToken);
            if (user.Requires2FA != requires2FA)
            {
                user.Requires2FA = requires2FA;
                var dbContext = GetDbContext();
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public bool UpdateUserUseLongLivedToken(string authenticationToken, bool useLongLivedToken)
        {
            logger.LogDebug($"Update user use long-lived token to {useLongLivedToken}...");
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
            logger.LogDebug($"Update user allow reset password to {allowResetPassword}...");
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

        public bool UpdateUserRole(string authenticationToken, UserUpdateRoleModel model)
        {
            logger.LogDebug($"Update role '{model.RoleName}' for user '{model.UserName}', set assigned to {model.Assigned}...");
            var adminuser = GetUserFromToken(authenticationToken);
            if (!HasRole(adminuser, "usermanager"))
            {
                throw new AccessDeniedPermissionException();
            }
            var changed = false;
            var dbContext = GetDbContext();
            var user = dbContext.DbUsers
                .Include((u) => u.Roles)
                .SingleOrDefault((u) => u.Name == model.UserName);
            if (user != null)
            {
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
                            throw new PwdManInvalidArgumentException("Du kannst Dir selber nicht die Rolle 'usermanager' entziehen.");
                        }
                        var cntUserManagers = dbContext.DbRoles.Count((r) => r.Name == "usermanager");
                        if (cntUserManagers == 1)
                        {
                            throw new PwdManInvalidArgumentException("Es muss mindestens ein Benutzer mit der Rolle 'usermanager' vorhanden sein.");
                        }
                    }
                    user.Roles.Remove(role);
                    changed = true;
                }
                if (changed)
                {
                    dbContext.SaveChanges();
                }
            }
            return changed;
        }

        public bool UpdateUserStorageQuota(string authenticationToken, long userId, long quota)
        {
            logger.LogDebug($"Update storage quota for user ID {userId} to {quota}...", userId, quota);
            if (quota < 2 * 1024 * 1024 || quota > 1000 * 1024 * 1024)
            {
                throw new PwdManInvalidArgumentException("Ungültige Quota. Die Quota muss zwischen 2 MB und 1000 MB liegen.");
            }
            var adminuser = GetUserFromToken(authenticationToken);
            if (!HasRole(adminuser, "usermanager"))
            {
                throw new AccessDeniedPermissionException();
            }
            var changed = false;
            var dbContext = GetDbContext();
            var user = dbContext.DbUsers.SingleOrDefault((u) => u.Id == userId);
            if (user != null && user.StorageQuota != quota)
            {
                user.StorageQuota = quota;
                dbContext.SaveChanges();
                changed = true;
            }
            return changed;
        }

        public int DeleteLoginIpAddresses(string authenticationToken)
        {
            logger.LogDebug($"Delete login IP addresses...");
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
            var user = GetUserFromToken(authenticationToken);
            if (!HasRole(user, "usermanager"))
            {
                throw new AccessDeniedPermissionException();
            }
            var ret = new List<UserModel>();
            var opt = GetOptions();
            var dbContext = GetDbContext();
            var users = dbContext.DbUsers.Include(u => u.Roles).OrderBy(u => u.Name);
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
                    Roles = u.Roles.Select(r => r.Name).ToList(),
                    LoginIpAddresses = new List<LoginIpAddressModel>()
                };
                if (u.LoginTries >= opt.MaxLoginTryCount)
                {
                    var sec = (DateTime.UtcNow - u.LastLoginTryUtc.Value).TotalSeconds;
                    if (sec < opt.AccountLockTime)
                    {
                        userModel.AccountLocked = true;
                    }
                }
                ret.Add(userModel);
            }
            return ret;
        }

        // --- authentication

        public AuthenticationResponseModel Authenticate(AuthenticationModel authentication, string ipAddress)
        {
            logger.LogDebug("Authenticate '{username}' with client IP address {ipAddress}...", authentication.Username, ipAddress);
            var opt = GetOptions();
            var user = GetDbUserByName(authentication.Username);
            if (user != null)
            {
                if (user.LoginTries >= opt.MaxLoginTryCount)
                {
                    var sec = (DateTime.UtcNow - user.LastLoginTryUtc.Value).TotalSeconds;
                    if (sec < opt.AccountLockTime)
                    {
                        logger.LogDebug("Account disabled. Too many login tries.");
                        throw new AccountLockedException((opt.AccountLockTime - (int)sec) / 60 + 1);
                    }
                    user.LoginTries = 0;
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
                var hasher = new PasswordHasher<string>();
                hasher.HashPassword(user.Name, authentication.Password);
                if (hasher.VerifyHashedPassword(
                    user.Name,
                    user.PasswordHash,
                    authentication.Password) == PasswordVerificationResult.Success)
                {
                    if (user.Requires2FA)
                    {
                        Send2FAEmail(user, opt);
                    }
                    var token = GenerateToken(user.Name, opt, user.Requires2FA);
                    if (token != null)
                    {
                        user.LoginTries = 0;
                        user.LastLoginTryUtc = DateTime.UtcNow;
                        loginIpAddress.Succeeded += 1;
                        dbContext.SaveChanges();
                        var ret = new AuthenticationResponseModel { Token = token, RequiresPass2 = user.Requires2FA };
                        if (!user.Requires2FA && user.UseLongLivedToken)
                        {
                            ret.LongLivedToken = GenerateLongLivedToken(user.Name, opt);
                        }
                        return ret;
                    }
                }
                logger.LogDebug("Invalid password specified.");
                user.LoginTries += 1;
                user.LastLoginTryUtc = DateTime.UtcNow;
                loginIpAddress.Failed += 1;
                dbContext.SaveChanges();
                if (user.LoginTries >= opt.MaxLoginTryCount)
                {
                    throw new UnauthorizedAndLockedException();
                }
            }
            else
            {
                logger.LogDebug("Username not found.");
            }
            throw new UnauthorizedException();
        }

        public void SendTOTP(string token)
        {
            logger.LogDebug("Send TOTP...");
            var opt = GetOptions();
            if (ValidateToken(token, opt))
            {
                var tokenHandler = new JwtSecurityTokenHandler();
                var securityToken = tokenHandler.ReadToken(token) as JwtSecurityToken;
                var amr = securityToken.Claims.FirstOrDefault(claim => claim.Type == "amr");
                var claim = securityToken.Claims.FirstOrDefault(claim => claim.Type == "unique_name");
                if (claim != null && amr?.Value == "2fa")
                {
                    var dbContext = GetDbContext();
                    var user = dbContext.DbUsers.SingleOrDefault(u => u.Name == claim.Value);
                    if (user != null && user.Requires2FA)
                    {
                        Send2FAEmail(user, opt);
                        dbContext.SaveChanges();
                        return;
                    }
                }
            }
            throw new InvalidTokenException();
        }

        public AuthenticationResponseModel AuthenticateTOTP(string token, string totp)
        {
            logger.LogDebug("Authenticate using Time-Based One-Time Password (TOTP)...");
            var opt = GetOptions();
            if (ValidateToken(token, opt)) // verify pass 1
            {
                var tokenHandler = new JwtSecurityTokenHandler();
                var securityToken = tokenHandler.ReadToken(token) as JwtSecurityToken;
                var amr = securityToken.Claims.FirstOrDefault(claim => claim.Type == "amr");
                var claim = securityToken.Claims.FirstOrDefault(claim => claim.Type == "unique_name");
                if (claim != null && amr?.Value == "2fa")
                {
                    var dbContext = GetDbContext();
                    var user = dbContext.DbUsers.SingleOrDefault(u => u.Name == claim.Value);
                    if (user != null && !string.IsNullOrEmpty(user.TOTPKey))
                    {
                        long utcNowSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                        var validTOTP = TOTP.Generate(utcNowSeconds, user.TOTPKey, opt.TOTPConfig.Digits, opt.TOTPConfig.ValidSeconds);
                        if (validTOTP != totp)
                        {
                            utcNowSeconds -= opt.TOTPConfig.ValidSeconds;
                            validTOTP = TOTP.Generate(utcNowSeconds, user.TOTPKey, opt.TOTPConfig.Digits, opt.TOTPConfig.ValidSeconds);
                        }
                        user.TOTPKey = "";
                        dbContext.SaveChanges();
                        if (totp == validTOTP) // verify pass 2
                        {
                            var ret = new AuthenticationResponseModel
                            {
                                Token = GenerateToken(user.Name, opt, false),
                                RequiresPass2 = true
                            };
                            if (user.UseLongLivedToken)
                            {
                                ret.LongLivedToken = GenerateLongLivedToken(user.Name, opt);
                            }
                            return ret;
                        }
                    }
                    logger.LogDebug("User not found or TOTP token already consumed.");
                    throw new PwdManInvalidArgumentException("Der Sicherheitscode ist ungültig. Fordere einen neuen Code an.");
                }
                logger.LogDebug("Claim type 'unique_name' not found or not a 2FA token.");
            }
            throw new InvalidTokenException();
        }

        public AuthenticationResponseModel AuthenticateLongLivedToken(string longLivedToken, string ipAddress)
        {
            var opt = GetOptions();
            var user = GetUserFromToken(longLivedToken, true);
            if (!user.UseLongLivedToken)
            {
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
            user.LastLoginTryUtc = DateTime.UtcNow;
            loginIpAddress.Succeeded += 1;
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

        private void CleanupLoginIpAddress(DbMynaContext dbContext, long userId)
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
            if (user.PasswordFileId == null) throw new PasswordFileNotFoundException();
            var dbContext = GetDbContext();
            dbContext.Entry(user).Reference(f => f.PasswordFile).Load();
            return user.PasswordFile.Content;
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

        public bool HasPasswordFile(string authenticationToken)
        {
            logger.LogDebug("Has password file...");
            var user = GetUserFromToken(authenticationToken);
            return user.PasswordFileId != null;
        }

        // --- slideshow

        public SlideShowModel GetSlideShow(string authenticationToken)
        {
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

        public string GetMarkdown(string authenticationToken, string id)
        {
            var opt = GetOptions();
            if (id == "startpage")
            {
                id = opt.StartPage;
            }
            if (int.TryParse(id, out int documentId))
            {
                return GetMarkdownByDocumentId(authenticationToken, documentId);
            }
            string content = null;
            string role = null;
            if (opt.Markdown?.Count > 0)
            {
                foreach (var mdc in opt.Markdown)
                {
                    if (mdc.Id == id)
                    {
                        if (int.TryParse(mdc.Content, out int docId))
                        {
                            return GetMarkdownByDocumentId(authenticationToken, docId);
                        }
                        content = mdc.Content;
                        role = mdc.Role;
                        break;
                    }
                }
            }
            if (content != null && File.Exists(content))
            {
                var render = string.IsNullOrEmpty(role);
                if (!render && !string.IsNullOrEmpty(authenticationToken))
                {
                    try
                    {
                        render = HasRole(GetUserFromToken(authenticationToken), role);
                    }
                    catch
                    {
                    }
                }
                if (render)
                {
                    var pipeline = new MarkdownPipelineBuilder().UseAdvancedExtensions().Build();
                    var markdown = Markdig.Markdown.ToHtml(File.ReadAllText(content), pipeline);
                    return markdown;
                }
            }
            return "<p>Zugriff verweigert.</p>";
        }

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

        // --- database access

        public DbMynaContext GetDbContext()
        {
            var connectionType = Configuration.GetValue<string>("ConnectionType");
            return connectionType == "Postgres" ? dbPostgresContext : dbSqliteContext;
        }

        // --- private

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

        private bool IsValidUsername(string username)
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

        private bool IsValidEmailAddress(string email)
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
                else if (!char.IsLetterOrDigit(ch))
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

        private void Send2FAEmail(DbUser user, PwdManOptions opt)
        {
            if (string.IsNullOrEmpty(user.Email)) throw new UnauthorizedException();
            var pwdgen = new PwdGen { Length = 28 };
            user.TOTPKey = pwdgen.Generate();
            var totp = TOTP.Generate(user.TOTPKey, opt.TOTPConfig.Digits, opt.TOTPConfig.ValidSeconds);
            var subject = $"Myna Portal 2-Schritt-Verifizierung";
            var body =
                $"{totp} ist Dein Sicherheitscode. Der Code ist {opt.TOTPConfig.ValidSeconds / 60} Minuten gültig. " +
                "In dieser Zeit kann er genau 1 Mal verwendet werden.";
            notificationService.Send(user.Email, subject, body);
        }

        private bool VerifyPasswordStrength(string pwd)
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

        private byte[] EncodeSecret(byte[] salt, string password, byte[] secret)
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

        private string GenerateToken(string username, PwdManOptions opt, bool requires2FA)
        {
            return GenerateTokenPerType(false, username, opt, requires2FA);
        }

        private string GenerateLongLivedToken(string username, PwdManOptions opt)
        {
            return GenerateTokenPerType(true, username, opt);
        }

        private string GenerateTokenPerType(bool useLongLivedToken, string username, PwdManOptions opt, bool requires2FA = false)
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

        private PwdManOptions GetOptions()
        {
            var opt = Configuration.GetSection("PwdMan").Get<PwdManOptions>();
            return opt ?? new PwdManOptions();
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
