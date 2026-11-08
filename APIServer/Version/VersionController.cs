/*
    Myna API Server
    Copyright (C) 2020-2026 Niels Stockfleth

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
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;

namespace APIServer.Version
{
    [ApiController]
    public class VersionController : ControllerBase
    {
        [AllowAnonymous]
        [HttpGet("/api/version")]
        public ActionResult<VersionResponse> GetVersion()
        {
            var version = typeof(Program).Assembly.GetName().Version
                ?? throw new InvalidOperationException("The application assembly has no version.");
            return Ok(new VersionResponse(version.ToString(3)));
        }
    }

    /// <summary>Contains the running API server version.</summary>
    public sealed record VersionResponse(string Version);
}
