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
using APIServer.Database;
using APIServer.Notes.Model;
using APIServer.PwdMan;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;

namespace APIServer.Notes
{
    public class NotesService : INotesService
    {
        private readonly ILogger logger;

        public NotesService(ILogger<NotesService> logger)
        {
            this.logger = logger;
        }

        public List<NoteModel> GetNotes(IPwdManService pwdManService, string authenticationToken)
        {
            logger.LogDebug("Get notes...");
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var notes = dbContext.DbNotes.Where((n) => n.DbUserId == user.Id).OrderByDescending((n) => n.ModifiedUtc);
            var ret = new List<NoteModel>();
            foreach (var note in notes)
            {
                ret.Add(new NoteModel { Id = note.Id, Title = note.Title });
            }
            return ret;
        }

        public NoteModel GetNote(IPwdManService pwdManService, string authenticationToken, long id)
        {
            logger.LogDebug("Get note for ID {id}...", id);
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var note = dbContext.DbNotes.SingleOrDefault(
                (n) => n.Id == id && n.DbUserId == user.Id);
            if (note != null)
            {
                return new NoteModel
                {
                    Id = note.Id,
                    LastModifiedUtc = DbMynaContext.GetUtcDateTime(note.ModifiedUtc).Value,
                    Title = note.Title,
                    Content = note.Content
                };
            }
            return null;
        }

        public bool UpdateNote(IPwdManService pwdManService, string authenticationToken, NoteModel noteModel)
        {
            logger.LogDebug("Update note ID {noteModel.Id}...", noteModel.Id);
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var note = dbContext.DbNotes.SingleOrDefault(
                (n) => n.Id == noteModel.Id && n.DbUserId == user.Id);
            if (note != null && (note.Title != noteModel.Title || note.Content != noteModel.Content))
            {
                note.Title = noteModel.Title;
                note.Content = noteModel.Content;
                note.ModifiedUtc = DateTime.UtcNow;
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public long AddNote(IPwdManService pwdManService, string authenticationToken, NoteModel noteModel)
        {
            logger.LogDebug("Add note...");
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var note = new DbNote
            {
                DbUserId = user.Id,
                Title = noteModel.Title,
                Content = noteModel.Content,
                ModifiedUtc = DateTime.UtcNow
            };
            dbContext.DbNotes.Add(note);
            dbContext.SaveChanges();
            return note.Id;
        }

        public bool DeleteNote(IPwdManService pwdManService, string authenticationToken, long id)
        {
            logger.LogDebug("Delete note ID {id}", id);
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var note = dbContext.DbNotes.SingleOrDefault(
                (n) => n.Id == id && n.DbUserId == user.Id);
            if (note != null)
            {
                dbContext.DbNotes.Remove(note);
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

    }
}
