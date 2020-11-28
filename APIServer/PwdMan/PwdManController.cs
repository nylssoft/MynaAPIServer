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
using APIServer.PwdMan.Model;

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
        [Route("api/pwdman/resetpwd")]
        public IActionResult RequestResetPwd([FromBody] string email)
        {
            PwdManService.RequestResetPassword(email);
            return new JsonResult(true);
        }

        [HttpPost]
        [Route("api/pwdman/resetpwd2")]
        public IActionResult RequestReset([FromBody] UserResetPasswordModel resetPasswordModel)
        {
            PwdManService.ResetPassword(resetPasswordModel);
            return new JsonResult(true);
        }

        [HttpPost]
        [Route("api/pwdman/register")]
        public IActionResult IsRegisterAllowed([FromBody] string email)
        {
            return new JsonResult(PwdManService.IsRegisterAllowed(email));
        }

        [HttpPost]
        [Route("api/pwdman/profile")]
        public IActionResult RegisterUser([FromBody] UserRegistrationModel userRegistration)
        {
            PwdManService.RegisterUser(userRegistration);
            return new JsonResult(true);
        }

        [HttpGet]
        [Route("api/pwdman/confirmation")]
        public IActionResult GetOutstandingRegistrations()
        {
            return new JsonResult(PwdManService.GetOutstandingRegistrations(GetToken()));
        }

        [HttpPost]
        [Route("api/pwdman/confirmation")]
        public IActionResult ConfirmRegistration([FromBody] OutstandingRegistrationModel confirmation)
        {
            return new JsonResult(PwdManService.ConfirmRegistration(GetToken(), confirmation));
        }

        [HttpGet]
        [Route("api/pwdman/user")]
        public IActionResult GetUser()
        {
            return new JsonResult(PwdManService.GetUser(GetToken()));
        }

        [HttpPost]
        [Route("api/pwdman/user/unlock")]
        public IActionResult UnlockUser([FromBody] string userName)
        {
            return new JsonResult(PwdManService.UnlockUser(GetToken(), userName));
        }

        [HttpDelete]
        [Route("api/pwdman/user")]
        public IActionResult DeleteUser([FromBody] string username)
        {
            return new JsonResult(PwdManService.DeleteUser(GetToken(), username));
        }

        [HttpDelete]
        [Route("api/pwdman/loginipaddress")]
        public IActionResult DeleteLoginIpAddresses()
        {
            return new JsonResult(PwdManService.DeleteLoginIpAddresses(GetToken()));
        }

        [HttpPut]
        [Route("api/pwdman/user/2fa")]
        public IActionResult UpdateUser2FA([FromBody] bool requires2FA)
        {
            return new JsonResult(PwdManService.UpdateUser2FA(GetToken(), requires2FA));
        }

        [HttpPut]
        [Route("api/pwdman/user/lltoken")]
        public IActionResult UpdateUserUseLongLivedToken([FromBody] bool useLongLivedToken)
        {
            return new JsonResult(PwdManService.UpdateUserUseLongLivedToken(GetToken(), useLongLivedToken));
        }

        [HttpPut]
        [Route("api/pwdman/user/allowresetpwd")]
        public IActionResult UpdateUserAllowResetPassword([FromBody] bool allowResetPassword)
        {
            return new JsonResult(PwdManService.UpdateUserAllowResetPassword(GetToken(), allowResetPassword));
        }

        [HttpPut]
        [Route("api/pwdman/user/role")]
        public IActionResult UpdateUserRole([FromBody] UserUpdateRoleModel userUpdateRoleModel)
        {
            return new JsonResult(PwdManService.UpdateUserRole(GetToken(), userUpdateRoleModel));
        }

        [HttpGet]
        [Route("api/pwdman/users")]
        public IActionResult GetUsers()
        {
            return new JsonResult(PwdManService.GetUsers(GetToken()));
        }

        [HttpPost]
        [Route("api/pwdman/auth")]
        public IActionResult Login([FromBody] AuthenticationModel authentication)
        {
            var ipAddress = HttpContext.Connection.RemoteIpAddress.ToString();
            return new JsonResult(PwdManService.Authenticate(authentication, ipAddress));
        }

        [HttpPost]
        [Route("api/pwdman/auth2")]
        public IActionResult LoginPass2([FromBody] string totp)
        {
            return new JsonResult(PwdManService.AuthenticateTOTP(GetToken(), totp));
        }

        [HttpGet]
        [Route("api/pwdman/auth/lltoken")]
        public IActionResult LoginWithLongLivedToken()
        {
            return new JsonResult(PwdManService.AuthenticateLongLivedToken(GetToken()));
        }

        [HttpPost]
        [Route("api/pwdman/totp")]
        public IActionResult SendTOTP()
        {
            PwdManService.SendTOTP(GetToken());
            return new JsonResult(true);
        }

        [HttpPost]
        [Route("api/pwdman/userpwd")]
        public IActionResult ChangeUserPassword([FromBody] UserPasswordChangeModel userPasswordChange)
        {
            PwdManService.ChangeUserPassword(GetToken(), userPasswordChange);
            return new JsonResult(true);
        }

        [HttpPost]
        [Route("api/pwdman/file")]
        public IActionResult SavePasswordFile([FromBody] PasswordFileModel passwordFile)
        {
            PwdManService.SavePasswordFile(GetToken(), passwordFile);
            return new JsonResult(true);
        }

        [HttpGet]
        [Route("api/pwdman/file")]
        public IActionResult GetPasswordFile()
        {
            return new JsonResult(PwdManService.GetEncodedPasswordFile(GetToken()));
        }

        [HttpGet]
        [Route("api/pwdman/fileinfo")]
        public IActionResult HashPasswordFile()
        {
            return new JsonResult(PwdManService.HasPasswordFile(GetToken()));
        }

        // --- private

        private string GetToken()
        {
            return HttpContext.Request.Headers["token"];
        }
    }
}
