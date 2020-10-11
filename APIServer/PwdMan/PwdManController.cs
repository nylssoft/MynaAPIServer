/*
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
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace APIServer.PwdMan
{
    [ApiController]
    public class PwdManController : ControllerBase
    {
        public IConfiguration Configuration { get; }

        public IPwdManService PwdManService { get; }

        public PwdManController(IConfiguration configuration, IPwdManService pwdManService)
        {
            Configuration = configuration;
            PwdManService = pwdManService;
        }

        [HttpPost]
        [Route("api/pwdman/user")]
        public IActionResult AddUser([FromBody] UserCreation userCreation)
        {
            PwdManService.AddUser(userCreation);
            return Ok();
        }

        [HttpPost]
        [Route("api/pwdman/auth")]
        public IActionResult Login([FromBody] Authentication authentication)
        {
            return new JsonResult(PwdManService.Authenticate(authentication));
        }

        [HttpPost]
        [Route("api/pwdman/auth2")]
        public IActionResult LoginPass2([FromBody] string totp)
        {
            return new JsonResult(PwdManService.AuthenticateTOTP(GetToken(), totp));
        }

        [HttpGet]
        [Route("api/pwdman/salt")]
        public IActionResult GetSalt()
        {
            return new JsonResult(PwdManService.GetSalt(GetToken()));
        }

        [HttpPost]
        [Route("api/pwdman/userpwd")]
        public IActionResult ChangeUserPassword([FromBody] UserPasswordChange userPasswordChange)
        {
            PwdManService.ChangeUserPassword(GetToken(), userPasswordChange);
            return Ok();
        }

        [HttpPost]
        [Route("api/pwdman/file")]
        public IActionResult SavePasswordFile([FromBody] PasswordFile passwordFile)
        {
            PwdManService.SavePasswordFile(GetToken(), passwordFile);
            return Ok();
        }

        [HttpGet]
        [Route("api/pwdman/file")]
        public IActionResult GetPasswordFile()
        {
            return new JsonResult(PwdManService.GetEncodedPasswordFile(GetToken()));
        }

        // --- private

        private string GetToken()
        {
            return HttpContext.Request.Headers["token"];
        }
    }
}
