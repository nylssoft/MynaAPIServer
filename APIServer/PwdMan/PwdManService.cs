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
using APIServer.Email;
using APIServer.PasswordGenerator;
using Microsoft.AspNetCore.Cryptography.KeyDerivation;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.IO;
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

        private readonly object mutex = new object();

        private readonly Dictionary<string,LoginTry> loginFailures = new Dictionary<string, LoginTry>();

        private readonly INotificationService notificationService;

        private readonly Dictionary<string, string> totpKeys = new Dictionary<string, string>();

        public PwdManService(
            IConfiguration configuration,
            ILogger<PwdManService> logger,
            INotificationService notificationService)
        {
            Configuration = configuration;
            this.logger = logger;
            this.notificationService = notificationService;
        }

        public bool IsRegisteredUsername(string username)
        {
            logger.LogDebug("Check whether username '{username}' is registered...", username);
            lock (mutex)
            {
                return ReadUsers(GetOptions().UsersFile).Find((u) => u.Name == username) != null;
            }
        }

        public string GetUsername(string authenticationToken)
        {
            logger.LogDebug("Get current username...");
            lock (mutex)
            {
                return GetUserFromToken(authenticationToken).Name;
            }
        }

        public void AddUser(UserCreation userCreation)
        {
            logger.LogDebug("Add user '{username}'...", userCreation.Username);
            if (string.IsNullOrEmpty(userCreation.Username)) throw new PwdManInvalidArgumentException("Benutzername ungültig.");
            if (userCreation.Requires2FA && string.IsNullOrEmpty(userCreation.Email)) throw new PwdManInvalidArgumentException("E-Mail-Addresse ungültig.");
            lock (mutex)
            {
                var opt = GetOptions();
                var users = ReadUsers(opt.UsersFile);
                var user = users.Find((u) => u.Name == userCreation.Username);
                if (user != null ||
                    opt.AllowedUsers == null ||
                    !opt.AllowedUsers.Contains(userCreation.Username))
                {
                    throw new UserNotAllowedException();
                }
                if (!VerifyPasswordStrength(userCreation.Password))
                {
                    throw new PasswordNotStrongEnoughException();
                }
                var pwdgen = new PwdGen { Length = 12 };
                var hasher = new PasswordHasher<string>();
                var hash = hasher.HashPassword(userCreation.Username, userCreation.Password);
                user = new User
                {
                    Name = userCreation.Username,
                    PasswordFile = opt.PasswordFilePattern.Replace("{guid}", Guid.NewGuid().ToString()),
                    Salt = pwdgen.Generate(),
                    PasswordHash = hash,
                    Email = userCreation.Email,
                    Requires2FA = userCreation.Requires2FA
                };
                users.Add(user);
                File.WriteAllText(opt.UsersFile, JsonSerializer.Serialize(users));
            }
        }

        public AuthenticationResult Authenticate(Authentication authentication)
        {
            logger.LogDebug("Authenticate '{username}'...", authentication.Username);
            lock (mutex)
            {
                var opt = GetOptions();
                var users = ReadUsers(opt.UsersFile);
                var user = users.Find((u) => u.Name == authentication.Username);
                if (user != null)
                {
                    LoginTry loginTry = null;
                    loginFailures.TryGetValue(user.Name, out loginTry);
                    if (loginTry != null && loginTry.Count >= opt.MaxLoginTryCount)
                    {
                        var sec = (DateTime.UtcNow - loginTry.LastTryUtc).TotalSeconds;
                        if (sec < opt.AccountLockTime)
                        {
                            logger.LogDebug("Account disabled. Too many login tries.");
                            throw new UnauthorizedException();
                        }
                        loginTry = null; // try again
                        loginFailures.Remove(user.Name);
                    }
                    var hasher = new PasswordHasher<string>();
                    var hash = hasher.HashPassword(authentication.Username, authentication.Password);
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
                            loginFailures.Remove(user.Name);
                            return new AuthenticationResult { Token = token, RequiresPass2 = user.Requires2FA };
                        }
                    }
                    logger.LogDebug("Invalid password specified.");
                    if (loginTry == null)
                    {
                        loginTry = new LoginTry();
                        loginFailures[user.Name] = loginTry;
                    }
                    loginTry.Count += 1;
                    loginTry.LastTryUtc = DateTime.UtcNow;
                }
                else
                {
                    logger.LogDebug("Username not found.");
                }
                throw new UnauthorizedException();
            }
        }

        public void SendTOTP(string token)
        {
            logger.LogDebug("Send TOTP...");
            lock (mutex)
            {
                var opt = GetOptions();
                if (ValidateToken(token, opt))
                {
                    var tokenHandler = new JwtSecurityTokenHandler();
                    var securityToken = tokenHandler.ReadToken(token) as JwtSecurityToken;
                    var amr = securityToken.Claims.FirstOrDefault(claim => claim.Type == "amr");
                    var claim = securityToken.Claims.FirstOrDefault(claim => claim.Type == "unique_name");
                    if (claim != null && amr?.Value == "2fa")
                    {
                        var users = ReadUsers(opt.UsersFile);
                        var user = users.Find((u) => u.Name == claim.Value);
                        if (user != null && user.Requires2FA)
                        {
                            Send2FAEmail(user, opt);
                            return;
                        }
                    }
                }
            }
            throw new InvalidTokenException();
        }

        public string AuthenticateTOTP(string token, string totp)
        {
            logger.LogDebug("Authenticate using Time-Based One-Time Password (TOTP)...");
            lock (mutex)
            {
                var opt = GetOptions();
                if (ValidateToken(token, opt)) // verify pass 1
                {
                    var tokenHandler = new JwtSecurityTokenHandler();
                    var securityToken = tokenHandler.ReadToken(token) as JwtSecurityToken;
                    var amr = securityToken.Claims.FirstOrDefault(claim => claim.Type == "amr");
                    var claim = securityToken.Claims.FirstOrDefault(claim => claim.Type == "unique_name");
                    if (claim != null && amr?.Value == "2fa")
                    {
                        var users = ReadUsers(opt.UsersFile);
                        var user = users.Find((u) => u.Name == claim.Value);
                        if (user != null && totpKeys.ContainsKey(user.Name))
                        {
                            long utcNowSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                            var validTOTP = TOTP.Generate(utcNowSeconds, totpKeys[user.Name], opt.TOTPConfig.Digits, opt.TOTPConfig.ValidSeconds);
                            if (validTOTP != totp)
                            {
                                utcNowSeconds -= opt.TOTPConfig.ValidSeconds;
                                validTOTP = TOTP.Generate(utcNowSeconds, totpKeys[user.Name], opt.TOTPConfig.Digits, opt.TOTPConfig.ValidSeconds);
                            }
                            totpKeys.Remove(user.Name);
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
        }

        public string GetSalt(string token)
        {
            logger.LogDebug("Get salt...");
            lock (mutex)
            {
                return GetUserFromToken(token).Salt;
            }
        }

        public void ChangeUserPassword(string token, UserPasswordChange userPassswordChange)
        {
            logger.LogDebug("Change user password...");
            lock (mutex)
            {
                var user = GetUserFromToken(token);
                var hasher = new PasswordHasher<string>();
                var hash = hasher.HashPassword(user.Name, userPassswordChange.OldPassword);
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
                    throw new PasswordNotStrongEnoughException();
                }
                var newhash = hasher.HashPassword(user.Name, userPassswordChange.NewPassword);
                var opt = GetOptions();
                var users = ReadUsers(opt.UsersFile);
                user = users.Find(u => u.Name == user.Name);
                if (user == null) throw new UnauthorizedException();
                user.PasswordHash = newhash;
                File.WriteAllText(opt.UsersFile, JsonSerializer.Serialize(users));
            }
        }

        public void SavePasswordFile(string token, PasswordFile passwordFile)
        {
            logger.LogDebug("Save password file...");
            lock (mutex)
            {
                if (!VerifyPasswordStrength(passwordFile.SecretKey))
                {
                    throw new SecretKeyNotStrongEnoughException();
                }
                var user = GetUserFromToken(token);
                var hasher = new PasswordHasher<string>();
                var hash = hasher.HashPassword(user.Name, passwordFile.SecretKey);
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
                File.WriteAllBytes(user.PasswordFile, encoded);
            }
        }

        public string GetEncodedPasswordFile(string token)
        {
            logger.LogDebug("Get encoded password file...");
            lock (mutex)
            {
                var user = GetUserFromToken(token);
                if (!File.Exists(user.PasswordFile)) throw new PasswordFileNotFoundException();
                return ConvertToHexString(File.ReadAllBytes(user.PasswordFile));
            }
        }

        public bool HasPasswordFile(string authenticationToken)
        {
            logger.LogDebug("Has password file...");
            lock (mutex)
            {
                var user = GetUserFromToken(authenticationToken);
                return user.PasswordFile?.Length > 0 && File.Exists(user.PasswordFile);
            }
        }

        // --- private

        private void Send2FAEmail(User user, PwdManOptions opt)
        {
            if (string.IsNullOrEmpty(user.Email)) throw new UnauthorizedException();
            var pwdgen = new PwdGen { Length = 28 };
            totpKeys[user.Name] = pwdgen.Generate();
            var totp = TOTP.Generate(totpKeys[user.Name], opt.TOTPConfig.Digits, opt.TOTPConfig.ValidSeconds);
            var subject = $"Myna Online 2-Schritt-Verifizierung";
            var body =
                $"{totp} ist Dein Sicherheitscode. Der Code ist {opt.TOTPConfig.ValidSeconds} Sekunden gültig. " +
                "In diesem Zeit kann er genau 1 Mal verwendet werden.";
            notificationService.SendToAsync(user.Email, subject, body);
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

        private List<User> ReadUsers(string usersFile)
        {
            if (!File.Exists(usersFile))
            {
                return new List<User>();
            }
            var json = File.ReadAllText(usersFile);
            return JsonSerializer.Deserialize<List<User>>(json);
        }

        private byte [] EncodeSecret(byte [] salt, string password, byte [] secret)
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

        private User GetUserFromToken(string token)
        {
            var opt = GetOptions();
            if (ValidateToken(token, opt))
            {
                var tokenHandler = new JwtSecurityTokenHandler();
                var securityToken = tokenHandler.ReadToken(token) as JwtSecurityToken;
                var claim = securityToken.Claims.FirstOrDefault(claim => claim.Type == "unique_name");
                if (claim != null)
                {
                    var users = ReadUsers(opt.UsersFile);
                    var user = users.Find((u) => u.Name == claim.Value);
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
