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
using System.ComponentModel.DataAnnotations.Schema;

namespace APIServer.Database
{
    public enum DbDocItemType { Volume = 0, Folder = 1, Item = 2, Contacts = 100 };

    [Table("DocItems")]
    public class DbDocItem
    {
        public long Id { get; set; }

        public long OwnerId { get; set; }

        public DbUser Owner { get; set; }

        public long? ParentId { get; set; }

        public DbDocItem Parent { get; set; }

        public string Name { get; set; }

        public DbDocItemType Type { get; set; }

        public long Size { get; set; }

        public int Children { get; set; }

        public long? ContentId { get; set; }

        public DbDocContent Content { get; set; }

        public string AccessRole { get; set; }
    }
}
