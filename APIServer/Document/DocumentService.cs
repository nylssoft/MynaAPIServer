/*
    Myna API Server
    Copyright (C) 2021-2025 Niels Stockfleth

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
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace APIServer.Document
{
    public class DocumentService(ILogger<DocumentService> logger, IMemoryCache memoryCache) : IDocumentService
    {
        private readonly ILogger logger = logger;

        private readonly IMemoryCache memoryCache = memoryCache;

        public ItemModel CreateVolume(IPwdManService pwdManService, string authenticationToken, string name)
        {
            logger.LogDebug("Create volume '{name}'...", name);
            name = name.Trim();
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var docItem = GetVolume(dbContext, user);
            if (docItem == null)
            {
                docItem = new DbDocItem
                {
                    Name = name,
                    Type = DbDocItemType.Volume,
                    OwnerId = user.Id
                };
                dbContext.DbDocItems.Add(docItem);
                dbContext.SaveChanges();
            }
            return ConvertToItemModel(docItem);
        }

        public List<ItemModel> GetItems(IPwdManService pwdManService, string authenticationToken, long? id)
        {
            logger.LogDebug("Get items for item ID {id}...", id);
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var ret = new List<ItemModel>();
            var docItem = GetItemById(dbContext, user, id);
            if (docItem != null)
            {
                // current item, path items and all direct children
                ret.Add(ConvertToItemModel(docItem));
                ret.AddRange(ConvertToItemModel(GetPath(dbContext, user, docItem)));
                ret.AddRange(ConvertToItemModel(GetChildren(dbContext, user, docItem)));
            }
            return ret;
        }

        public ItemModel UploadDocument(IPwdManService pwdManService, string authenticationToken, long parentId, string name, Stream stream, bool overwrite)
        {
            logger.LogDebug("Upload document with '{name}' into parent ID {parentId}...", name, parentId);
            name = name.Trim();
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var sum = dbContext.DbDocItems.Where(item => item.OwnerId == user.Id).Sum(item => item.Size);
            var parentItem = GetItemById(dbContext, user, parentId);
            if (parentItem != null)
            {
                DbDocItem docItem = null;
                if (overwrite)
                {
                    docItem = dbContext.DbDocItems.
                        Include(item => item.Content).
                        SingleOrDefault(item =>
                            item.Type == DbDocItemType.Item &&
                            item.ParentId == parentId &&
                            item.OwnerId == user.Id &&
                            item.Name == name);
                    if (docItem != null)
                    {
                        sum -= docItem.Size;
                    }
                }
                var ms = new MemoryStream();
                stream.CopyTo(ms);
                var size = ms.Length;
                if (sum + size > user.StorageQuota)
                {
                    throw new StorageQuotaExceededException();
                }
                if (docItem != null)
                {
                    docItem.Size = size;
                    docItem.Content.Data = ms.ToArray();
                    docItem.AccessRole = parentItem.AccessRole;
                }
                else
                {
                    docItem = new DbDocItem
                    {
                        Name = name,
                        Type = DbDocItemType.Item,
                        OwnerId = user.Id,
                        ParentId = parentId,
                        Size = size,
                        Content = new DbDocContent { Data = ms.ToArray() },
                        AccessRole = parentItem.AccessRole
                    };
                    dbContext.DbDocItems.Add(docItem);
                    parentItem.Children += 1;
                }
                dbContext.SaveChanges();
                return ConvertToItemModel(docItem);
            }
            return null;
        }

        public DownloadResult DownloadDocument(IPwdManService pwdManService, string authenticationToken, long id)
        {
            logger.LogDebug("Download content for item ID {id}...", id);
            var dbContext = pwdManService.GetDbContext();
            var docItem = dbContext.DbDocItems
                 .SingleOrDefault(item => item.Type == DbDocItemType.Item && item.Id == id);
            if (docItem == null || !docItem.ContentId.HasValue)
            {
                throw new AccessDeniedPermissionException();
            }
            if (!AccessRole.IsEverbody(docItem.AccessRole))
            {
                var user = pwdManService.GetUserFromToken(authenticationToken);
                if (AccessRole.IsOwner(docItem.AccessRole))
                {
                    if (user.Id != docItem.OwnerId)
                    {
                        throw new AccessDeniedPermissionException();
                    }
                }
                else if (!pwdManService.HasRole(user, docItem.AccessRole))
                {
                    throw new AccessDeniedPermissionException();
                }
            }
            var docContent = dbContext.DbDocContents.Single(c => c.Id == docItem.ContentId);
            return new DownloadResult
            {
                Stream = new MemoryStream(docContent.Data),
                FileName = docItem.Name,
                ContentType = "application/octet-stream"
            };
        }

        public ItemModel AddFolder(IPwdManService pwdManService, string authenticationToken, long parentId, string name)
        {
            logger.LogDebug("Add folder '{name}' into parent ID {parentId}...", name, parentId);
            name = name.Trim();
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var parentItem = GetItemById(dbContext, user, parentId);
            if (parentItem != null)
            {
                var docItem = new DbDocItem
                {
                    Name = name,
                    Type = DbDocItemType.Folder,
                    OwnerId = user.Id,
                    ParentId = parentId
                };
                dbContext.DbDocItems.Add(docItem);
                parentItem.Children += 1;
                dbContext.SaveChanges();
                return ConvertToItemModel(docItem);
            }
            return null;
        }

        public int DeleteItems(IPwdManService pwdManService, string authenticationToken, long parentId, List<long> delIds)
        {
            logger.LogDebug("Delete {cnt} item(s) in parent ID {parentId}...", delIds.Count, parentId);
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var removeItems = new List<DbDocItem>();
            var parent = GetItemById(dbContext, user, parentId);
            if (parent != null)
            {
                // delete only items that are contained in the parent folder
                var delItems = dbContext.DbDocItems.Where(
                    item =>
                        item.OwnerId == user.Id &&
                        item.ParentId == parentId &&
                        delIds.Contains(item.Id)).ToList();
                foreach (var delItem in delItems)
                {
                    removeItems.Add(delItem);
                    parent.Children -= 1;
                    // add all children if a folder is deleted
                    if (delItem.Type == DbDocItemType.Folder)
                    {
                        removeItems.AddRange(GetAllChildren(dbContext, user, delItem));
                    }
                }
            }
            foreach (var delItem in removeItems)
            {
                if (delItem.ContentId.HasValue)
                {
                    dbContext.DbDocContents.Remove(new DbDocContent { Id = delItem.ContentId.Value });
                }
            }
            if (removeItems.Any())
            {
                dbContext.DbDocItems.RemoveRange(removeItems);
                dbContext.SaveChanges();
            }
            return removeItems.Count;
        }

        public bool RenameItem(IPwdManService pwdManService, string authenticationToken, long id, string name)
        {
            logger.LogDebug("Rename item ID {id} to '{name}'...", id, name);
            name = name.Trim();
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var docItem = GetItemById(dbContext, user, id);
            if (docItem != null && docItem.Name != name)
            {
                docItem.Name = name;
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public bool UpdateMarkdown(IPwdManService pwdManService, string authenticationToken, long id, string markdown)
        {
            logger.LogDebug("Update markdown for item ID {id}...", id);
            var user = pwdManService.GetUserFromToken(authenticationToken);
            if (!pwdManService.HasRole(user, "usermanager"))
            {
                throw new AccessDeniedPermissionException();
            }
            var dbContext = pwdManService.GetDbContext();
            var docItem = dbContext.DbDocItems.
                Include(item => item.Content).
                SingleOrDefault(item => item.OwnerId == user.Id && item.Id == id);
            if (docItem == null || docItem.Type != DbDocItemType.Item || !docItem.Name.EndsWith(".md"))
            {
                throw new InvalidParameterException();
            }
            var sum = dbContext.DbDocItems.Where(item => item.OwnerId == user.Id).Sum(item => item.Size);
            sum -= docItem.Size;
            var bytes = Encoding.UTF8.GetBytes(markdown);
            var size = bytes.Length;
            if (sum + size > user.StorageQuota)
            {
                throw new StorageQuotaExceededException();
            }
            docItem.Size = size;
            docItem.Content.Data = bytes;
            dbContext.SaveChanges();
            memoryCache.Remove($"markdown-{id}");
            return true;
        }

        public bool SetFolderAccessRole(IPwdManService pwdManService, string authenticationToken, long id, string accessRole)
        {
            logger.LogDebug("Update item access for ID {id} to '{access}'...", id, accessRole);
            var user = pwdManService.GetUserFromToken(authenticationToken);
            if (!pwdManService.HasRole(user, "usermanager"))
            {
                throw new AccessDeniedPermissionException();
            }
            var dbContext = pwdManService.GetDbContext();
            var docItem = GetItemById(dbContext, user, id);
            if (docItem != null && docItem.Type == DbDocItemType.Folder && docItem.AccessRole != accessRole)
            {
                docItem.AccessRole = accessRole;
                dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        public int MoveItems(IPwdManService pwdManService, string authenticationToken, long destinationId, List<long> moveIds)
        {
            logger.LogDebug("Move {cnt} item(s) to item ID {destinationId}...", moveIds.Count, destinationId);
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            int moved = 0;
            var destination = GetItemById(dbContext, user, destinationId);
            if (destination != null)
            {
                // skip all items that are in destination path
                // skip all items that have already the destination as parent
                // skip the destination item itself
                var destPathIds = GetPath(dbContext, user, destination).Select(item => item.Id);
                var moveItems = dbContext.DbDocItems.Where(
                    item =>
                        item.OwnerId == user.Id &&
                        moveIds.Contains(item.Id) &&
                        item.Id != destinationId &&
                        item.ParentId != destinationId &&
                        !destPathIds.Contains(item.Id)).ToList();
                foreach (var moveItem in moveItems)
                {
                    var oldParent = GetItemById(dbContext, user, moveItem.ParentId);
                    if (oldParent != null)
                    {
                        oldParent.Children -= 1;
                    }
                    moveItem.ParentId = destinationId;
                    destination.Children += 1;
                    moved++;
                }
                if (moveItems.Any())
                {
                    dbContext.SaveChanges();
                }
            }
            return moved;
        }

        // --- messages

        public void SetKeyPair(IPwdManService pwdManService, string authenticationToken, string publicKey, string privateKey)
        {
            DbUser user = pwdManService.GetUserFromToken(authenticationToken);
            DbMynaContext dbContext = pwdManService.GetDbContext();
            int cntMessages = dbContext.DbDocItems.Count((item) => item.OwnerId == user.Id && item.Type == DbDocItemType.Message);
            if (cntMessages > 0)
            {
                // TODO: appropriate exception, messages still exist
                throw new InvalidParameterException();
            }
            SetTextDocumentByType(dbContext, publicKey, DbDocItemType.PublicKey, "$$publickey$$", user);
            SetTextDocumentByType(dbContext, privateKey, DbDocItemType.PrivateKey, "$$privatekey$$", user);
        }

        public void DeleteKeyPair(IPwdManService pwdManService, string authenticationToken)
        {
            DbUser user = pwdManService.GetUserFromToken(authenticationToken);
            DbMynaContext dbContext = pwdManService.GetDbContext();
            int cntMessages = dbContext.DbDocItems.Count((item) => item.OwnerId == user.Id && item.Type == DbDocItemType.Message);
            if (cntMessages > 0)
            {
                // TODO: appropriate exception, messages still exist
                throw new InvalidParameterException();
            }
            _ = DeleteTextDocumentByType(dbContext, DbDocItemType.PublicKey, user.Id);
            _ = DeleteTextDocumentByType(dbContext, DbDocItemType.PrivateKey, user.Id);
        }

        public string GetPrivateKey(IPwdManService pwdManService, string authenticationToken)
        {
            DbUser user = pwdManService.GetUserFromToken(authenticationToken);
            return GetTextDocumentByType(pwdManService.GetDbContext(), DbDocItemType.PrivateKey, user.Id);
        }

        public string GetPublicKey(IPwdManService pwdManService, string authenticationToken, string emailAddress)
        {
            DbUser user = pwdManService.GetUserFromToken(authenticationToken);
            if (!string.IsNullOrEmpty(emailAddress))
            {
                emailAddress = emailAddress.ToLowerInvariant();
                user = pwdManService.GetDbContext().DbUsers.SingleOrDefault((u) => u.Email == emailAddress);
                if (user == null)
                {
                    throw new InvalidEmailAddressException();
                }
            }
            return GetTextDocumentByType(pwdManService.GetDbContext(), DbDocItemType.PublicKey, user.Id);
        }

        public List<ItemModel> GetMessages(IPwdManService pwdManService, string authenticationToken)
        {
            DbUser user = pwdManService.GetUserFromToken(authenticationToken);
            DbMynaContext dbContext = pwdManService.GetDbContext();
            List<ItemModel> ret = [];
            foreach (DbDocItem item in dbContext.DbDocItems.Where(item => item.OwnerId == user.Id && item.Type == DbDocItemType.Message))
            {
                ret.AddRange(ConvertToItemModel(item));
            }
            return ret;
        }

        public int DeleteMessages(IPwdManService pwdManService, string authenticationToken, List<long> delIds)
        {
            DbUser user = pwdManService.GetUserFromToken(authenticationToken);
            DbMynaContext dbContext = pwdManService.GetDbContext();
            List<DbDocItem> removeItems = [];
            foreach (DbDocItem delItem in dbContext.DbDocItems.Where(
                item =>
                    item.OwnerId == user.Id &&
                    item.Type == DbDocItemType.Message &&
                    delIds.Contains(item.Id)))
            {
                _ = dbContext.DbDocContents.Remove(new DbDocContent { Id = delItem.ContentId.Value });
                removeItems.Add(delItem);
            }
            if (removeItems.Count != 0)
            {
                dbContext.DbDocItems.RemoveRange(removeItems);
                _ = dbContext.SaveChanges();
            }
            return removeItems.Count;
        }

        public void SendMessage(IPwdManService pwdManService, string authenticationToken, string recipientEmailAddress, Stream stream)
        {
            DbUser sender = pwdManService.GetUserFromToken(authenticationToken);
            recipientEmailAddress = recipientEmailAddress.ToLowerInvariant();
            DbMynaContext dbContext = pwdManService.GetDbContext();
            DbUser recpient = dbContext.DbUsers.SingleOrDefault((u) => u.Email == recipientEmailAddress) ?? throw new InvalidEmailAddressException();
            string publicKeySender = GetTextDocumentByType(dbContext, DbDocItemType.PublicKey, sender.Id);
            string publicKeyRecipient = GetTextDocumentByType(dbContext, DbDocItemType.PublicKey, recpient.Id);
            // recipient or sender not enabled for message sending
            if (publicKeyRecipient == null || publicKeySender == null)
            {
                // TODO: appropriate exception
                throw new InvalidParameterException();
            }
            long sum = dbContext.DbDocItems.Where(item => item.OwnerId == recpient.Id).Sum(item => item.Size);
            MemoryStream ms = new();
            stream.CopyTo(ms);
            long size = ms.Length;
            if (sum + size > recpient.StorageQuota)
            {
                throw new StorageQuotaExceededException();
            }
            DateTimeOffset utcOffset = new(DateTime.Now);
            DbDocItem docItem = new()
            {
                Name = $"{sender.Email}:{sender.Name}:{utcOffset.ToUnixTimeMilliseconds()}",
                Type = DbDocItemType.Message,
                OwnerId = recpient.Id,
                Size = size,
                Content = new DbDocContent { Data = ms.ToArray() }
            };
            _ = dbContext.DbDocItems.Add(docItem);
            _ = dbContext.SaveChanges();
        }

        public DownloadResult DownloadMessage(IPwdManService pwdManService, string authenticationToken, long id)
        {
            DbUser user = pwdManService.GetUserFromToken(authenticationToken);
            DbMynaContext dbContext = pwdManService.GetDbContext();
            DbDocItem docItem = dbContext.DbDocItems
                 .SingleOrDefault(item => item.Type == DbDocItemType.Message && item.OwnerId == user.Id && item.Id == id);
            if (docItem == null || !docItem.ContentId.HasValue)
            {
                throw new AccessDeniedPermissionException();
            }
            DbDocContent docContent = dbContext.DbDocContents.Single(c => c.Id == docItem.ContentId);
            return new DownloadResult
            {
                Stream = new MemoryStream(docContent.Data),
                FileName = docItem.Name,
                ContentType = "application/octet-stream"
            };
        }

        // --- contacts

        public string GetContacts(IPwdManService pwdManService, string authenticationToken)
        {
            var user = pwdManService.GetUserFromToken(authenticationToken);
            return GetTextDocumentByType(pwdManService.GetDbContext(), DbDocItemType.Contacts, user.Id);
        }

        public bool SetContacts(IPwdManService pwdManService, string authenticationToken, string encodedContent)
        {
            var user = pwdManService.GetUserFromToken(authenticationToken);
            SetTextDocumentByType(pwdManService.GetDbContext(), encodedContent, DbDocItemType.Contacts, "$$contacts$$", user);
            return true;
        }

        public bool DeleteContacts(IPwdManService pwdManService, string authenticationToken)
        {
            var user = pwdManService.GetUserFromToken(authenticationToken);
            return DeleteTextDocumentByType(pwdManService.GetDbContext(), DbDocItemType.Contacts, user.Id);
        }

        // ---- private methods

        private static string GetTextDocumentByType(DbMynaContext dbContext, DbDocItemType type, long userId)
        {
            DbDocItem item = dbContext.DbDocItems.
                Include(item => item.Content).
                SingleOrDefault(item => item.OwnerId == userId && item.Type == type);
            return item == null ? null : Encoding.UTF8.GetString(item.Content.Data);
        }

        private static void SetTextDocumentByType(DbMynaContext dbContext, string content, DbDocItemType type, string typeName, DbUser user)
        {
            long sum = dbContext.DbDocItems.Where(item => item.OwnerId == user.Id).Sum(item => item.Size);
            byte[] data = Encoding.UTF8.GetBytes(content);
            DbDocItem item = dbContext.DbDocItems.
                Include(item => item.Content).
                SingleOrDefault(item => item.OwnerId == user.Id && item.Type == type);
            if (item == null)
            {
                item = new DbDocItem
                {
                    Name = typeName,
                    Type = type,
                    OwnerId = user.Id,
                    Size = data.Length,
                    Content = new DbDocContent { Data = data }
                };
                _ = dbContext.DbDocItems.Add(item);
            }
            else
            {
                sum -= item.Size;
                item.Size = data.Length;
                item.Content.Data = data;
            }
            sum += data.Length;
            if (sum > user.StorageQuota)
            {
                throw new StorageQuotaExceededException();
            }
            _ = dbContext.SaveChanges();
        }

        private static bool DeleteTextDocumentByType(DbMynaContext dbContext, DbDocItemType type, long userId)
        {
            DbDocItem item = dbContext.DbDocItems.
                SingleOrDefault(item => item.OwnerId == userId && item.Type == type);
            if (item != null)
            {
                _ = dbContext.DbDocContents.Remove(new DbDocContent { Id = item.ContentId.Value });
                _ = dbContext.DbDocItems.Remove(item);
                _ = dbContext.SaveChanges();
                return true;
            }
            return false;
        }

        private static bool IsContainer(DbDocItem item) => item.Type == DbDocItemType.Folder || item.Type == DbDocItemType.Volume;

        public static DbDocItem GetVolume(DbMynaContext dbContext, DbUser user)
        {
            return GetItemById(dbContext, user, null);
        }

        private static DbDocItem GetItemById(DbMynaContext dbContext, DbUser user, long? id)
        {
            DbDocItem item = null;
            if (id.HasValue)
            {
                return dbContext.DbDocItems.SingleOrDefault(
                    item => item.OwnerId == user.Id && item.Id == id.Value && item.Type < DbDocItemType.Contacts);
            }
            else
            {
                item = dbContext.DbDocItems.SingleOrDefault(
                    item => item.OwnerId == user.Id && item.Type == DbDocItemType.Volume);
            }
            return item;
        }

        public static List<DbDocItem> GetChildren(DbMynaContext dbContext, DbUser user, DbDocItem item)
        {
            return dbContext.DbDocItems.Where(child => child.OwnerId == user.Id && child.ParentId == item.Id).ToList<DbDocItem>();
        }

        private static List<DbDocItem> GetPath(DbMynaContext dbContext, DbUser user, DbDocItem item)
        {
            var ret = new List<DbDocItem>();
            while (item != null && item.ParentId.HasValue)
            {
                item = GetItemById(dbContext, user, item.ParentId.Value);
                if (item != null)
                {
                    ret.Add(item);
                }
            }
            return ret;
        }

        private static List<DbDocItem> GetAllChildren(DbMynaContext dbContext, DbUser user, DbDocItem docItem)
        {
            var ret = new List<DbDocItem>();
            foreach (var child in GetChildren(dbContext, user, docItem))
            {
                ret.Add(child);
                if (IsContainer(child))
                {
                    ret.AddRange(GetAllChildren(dbContext, user, child));
                }
            }
            return ret;
        }

        private static List<ItemModel> ConvertToItemModel(List<DbDocItem> docItems)
        {
            return docItems.Select(item => ConvertToItemModel(item)).ToList();
        }

        private static ItemModel ConvertToItemModel(DbDocItem docItem)
        {
            return new ItemModel
            {
                Id = docItem.Id,
                Name = docItem.Name,
                Type = ConvertToType(docItem.Type),
                ParentId = docItem.ParentId,
                Children = docItem.Children,
                Size = docItem.Size,
                AccessRole = docItem.AccessRole
            };
        }

        private static string ConvertToType(DbDocItemType docType)
        {
            return docType switch
            {
                DbDocItemType.Volume => "Volume",
                DbDocItemType.Folder => "Folder",
                DbDocItemType.Item => "Document",
                DbDocItemType.Contacts => "Contacts",
                DbDocItemType.PublicKey => "PublicKey",
                DbDocItemType.PrivateKey => "PrivateKey",
                DbDocItemType.Message => "Message",
                _ => throw new ArgumentException($"Invalid document type '{docType}'.")
            };
        }
    }
}
