/*
    Myna API Server
    Copyright (C) 2024 Niels Stockfleth

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
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Primitives;

namespace APIServer.Pages
{   
    public class ViewModel : PageModel
    {
        public string OgTitle { get; private set; }
        public string OgDescription { get; private set; }
        public string OgImage { get; private set; }
        public string OgType { get; private set; }

        public void OnGet()
        {
            try
            {
                string page = "startpage";
                if (Request.Query.TryGetValue("page", out StringValues idValues))
                {
                    if (idValues.Count == 1)
                    {
                        page = idValues[0];
                    }
                }
                OgTitle = "nielsi.de";
                OgDescription = page;
                OgType = "website";
                OgImage = $"{Request.Scheme}://{Request.Host}/images/social/view.png";
            }
            catch
            {
                // ignored
            }
        }
    }
}
