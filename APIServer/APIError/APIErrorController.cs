﻿/*
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
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace APIServer.APIError
{
    public class APIErrorController : ControllerBase
    {
        private readonly ILogger logger;

        public APIErrorController(ILogger<APIErrorController> logger)
        {
            this.logger = logger;
        }

        [Route("/error")]
        public IActionResult Error()
        {
            var context = HttpContext.Features.Get<IExceptionHandlerFeature>();
            if (context.Error is APIException)
            {
                int statusCode = (context.Error as APIException).StatusCode;
                logger.LogDebug("Error occurs: {statusCode} => {message}", statusCode, context.Error.Message);
                return Problem(
                    title: context.Error.Message,
                    statusCode: statusCode);
            }
            logger.LogWarning("Server error occured: {message}.", context.Error.Message);
            return Problem(title: "ERROR_UNEXPECTED", statusCode: 500);
        }
    }
}
