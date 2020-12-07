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
using Microsoft.AspNetCore.Mvc;

namespace APIServer.Notes
{
    [ApiController]
    public class NotesController : ControllerBase
    {
        public INotesService NotesService { get; }

        public IPwdManService PwdManService { get; set; }

        public NotesController(INotesService notesService, IPwdManService pwdManService)
        {
            NotesService = notesService;
            PwdManService = pwdManService;
        }

        [HttpGet]
        [Route("api/notes/note")]
        public IActionResult GetNotes()
        {
            return new JsonResult(NotesService.GetNotes(PwdManService, GetToken()));
        }

        [HttpGet]
        [Route("api/notes/note/{id}")]
        public IActionResult GetNode(long id)
        {
            return new JsonResult(NotesService.GetNote(PwdManService, GetToken(), id));
        }

        [HttpDelete]
        [Route("api/notes/note/{id}")]
        public IActionResult DeleteNode(long id)
        {
            return new JsonResult(NotesService.DeleteNote(PwdManService, GetToken(), id));
        }

        [HttpPut]
        [Route("api/notes/note")]
        public IActionResult UpdateNote([FromBody] NoteModel noteModel)
        {
            return new JsonResult(NotesService.UpdateNote(PwdManService, GetToken(), noteModel));
        }

        [HttpPost]
        [Route("api/notes/note")]
        public IActionResult AddNote([FromBody] NoteModel noteModel)
        {
            NotesService.AddNote(PwdManService, GetToken(), noteModel);
            return new JsonResult(true);
        }

        // --- private

        private string GetToken()
        {
            return HttpContext.Request.Headers["token"];
        }

    }
}
