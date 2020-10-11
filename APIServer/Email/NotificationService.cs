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
using Microsoft.Extensions.Logging;
using System;
using System.ComponentModel;
using System.Net;
using System.Net.Mail;

namespace APIServer.Email
{
    public class NotificationService : INotificationService
    {
        public IConfiguration Configuration { get; }

        private readonly ILogger logger;

        private SmtpClient smtpClient = null;

        public NotificationService(IConfiguration configuration, ILogger<NotificationService> logger)
        {
            Configuration = configuration;
            this.logger = logger;
        }

        public void NotifyAsync(string subject, string plainTextBody)
        {
            var opt = GetOptions();
            if (!opt.IsConfigured()) return;
            SendToAsync(opt.NotificationRecipientAddress, subject, plainTextBody);
        }

        public void SendToAsync(string to, string subject, string plainTextBody)
        {
            var opt = GetOptions();
            if (!opt.IsConfigured()) return;
            var mm = new MailMessage();
            mm.To.Add(new MailAddress(to));
            mm.From = new MailAddress(opt.NotificationSenderAddress);
            mm.Subject = subject;
            mm.Body = plainTextBody;
            mm.IsBodyHtml = false;
            try
            {
                GetSmtpClient().SendAsync(mm, subject);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to send notification '{subject}'.", subject);
            }
        }

        // --- private

        private SmtpClient GetSmtpClient()
        {
            if (smtpClient == null)
            {
                var opt = GetOptions();
                smtpClient = new SmtpClient();
                smtpClient.UseDefaultCredentials = false;
                smtpClient.Credentials = new NetworkCredential(opt.Office365Account, opt.Office365Password);
                smtpClient.Port = 587;
                smtpClient.Host = "smtp.office365.com";
                smtpClient.DeliveryMethod = SmtpDeliveryMethod.Network;
                smtpClient.EnableSsl = true;
                smtpClient.SendCompleted += new SendCompletedEventHandler(SendCompletedCallback);
            }
            return smtpClient;
        }

        private void SendCompletedCallback(object sender, AsyncCompletedEventArgs e)
        {
            var subject = e.UserState as string;
            if (e.Cancelled)
            {
                logger.LogInformation("Send notification '{subject}' canceled.", subject);
            }
            if (e.Error != null)
            {
                logger.LogError(e.Error, "Send notification '{subject}' failed.", subject);
            }
            else
            {
                logger.LogInformation("Notification '{subject}' sent.", subject);
            }
        }

        private EmailOptions GetOptions()
        {
            var opt = Configuration.GetSection("Email").Get<EmailOptions>();
            return opt ?? new EmailOptions();
        }
    }
}
