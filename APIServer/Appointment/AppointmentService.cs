/*
    Myna API Server
    Copyright (C) 2023 Niels Stockfleth

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
using APIServer.Appointment.Model;
using APIServer.Database;
using APIServer.PwdMan;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace APIServer.Appointment
{
    public class AppointmentService : IAppointmentService
    {
        private readonly ILogger logger;

        public AppointmentService(ILogger<AppointmentService> logger)
        {
            this.logger = logger;
        }

        public DateTime AddAppointment(IPwdManService pwdManService, string authenticationToken, string uuid, AppointmentModel appointment, string securityKey)
        {
            logger.LogDebug("Add appointment...");
            var user = pwdManService.GetUserFromToken(authenticationToken);
            CheckAppointment(appointment);
            var now = DateTime.UtcNow;
            var dbContext = pwdManService.GetDbContext();
            var encryptedContent = Encrypt(JsonSerializer.Serialize(appointment.Definition), securityKey);
            var dbAppointment = new DbAppointment
            {
                DbUserId = user.Id,
                Uuid = uuid,
                Content = encryptedContent,
                CreatedUtc = now,
                ModifiedUtc = now,
                OwnerKey = appointment.OwnerKey,
            };
            dbAppointment.Votes = new();
            List<AppointmentOptionModel> empty = new();
            appointment.Definition.Participants.ForEach(p =>
            {
                dbAppointment.Votes.Add(new DbVote { UserUuid = p.UserUuid, Content = Encrypt("[]", securityKey) });
            });
            dbContext.DbAppointments.Add(dbAppointment);
            dbContext.SaveChanges();
            return DbMynaContext.GetUtcDateTime(dbAppointment.ModifiedUtc).Value;
        }

        public bool DeleteAppointment(IPwdManService pwdManService, string authenticationToken, string uuid)
        {
            logger.LogDebug("Delete appointment...");
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var dbAppointment = dbContext.DbAppointments.
                Where(a => a.Uuid == uuid && a.DbUserId == user.Id).
                SingleOrDefault();
            if (dbAppointment != null)
            {
                dbContext.DbAppointments.Remove(dbAppointment);
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public AppointmentModel GetAppointment(IPwdManService pwdManService, string uuid, string securityKey)
        {
            logger.LogDebug("Get appointment...");
            var dbContext = pwdManService.GetDbContext();
            var appointment = dbContext.DbAppointments
                .Where(a => a.Uuid == uuid)
                .Include(a => a.Votes)
                .SingleOrDefault();
            if (appointment != null)
            {
                return ConvertDbAppointment(appointment, securityKey);
            }
            return null;
        }

        public List<AppointmentModel> GetAppointments(IPwdManService pwdManService, string authenticationToken)
        {
            logger.LogDebug("Get appointments...");
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var appointments = dbContext.DbAppointments
                .Where(a => a.DbUserId == user.Id)
                .Include(a => a.Votes)
                .OrderByDescending(a => a.CreatedUtc);
            var ret = new List<AppointmentModel>();
            foreach (var appointment in appointments)
            {
                ret.Add(ConvertDbAppointment(appointment, null, true));
            }
            return ret;
        }

        public DateTime? UpdateAppointment(IPwdManService pwdManService, string authenticationToken, string uuid, AppointmentDefinitionModel definition, string securityKey)
        {
            logger.LogDebug("Update appointment...");
            var user = pwdManService.GetUserFromToken(authenticationToken);
            CheckDefinition(definition);
            var dbContext = pwdManService.GetDbContext();
            var dbAppointment = dbContext.DbAppointments
                .Where(a => a.Uuid == uuid && a.DbUserId == user.Id)
                .Include(a => a.Votes)
                .SingleOrDefault() ?? throw new InvalidParameterException();
            var appointment = ConvertDbAppointment(dbAppointment, securityKey);
            if (appointment.Votes.All(v => !v.Accepted.Any()))
            {
                var currentContent = JsonSerializer.Serialize(appointment.Definition);
                var newContent = JsonSerializer.Serialize(definition);
                if (currentContent != newContent)
                {
                    dbAppointment.Content = Encrypt(newContent, securityKey);
                    dbAppointment.ModifiedUtc = DateTime.UtcNow;
                    dbAppointment.Votes = new();
                    definition.Participants.ForEach(p =>
                    {
                        dbAppointment.Votes.Add(new DbVote { UserUuid = p.UserUuid, Content = Encrypt("[]", securityKey) });
                    });
                    dbContext.SaveChanges();
                    return DbMynaContext.GetUtcDateTime(dbAppointment.ModifiedUtc).Value;
                }
            }
            return null;
        }

        public DateTime? UpdateVote(IPwdManService pwdManService, string uuid, AppointmentVoteModel vote, string securityKey)
        {
            logger.LogDebug("Update vote...");
            var dbContext = pwdManService.GetDbContext();
            var dbAppointment = GetDbAppointmentByUuid(dbContext, uuid) ?? throw new InvalidParameterException();
            CheckVote(vote, ConvertDbAppointment(dbAppointment, securityKey));
            var dbVote = dbAppointment.Votes.SingleOrDefault(v => v.UserUuid == vote.UserUuid);
            if (dbVote != null)
            {
                var currentVote = ConvertDbVote(dbVote, securityKey);
                var currentContent = JsonSerializer.Serialize(currentVote.Accepted);
                var newContent = JsonSerializer.Serialize(vote.Accepted);
                if (currentContent != newContent)
                {
                    dbVote.Content = Encrypt(newContent, securityKey);
                    dbAppointment.ModifiedUtc = DateTime.UtcNow;
                    dbContext.SaveChanges();
                    return dbAppointment.ModifiedUtc;
                }
            }
            return null;
        }

        public string GenerateRandomKey(IPwdManService pwdManService, string authenticationToken)
        {
            logger.LogDebug("Generate random key...");
            pwdManService.GetUserFromToken(authenticationToken);
            return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        }

        private static DbAppointment GetDbAppointmentByUuid(DbMynaContext dbContext, string uuid)
        {
            return dbContext.DbAppointments
                .Where(a => a.Uuid == uuid)
                .Include(a => a.Votes)
                .SingleOrDefault();
        }

        private static void CheckVote(AppointmentVoteModel vote, AppointmentModel appointment)
        {
            if (!IsValidVote(vote, appointment))
            {
                throw new InvalidParameterException();
            }
        }

        private static void CheckAppointment(AppointmentModel appointment)
        {
            if (!IsValidAppointment(appointment))
            {
                throw new InvalidParameterException();
            }
        }

        private static void CheckDefinition(AppointmentDefinitionModel definition)
        {
            if (!IsValidDefinition(definition))
            {
                throw new InvalidParameterException();
            }
        }

        private static bool IsValidAppointment(AppointmentModel appointment)
        {
            if (appointment == null || !IsValidDefinition(appointment.Definition))
            {
                return false;
            }
            return true;
        }

        private static bool IsValidDefinition(AppointmentDefinitionModel definition)
        {
            if (definition == null ||
                definition.Description.IsNullOrEmpty() ||
                definition.Participants == null ||
                definition.Options == null)
            {
                return false;
            }
            definition.Participants = definition.Participants.Distinct().ToList();
            if (definition.Participants.Count > 20 ||
                definition.Options.Count > 3)
            {
                return false;
            }
            var seen = new HashSet<Tuple<int, int>>();
            foreach (var opt in definition.Options)
            {
                opt.Days = opt.Days.Distinct().ToList();
                var t = new Tuple<int, int>(opt.Year, opt.Month);
                if (seen.Contains(t))
                {
                    return false;
                }
                if (opt.Days.Any(d => d < 1 || d > 31))
                {
                    return false;
                }
                seen.Add(t);
            }
            return true;
        }

        private static bool IsValidVote(AppointmentVoteModel vote, AppointmentModel appointment)
        {
            if (vote == null ||
                vote.UserUuid.IsNullOrEmpty() ||
                vote.Accepted == null ||
                !appointment.Definition.Participants.Any(p => p.UserUuid == vote.UserUuid))
            {
                return false;
            }
            var seen = new HashSet<Tuple<int, int>>();
            foreach (var opt in vote.Accepted)
            {
                opt.Days = opt.Days.Distinct().ToList();
                var t = new Tuple<int, int>(opt.Year, opt.Month);
                if (seen.Contains(t) || !IsValidOption(opt, appointment.Definition.Options))
                {
                    return false;
                }
                seen.Add(t);
            }
            return true;
        }

        private static bool IsValidOption(AppointmentOptionModel opt, List<AppointmentOptionModel> options)
        {
            var foundOption = options.SingleOrDefault(o => o.Year == opt.Year && o.Month == opt.Month);
            if (foundOption != null)
            {
                return !opt.Days.Except(foundOption.Days).Any();
            }
            return false;
        }

        private static AppointmentModel ConvertDbAppointment(DbAppointment dbAppointment, string securityKey, bool includeOwnerKey = false)
        {
            var appointment = new AppointmentModel
            {
                Uuid = dbAppointment.Uuid,
                CreatedUtc = DbMynaContext.GetUtcDateTime(dbAppointment.CreatedUtc).Value,
                ModifiedUtc = DbMynaContext.GetUtcDateTime(dbAppointment.ModifiedUtc)
            };
            if (includeOwnerKey)
            {
                appointment.Definition = null;
                appointment.Votes = null;
                appointment.OwnerKey = dbAppointment.OwnerKey;
            }
            else
            {
                var decryptedContent = Decrypt(dbAppointment.Content, securityKey);
                appointment.Definition = JsonSerializer.Deserialize<AppointmentDefinitionModel>(decryptedContent);
                foreach (var vote in dbAppointment.Votes)
                {
                    appointment.Votes.Add(ConvertDbVote(vote, securityKey));
                }
            }
            return appointment;
        }

        private static AppointmentVoteModel ConvertDbVote(DbVote dbVote, string securityKey)
        {
            var decryptedContent = Decrypt(dbVote.Content, securityKey);
            return new AppointmentVoteModel
            {
                UserUuid = dbVote.UserUuid,
                Accepted = JsonSerializer.Deserialize<List<AppointmentOptionModel>>(decryptedContent)
            };
        }

        private static string Decrypt(string encryptedText, string securityKey)
        {
            if (!securityKey.IsNullOrEmpty())
            {
                byte[] cryptoKey = Convert.FromBase64String(securityKey);
                return DecodeText(encryptedText, cryptoKey);
            }
            return encryptedText;
        }

        private static string Encrypt(string plainText, string securityKey)
        {
            if (!securityKey.IsNullOrEmpty())
            {
                byte[] cryptoKey = Convert.FromBase64String(securityKey);
                return EncodeText(plainText, cryptoKey);
            }
            return plainText;
        }

        private static string DecodeText(string encrypted, byte[] cryptoKey)
        {
            var decoded = DecryptData(Convert.FromBase64String(encrypted), cryptoKey);
            return Encoding.UTF8.GetString(decoded);
        }

        private static string EncodeText(string text, byte[] cryptoKey)
        {
            var data = Encoding.UTF8.GetBytes(text);
            var encrypted = EncryptData(data, cryptoKey);
            return Convert.ToBase64String(encrypted);
        }

        private static byte[] EncryptData(byte[] data, byte[] key)
        {
            var iv = new byte[12];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(iv);
            }
            var encoded = new byte[data.Length];
            var tag = new byte[16];
            using (var cipher = new AesGcm(key))
            {
                cipher.Encrypt(iv, data, encoded, tag);
            }
            var ret = new byte[iv.Length + encoded.Length + tag.Length];
            iv.CopyTo(ret, 0);
            encoded.CopyTo(ret, iv.Length);
            tag.CopyTo(ret, iv.Length + encoded.Length);
            return ret;
        }

        private static byte[] DecryptData(byte[] data, byte[] key)
        {
            byte[] iv = data[0..12];
            byte[] chipherText = data[12..^16];
            byte[] tag = data[^16..];
            byte[] plainText = new byte[chipherText.Length];
            using (var cipher = new AesGcm(key))
            {
                cipher.Decrypt(iv, chipherText, tag, plainText);
            }
            return plainText;
        }
    }
}
