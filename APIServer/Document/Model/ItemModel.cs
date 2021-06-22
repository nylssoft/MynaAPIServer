using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace APIServer.Document.Model
{
    public class ItemModel
    {
        public long Id { get; set; }

        public long? ParentId { get; set; }

        public string Name { get; set; }

        public long Size { get; set; }

        public string Type { get; set; }

        public int Children { get; set; }
    }
}
