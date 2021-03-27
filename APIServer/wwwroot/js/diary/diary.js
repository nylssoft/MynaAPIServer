"use strict";

var diary = (() => {

    // state

    let version = "1.1.4";

    let changeDate;
    let inSaveDiary;
    let selectedISODate;
    let daySet;
    let dayClicked;

    let currentUser;

    let cryptoKey;

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

    const showEncryptKey = (show) => {
        let encryptKeyElem = document.getElementById("div-encryptkey-id");
        if (!encryptKeyElem) return;
        if (show || !utils.has_viewed_encryption_key(currentUser)) {
            encryptKeyElem.classList.add("show");
        }
        else {
            encryptKeyElem.classList.remove("show");
        }
        renderDropdownContent();
    };

    // rendering

    const renderDropdown = (parent) => {
        let dropdownDiv = controls.create(parent, "div", "dropdown");
        let dropdownButton = controls.createImg(dropdownDiv, "dropbtn", 24, 24, "/images/buttons/hamburger.svg");
        dropdownButton.addEventListener("click", () => {
            document.getElementById("dropdown-id").classList.toggle("show");
        });
        let dropdownContentDiv = controls.create(dropdownDiv, "div", "dropdown-content");
        dropdownContentDiv.id = "dropdown-id";
    };

    const renderDropdownContent = () => {
        let parent = document.getElementById("dropdown-id");
        let encryptKeyElem = document.getElementById("div-encryptkey-id");
        if (!parent || !encryptKeyElem) return;
        controls.removeAllChildren(parent);
        controls.createA(parent, undefined, "/slideshow", "Bildergalerie");
        controls.createA(parent, undefined, "/notes", "Notizen");
        controls.createA(parent, undefined, "/skat", "Skat");
        controls.createA(parent, undefined, "/diary", "Tagebuch");
        controls.createA(parent, undefined, "/tetris", "Tetris");
        controls.create(parent, "hr");
        controls.createA(parent, undefined, "/usermgmt", "Profil");
        controls.createA(parent, undefined, "/usermgmt?logout", "Abmelden");
        controls.create(parent, "hr");
        controls.createA(parent, undefined, "/markdown?page=impressum", "Impressum");
        controls.create(parent, "hr");
        if (encryptKeyElem.classList.contains("show")) {
            controls.createA(parent, undefined, "/hidekey", "Schl\u00FCssel verbergen",
                () => {
                    utils.set_viewed_encryption_key(currentUser, true);
                    showEncryptKey(false);
                });
        }
        else {
            controls.createA(parent, undefined, "/showkey", "Schl\u00FCssel anzeigen",
                () => showEncryptKey(true));
        }
    };

    const renderHeader = (parent) => {
        controls.create(parent, "h1", undefined, `${currentUser.name} - Tagebuch`);
        if (currentUser && currentUser.photo) {
            let imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo);
            imgPhoto.title = "Profil";
            imgPhoto.addEventListener("click", () => window.location.href = "/usermgmt");
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna Diary ${version}. Copyright 2020-2021 `);
        controls.createA(div, "copyright", "/markdown?page=homepage", "Niels Stockfleth");
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
            date.toLocaleDateString("de-DE", { year: "numeric", month: "long" }),
            () => onShowSummary(textDiv, new Date(Date.UTC(year, month))));
        controls.createImageButton(caption, "Vorheriger Monat",
            () => onPrevButton(parent, calendarDiv, textDiv, year, month),
            "/images/buttons/arrow-left-2.png", 16, "transparent");
        controls.createImageButton(caption, "N\u00E4chster Monat",
            () => onNextButton(parent, calendarDiv, textDiv, year, month),
            "/images/buttons/arrow-right-2.png", 16, "transparent");
        let theader = controls.create(table, "thead");
        let tr = controls.create(theader, "tr");
        let th = controls.create(tr, "th", undefined, "Mon");
        th.title = "Montag";
        th = controls.create(tr, "th", undefined, "Die");
        th.title = "Dienstag";
        th = controls.create(tr, "th", undefined, "Mit");
        th.title = "Mittwoch";
        th = controls.create(tr, "th", undefined, "Don");
        th.title = "Donnerstag";
        th = controls.create(tr, "th", undefined, "Fre");
        th.title = "Freitag";
        th = controls.create(tr, "th", undefined, "Sam");
        th.title = "Samstag";
        th = controls.create(tr, "th", undefined, "Son");
        th.title = "Sonntag";
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
            let dt = dd.toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
            let caption = controls.createDiv(div, "caption");
            caption.textContent = `Eintrag vom ${dt}`;
            let imgStatus = controls.createImg(caption, "img-status", 24, 24);
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
        let dt = date.toLocaleDateString("de-DE", { month: "long" });
        controls.createDiv(div, "caption").textContent = `Eintr\u00E4ge f\u00FCr ${dt}`;
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
                    let dt = d.toLocaleDateString("de-DE", options);
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
        controls.createDiv(parent, "error").textContent = errMsg;
    };

    const renderDiary = (parent) => {
        controls.removeAllChildren(parent);
        let token = utils.get_authentication_token();
        if (!token) {
            let nexturl = "/diary";
            window.location.href = "/pwdman?nexturl=" + encodeURI(nexturl);
            return;
        }
        if (!currentUser) {
            utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
                (user) => {
                    currentUser = user;
                    renderDiary(parent);
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
                    renderDiary(parent);
                },
                (errMsg) => renderError(parent, errMsg)
            );
            return;
        }
        renderDropdown(parent);
        renderHeader(parent);
        let encryptKey = utils.get_encryption_key(currentUser);
        let div = controls.createDiv(parent, "hide");
        div.id = "div-encryptkey-id";
        let p = controls.create(div, "p");
        p.id = "p-encryptkey-notice-id";
        controls.create(p, "p", "encryptkey-notice",
            "Die Texte werden auf dem Server verschl\u00FCsselt gespeichert, sodass nur Du die Texte lesen kannst." +
            " Dazu ist ein Schl\u00FCssel erforderlich, der in Deinem Browser lokal gespeichert werden kann." +
            " Notiere den Schl\u00FCssel." +
            " Danach w\u00E4hle im Men\u00FC 'Schl\u00FCssel verbergen', um diesen Text auszublenden." +
            " Wenn der Schl\u00FCssel verloren geht, sind auch alle Daten verloren.");
        p = controls.create(div, "p");
        let elem = controls.createLabel(p, undefined, "Schl\u00FCssel:");
        elem.htmlFor = "input-encryptkey-id";
        elem = controls.createInputField(p, "Schl\u00FCssel", () => { }, undefined, 32, 32);
        elem.id = "input-encryptkey-id";
        elem.addEventListener("change", () => onChangeEncryptKey());
        if (encryptKey && encryptKey.length > 0) {
            elem.value = encryptKey;
        }
        p = controls.create(div, "p");
        let show = encryptKey == undefined;
        elem = controls.createCheckbox(p, "checkbox-save-encryptkey-id", undefined,
            "Schl\u00FCssel im Browser speichern", !show, () => onChangeEncryptKey());
        showEncryptKey(show);
        let today = new Date();
        let boxDiv = controls.createDiv(parent, "box");
        let leftDiv = controls.createDiv(boxDiv, "calendar-column");
        let rightDiv = controls.createDiv(boxDiv, "text-column");
        rightDiv.id = "text-column-id";
        renderCalendar(leftDiv, rightDiv, today.getMonth(), today.getFullYear());
        renderCopyright(parent);
        renderDropdownContent();
    };

    // --- callbacks

    const onUpdateStatus = () => {
        let statusimg = document.getElementById("img-status-id");
        if (statusimg) {
            if (!changeDate) {
                statusimg.style.visibility = "hidden";
            }
            else {
                statusimg.src = "/images/buttons/document-save-3.png";
                statusimg.title = "\u00C4nderung wird gespeichert...";
                statusimg.style.visibility = "visible";
            }
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

    const onChangeEncryptKey = () => {
        let elem = document.getElementById("checkbox-save-encryptkey-id");
        let saveInBrowser = elem.checked;
        elem = document.getElementById("input-encryptkey-id");
        let val = elem.value.trim();
        if (val.length == 0 || !saveInBrowser) {
            utils.set_encryption_key(currentUser);
        }
        else {
            utils.set_encryption_key(currentUser, val);
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
        renderDiary(document.body);
    };

    // --- public API

    return {
        render: render,
        onTimer: onTimer
    };
})();

window.onload = () => {
    window.setInterval(diary.onTimer, 1000);
    utils.auth_lltoken(diary.render);
};

window.onclick = (event) => {
    if (!event.target.matches(".dropbtn")) {
        let dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            let openDropdown = dropdowns[i];
            if (openDropdown.classList.contains("show")) {
                openDropdown.classList.remove("show");
            }
        }
    }
};