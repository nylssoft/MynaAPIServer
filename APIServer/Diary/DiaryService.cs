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
using APIServer.Diary.Model;
using APIServer.PwdMan;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;

namespace APIServer.Diary
{
    public class DiaryService : IDiaryService
    {
        private readonly ILogger logger;

        public DiaryService(ILogger<DiaryService> logger)
        {
            this.logger = logger;
        }

        public DiaryEntryModel GetEntry(IPwdManService pwdManService, string authenticationToken, DateTime date)
        {
            logger.LogDebug("Get diary entry for {date}...", date);
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            date = new DateTime(date.Year, date.Month, date.Day, 0, 0, 0, DateTimeKind.Utc);
            var diary = dbContext.DbDiaries.SingleOrDefault((d) => d.DbUserId == user.Id && d.Date == date);
            if (diary != null)
            {
                return new DiaryEntryModel
                {
                    Date = diary.Date,
                    Entry = diary.Entry
                };
            }
            return null;
        }

        public List<DiaryEntryModel> GetMonthEntries(IPwdManService pwdManService, string authenticationToken, DateTime date)
        {
            logger.LogDebug("Get diary month entries for {date}...", date);
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var first = new DateTime(date.Year, date.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var last = new DateTime(date.Year, date.Month, DateTime.DaysInMonth(date.Year, date.Month), 0, 0, 0, DateTimeKind.Utc);
            var diaries = dbContext.DbDiaries
                .Where((d) => d.DbUserId == user.Id &&
                    d.Date >= first && d.Date <= last &&
                    d.Entry.Trim().Length > 0)
                .OrderBy((d) => d.Date);
            var ret = new List<DiaryEntryModel>();
            foreach (var diary in diaries)
            {
                ret.Add(new DiaryEntryModel { Date = diary.Date, Entry = diary.Entry });
            }
            return ret;
        }

        public List<int> GetDaysWithEntries(IPwdManService pwdManService, string authenticationToken, DateTime date)
        {
            logger.LogDebug("Get days in month with diary entries for {date}...", date);
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var first = new DateTime(date.Year, date.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var last = new DateTime(date.Year, date.Month, DateTime.DaysInMonth(date.Year, date.Month), 0, 0, 0, DateTimeKind.Utc);
            var diaries = dbContext.DbDiaries
                .Where((d) => d.DbUserId == user.Id &&
                    d.Date >= first && d.Date <= last &&
                    d.Entry.Trim().Length > 0)
                .OrderBy((d) => d.Date);
            var ret = new List<int>();
            foreach (var diary in diaries)
            {
                ret.Add(diary.Date.Day);
            }
            return ret;
        }

        public void SetEntry(IPwdManService pwdManService, string authenticationToken, DiaryEntryModel model)
        {
            logger.LogDebug("Set diary entry  for {date}...", model.Date);
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var date = new DateTime(model.Date.Year, model.Date.Month, model.Date.Day, 0, 0, 0, DateTimeKind.Utc);
            var diary = dbContext.DbDiaries.SingleOrDefault((d) => d.DbUserId == user.Id && d.Date == date);
            if (diary == null)
            {
                diary = new DbDiary { DbUserId = user.Id, Date = date, Entry = model.Entry };
                dbContext.DbDiaries.Add(diary);
            }
            else
            {
                if (string.IsNullOrEmpty(model.Entry))
                {
                    dbContext.DbDiaries.Remove(diary);
                }
                else
                {
                    diary.Entry = model.Entry;
                }
            }
            dbContext.SaveChanges();
        }

        public List<DateTime> GetAllEntries(IPwdManService pwdManService, string authenticationToken)
        {
            logger.LogDebug("Get all entries");
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var diaries = dbContext.DbDiaries
                .Where((d) => d.DbUserId == user.Id && d.Entry.Trim().Length > 0)
                .OrderBy((d) => d.Date);
            var ret = new List<DateTime>();
            foreach (var diary in diaries)
            {
                ret.Add(diary.Date);
            }
            return ret;
        }
    }
}
