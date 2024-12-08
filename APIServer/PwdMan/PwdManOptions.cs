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
using System.Collections.Generic;

namespace APIServer.PwdMan
{
    public class PwdManOptions
    {
        public TokenConfig TokenConfig { get; set; }

        public TOTPConfig TOTPConfig { get; set; }

        public SendGridConfig SendGridConfig { get; set; }

        public int ResetPasswordTokenExpireMinutes { get; set; } = 15;

        public int MaxLoginTryCount { get; set; } = 3;

        public int AccountLockTime { get; set; } = 300;

        public string Hostname { get; set; }

        public string SlideShowPublicPhotos { get; set; }

        public string SlideShowFamilyPhotos { get; set; }

        public string PhotoFramePublicUrls { get; set; }

        public string PhotoFrameFamilyUrls { get; set; }

        public string FamilyAccessToken { get; set; }

        public List<ContentConfig> Markdown { get; set; }

        public string StartPage { get; set; }

        public List<StartPagePerHostConfig> StartPagePerHost { get; set; }

        public List<string> Languages { get; set; } = new List<string>();
    }
}
