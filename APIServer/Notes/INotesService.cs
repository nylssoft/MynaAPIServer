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
using APIServer.Notes.Model;
using APIServer.PwdMan;
using System.Collections.Generic;

namespace APIServer.Notes
{
    public interface INotesService
    {
        List<NoteModel> GetNotes(IPwdManService pwdManService, string authenticationToken);

        NoteModel GetNote(IPwdManService pwdManService, string authenticationToken, long id);

        bool UpdateNote(IPwdManService pwdManService, string authenticationToken, NoteModel noteModel);

        long AddNote(IPwdManService pwdManService, string authenticationToken, NoteModel noteModel);

        bool DeleteNote(IPwdManService pwdManService, string authenticationToken, long id);
    }
}
