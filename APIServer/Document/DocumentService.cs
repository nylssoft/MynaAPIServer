using APIServer.Document.Model;
using APIServer.PwdMan;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace APIServer.Document
{
    public class DocumentService : IDocumentService
    {
        private readonly ILogger logger;

        private static List<ItemModel> docItems;
        private static long nextId;

        private static void InitDocItems()
        {
            if (docItems == null)
            {
                docItems = new List<ItemModel>();
                docItems.Add(new ItemModel { Name="Dokumente", Id= 1, ParentId = null, Type = "Folder", Children = 1 });
                docItems.Add(new ItemModel { Name = "Krankenkasse", Id = 2, ParentId = 1, Type = "Folder", Children = 3 });
                docItems.Add(new ItemModel { Name = "Orthopaidie", Id = 3, ParentId = 2, Type = "Folder", Children = 0 });
                docItems.Add(new ItemModel { Name = "Zahnarzt-7-4-2022.pdf", Id = 4, ParentId = 2, Type = "Document", Size = 1024 });
                docItems.Add(new ItemModel { Name = "Krankengymnastik-1-6-2022.pdf", Id = 5, ParentId = 2, Type = "Document", Size = 8192 });
                nextId = 6;
            }
        }

        private static ItemModel GetRoot()
        {
            foreach (var item in docItems)
            {
                if (!item.ParentId.HasValue)
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
                if (IsFolder(child))
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
                        if (IsFolder(delItem))
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

        private static bool IsFolder(ItemModel item) => item.Type == "Folder";

        private static bool IsContained(ItemModel item1, ItemModel item2)
        {
            // item1 contained in item2
            if (IsFolder(item2))
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

        public List<ItemModel> GetItems(IPwdManService pwdManService, string authenticationToken, long? id)
        {
            InitDocItems();
            var ret = new List<ItemModel>();
            var item = id.HasValue ? GetItem(id.Value) : GetRoot();
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
            InitDocItems();
            return AddDocument(parentId, name, size);
        }

        public DownloadResult DownloadDocument(IPwdManService pwdManService, string authenticationToken, long id)
        {
            InitDocItems();
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
            InitDocItems();
            return AddFolder(parentId, name);
        }

        public int DeleteItems(IPwdManService pwdManService, string authenticationToken, long parentId, List<long> delIds)
        {
            InitDocItems();
            return DeleteItems(parentId, delIds);
        }

        public bool RenameItem(IPwdManService pwdManService, string authenticationToken, long id, string name)
        {
            InitDocItems();
            return RenameItem(id, name);
        }

        public int MoveItems(IPwdManService pwdManService, string authenticationToken, long destinationId, List<long> moveIds)
        {
            InitDocItems();
            return MoveItems(destinationId, moveIds);
        }

    }
}
