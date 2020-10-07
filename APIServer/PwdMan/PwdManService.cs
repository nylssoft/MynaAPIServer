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

        public PwdManService(
            IConfiguration configuration,
            ILogger<PwdManService> logger)
        {
            Configuration = configuration;
            this.logger = logger;
        }

        public void AddUser(Authentication authentication)
        {
            logger.LogDebug("Add user '{username}'...", authentication.Username);
            lock (mutex)
            {
                var opt = GetOptions();
                var users = ReadUsers(opt.UsersFile);
                var user = users.Find((u) => u.Name == authentication.Username);
                if (user != null ||
                    opt.AllowedUsers == null ||
                    !opt.AllowedUsers.Contains(authentication.Username))
                {
                    throw new UserNotAllowedException();
                }
                if (!VerifyPasswordStrength(authentication.Password))
                {
                    throw new PasswordNotStrongEnoughException();
                }
                var pwdgen = new PwdGen { Length = 12 };
                var hasher = new PasswordHasher<string>();
                var hash = hasher.HashPassword(authentication.Username, authentication.Password);
                user = new User
                {
                    Name = authentication.Username,
                    PasswordFile = opt.PasswordFilePattern.Replace("{guid}", Guid.NewGuid().ToString()),
                    Salt = pwdgen.Generate(),
                    PasswordHash = hash
                };
                users.Add(user);
                File.WriteAllText(opt.UsersFile, JsonSerializer.Serialize(users));
            }
        }

        public string Authenticate(Authentication authentication)
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
                        var token = GenerateToken(authentication.Username, opt);
                        if (token != null)
                        {
                            loginFailures.Remove(user.Name);
                            return token;
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

        // --- private

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

        private string GenerateToken(string username, PwdManOptions opt)
        {
            var securityKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(opt.TokenConfig.SignKey));
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new Claim[] { new Claim(ClaimTypes.NameIdentifier, username) }),
                Expires = DateTime.UtcNow.AddMinutes(opt.TokenConfig.ExpireMinutes),
                Issuer = opt.TokenConfig.Issuer,
                Audience = opt.TokenConfig.Audience,
                SigningCredentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256Signature)
            };
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
                    ValidIssuer = opt.TokenConfig.Issuer,
                    ValidAudience = opt.TokenConfig.Audience,
                    IssuerSigningKey = securityKey
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
                var claim = securityToken.Claims.FirstOrDefault(claim => claim.Type == "nameid");
                if (claim != null)
                {
                    var users = ReadUsers(opt.UsersFile);
                    return users.Find((u) => u.Name == claim.Value);
                }
                logger.LogDebug("Claim type 'nameid' not found.");
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
