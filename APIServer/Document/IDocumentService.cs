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
using APIServer.Database;
using APIServer.Document.Model;
using APIServer.PwdMan;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace APIServer.Document
{
    public interface IDocumentService
    {
        ItemModel CreateVolume(IPwdManService pwdManService, string authenticationToken, string name);

        List<ItemModel> GetItems(IPwdManService pwdManService, string authenticationToken, long? id);

        int DeleteItems(IPwdManService pwdManService, string authenticationToken, long parentId, List<long> delIds);

        ItemModel UploadDocument(IPwdManService pwdManService, string authenticationToken, long parentId, string name, Stream stream, bool overwrite);

        DownloadResult DownloadDocument(IPwdManService pwdManService, string authenticationToken, long id);

        bool UpdateMarkdown(IPwdManService pwdManService, string authenticationToken, long id, string markdown);

        ItemModel AddFolder(IPwdManService pwdManService, string authenticationToken, long parentId, string name);

        bool RenameItem(IPwdManService pwdManService, string authenticationToken, long id, string name);

        int MoveItems(IPwdManService pwdManService, string authenticationToken, long destinationId, List<long> moveIds);

        bool SetFolderAccessRole(IPwdManService pwdManService, string authenticationToken, long id, string accessRole);

        // --- contacts

        string GetContacts(IPwdManService pwdManService, string authenticationToken);

        bool SetContacts(IPwdManService pwdManService, string authenticationToken, string encodedContent);

        bool DeleteContacts(IPwdManService pwdManService, string authenticationToken);

        // --- messages

        void SetKeyPair(IPwdManService pwdManService, string authenticationToken, string publicKey, string privateKey);

        void DeleteKeyPair(IPwdManService pwdManService, string authenticationToken);

        string GetPrivateKey(IPwdManService pwdManService, string authenticationToken);

        string GetPublicKey(IPwdManService pwdManService, string authenticationToken, string emailAddress);

        List<ItemModel> GetMessages(IPwdManService pwdManService, string authenticationToken);

        int DeleteMessages(IPwdManService pwdManService, string authenticationToken, List<long> delIds);

        void SendMessage(IPwdManService pwdManService, string authenticationToken, string emailAddress, Stream stream);

        DownloadResult DownloadMessage(IPwdManService pwdManService, string authenticationToken, long id);
    }
}
