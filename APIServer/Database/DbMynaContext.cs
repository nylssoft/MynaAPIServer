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
using Microsoft.EntityFrameworkCore;

namespace APIServer.Database
{
    public class DbMynaContext : DbContext
    {
        public DbMynaContext(DbContextOptions<DbMynaContext> options) : base(options)
        {
        }

        public DbSet<DbUser> DbUsers { get; set; }

        public DbSet<DbRegistration> DbRegistrations { get; set; }

        public DbSet<DbSetting> DbSettings { get; set; }

        public DbSet<DbPasswordFile> DbPasswordFiles { get; set; }
    }
}