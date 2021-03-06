﻿/*
    Myna API Server
    Copyright (C) 2020 Niels Stockfleth

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
using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace APIServer.Database
{
    [Table("Note")]
    public class DbNote
    {
        public long Id { get; set; }

        public long DbUserId { get; set; }

        public DbUser DbUser { get; set; }

        public DateTime ModifiedUtc { get; set; }

        public string Title { get; set; }

        public string Content { get; set; }
    }
}
