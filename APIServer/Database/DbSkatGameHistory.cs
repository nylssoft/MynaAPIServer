using SQLitePCL;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Threading.Tasks;

namespace APIServer.Database
{
    [Table("SkatGameHistories")]
    public class DbSkatGameHistory
    {
        public long Id { get; set; }

        public long DbSkatResultId { get; set; }

        public string History { get; set; }
    }
}
