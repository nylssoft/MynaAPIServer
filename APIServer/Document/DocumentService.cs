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
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace APIServer.Document
{
    public class DocumentService : IDocumentService
    {
        private readonly ILogger logger;

        public DocumentService(ILogger<DocumentService> logger)
        {
            this.logger = logger;
        }

        public ItemModel CreateVolume(IPwdManService pwdManService, string authenticationToken, string name)
        {
            logger.LogDebug("Create volume '{name}'...", name);
            name = name.Trim();
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var docItem = GetVolume(dbContext, user);
            if (docItem == null)
            {
                docItem = new DbDocItem {
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

        public ItemModel UploadDocument(IPwdManService pwdManService, string authenticationToken, long parentId, string name, Stream stream)
        {
            logger.LogDebug("Upload documemt with '{name}' into parent ID {parentId}...", name, parentId);
            name = name.Trim();
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            var sum = dbContext.DbDocItems.Where(item => item.Type == DbDocItemType.Item && item.OwnerId == user.Id).Sum(item => item.Size);
            var parentItem = GetItemById(dbContext, user, parentId);
            if (parentItem != null)
            {
                var ms = new MemoryStream();
                stream.CopyTo(ms);
                var size = ms.Length;
                if (sum + size > Limits.MAX_DOCUMENT_STORAGE)
                {
                    throw new PwdManInvalidArgumentException("Es ist nicht genügend Speicherplatz mehr verfügbar.");
                }
                var docItem = new DbDocItem
                {
                    Name = name,
                    Type = DbDocItemType.Item,
                    OwnerId = user.Id,
                    ParentId = parentId,
                    Size = size,
                    Content = new DbDocContent { Data = ms.ToArray() }
                };
                dbContext.DbDocItems.Add(docItem);
                parentItem.Children += 1;
                dbContext.SaveChanges();
                return ConvertToItemModel(docItem);
            }
            return null;
        }

        public DownloadResult DownloadDocument(IPwdManService pwdManService, string authenticationToken, long id)
        {
            logger.LogDebug("Download content for item ID {id}...", id);
            var user = pwdManService.GetUserFromToken(authenticationToken);
            var dbContext = pwdManService.GetDbContext();
            // get item by ID but include content
            var docItem = dbContext.DbDocItems
                 .Include(item => item.Content)
                 .SingleOrDefault(
                    item => item.OwnerId == user.Id && item.Type == DbDocItemType.Item && item.Id == id);
            if (docItem == null || docItem.Content == null)
            {
                throw new PwdManInvalidArgumentException("Dokument hat keinen Inhalt.");
            }
            return new DownloadResult
            {
                Stream = new MemoryStream(docItem.Content.Data),
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
                        delIds.Contains(item.Id));
                foreach (var delItem in delItems)
                {
                    removeItems.Add(delItem);
                    parent.Children -= 1;
                    // add all children of a folder is deleted
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
                        !destPathIds.Contains(item.Id));
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

        // ---- private methods

        private static bool IsContainer(DbDocItem item) => item.Type == DbDocItemType.Folder || item.Type == DbDocItemType.Folder;

        private static DbDocItem GetVolume(DbMynaContext dbContext, DbUser user)
        {
            return GetItemById(dbContext, user, null);
        }

        private static DbDocItem GetItemById(DbMynaContext dbContext, DbUser user, long? id)
        {
            DbDocItem item = null;
            if (id.HasValue)
            {
                return dbContext.DbDocItems.SingleOrDefault(
                    item => item.OwnerId == user.Id && item.Id == id.Value);
            }
            else
            {
                item = dbContext.DbDocItems.SingleOrDefault(
                    item => item.OwnerId == user.Id && item.Type == DbDocItemType.Volume);
            }
            return item;
        }

        private static List<DbDocItem> GetChildren(DbMynaContext dbContext, DbUser user, DbDocItem item)
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
            return docItems.Select(item => ConvertToItemModel(item)).ToList<ItemModel>();
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
                Size = docItem.Size
            };
        }

        private static string ConvertToType(DbDocItemType docType)
        {
            return docType switch
            {
                DbDocItemType.Volume => "Volume",
                DbDocItemType.Folder => "Folder",
                DbDocItemType.Item => "Document",
                _ => throw new ArgumentException($"Invalid document type '{docType}'."),
            };
        }
    }
}
