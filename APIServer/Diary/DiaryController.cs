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
using APIServer.Diary.Model;
using APIServer.PwdMan;
using Microsoft.AspNetCore.Mvc;
using System;

namespace APIServer.Diary
{
    [ApiController]
    public class DiaryController : ControllerBase
    {
        public IDiaryService DiaryService { get; }

        public IPwdManService PwdManService { get; set; }

        public DiaryController(IDiaryService diaryService, IPwdManService pwdManService)
        {
            DiaryService = diaryService;
            PwdManService = pwdManService;
        }

        [HttpPost]
        [Route("api/diary/entry")]
        public IActionResult SetEntry([FromBody] DiaryEntryModel model)
        {
            if (model?.Entry?.Length > Limits.MAX_DIARY_ENTRY) throw new InputValueTooLargeException();
            DiaryService.SetEntry(PwdManService, GetToken(), model);
            return new JsonResult(true);
        }

        [HttpGet]
        [Route("api/diary/entry")]
        public IActionResult GetEntry([FromQuery] DateTime date)
        {
            return new JsonResult(DiaryService.GetEntry(PwdManService, GetToken(), date));
        }

        [HttpGet]
        [Route("api/diary/month")]
        public IActionResult GetMonthEntries([FromQuery] DateTime date)
        {
            return new JsonResult(DiaryService.GetMonthEntries(PwdManService, GetToken(), date));
        }

        [HttpGet]
        [Route("api/diary/day")]
        public IActionResult GetDays([FromQuery] DateTime date)
        {
            return new JsonResult(DiaryService.GetDaysWithEntries(PwdManService, GetToken(), date));
        }

        [HttpGet]
        [Route("api/diary/all")]
        public IActionResult GetAllEntries()
        {
            return new JsonResult(DiaryService.GetAllEntries(PwdManService, GetToken()));
        }

        // --- private

        private string GetToken()
        {
            return HttpContext.Request.Headers["token"];
        }
    }
}
