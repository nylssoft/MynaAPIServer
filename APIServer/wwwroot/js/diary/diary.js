"use strict";

var diary = (() => {

    // state

    let version = "2.0.4";

    let changeDate;
    let inSaveDiary;
    let selectedISODate;
    let daySet;
    let dayClicked;

    let currentUser;

    let cryptoKey;

    let helpDiv;

    // helper

    const hasEncryptKey = () => {
        let elem = document.getElementById("input-encryptkey-id");
        return elem && elem.value.trim().length > 0;
    }

    const initCryptoKey = (resolve, reject) => {
        if (!cryptoKey) {
            let elem = document.getElementById("input-encryptkey-id");
            if (elem && elem.value.trim().length > 0) {
                utils.create_crypto_key(elem.value.trim(), currentUser.passwordManagerSalt,
                    (ck) => {
                        cryptoKey = ck;
                        resolve();
                    },
                    reject
                );
                return;
            }
        }
        resolve();
    };

    const encodeEntry = (entry, resolve, reject) => {
        if (entry.length > 0) {
            initCryptoKey(() => utils.encode_message(cryptoKey, entry, resolve, reject), reject);
            return;
        }
        return resolve("");
    };

    const decodeEntry = (entry, resolve, reject) => {
        if (entry.length > 0) {
            initCryptoKey(() => utils.decode_message(cryptoKey, entry, resolve, reject), reject);
            return;
        }
        resolve("");
    };

    const decodeDiaries = (diaries, decodedDiaries, resolve, reject) => {
        if (diaries.length == 0) {
            resolve(decodedDiaries);
            return;
        }
        let diary = diaries.shift();
        decodeEntry(diary.entry,
            (msg) => {
                decodedDiaries.push({ "date": diary.date, "entry": msg });
                decodeDiaries(diaries, decodedDiaries, resolve, reject);
            },
            reject
        );
    };

    // rendering

    const renderHeader = (parent) => {
        helpDiv = controls.createDiv(document.body);
        const h1 = controls.create(parent, "h1", undefined, `${currentUser.name} - ${_T("HEADER_DIARY")}`);
        const helpImg = controls.createImg(h1, "help-button", 24, 24, "/images/buttons/help.png", _T("BUTTON_HELP"));
        helpImg.addEventListener("click", () => onUpdateHelp(true));
        if (currentUser && currentUser.photo) {
            let imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo, _T("BUTTON_PROFILE"));
            imgPhoto.addEventListener("click", () => utils.set_window_location("/usermgmt"));
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `${_T("HEADER_DIARY")} ${version}. ${_T("TEXT_COPYRIGHT")} 2020-2022 `);
        controls.createA(div, "copyright", "/view?page=copyright", _T("COPYRIGHT"));
        controls.create(div, "span", "copyright", ".");
    };

    const renderCalendar = (calendarDiv, textDiv, month, year) => {
        controls.removeAllChildren(calendarDiv);
        let today = new Date();
        let date = new Date(year, month);
        let firstDay = (date.getDay() + 6) % 7;
        let daysInMonth = 32 - new Date(year, month, 32).getDate();
        let table = controls.create(calendarDiv, "table");
        let caption = controls.create(table, "caption");
        controls.createA(caption, undefined, "#summary",
            utils.format_date(date, { year: "numeric", month: "long" }),
            () => onShowSummary(textDiv, new Date(Date.UTC(year, month))));
        controls.createImageButton(caption, _T("BUTTON_PREV_MONTH"),
            () => onPrevButton(parent, calendarDiv, textDiv, year, month),
            "/images/buttons/arrow-left-2.png", 16, "transparent");
        controls.createImageButton(caption, _T("BUTTON_NEXT_MONTH"),
            () => onNextButton(parent, calendarDiv, textDiv, year, month),
            "/images/buttons/arrow-right-2.png", 16, "transparent");
        let theader = controls.create(table, "thead");
        let tr = controls.create(theader, "tr");
        let th = controls.create(tr, "th", undefined, _T("COLUMN_MON"));
        th.title = _T("TEXT_MONDAY");
        th = controls.create(tr, "th", undefined, _T("COLUMN_TUE"));
        th.title = _T("TEXT_TUESDAY");
        th = controls.create(tr, "th", undefined, _T("COLUMN_WED"));
        th.title = _T("TEXT_WEDNESDAY");
        th = controls.create(tr, "th", undefined, _T("COLUMN_THU"));
        th.title = _T("TEXT_THURSDAY");
        th = controls.create(tr, "th", undefined, _T("COLUMN_FRI"));
        th.title = _T("TEXT_FRIDAY");
        th = controls.create(tr, "th", undefined, _T("COLUMN_SAT"));
        th.title = _T("TEXT_SATURDAY");
        th = controls.create(tr, "th", undefined, _T("COLUMN_SON"));
        th.title = _T("TEXT_SUNDAY");
        let tbody = controls.create(table, "tbody");        
        let day = 1;
        for (let i = 0; i < 6; i++) {
            let tr = controls.create(tbody, "tr");
            for (let j = 0; j < 7; j++) {
                if (i === 0 && j < firstDay) {
                    controls.create(tr, "td");
                }
                else if (day > daysInMonth) {
                    controls.create(tr, "td", undefined, "\u00A0");
                }
                else {
                    let isToday = day == today.getDate() && year == today.getFullYear() && month == today.getMonth();
                    let td = controls.create(tr, "td");
                    let d = day;
                    let cl = daySet && daySet.has(d) ? "filled" : undefined;
                    let msg = `${day}`;
                    if (isToday) {
                        msg += "*";
                    }
                    let a = controls.createA(td, cl, "#open", msg,
                        () => onClickCalendarDate(textDiv, a, year, month, d));
                    day++;
                }
            }
        }
        renderText(textDiv);
    };

    const renderText = (div, dd, diary) => {
        controls.removeAllChildren(div);
        selectedISODate = undefined;
        if (dd && hasEncryptKey()) {
            selectedISODate = dd.toISOString();
            let dt = utils.format_date(dd, { year: "numeric", month: "long", day: "numeric" });
            let caption = controls.createDiv(div, "caption");
            caption.textContent = _T("INFO_ENTRY_FROM_1", dt);
            let imgStatus = controls.createImg(caption, "img-status", 24, 24, "/images/buttons/document-save-3.png", _T("INFO_STATUS_SAVING"));
            imgStatus.id = "img-status-id";
            imgStatus.style.visibility = "hidden";
            let txt = controls.create(div, "textarea");
            txt.id = "textarea-entry-id";
            txt.rows = 11;
            txt.maxLength = 90000;
            if (!utils.is_mobile()) {
                txt.cols = 40;
            }
            else {
                txt.cols = 35;
            }
            txt.addEventListener("input", (ev) => {
                changeDate = Date.now();
                if (dayClicked && dayClicked.elem) {
                    dayClicked.elem.className = ev.target.value.length > 0 ? "filled" : undefined;
                }
                onUpdateStatus();
            });
            txt.addEventListener("change", () => onSaveDiaryEntry());
            if (diary) {
                decodeEntry(diary.entry,
                    (msg) => txt.value = msg,
                    (errMsg) => {
                        txt.value = "?";
                        console.error(errMsg);
                    }
                );
            }
        }
        else {
            dayClicked = undefined;
        }
    };

    const renderSummary = (div, diaries, date) => {
        dayClicked = undefined;
        controls.removeAllChildren(div);
        let dt = utils.format_date(date, { month: "long" });
        controls.createDiv(div, "caption").textContent = _T("INFO_ENTRIES_FOR_1", dt);
        let txt = controls.create(div, "textarea");
        txt.id = "textarea-entry-id";
        txt.rows = 11;
        if (!utils.is_mobile()) {
            txt.cols = 40;
        }
        else {
            txt.cols = 35;
        }
        txt.readOnly = true;
        txt.spellcheck = false;
        decodeDiaries(diaries, [],
            (decodedDiaries) => {
                let content = "";
                const options = { year: 'numeric', month: 'long', day: 'numeric' };
                decodedDiaries.forEach(diary => {
                    let d = new Date(diary.date);
                    let dt = utils.format_date(d, options);
                    content += `${dt}\n`;
                    content += `${diary.entry}\n\n`;
                });
                txt.value = content;
            },
            (errMsg) => {
                txt.value = "?";
                console.error(errMsg);
            }
        );
    };

    const renderError = (parent, errMsg) => {
        controls.createDiv(parent, "error").textContent = _T(errMsg);
    };

    const renderDiaryAsync = async (parent) => {
        controls.removeAllChildren(parent);
        let token = utils.get_authentication_token();
        if (!token) {
            const nexturl = "/diary";
            utils.set_window_location("/pwdman?nexturl=" + encodeURI(nexturl));
            return;
        }
        if (!currentUser) {
            utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
                (user) => {
                    currentUser = user;
                    renderDiaryAsync(parent);
                },
                (errMsg) => renderError(parent, errMsg)
            );
            return;
        }
        if (!daySet) {
            let d = new Date(Date.now());
            utils.fetch_api_call(`api/diary/day?date=${d.toISOString()}`, { headers: { "token": token } },
                (days) => {
                    daySet = new Set(days);
                    renderDiaryAsync(parent);
                },
                (errMsg) => renderError(parent, errMsg)
            );
            return;
        }
        utils.create_menu(parent);
        renderHeader(parent);
        const encryptKey = await utils.get_encryption_key_async(currentUser);
        let div = controls.createDiv(parent, "hide");
        div.id = "div-encryptkey-id";
        let p = controls.create(div, "p");
        p.id = "p-encryptkey-notice-id";
        controls.create(p, "p", "encryptkey-notice", _T("INFO_ENCRYPTION_TEXT"));
        p = controls.create(div, "p");
        let elem = controls.createLabel(p, undefined, _T("LABEL_KEY"));
        elem.htmlFor = "input-encryptkey-id";
        elem = controls.createInputField(p, _T("TEXT_KEY"), () => onChangeEncryptKeyAsync(), undefined, 32, 32);
        elem.id = "input-encryptkey-id";
        elem.addEventListener("change", () => onChangeEncryptKeyAsync());
        if (encryptKey && encryptKey.length > 0) {
            elem.value = encryptKey;
        }
        p = controls.create(div, "p");
        let show = encryptKey == undefined;
        elem = controls.createCheckbox(p, "checkbox-save-encryptkey-id", undefined,
            _T("OPTION_SAVE_KEY_IN_BROWSER"), !show, () => onChangeEncryptKeyAsync());
        utils.show_encrypt_key(currentUser, show);
        let today = new Date();
        let boxDiv = controls.createDiv(parent, "box");
        let leftDiv = controls.createDiv(boxDiv, "calendar-column");
        let rightDiv = controls.createDiv(boxDiv, "text-column");
        rightDiv.id = "text-column-id";
        renderCalendar(leftDiv, rightDiv, today.getMonth(), today.getFullYear());
        renderCopyright(parent);
        utils.set_menu_items(currentUser);
    };

    // --- callbacks

    const onUpdateHelp = (show) => {
        if (helpDiv) {
            helpDiv.className = show ? "help-div" : undefined;
            controls.removeAllChildren(helpDiv);
            if (show) {
                let contentDiv = controls.createDiv(helpDiv, "help-content");
                let mdDiv = controls.createDiv(contentDiv, "help-item");
                utils.fetch_api_call(`/api/pwdman/markdown/help-diary?locale=${utils.get_locale()}`, undefined, (html) => mdDiv.innerHTML = html);
                controls.createButton(contentDiv, _T("BUTTON_OK"), () => onUpdateHelp(false)).focus();
            }
        }
    };

    const onUpdateStatus = () => {
        let statusimg = document.getElementById("img-status-id");
        if (statusimg) {
            statusimg.style.visibility = changeDate ? "visible" : "hidden";
        }
    };

    const onPrevButton = (parent, calendarDiv, textDiv, year, month) => {
        month -= 1;
        if (month < 0) {
            year -= 1;
            month = 11;
        }
        let d = new Date(Date.UTC(year, month));
        let token = utils.get_authentication_token();
        utils.fetch_api_call(`api/diary/day?date=${d.toISOString()}`, { headers: { "token": token } },
            (days) => {
                daySet = new Set(days);
                renderCalendar(calendarDiv, textDiv, month, year);
            },
            (errMsg) => renderError(parent, errMsg)
        );
    };

    const onNextButton = (parent, calendarDiv, textDiv, year, month) => {
        month += 1;
        if (month >= 12) {
            month = 0;
            year += 1;
        }
        let d = new Date(Date.UTC(year, month));
        let token = utils.get_authentication_token();
        utils.fetch_api_call(`api/diary/day?date=${d.toISOString()}`, { headers: { "token": token } },
            (days) => {
                daySet = new Set(days);
                renderCalendar(calendarDiv, textDiv, month, year);
            },
            (errMsg) => renderError(parent, errMsg)
        );
    };

    const onChangeEncryptKeyAsync = async () => {
        let elem = document.getElementById("checkbox-save-encryptkey-id");
        let saveInBrowser = elem.checked;
        elem = document.getElementById("input-encryptkey-id");
        let val = elem.value.trim();
        if (val.length == 0 || !saveInBrowser) {
            await utils.set_encryption_key_async(currentUser);
        }
        else {
            await utils.set_encryption_key_async(currentUser, val);
        }
        cryptoKey = undefined;
        elem = document.getElementById("text-column-id");
        if (elem) {
            if (dayClicked) {
                onClickCalendarDate(elem, dayClicked.elem, dayClicked.year, dayClicked.month, dayClicked.day);
            }
            else {
                renderText(elem);
            }
        }
    };

    const onClickCalendarDate = (textDiv, a, year, month, day) => {
        dayClicked = { "elem": a, "year": year, "month": month, "day": day };
        let d = new Date(Date.UTC(year, month, day));
        let token = utils.get_authentication_token();
        utils.fetch_api_call(`api/diary/entry?date=${d.toISOString()}`, { headers: { "token": token } },
            (diary) => renderText(textDiv, d, diary),
            (errMsg) => renderError(textDiv, errMsg)
        );
    };

    const onSaveDiaryEntry = () => {
        if (inSaveDiary || !changeDate) return;
        inSaveDiary = true;
        let elem = document.getElementById("textarea-entry-id");
        if (elem && changeDate && selectedISODate) {
            changeDate = undefined;
            encodeEntry(elem.value.trim(),
                (msg) => {
                    let token = utils.get_authentication_token();
                    utils.fetch_api_call("api/diary/entry",
                        {
                            method: "POST",
                            headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                            body: JSON.stringify({ "Date": selectedISODate, "Entry": msg })
                        },
                        () => {
                            inSaveDiary = false;
                            onUpdateStatus();
                        },
                        (errMsg) => {
                            console.error(errMsg);
                            inSaveDiary = false;
                            onUpdateStatus();
                        }
                    );
                },
                (errMsg) => {
                    console.error(errMsg);
                    inSaveDiary = false;
                    onUpdateStatus();
                });
            return;
        }
        inSaveDiary = false;
        onUpdateStatus();
    };

    const onShowSummary = (div, date) => {
        if (!hasEncryptKey()) {
            return;
        }
        let token = utils.get_authentication_token();
        utils.fetch_api_call(`api/diary/month?date=${date.toISOString()}`, { headers: { "token": token } },
            (diaries) => renderSummary(div, diaries, date),
            (errMsg) => renderError(div, errMsg)
        );
        return;
    };

    const onTimer = () => {
        if (changeDate) {
            let end = Date.now();
            let elapsed = end - changeDate;
            if (elapsed > 1000) {
                onSaveDiaryEntry();
            }
        }
    }

    // --- start rendering

    const render = () => {
        renderDiaryAsync(document.body);
    };

    // --- public API

    return {
        render: render,
        onTimer: onTimer
    };
})();

window.onload = () => {
    window.setInterval(diary.onTimer, 1000);
    utils.auth_lltoken(() => utils.set_locale(diary.render));
};

window.onclick = (event) => utils.hide_menu(event);