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
using APIServer.Database;
using APIServer.Email;
using APIServer.PasswordGenerator;
using APIServer.PwdMan.Model;
using Microsoft.AspNetCore.Cryptography.KeyDerivation;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
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

        private readonly DbMynaContext dbContext;

        private readonly INotificationService notificationService;

        private const string LAST_REGISTRATION_REQUEST = "LastReqistrationRequest";

        public PwdManService(
            IConfiguration configuration,
            ILogger<PwdManService> logger,
            DbMynaContext dbContext,
            INotificationService notificationService)
        {
            Configuration = configuration;
            this.logger = logger;
            this.dbContext = dbContext;
            this.notificationService = notificationService;
        }

        // --- registration

        public bool IsRegisterAllowed(string email)
        {
            logger.LogDebug("Check whether email addresss '{email}' is allowed to register...", email);
            email = email.ToLowerInvariant();
            var opt = GetOptions();
            if (string.IsNullOrEmpty(opt.RegistrationEmail))
            {
                throw new PwdManInvalidArgumentException("Registrieren ist deaktiviert.");
            }
            // first user can register without confirmation and token
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
            var lastRegistrationRequest = GetSetting<DateTime?>(LAST_REGISTRATION_REQUEST);
            // avoid spam emails, only one request in 5 minutes
            if (lastRegistrationRequest != null)
            {
                var min = (DateTime.UtcNow - lastRegistrationRequest.Value).TotalMinutes;
                if (min < 5)
                {
                    throw new PwdManInvalidArgumentException("Registrieren ist z.Zt. nicht möglich. Versuche es später noch einmal.");
                }
            }
            SetSetting(LAST_REGISTRATION_REQUEST, DateTime.UtcNow);
            dbContext.DbRegistrations.Add(new DbRegistration { Email = email, RequestedUtc = DateTime.UtcNow });
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
                    RequestedUtc = GetUtcDateTime(registration.RequestedUtc)
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
                        "Deine E-Mail-Adresse wurde jetzt freigeschaltet und Du kannst Dich auf dem Portal registrieren.\n\n\n\n" +
                        "Viele Grüsse!";
                }
                notificationService.Send(email, subject, body);
            }
            return registration.Token;
        }

        public void RegisterUser(UserRegistrationModel registrationProfile)
        {
            logger.LogDebug("Register user '{username}', email '{email}...", registrationProfile.Username, registrationProfile.Email);
            if (string.IsNullOrEmpty(registrationProfile.Username)) throw new PwdManInvalidArgumentException("Benutzername ungültig.");
            if (string.IsNullOrEmpty(registrationProfile.Email)) throw new PwdManInvalidArgumentException("E-Mail-Addresse ungültig.");
            if (string.IsNullOrEmpty(registrationProfile.Token)) throw new PwdManInvalidArgumentException("Registrierungscode ist ungültig.");
            var email = registrationProfile.Email.ToLowerInvariant();
            var opt = GetOptions();
            // first user can register without token
            var firstUser = dbContext.DbUsers.Count() == 0;
            if (!firstUser)
            {
                var registration = dbContext.DbRegistrations.SingleOrDefault((r) => r.Email == email);
                if (registration == null || registration.Token != registrationProfile.Token.ToUpperInvariant())
                {
                    throw new PwdManInvalidArgumentException("Der Registrierungscode ist ungültig.");
                }
                var exsitingUser = dbContext.DbUsers.SingleOrDefault(u => u.Name == registrationProfile.Username);
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
                RegisteredUtc = DateTime.UtcNow
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
                .Where(r => r.Player1 == user.Name || r.Player2 == user.Name || r.Player3 == user.Name)
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

        public bool IsRegisteredUsername(string username)
        {
            logger.LogDebug("Check whether username '{username}' is registered...", username);
            var user = dbContext.DbUsers.SingleOrDefault(u => u.Name == username);
            return user != null;
        }

        public DbUser GetUserFromToken(string authenticationToken)
        {
            var opt = GetOptions();
            if (ValidateToken(authenticationToken, opt))
            {
                var tokenHandler = new JwtSecurityTokenHandler();
                var securityToken = tokenHandler.ReadToken(authenticationToken) as JwtSecurityToken;
                var claim = securityToken.Claims.FirstOrDefault(claim => claim.Type == "unique_name");
                if (claim != null)
                {
                    var user = dbContext.DbUsers.SingleOrDefault(u => u.Name == claim.Value);
                    if (user != null)
                    {
                        if (user.Requires2FA)
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

        public UserModel GetUser(string authenticationToken)
        {
            logger.LogDebug("Get user...");
            var user = GetUserFromToken(authenticationToken);
            var userModel = new UserModel
            {
                Name = user.Name,
                Email = user.Email,
                LastLoginUtc = GetUtcDateTime(user.LastLoginTryUtc),
                Requires2FA = user.Requires2FA,
                RegisteredUtc = GetUtcDateTime(user.RegisteredUtc),
                HasPasswordManagerFile = user.PasswordFileId != null,
                PasswordManagerSalt = user.Salt
            };
            userModel.Roles = dbContext.DbRoles.Where(r => r.DbUserId == user.Id).Select(r => r.Name).ToList();
            return userModel;
        }

        public bool DeleteUser(string authenticationToken, string userName)
        {
            logger.LogDebug($"Delete username {userName}...");
            var user = GetUserFromToken(authenticationToken);
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
            if (user.PasswordFileId.HasValue)
            {
                var delpwdfile = new DbPasswordFile { Id = user.PasswordFileId.Value };
                dbContext.DbPasswordFiles.Attach(delpwdfile);
                dbContext.DbPasswordFiles.Remove(delpwdfile);
            }
            var regs = dbContext.DbRegistrations.Where(r => r.ConfirmedById == user.Id);
            if (regs.Any())
            {
                dbContext.DbRegistrations.RemoveRange(regs);
            }
            regs = dbContext.DbRegistrations.Where(r => r.Email == user.Email);
            if (regs.Any())
            {
                dbContext.DbRegistrations.RemoveRange(regs);
            }
            var roles = dbContext.DbRoles.Where(r => r.DbUserId == user.Id);
            if (roles.Any())
            {
                dbContext.DbRoles.RemoveRange(roles);
            }
            dbContext.DbUsers.Remove(user);
            var userSkatResults = dbContext.DbUserSkatResults.Where(r => r.DbUserId == user.Id);
            if (userSkatResults.Any())
            {
                dbContext.DbUserSkatResults.RemoveRange(userSkatResults);
            }
            dbContext.SaveChanges();
            return true;
        }

        public bool UpdateUser2FA(string authenticationToken, bool requires2FA)
        {
            logger.LogDebug($"Update user two factor authentication...");
            var user = GetUserFromToken(authenticationToken);
            if (user.Requires2FA != requires2FA)
            {
                user.Requires2FA = requires2FA;
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        // --- authentication

        public AuthenticationResponseModel Authenticate(AuthenticationModel authentication)
        {
            logger.LogDebug("Authenticate '{username}'...", authentication.Username);
            var opt = GetOptions();
            var user = dbContext.DbUsers.SingleOrDefault(u => u.Name == authentication.Username);
            if (user != null)
            {
                if (user.LoginTries >= opt.MaxLoginTryCount)
                {
                    var sec = (DateTime.UtcNow - user.LastLoginTryUtc.Value).TotalSeconds;
                    if (sec < opt.AccountLockTime)
                    {
                        logger.LogDebug("Account disabled. Too many login tries.");
                        throw new UnauthorizedException();
                    }
                }
                var hasher = new PasswordHasher<string>();
                hasher.HashPassword(authentication.Username, authentication.Password);
                if (hasher.VerifyHashedPassword(
                    authentication.Username,
                    user.PasswordHash,
                    authentication.Password) == PasswordVerificationResult.Success)
                {
                    if (user.Requires2FA)
                    {
                        Send2FAEmail(user, opt);
                    }
                    var token = GenerateToken(authentication.Username, opt, user.Requires2FA);
                    if (token != null)
                    {
                        user.LoginTries = 0;
                        user.LastLoginTryUtc = DateTime.UtcNow;
                        dbContext.SaveChanges();
                        return new AuthenticationResponseModel { Token = token, RequiresPass2 = user.Requires2FA };
                    }
                }
                logger.LogDebug("Invalid password specified.");
                user.LoginTries += 1;
                user.LastLoginTryUtc = DateTime.UtcNow;
                dbContext.SaveChanges();
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

        public string AuthenticateTOTP(string token, string totp)
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
                            return GenerateToken(user.Name, opt, false);
                        }
                    }
                    logger.LogDebug("User not found or TOTP token already consumed.");
                    throw new PwdManInvalidArgumentException("Der Sicherheitscode ist ungültig. Fordere einen neuen Code an.");
                }
                logger.LogDebug("Claim type 'unique_name' not found or not a 2FA token.");
            }
            throw new InvalidTokenException();
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
            dbContext.SaveChanges();
        }

        // --- password manager

        public void SavePasswordFile(string token, PasswordFileModel passwordFile)
        {
            logger.LogDebug("Save password file...");
            if (!VerifyPasswordStrength(passwordFile.SecretKey))
            {
                throw new SecretKeyNotStrongEnoughException();
            }
            var user = GetUserFromToken(token);
            var hasher = new PasswordHasher<string>();
            hasher.HashPassword(user.Name, passwordFile.SecretKey);
            if (hasher.VerifyHashedPassword(
                user.Name,
                user.PasswordHash,
                passwordFile.SecretKey) == PasswordVerificationResult.Success)
            {
                throw new SecretKeySameAsPasswordException();
            }
            var salt = Encoding.UTF8.GetBytes(user.Salt);
            foreach (var item in passwordFile.Passwords)
            {
                item.Password = ConvertToHexString(
                    EncodeSecret(salt, passwordFile.SecretKey, Encoding.UTF8.GetBytes(item.Password)));
            }
            var passwords = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(passwordFile.Passwords));
            var encoded = EncodeSecret(salt, passwordFile.SecretKey, passwords);
            if (user.PasswordFile == null)
            {
                user.PasswordFile = new DbPasswordFile();
            }
            user.PasswordFile.Content = ConvertToHexString(encoded);
            user.PasswordFile.LastWrittenUtc = DateTime.UtcNow;
            dbContext.SaveChanges();
        }

        public string GetEncodedPasswordFile(string token)
        {
            logger.LogDebug("Get encoded password file...");
            var user = GetUserFromToken(token);
            if (user.PasswordFileId == null) throw new PasswordFileNotFoundException();
            dbContext.Entry(user).Reference(f => f.PasswordFile).Load();
            return user.PasswordFile.Content;
        }

        public bool HasPasswordFile(string authenticationToken)
        {
            logger.LogDebug("Has password file...");
            var user = GetUserFromToken(authenticationToken);
            return user.PasswordFileId != null;
        }

        // --- database access

        public DbMynaContext GetDbContext()
        {
            return dbContext;
        }

        public DateTime? GetUtcDateTime(DateTime? dbDateTime)
        {
            DateTime? ret = null;
            if (dbDateTime != null)
            {
                var ticks = dbDateTime.Value.Ticks;
                ret = new DateTime(ticks, DateTimeKind.Utc);
            }
            return ret;
        }

        // --- private

        private bool HasRole(DbUser user, string roleName)
        {
            if (user.Roles == null)
            {
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

        private T GetSetting<T>(string key)
        {
            var setting = dbContext.DbSettings.SingleOrDefault((s) => s.Key == key);
            if (setting != null)
            {
                return JsonSerializer.Deserialize<T>(setting.Value);
            }
            return default;
        }

        private void SetSetting<T>(string key, T value)
        {
            var setting = dbContext.DbSettings.SingleOrDefault((s) => s.Key == key);
            if (setting == null)
            {
                setting = new DbSetting { Key = LAST_REGISTRATION_REQUEST };
            }
            setting.Value = JsonSerializer.Serialize(value);
        }

        private void Send2FAEmail(DbUser user, PwdManOptions opt)
        {
            if (string.IsNullOrEmpty(user.Email)) throw new UnauthorizedException();
            var pwdgen = new PwdGen { Length = 28 };
            user.TOTPKey = pwdgen.Generate();
            var totp = TOTP.Generate(user.TOTPKey, opt.TOTPConfig.Digits, opt.TOTPConfig.ValidSeconds);
            var subject = $"Myna Portal 2-Schritt-Verifizierung";
            var body =
                $"{totp} ist Dein Sicherheitscode. Der Code ist {opt.TOTPConfig.ValidSeconds/60} Minuten gültig. " +
                "In diesem Zeit kann er genau 1 Mal verwendet werden.";
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
            var securityKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(opt.TokenConfig.SignKey));
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                NotBefore = DateTime.UtcNow,
                Expires = DateTime.UtcNow.AddMinutes(opt.TokenConfig.ExpireMinutes),
                Issuer = opt.TokenConfig.Issuer,
                Audience = opt.TokenConfig.Audience,
                SigningCredentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256Signature)
            };
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

        private bool ValidateToken(string token, PwdManOptions opt)
        {
            var securityKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(opt.TokenConfig.SignKey));
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
