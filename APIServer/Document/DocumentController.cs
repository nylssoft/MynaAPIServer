using APIServer.PwdMan;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

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
            return new JsonResult(DocumentService.RenameItem(PwdManService, GetToken(), id, name));
        }

        [HttpPost]
        [Route("api/document/upload/{id}")]
        public IActionResult UploadDocument(long id, [FromForm(Name = "document-file")] IFormFile formFile)
        {
            if (formFile == null) throw new PwdManInvalidArgumentException("Datei fehlt.");
            if (formFile.Length > 10 * 1024 * 1024) throw new PwdManInvalidArgumentException("Datei grösser als 10 MB.");
            using var stream = formFile.OpenReadStream();
            return new JsonResult(DocumentService.UploadDocument(
                PwdManService, GetToken(),
                id, formFile.FileName, formFile.Length, stream));
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
            return new JsonResult(DocumentService.AddFolder(PwdManService, GetToken(), id, name));
        }

        // --- private

        private string GetToken()
        {
            return HttpContext.Request.Headers["token"];
        }
    }
}
