"use strict";

var diary = (() => {

    // state

    let version = "1.0.4";

    let changeDate;
    let selectedISODate;
    let daySet;
    let dayClickedElem;

    let currentUser;

    let cryptoKey;

    // helper

    const getLocalStorageKey = () => {
        return `diary-${currentUser.email}-encryptkey`;
    }

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
        let elem = document.getElementById("div-encryptkey-id");
        elem.style.display = show ? "" : "none";
    };

    // rendering

    const renderHeader = (parent, intro) => {
        controls.create(parent, "h1", undefined, "Mein Tagebuch");
        if (intro) {
            controls.create(parent, "p", undefined, intro);
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna Diary ${version}. Copyright 2020 `);
        let a = controls.createA(div, "copyright", "https://github.com/nylssoft/", "Niels Stockfleth");
        a.target = "_blank";
        controls.create(div, "span", "copyright", `. Alle Rechte vorbehalten. `);
        controls.createA(div, "copyright", "/slideshow", "Home");
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
            "/images/diary/arrow-left-2.png", 16, "transparent");
        controls.createImageButton(caption, "N\u00E4chster Monat",
            () => onNextButton(parent, calendarDiv, textDiv, year, month),
            "/images/diary/arrow-right-2.png", 16, "transparent");
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
            controls.createDiv(div, "caption").textContent = `Eintrag vom ${dt}`;
            let txt = controls.create(div, "textarea");
            txt.id = "textarea-entry-id";
            txt.rows = 11;
            txt.spellcheck = false;
            if (!utils.is_mobile()) {
                txt.cols = 40;
            }
            else {
                txt.cols = 35;
            }
            txt.addEventListener("input", (ev) => {
                changeDate = Date.now();
                dayClickedElem.className = ev.target.value.length > 0 ? "filled" : undefined;
            });
            txt.addEventListener("change", () => onSaveDiaryEntry());
            if (diary) {
                decodeEntry(diary.entry,
                    (msg) => txt.value = msg,
                    (errMsg) => console.error(errMsg)
                );
            }
        }
    };

    const renderSummary = (div, diaries, date) => {
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
            (errMsg) => console.error(errMsg)
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
        let itemKey = getLocalStorageKey();
        let encryptKey = window.localStorage.getItem(itemKey);
        renderHeader(parent, `Hallo ${currentUser.name}! Klicke auf einen Tag, um einen Tagebucheintrag vorzunehmen.`);
        let p = controls.create(parent, "p");
        let elem = controls.createCheckbox(p, "checkbox-show-encryptkey-id", undefined,
            "Schl\u00FCssel anzeigen", encryptKey == undefined,
            () => onSelectShowEncryptKey());
        let div = controls.createDiv(parent);
        div.id = "div-encryptkey-id";
        p = controls.create(div, "p");
        p.id = "p-encryptkey-notice-id";
        controls.create(p, "p", undefined,
            "Die Texte werden auf dem Server verschl\u00FCsselt gespeichert, sodass nur Du die Texte lesen kannst." +
            " Dazu ist ein Schl\u00FCssel erforderlich, der in deinem Browser lokal gespeichert werden kann." +
            " Notiere den Schl\u00FCssel, z.B. in einem Passwort-Manager." +
            " Wenn Du ihn nicht mehr wei\u00DFt, k\u00F6nnen keine Texte mehr angezeigt werden. Alle Daten sind dann verloren.");
        p = controls.create(div, "p");
        elem = controls.createLabel(p, undefined, "Schl\u00FCssel:");
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
        renderCalendar(leftDiv, rightDiv, today.getMonth(), today.getFullYear());
        renderCopyright(parent);
    };

    // --- callbacks

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

    const onSelectShowEncryptKey = () => {
        let elem = document.getElementById("checkbox-show-encryptkey-id");
        showEncryptKey(elem.checked);
    };
    
    const onChangeEncryptKey = () => {
        let elem = document.getElementById("checkbox-save-encryptkey-id");
        let saveInBrowser = elem.checked;
        let itemKey = getLocalStorageKey();
        elem = document.getElementById("input-encryptkey-id");
        let val = elem.value.trim();
        if (val.length == 0 || !saveInBrowser) {
            window.localStorage.removeItem(itemKey);
        }
        else {
            window.localStorage.setItem(itemKey, val);
        }
        cryptoKey = undefined;
    };

    const onClickCalendarDate = (textDiv, a, year, month, day) => {
        dayClickedElem = a;
        let d = new Date(Date.UTC(year, month, day));
        let token = utils.get_authentication_token();
        utils.fetch_api_call(`api/diary/entry?date=${d.toISOString()}`, { headers: { "token": token } },
            (diary) => renderText(textDiv, d, diary),
            (errMsg) => renderError(textDiv, errMsg)
        );
    };

    const onSaveDiaryEntry = () => {
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
                        undefined,
                        (errMsg) => console.error(errMsg)
                    );
                },
                (errMsg) => console.error(errMsg)
            );
        }
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
            if (elapsed > 5000) {
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
    window.setInterval(diary.onTimer, 5000);
    utils.auth_lltoken(diary.render);
};
