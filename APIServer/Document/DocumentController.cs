/*
    Myna API Server
    Copyright (C) 2021 Niels Stockfleth

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
using APIServer.PwdMan;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;

namespace APIServer.Document
{
    [ApiController]
    public class DocumentController : ControllerBase
    {
        public IDocumentService DocumentService { get; }

        public IPwdManService PwdManService { get; set; }

        public DocumentController(IDocumentService documentService, IPwdManService pwdManService)
        {
            DocumentService = documentService;
            PwdManService = pwdManService;
        }

        [HttpPost]
        [Route("api/document/volume")]
        public IActionResult CreateVolume([FromBody]string name)
        {
            if (string.IsNullOrEmpty(name)) throw new MissingParameterException();
            if (name?.Trim().Length > Limits.MAX_DOCUMENT_TITLE) throw new InputValueTooLargeException();
            return new JsonResult(DocumentService.CreateVolume(PwdManService, GetToken(), name));
        }

        [HttpGet]
        [Route("api/document/items")]
        public IActionResult GetItems()
        {
            return new JsonResult(DocumentService.GetItems(PwdManService, GetToken(), null));
        }

        [HttpGet]
        [Route("api/document/items/{id}")]
        public IActionResult GetItems(long id)
        {
            return new JsonResult(DocumentService.GetItems(PwdManService, GetToken(), id));
        }

        [HttpDelete]
        [Route("api/document/items/{id}")]
        public IActionResult DeleteItems(long id, [FromBody] List<long> delIds)
        {
            return new JsonResult(DocumentService.DeleteItems(PwdManService, GetToken(), id, delIds));
        }

        [HttpPut]
        [Route("api/document/items/{id}")]
        public IActionResult MoveItems(long id, [FromBody] List<long> moveIds)
        {
            return new JsonResult(DocumentService.MoveItems(PwdManService, GetToken(), id, moveIds));
        }

        [HttpPut]
        [Route("api/document/item/{id}")]
        public IActionResult RenameItem(long id, [FromBody] string name)
        {
            if (string.IsNullOrEmpty(name)) throw new MissingParameterException();
            if (name?.Trim().Length > Limits.MAX_DOCUMENT_TITLE) throw new InputValueTooLargeException();
            return new JsonResult(DocumentService.RenameItem(PwdManService, GetToken(), id, name));
        }

        [HttpPut]
        [Route("api/document/folder/{id}/accessrole")]
        public IActionResult SetFolderAccessRole(long id, [FromBody] string accessRole)
        {
            if (accessRole?.Length > Limits.MAX_ROLE_NAME) throw new InputValueTooLargeException();
            return new JsonResult(DocumentService.SetFolderAccessRole(PwdManService, GetToken(), id, accessRole));
        }

        [HttpPost]
        [Route("api/document/upload/{id}")]
        public IActionResult UploadDocument(long id, [FromForm(Name = "document-file")] IFormFile formFile, [FromForm(Name = "overwrite")] bool overwrite)
        {
            if (formFile == null) throw new MissingParameterException();
            if (string.IsNullOrEmpty(formFile.FileName)) throw new MissingParameterException();
            if (formFile.Length > Limits.MAX_DOCUMENT_UPLOAD) throw new FileTooLargeException();
            if (formFile.Length <= 0) throw new InvalidParameterException();
            if (formFile.FileName?.Trim().Length > Limits.MAX_DOCUMENT_TITLE) throw new InputValueTooLargeException();
            using var stream = formFile.OpenReadStream();
            return new JsonResult(DocumentService.UploadDocument(PwdManService, GetToken(), id, formFile.FileName, stream, overwrite));
        }

        [HttpPut]
        [Route("api/document/updatemarkdown/{id}")]
        public IActionResult UpdateMarkdown(long id, [FromBody] string markdown)
        {
            if (markdown == null) throw new MissingParameterException();
            if (markdown.Length > 1024 * 1024) throw new FileTooLargeException();
            return new JsonResult(DocumentService.UpdateMarkdown(PwdManService, GetToken(), id, markdown));
        }

        [HttpGet]
        [Route("api/document/download/{id}")]
        public IActionResult DownloadDocument(long id)
        {
            var result = DocumentService.DownloadDocument(PwdManService, GetToken(), id);
            return File(result.Stream, result.ContentType, result.FileName);
        }

        [HttpPost]
        [Route("api/document/folder/{id}")]
        public IActionResult AddFolder(long id, [FromBody] string name)
        {
            if (string.IsNullOrEmpty(name)) throw new InvalidUsernameException();
            if (name?.Trim().Length > Limits.MAX_DOCUMENT_TITLE) throw new InputValueTooLargeException();
            return new JsonResult(DocumentService.AddFolder(PwdManService, GetToken(), id, name));
        }

        // --- private

        private string GetToken()
        {
            return HttpContext.Request.Headers["token"];
        }
    }
}
