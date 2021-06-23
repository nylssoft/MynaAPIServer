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
using APIServer.Document.Model;
using APIServer.PwdMan;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace APIServer.Document
{
    public class DocumentService : IDocumentService
    {
        private readonly ILogger logger;

        private static List<ItemModel> docItems = new List<ItemModel>();
        private static long nextId = 1;

        private static ItemModel CreateVolume(string name)
        {
            var ret = GetVolume();
            if (ret == null)
            {
                ret = new ItemModel { Name = name, Id = nextId, ParentId = null, Type = "Volume", Children = 0 };
                nextId++;
                docItems.Add(ret);
            }
            return ret;
        }

        private static ItemModel GetVolume()
        {
            foreach (var item in docItems)
            {
                if (item.Type == "Volume")
                {
                    return item;
                }
            }
            return null;
        }

        private static ItemModel GetItem(long id)
        {
            foreach (var item in docItems)
            {
                if (item.Id == id)
                {
                    return item;
                }
            }
            return null;
        }

        private static List<ItemModel> GetChildren(long id)
        {
            var ret = new List<ItemModel>();
            foreach (var item in docItems)
            {
                if (item.ParentId.HasValue && item.ParentId.Value == id)
                {
                    ret.Add(item);
                }
            }
            return ret;
        }

        private static List<ItemModel> GetPath(long id)
        {
            var ret = new List<ItemModel>();
            var current = GetItem(id);
            while (current != null && current.ParentId.HasValue)
            {
                var parent = GetItem(current.ParentId.Value);
                if (parent == null)
                {
                    break;
                }
                ret.Add(parent);
                current = parent;
            }
            return ret;
        }

        private static ItemModel AddDocument(long parentId, string name, long size)
        {
            ItemModel ret = null;
            var parent = GetItem(parentId);
            if (parent != null)
            {
                ret = new ItemModel { Name = name, Id = nextId, ParentId = parentId, Type = "Document", Size = size };
                nextId++;
                docItems.Add(ret);
                parent.Children += 1;
            }
            return ret;
        }

        private static ItemModel AddFolder(long parentId, string name)
        {
            ItemModel ret = null;
            var parent = GetItem(parentId);
            if (parent != null)
            {
                ret = new ItemModel { Name = name, Id = nextId, ParentId = parentId, Type = "Folder", Children  = 0 };
                nextId++;
                docItems.Add(ret);
                parent.Children += 1;
            }
            return ret;
        }

        private static List<long> GetAllChildrenIds(long parentId)
        {
            var ret = new List<long>();
            var children = GetChildren(parentId);
            foreach (var child in children)
            {
                ret.Add(child.Id);
                if (IsContainer(child))
                {
                    ret.AddRange(GetAllChildrenIds(child.Id));
                }
            }
            return ret;
        }

        private static int DeleteItems(long parentId, List<long> delIds)
        {
            var allDelIds = new List<long>();
            var parent = GetItem(parentId);
            if (parent != null)
            {
                foreach (var delId in delIds)
                {
                    var delItem = GetItem(delId);
                    if (delItem != null && delItem.ParentId == parentId)
                    {
                        allDelIds.Add(delId);
                        parent.Children -= 1;
                        if (IsContainer(delItem))
                        {
                            allDelIds.AddRange(GetAllChildrenIds(delItem.Id));
                        }
                    }
                }
                if (allDelIds.Any())
                {
                    var keepItems = new List<ItemModel>();
                    foreach (var item in docItems)
                    {
                        if (allDelIds.Contains(item.Id))
                        {
                            continue;
                        }
                        keepItems.Add(item);
                    }
                    docItems = keepItems;
                }
            }
            return allDelIds.Count;
        }

        private static bool IsContainer(ItemModel item) => item.Type == "Folder" || item.Type == "Volume";

        private static bool IsContained(ItemModel item1, ItemModel item2)
        {
            // item1 contained in item2
            if (IsContainer(item2))
            {
                var id = item1.ParentId;
                while (id.HasValue)
                {
                    if (id.Value == item2.Id)
                    {
                        return true;
                    }
                    item1 = GetItem(id.Value);
                    if (item1 == null)
                    {
                        break;
                    }
                    id = item1.ParentId;
                }
            }
            return false;
        }

        private static int MoveItems(long destinationId, List<long> moveIds)
        {
            int moved = 0;
            var destination = GetItem(destinationId);
            if (destination != null)
            {
                foreach (var id in moveIds)
                {
                    if (id != destinationId)
                    {
                        var item = GetItem(id);
                        if (item != null && item.ParentId.HasValue &&
                            item.ParentId.Value != destinationId &&
                            !IsContained(destination, item))
                        {
                            var oldParent = GetItem(item.ParentId.Value);
                            if (oldParent != null)
                            {
                                oldParent.Children -= 1;
                            }
                            item.ParentId = destinationId;
                            destination.Children += 1;
                            moved++;
                        }
                    }
                }
            }
            return moved;
        }

        private static bool RenameItem(long id, string name)
        {
            var item = GetItem(id);
            if (item != null && !string.IsNullOrEmpty(name) && name != item.Name)
            {
                item.Name = name;
                return true;
            }
            return false;
        }

        public DocumentService(ILogger<DocumentService> logger)
        {
            this.logger = logger;
        }

        public ItemModel CreateVolume(IPwdManService pwdManService, string authenticationToken, string name)
        {
            return CreateVolume(name);
        }

        public List<ItemModel> GetItems(IPwdManService pwdManService, string authenticationToken, long? id)
        {
            var ret = new List<ItemModel>();
            var item = id.HasValue ? GetItem(id.Value) : GetVolume();
            if (item != null)
            {
                ret.Add(item);
                ret.AddRange(GetPath(item.Id));
                ret.AddRange(GetChildren(item.Id));
            }
            return ret;
        }

        public ItemModel UploadDocument(IPwdManService pwdManService, string authenticationToken, long parentId, string name, long size, Stream stream)
        {
            return AddDocument(parentId, name, size);
        }

        public DownloadResult DownloadDocument(IPwdManService pwdManService, string authenticationToken, long id)
        {
            DownloadResult ret = null;
            var item = GetItem(id);
            if (item != null)
            {
                ret = new DownloadResult
                {
                    Stream = new MemoryStream(Encoding.UTF8.GetBytes("Hello World!")),
                    FileName = item.Name,
                    ContentType = "application/octet-stream"
                };
            }
            return ret;
        }

        public ItemModel AddFolder(IPwdManService pwdManService, string authenticationToken, long parentId, string name)
        {
            return AddFolder(parentId, name);
        }

        public int DeleteItems(IPwdManService pwdManService, string authenticationToken, long parentId, List<long> delIds)
        {
            return DeleteItems(parentId, delIds);
        }

        public bool RenameItem(IPwdManService pwdManService, string authenticationToken, long id, string name)
        {
            return RenameItem(id, name);
        }

        public int MoveItems(IPwdManService pwdManService, string authenticationToken, long destinationId, List<long> moveIds)
        {
            return MoveItems(destinationId, moveIds);
        }

    }
}
