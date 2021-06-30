/*
    Myna API Server
    Copyright (C) 2020-2021 Niels Stockfleth

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

namespace APIServer.PwdMan.Model
{
    public class UserModel
    {
        public string Name { get; set; }

        public string Email { get; set; }

        public bool Requires2FA { get; set; }

        public bool UseLongLivedToken { get; set; }

        public bool AllowResetPassword { get; set; }

        public DateTime? LastLoginUtc { get; set; }

        public DateTime? RegisteredUtc { get; set; }

        public List<string> Roles { get; set; }

        public bool HasPasswordManagerFile { get; set; }

        public string PasswordManagerSalt { get; set; }

        public bool AccountLocked { get; set; }

        public List<LoginIpAddressModel> LoginIpAddresses { get; set; }

        public string Photo { get; set; }

        public long DocumentStorageUsed { get; set; }

        public long DocumentStorageQuota { get; set; }
    }
}
