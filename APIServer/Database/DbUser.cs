/*
    Myna API Server
    Copyright (C) 2020-2022 Niels Stockfleth

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
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace APIServer.Database
{
    [Table("Users")]
    public class DbUser
    {
        public long Id { get; set; }

        public string Name { get; set; }

        public string PasswordHash { get; set; }

        public string Salt { get; set; }

        public string Email { get; set; }

        public bool Requires2FA { get; set; }

        public int LoginTries { get; set; }

        public DateTime? LastLoginTryUtc { get; set; }

        public DateTime? RegisteredUtc { get; set; }

        public DateTime? LogoutUtc { get; set; }

        public string TOTPKey { get; set; }

        public long? PasswordFileId { get; set; }

        public DbPasswordFile PasswordFile { get; set; }

        public List<DbRole> Roles { get; set; }

        public bool UseLongLivedToken { get; set; }

        public bool AllowResetPassword { get; set; }

        public string Photo { get; set; }

        public long StorageQuota { get; set; }

        public bool LoginEnabled { get; set; }

        public string LoginName { get; set; }

        public string SecKey { get; set; }
    }
}
