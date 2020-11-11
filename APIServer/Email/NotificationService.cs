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
using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Mail;

namespace APIServer.Email
{
    public class NotificationService : INotificationService
    {
        public IConfiguration Configuration { get; }

        public NotificationService(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public void Send(string to, string subject, string plainTextBody)
        {
            var opt = GetOptions();
            if (!opt.IsConfigured()) return;
            var mm = new MailMessage();
            mm.From = new MailAddress(opt.Office365Account);
            mm.To.Add(new MailAddress(to));
            mm.Subject = subject;
            mm.Body = plainTextBody;
            mm.IsBodyHtml = false;
            using (var smtpClient = GetSmtpClient())
            {
                smtpClient.Send(mm);
            }
        }

        // --- private

        private SmtpClient GetSmtpClient()
        {
            var opt = GetOptions();
            var smtpClient = new SmtpClient();
            smtpClient.UseDefaultCredentials = false;
            smtpClient.Credentials = new NetworkCredential(opt.Office365Account, opt.Office365Password);
            smtpClient.Port = 587;
            smtpClient.Host = "smtp.office365.com";
            smtpClient.DeliveryMethod = SmtpDeliveryMethod.Network;
            smtpClient.EnableSsl = true;
            return smtpClient;
        }
        private EmailOptions GetOptions()
        {
            var opt = Configuration.GetSection("Email").Get<EmailOptions>();
            return opt ?? new EmailOptions();
        }
    }
}
