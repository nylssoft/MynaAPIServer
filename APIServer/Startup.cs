/*
    Myna API Server
    Copyright (C) 2020-2025 Niels Stockfleth

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
using APIServer.Appointment;
using APIServer.Backgammon;
using APIServer.Chess;
using APIServer.Database;
using APIServer.Diary;
using APIServer.Document;
using APIServer.HighScore;
using APIServer.Notes;
using APIServer.PwdMan;
using APIServer.Skat;
using Markdig.Helpers;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Primitives;
using System.Text;

namespace APIServer
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            var sqliteConnection = Configuration.GetValue<string>("SqliteConnection");
            var postgresConnection = Configuration.GetValue<string>("PostgresConnection");
            services.AddControllers();
            // scoped
            services.AddDbContext<DbSqliteContext>(builder => builder.UseSqlite(sqliteConnection));
            services.AddDbContext<DbPostgresContext>(builder => builder.UseNpgsql(postgresConnection));
            services.AddScoped<IPwdManService, PwdManService>();
            services.AddScoped<IHighScoreService, HighScoreService>();
            services.AddScoped<IDiaryService, DiaryService>();
            services.AddScoped<INotesService, NotesService>();
            services.AddScoped<IDocumentService, DocumentService>();
            services.AddScoped<IAppointmentService, AppointmentService>();
            // singletons
            services.AddSingleton<ISkatService, SkatService>();
            services.AddSingleton<IChessService, ChessService>();
            services.AddSingleton<IBackgammonService, BackgammonService>();
            // enable cshtml pages
            services.AddRazorPages();
            // all urls lower case
            services.AddRouting(options => options.LowercaseUrls = true);
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            _ = app.Use(async (context, next) =>
            {
                // build Content-Security-Policy response header
                var path = context.Request.Path;
                var csp = new StringBuilder();
                csp.Append("default-src 'self'");
                if (env.IsDevelopment())
                {
                    csp.Append(" ws://localhost:*");
                    csp.Append(" http://localhost:*");
                }
                csp.Append(';');
                csp.Append("script-src 'self'");
                if (path == "/usermgmt" || path == "/pwdman")
                {
                    // uuid.min.js and qrcode.min.js are loaded via cloudflare
                    csp.Append($" cdnjs.cloudflare.com");
                    if (path == "/pwdman")
                    {
                        // friendly captcha javascript is loaded from jsdelivr and iframe (widget) is loaded from frcapi
                        csp.Append(" cdn.jsdelivr.net;frame-src *.frcapi.com");
                        // pass friendly captcha site key to razor page
                        context.Items["data-sitekey"] = GetOptions().FriendlyCaptchaConfig.SiteKey;
                    }
                }
                csp.Append(';');
                if (path == "/view")
                {
                    // $background syntax in markdown document, generates an inline style for body element
                    var pwdgen = new PasswordGenerator.PwdGen { Length = 16, MinDigits = 1, MinSymbols = 0, MinLowerCharacters = 0, MinUpperCharacters = 0 };
                    context.Items["nonce"] = pwdgen.Generate();
                    csp.Append($"style-src 'self' 'nonce-{context.Items["nonce"]}';");
                }
                csp.Append("img-src 'self'");
                if (path=="/usermgmt")
                {
                    // data image generated by qrcode.js
                    csp.Append(" data:");
                }
                else if (path=="/password")
                {
                    // favicons from google
                    csp.Append(" www.google.com *.gstatic.com");
                }
                csp.Append(';');
                // no CSP for webpack bundles (nonce is yet missing, inline CSS cannot be loaded)
                if (!path.StartsWithSegments("/webpack"))
                {
                    context.Response.Headers.Append("Content-Security-Policy", csp.ToString());
                }
                await next();
            });

            app.UseForwardedHeaders(new ForwardedHeadersOptions
            {
                ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
            });

            app.UseExceptionHandler("/error");

            app.UseDefaultFiles();

            var provider = new FileExtensionContentTypeProvider();
            provider.Mappings[".apk"] = "application/vnd.android.package-archive";
            app.UseStaticFiles(new StaticFileOptions
            {
                ContentTypeProvider = provider
            });

            app.UseRouting();

            app.UseAuthorization();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers();
                endpoints.MapRazorPages();
            });
        }

        private PwdManOptions GetOptions()
        {
            var opt = Configuration.GetSection("PwdMan").Get<PwdManOptions>();
            return opt ?? new PwdManOptions();
        }
    }
}
