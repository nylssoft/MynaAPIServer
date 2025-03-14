﻿/*
    Myna API Server
    Copyright (C) 2023-2025 Niels Stockfleth

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
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
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

        private IConfiguration Configuration { get; }

        public AppointmentService(IConfiguration configuration, ILogger<AppointmentService> logger)
        {
            Configuration = configuration;
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
            return now;
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

        public DateTime? GetLastModified(IPwdManService pwdManService, string uuid)
        {
            logger.LogDebug("Get last modified...");
            var dbContext = pwdManService.GetDbContext();
            var modifiedUtc = dbContext.DbAppointments
                .Where(a => a.Uuid == uuid)
                .Select(a => a.ModifiedUtc)
                .SingleOrDefault();
            return DbMynaContext.GetUtcDateTime(modifiedUtc);
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

        public DateTime UpdateAppointment(IPwdManService pwdManService, string authenticationToken, string uuid, AppointmentDefinitionModel definition, string securityKey)
        {
            logger.LogDebug("Update appointment...");
            var user = pwdManService.GetUserFromToken(authenticationToken);
            CheckDefinition(definition);
            FilterPastOptions(definition);
            var dbContext = pwdManService.GetDbContext();
            var dbAppointment = dbContext.DbAppointments
                .Where(a => a.Uuid == uuid && a.DbUserId == user.Id)
                .Include(a => a.Votes)
                .SingleOrDefault() ?? throw new InvalidParameterException();
            var appointment = ConvertDbAppointment(dbAppointment, securityKey);
            var optionDateTimes = GetOptionDateTimes(definition.Options);
            if (optionDateTimes.Count == 0)
            {
                throw new InvalidParameterException();
            }
            CleanupInvalidVotes(dbAppointment, appointment, definition, securityKey);
            appointment.Definition.Options = definition.Options;
            // description has to be specified
            if (definition.Description.Trim().Length == 0)
            {
                throw new InvalidParameterException();
            }
            appointment.Definition.Description = definition.Description;
            var voteDateTimes = GetVoteDateTimes(appointment.Votes);
            // if no votes exist any participants can be changed
            if (!voteDateTimes.Any())
            {
                appointment.Definition.Participants = definition.Participants;
                dbAppointment.Votes = new();
                definition.Participants.ForEach(p =>
                {
                    dbAppointment.Votes.Add(new DbVote { UserUuid = p.UserUuid, Content = Encrypt("[]", securityKey) });
                });
            }
            // participans can only be extended if votes already exist
            else
            {
                var existingNames = appointment.Definition.Participants.Select(p => p.Username).ToHashSet();
                var updateNames = definition.Participants.Select(p => p.Username).ToHashSet();
                var commonNames = existingNames.Intersect(updateNames);
                if (commonNames.Count() != existingNames.Count)
                {
                    throw new InvalidParameterException();
                }
                var addNames = updateNames.Except(commonNames);
                if (addNames.Any())
                {
                    appointment.Definition.Participants = definition.Participants;
                    foreach (var add in addNames)
                    {
                        var p = definition.Participants.Where(p => p.Username == add).First();
                        dbAppointment.Votes.Add(new DbVote { UserUuid = p.UserUuid, Content = Encrypt("[]", securityKey) });
                    }
                }
            }
            var now = DateTime.UtcNow;
            dbAppointment.Content = Encrypt(JsonSerializer.Serialize(appointment.Definition), securityKey);
            dbAppointment.ModifiedUtc = now;
            dbContext.SaveChanges();
            return now;
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
                    var now = DateTime.UtcNow;
                    dbVote.Content = Encrypt(newContent, securityKey);
                    dbAppointment.ModifiedUtc = now;
                    dbContext.SaveChanges();
                    return now;
                }
            }
            return null;
        }

        public string GenerateAccessToken(IPwdManService pwdManService, string authenticationToken, string uuid)
        {
            logger.LogDebug("Generate access token...");
            pwdManService.GetUserFromToken(authenticationToken);
            string securityKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
            string hash = Hash(uuid, securityKey);
            return $"{hash}#{uuid}#{securityKey}";
        }

        public string GetSecurityKey(string uuid, string accessToken)
        {
            try
            {
                var arr = accessToken?.Split('#');
                if (arr?.Length == 3 && arr[0] == Hash(arr[1], arr[2]) && arr[1] == uuid)
                {
                    return arr[2];
                }
            }
            catch
            {
                // ignored
            }
            throw new InvalidParameterException();
        }

        private string Hash(string uuid, string securityKey)
        {
            using var hmac = new HMACSHA256(Encoding.ASCII.GetBytes(GetOptions().SignKey));
            byte[] hashBytes = hmac.ComputeHash(Combine(Encoding.ASCII.GetBytes(uuid), Convert.FromBase64String(securityKey)));
            return Convert.ToBase64String(hashBytes);
        }

        private static byte[] Combine(byte[] first, byte[] second)
        {
            byte[] ret = new byte[first.Length + second.Length];
            Buffer.BlockCopy(first, 0, ret, 0, first.Length);
            Buffer.BlockCopy(second, 0, ret, first.Length, second.Length);
            return ret;
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
                string.IsNullOrEmpty(definition.Description) ||
                definition.Participants == null ||
                definition.Options == null)
            {
                return false;
            }
            definition.Participants = definition.Participants.Distinct().ToList();
            if (definition.Participants.Count > Limits.MAX_APPOINTMENT_PARTICIPANTS ||
                definition.Options.Count > Limits.MAX_APPOINTMENT_OPTIONS)
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
                if (opt.Days.Any(d => d is < 1 or > 31))
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
                string.IsNullOrEmpty(vote.UserUuid) ||
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
            if (!string.IsNullOrEmpty(securityKey))
            {
                byte[] cryptoKey = Convert.FromBase64String(securityKey);
                return DecodeText(encryptedText, cryptoKey);
            }
            return encryptedText;
        }

        private static string Encrypt(string plainText, string securityKey)
        {
            if (!string.IsNullOrEmpty(securityKey))
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
            using (var cipher = new AesGcm(key, 16))
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
            using (var cipher = new AesGcm(key, 16))
            {
                cipher.Decrypt(iv, chipherText, tag, plainText);
            }
            return plainText;
        }

        private AppointmentOptions GetOptions()
        {
            var opt = Configuration.GetSection("Appointment").Get<AppointmentOptions>();
            return opt ?? new AppointmentOptions();
        }

        private static HashSet<DateTime> GetOptionDateTimes(List<AppointmentOptionModel> options)
        {
            var ret = new HashSet<DateTime>();
            foreach (var option in options)
            {
                foreach (var day in option.Days)
                {
                    ret.Add(new DateTime(option.Year, option.Month, day));
                }
            }
            return ret;
        }

        private static HashSet<DateTime> GetVoteDateTimes(List<AppointmentVoteModel> votes)
        {
            var ret = new HashSet<DateTime>();
            foreach (var vote in votes)
            {
                foreach (var dateTime in GetOptionDateTimes(vote.Accepted))
                {
                    ret.Add(dateTime);
                }
            }
            return ret;
        }

        private static void FilterPastOptions(AppointmentDefinitionModel definition)
        {
            DateTime now = DateTime.UtcNow;
            definition.Options = definition.Options.Where(option => option.Year > now.Year || option.Year == now.Year && option.Month >= now.Month).ToList();
        }

        private static void CleanupInvalidVotes(DbAppointment dbAppointment, AppointmentModel appointment, AppointmentDefinitionModel definition, string securityKey)
        {
            var cleanupVoteDateTimes = GetVoteDateTimes(appointment.Votes).Except(GetOptionDateTimes(definition.Options));
            if (!cleanupVoteDateTimes.Any()) return;
            foreach (var dbVote in dbAppointment.Votes)
            {
                bool updateVote = false;
                var currentVote = ConvertDbVote(dbVote, securityKey);
                var newAccepted = new List<AppointmentOptionModel>();
                foreach (var accepted in currentVote.Accepted)
                {
                    foreach (var cleanupDateTime in cleanupVoteDateTimes)
                    {
                        if (accepted.Year == cleanupDateTime.Year
                            && accepted.Month == cleanupDateTime.Month
                            && accepted.Days.Remove(cleanupDateTime.Day))
                        {
                            updateVote = true;
                        }
                    }
                    if (accepted.Days.Count > 0)
                    {
                        newAccepted.Add(accepted);
                    }
                }
                if (updateVote)
                {
                    currentVote.Accepted = newAccepted;
                    var newContent = JsonSerializer.Serialize(currentVote.Accepted);
                    dbVote.Content = Encrypt(newContent, securityKey);
                }
            }
        }

    }
}
