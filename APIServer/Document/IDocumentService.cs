using APIServer.Document.Model;
using APIServer.PwdMan;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace APIServer.Document
{
    public interface IDocumentService
    {
        List<ItemModel> GetItems(IPwdManService pwdManService, string authenticationToken, long? id);

        int DeleteItems(IPwdManService pwdManService, string authenticationToken, long parentId, List<long> delIds);

        ItemModel UploadDocument(IPwdManService pwdManService, string authenticationToken, long parentId, string name, long size, Stream stream);

        DownloadResult DownloadDocument(IPwdManService pwdManService, string authenticationToken, long id);

        ItemModel AddFolder(IPwdManService pwdManService, string authenticationToken, long parentId, string name);

        bool RenameItem(IPwdManService pwdManService, string authenticationToken, long id, string name);

        int MoveItems(IPwdManService pwdManService, string authenticationToken, long destinationId, List<long> moveIds);
    }
}
