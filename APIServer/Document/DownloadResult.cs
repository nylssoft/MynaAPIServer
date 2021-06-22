using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace APIServer.Document
{
    public class DownloadResult
    {
        public string FileName { get; set; }

        public string ContentType { get; set; }

        public Stream Stream { get; set; }
    }
}
