var makeadate = (() => {

    "use strict";

    let version = "0.0.4";
    let currentUser;
    let cryptoKey;
    let helpDiv;

    let acceptImg;
    let headerHeight = 20;
    let dayWidth;
    let dayHeight;
    let xmin;
    let ymin;
    let dirty;
    let dayMatrix;
    let myName;
    let currentOptionIdx;
    let listView = false;
    let changed = false;
    let editAppointment = false;
    let appointments = [];
    let currentAppointmentId;
    
    let rowColorEven = "#FFFFFF";
    let rowColorOdd = "#EEEEEE";
    let dayNameColor = "#FFFFFF";
    let selectableDayColor = "#FF0000";
    let disabledDayColor = "#D8D8D8";
    let bestDayColor = "#FFD700";
    let acceptedDayColor = "#000000";
    let fontLarge = "24px Arial, Helvetica, sans-serif";
    let fontSmall = "14px Arial, Helvetica, sans-serif";
    let fontSmaller = "11px Arial, Helvetica, sans-serif";

    const draw = () => {
        if (!editAppointment && listView) {
            return;
        }
        const canvas = document.getElementById("calendar-id");
        window.requestAnimationFrame(draw);
        if (!canvas || !dirty || !acceptImg || !acceptImg.complete || !editAppointment && !myName) {
            return;
        }
        dirty = false;
        const appointment = getAppointment();
        const option = appointment.options[currentOptionIdx];
        let date = new Date(option.year, option.month - 1);
        let firstDay = (date.getDay() + 6) % 7;
        let daysInMonth = 32 - new Date(option.year, option.month - 1, 32).getDate();
        const bestVotes = getBestVotes(appointment);
        const selectableDays = new Set();
        const myAcceptedDays = new Set();
        const acceptedCount = new Map();
        option.votes.forEach(v => {
            selectableDays.add(v.day);
            if (v.accepted.length > 0) {
                acceptedCount.set(v.day, v.accepted.length);
                if (v.accepted.includes(myName)) {
                    myAcceptedDays.add(v.day);
                }
            }
        });
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = dayNameColor;
        ctx.font = utils.is_mobile() ? fontSmall : fontLarge;
        let xstart = 0;
        let ystart = 30;
        let days = ["Mon", "Die", "Mit", "Don", "Fre", "Sam", "Son"];
        for (let idx = 0; idx < 7; idx++) {
            ctx.fillText(days[idx], xstart + idx * dayWidth + dayWidth / 4, headerHeight);
        }   
        let day = 1;
        for (let y = 0; y < 6; y++) {
            for (let x = 0; x < 7; x++) {
                if ((y != 0 || x >= firstDay) && day <= daysInMonth) {
                    const dc = day;
                    const isBestVote = !editAppointment && bestVotes.some(v => v.year == option.year && v.month == option.month && v.day == dc);
                    if (isBestVote) {
                        ctx.fillStyle = bestDayColor;
                    }
                    else {
                        ctx.fillStyle = y % 2 == 0 ? rowColorEven : rowColorOdd;
                    }
                    ctx.fillRect(xstart + x * dayWidth, ystart + y * dayHeight, dayWidth - 2, dayHeight - 2);
                    dayMatrix[y][x] = day;
                    if (editAppointment) {
                        if (selectableDays.has(day)) {
                            ctx.drawImage(acceptImg, xstart + x * dayWidth, ystart + y * dayHeight, dayWidth, dayHeight);
                        }
                        if (acceptedCount.has(day)) {
                            dayMatrix[y][x] = undefined;
                            ctx.fillStyle = disabledDayColor;
                        }
                        else {
                            ctx.fillStyle = selectableDayColor;
                        }
                    }
                    else if (myAcceptedDays.has(day)) {
                        ctx.drawImage(acceptImg, xstart + x * dayWidth, ystart + y * dayHeight, dayWidth, dayHeight);
                        ctx.fillStyle = acceptedDayColor;
                    }
                    else {
                        ctx.fillStyle = selectableDays.has(day) ? selectableDayColor : disabledDayColor;
                    }
                    ctx.font = utils.is_mobile() ? fontSmall : fontLarge;
                    ctx.fillText(`${day}`, xstart + x * dayWidth + dayWidth / 3, ystart + y * dayHeight + dayHeight / 2);
                    if (acceptedCount.has(day)) {
                        ctx.font = utils.is_mobile() ? fontSmaller : fontSmall;
                        ctx.fillText(`+${acceptedCount.get(day)}`, xstart + x * dayWidth + 5, ystart + y * dayHeight + dayHeight - 8);
                    }
                    day++;
                }
                else {
                    ctx.fillStyle = y % 2 == 0 ? rowColorEven : rowColorOdd;
                    ctx.fillRect(xstart + x * dayWidth, ystart + y * dayHeight, dayWidth - 2, dayHeight - 2);
                    dayMatrix[y][x] = undefined;
                }
            }
        }
    };

    const getBestVotes = (appointment) => {
        let bestVotes = [];
        if (editAppointment) {
            return;
        }
        let maxVotes = 0;
        appointment.options.forEach(o => {
            o.votes.forEach(v => {
                if (v.accepted.length > 0 && v.accepted.length >= maxVotes) {
                    if (v.accepted.length > maxVotes) {
                        bestVotes = [];
                        maxVotes = v.accepted.length;
                    }
                    bestVotes.push({ "year": o.year, "month": o.month, "day": v.day });
                }
            });
        });
        return bestVotes;
    };

    // storage and initialization

    const KEY_MYNAME = "makeadate-myname";
    const KEY_APPOINTMENTS = "makeadate-appointments";

    const save = () => {
        utils.set_local_storage(KEY_MYNAME, myName);
        utils.set_local_storage(KEY_APPOINTMENTS, JSON.stringify(appointments));
    };

    const logout = () => {
        myName = undefined;
        utils.remove_local_storage(KEY_MYNAME);
    };
   
    const init = () => {
        acceptImg = new Image();
        acceptImg.src = "/images/buttons/check-lg.svg";
        dayMatrix = Array(6);
        for (let row = 0; row < 6; row++) {
            const arr = Array(7);
            for (let col = 0; col < 7; col++) {
                arr[col] = undefined;
            }
            dayMatrix[row] = arr;
        }
        xmin = utils.is_mobile() ? 330 : 400;
        ymin = xmin;
        myName = utils.get_local_storage(KEY_MYNAME);
        const json = utils.get_local_storage(KEY_APPOINTMENTS);
        if (json) {
            appointments = JSON.parse(json);
        }
        if (!appointments) {
            appointments = [];
        }
        const appointment = getAppointment();
        if (myName && appointment && !appointment.participants.includes(myName)) {
            myName = undefined;
        }
    };
    
    const setCanvasSize = (canvas) => {
        const wh = window.innerHeight - window.innerHeight / 2;
        const w = Math.max(xmin, window.innerWidth - 20);
        const h = Math.max(ymin, wh);
        dayWidth = Math.min(100, Math.floor(w / 7));
        dayHeight = Math.min(100, Math.floor(h / 6));
        dayWidth = Math.min(dayWidth, dayHeight);
        dayHeight = dayWidth;
        canvas.width = dayWidth * 7;
        canvas.height = dayHeight * 6 + headerHeight + 10;
    };

    const getAppointment = () => {
        let appointment;
        if (appointments) {
            appointment = appointments.find(a => a.id == currentAppointmentId);
        }
        return appointment;
    };

    // rendering

    const renderInit = () => {
        const parent = document.body;
        controls.removeAllChildren(parent);
        const params = new URLSearchParams(window.location.search);
        currentAppointmentId = params.get("id");
        if (!currentAppointmentId) {
            const token = utils.get_authentication_token();
            if (!token) {
                const nexturl = "/makeadate";
                utils.set_window_location("/pwdman?nexturl=" + encodeURI(nexturl));
                return;
            }
            if (!currentUser) {
                utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
                    (user) => {
                        currentUser = user;
                        renderPageAsync(parent);
                    },
                    (errMsg) => renderError(parent, errMsg)
                );
                return;
            }
        }
        renderPageAsync(parent);
        return;
    };

    const renderError = (parent, errMsg) => {
        controls.createDiv(parent, "error").textContent = _T(errMsg);
    };

    const render = () => {
        const params = new URLSearchParams(window.location.search);
        currentAppointmentId = params.get("id");
        if (!currentAppointmentId) {
            renderManageAppointments();
            return;
        }
        init();
        const parent = document.getElementById("content-id");
        const appointment = getAppointment();
        if (!appointment) {
            controls.create(parent, "p", undefined, "Unbekannter Termin.");
            return;
        }
        if (appointment.participants.length == 0) {
            controls.create(parent, "p", undefined, "Der Termin hat noch keine Teilnehmer.");
            return;
        }
        if (appointment.options.length == 0 || appointment.options[0].votes.length == 0) {
            controls.create(parent, "p", undefined, "Der Termin hat noch keine Auswahlm\u00F6glichkeiten.");
            return;
        }
        if (!currentOptionIdx || currentOptionIdx >= appointment.options.length) {
            currentOptionIdx = 0;
        }
        if (!myName) {
            renderSelectName();
            return;
        }
        renderVoteAppointment();
    };

    const renderManageAppointments = () => {
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        controls.createDiv(parent, "gap");
        if (!hasEncryptKey()) {
            renderError(parent, "ERROR_MISSING_KEY_DECODE_APPOINTMENT");
            return;
        }   
        init();
        controls.createButton(parent, "Neuer Termin", onNewAppointment);
        controls.create(parent, "p", undefined, "Termine:");
        const li = controls.create(parent, "ul");
        appointments.forEach(a => {
            const ul = controls.create(li, "li");
            controls.create(ul, "p", undefined, `${a.description}\u00a0\u00a0\u00a0`);
            controls.createButton(ul, "Bearbeiten", () => onEditAppointment(a));
            controls.createButton(ul, "Abstimmen", () => onVoteAppointment(a));
        });
    };

    const renderEditAppointment = () => {
        const appointment = getAppointment();
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        controls.createDiv(parent, "gap");
        editAppointment = true;
        currentOptionIdx = 0;
        const option = appointment.options[currentOptionIdx];
        // edit description
        const descriptionP = controls.create(parent, "p");
        const descriptionLabel = controls.createLabel(descriptionP, undefined, _T("LABEL_DESCRIPTION"));
        descriptionLabel.htmlFor = "description-id";
        const descriptionInput = controls.createInputField(descriptionP, _T("TEXT_DESCRIPTION"), undefined, undefined, 50, 255);
        descriptionInput.id = "description-id";
        descriptionInput.value = appointment.description;
        descriptionInput.addEventListener("input", onChange);
        // edit participants
        const participantsP = controls.create(parent, "p");
        const participantsLabel = controls.createLabel(participantsP, undefined, "Teilnehmer:");
        participantsLabel.htmlFor = "participants-id";
        const participantsInput = controls.createInputField(participantsP, "Teilnehmer", undefined, undefined, 50, 255);
        participantsInput.id = "participants-id";
        participantsInput.value = appointment.participants.join(", ");
        let canChangeParticipants = true;
        for (let i = 0; i < appointment.options.length && canChangeParticipants; i++) {
            for (let j = 0; j < appointment.options[i].votes.length && canChangeParticipants; j++) {
                if (appointment.options[i].votes[j].accepted.length > 0) {
                    canChangeParticipants = false;
                }
            }
        }
        if (!canChangeParticipants) {
            participantsInput.setAttribute("readonly", "readonly");
        }
        participantsInput.addEventListener("input", onChange);
        // show URL
        const urlP = controls.create(parent, "p");
        const urlLabel = controls.createLabel(urlP, undefined, "URL:");
        urlLabel.htmlFor = "url-id";
        const urlInput = controls.createInputField(urlP, "URL", undefined, undefined, 50, 255);
        urlInput.id = "url-id";
        urlInput.value = `${location}?id=${appointment.id}`;
        urlInput.setAttribute("readonly", "readonly");
        // edit options
        const date = new Date(option.year, option.month - 1, 1);
        const datestr = utils.format_date(date, { year: "numeric", month: "long" });
        const optionsP = controls.create(parent, "p", undefined, "Optionen f\u00FCr:\u00A0");
        const prevButton = controls.createButton(optionsP, "<", onDatePrevious);
        prevButton.id = "prev-button-id";
        controls.hide(prevButton);
        const dateSpan = controls.create(optionsP, "span", "date", datestr);
        dateSpan.id = "date-span-id";
        const nextButton = controls.createButton(optionsP, ">", onDateNext);
        nextButton.id = "next-button-id";
        const calendarDiv = controls.createDiv(optionsP);
        calendarDiv.id = "calendar-div-id";
        renderCalendarView();
        // action buttons
        const saveButton = controls.createButton(parent, _T("BUTTON_SAVE"), onUpdateAppointment);
        saveButton.id = "save-button-id";
        if (!changed) {
            controls.hide(saveButton);
        }
        controls.createButton(parent, _T("BUTTON_DELETE"), renderDeleteApppointment);
        controls.createButton(parent, _T("BUTTON_BACK"), renderCancelEditApppointment);
    };

    const renderDeleteApppointment = () => {
        const appointment = getAppointment();
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        controls.createDiv(parent, "gap");
        const pConfirm = controls.create(parent, "p");
        controls.create(pConfirm, "span", "confirmation", `M\u00F6chtest du den Termin f\u00FCr ${appointment.description} wirklich l\u00F6schen?\u00a0`);
        controls.createButton(pConfirm, _T("BUTTON_YES"), onDeleteAppointment);
        controls.createButton(pConfirm, _T("BUTTON_NO"), renderEditAppointment);
    };

    const renderCancelEditApppointment = () => {
        if (changed) {
            const appointment = getAppointment();
            const parent = document.getElementById("content-id");
            controls.removeAllChildren(parent);
            controls.createDiv(parent, "gap");
            const pConfirm = controls.create(parent, "p");
            controls.create(pConfirm, "span", "confirmation", `Deine \u00C4nderungen f\u00FCr ${appointment.description} wurden nicht gespeichert. M\u00F6chtest du die Seite wirklich verlassen?\u00a0`);
            controls.createButton(pConfirm, _T("BUTTON_YES"), renderManageAppointments);
            controls.createButton(pConfirm, _T("BUTTON_NO"), renderEditAppointment);
            return;
        }
        renderManageAppointments();
    };

    const renderLogout = () => {
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        controls.create(parent, "h2", undefined, "Terminplaner");
        controls.create(parent, "p", undefined, "Vielen Dank f\u00FCr deine Teilnahme!");
        controls.create(parent, "p", undefined, "Du bist jetzt abgemeldet.");
    };

    const renderSelectName = () => {
        const appointment = getAppointment();
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        controls.create(parent, "h2", undefined, "Terminplaner");
        controls.create(parent, "p", undefined, `Finde einen Termin f\u00FCr ${appointment.description}.`);
        controls.create(parent, "p", undefined, "Wie lautet dein Name?");
        appointment.participants.sort();
        appointment.participants.forEach(name => {
            const p = controls.create(parent, "p");
            controls.createButton(p, name, () => onChooseNameButton(name));
        });
    };

    const renderVoteAppointment = () => {
        const appointment = getAppointment();
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        controls.create(parent, "h2", undefined, `Hallo ${myName}!`);
        controls.create(parent, "p", undefined, `Wann hast du Zeit f\u00FCr ${appointment.description}?`);
        const option = appointment.options[currentOptionIdx];
        const date = new Date(option.year, option.month - 1, 1);
        const datestr = utils.format_date(date, { year: "numeric", month: "long" });
        const optionsP = controls.create(parent, "p");
        const prevButton = controls.createButton(optionsP, "<", onBackButton);
        prevButton.id = "prev-button-id";
        if (currentOptionIdx == 0) {
            controls.hide(prevButton);
        }
        const dateSpan = controls.create(optionsP, "span", "date", datestr);
        dateSpan.id = "date-span-id";
        const nextButton = controls.createButton(optionsP, ">", onContinueButton);
        nextButton.id = "next-button-id";
        if (currentOptionIdx == appointment.options.length - 1) {
            controls.hide(nextButton);
        }
        const calendarDiv = controls.createDiv(parent);
        calendarDiv.id = "calendar-div-id";
        const listViewDiv = controls.createDiv(parent);
        listViewDiv.id = "listview-div-id";
        renderListView();
        renderCalendarView();
        const divFooter = controls.create(parent, "p");
        if (listView) {
            controls.createButton(divFooter, "Kalendar", onCalendarViewButton);
        }
        else {
            controls.createButton(divFooter, "Liste", onListViewButton);
        }
        controls.createButton(divFooter, _T("BUTTON_LOGOUT"), onLogoutButton);
    };

    const renderListView = () => {
        const listViewDiv = document.getElementById("listview-div-id");
        controls.removeAllChildren(listViewDiv);
        if (listView) {
            const dateoptions = {
                weekday: "long",
                day: "numeric",
            };
            const appointment = getAppointment();
            const option = appointment.options[currentOptionIdx];
            option.votes.forEach(v => {
                const p = controls.create(listViewDiv, "p");
                const checked = v.accepted.includes(myName);
                controls.createCheckbox(p, `day-checkbox-${v.day}`, undefined, undefined, checked, () => onDayCheckbox(v));
                const date = new Date(option.year, option.month - 1, v.day);
                const datestr = utils.format_date(date, dateoptions);
                controls.create(p, "span", undefined, `${datestr}: ${v.accepted.join(', ')}`);
            });
            dirty = false;
        }
    };

    const renderCalendarView = () => {
        const calendarDiv = document.getElementById("calendar-div-id");
        controls.removeAllChildren(calendarDiv);
        if (!listView) {
            const canvas = controls.create(calendarDiv, "canvas");
            canvas.id = "calendar-id";
            canvas.addEventListener("mousedown", onCanvasMouseDown);
            setCanvasSize(canvas);
            window.requestAnimationFrame(draw);
            dirty = true;
        }
    };

    const renderHeader = (parent) => {
        helpDiv = controls.createDiv(document.body);
        const h1 = controls.create(parent, "h1", undefined, `${currentUser.name} - Terminplaner`);
        const helpImg = controls.createImg(h1, "help-button", 24, 24, "/images/buttons/help.png", _T("BUTTON_HELP"));
        helpImg.addEventListener("click", () => onUpdateHelp(true));
        if (currentUser && currentUser.photo) {
            let imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo, _T("BUTTON_PROFILE"));
            imgPhoto.addEventListener("click", () => utils.set_window_location("/usermgmt"));
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Terminplaner ${version}. ${_T("TEXT_COPYRIGHT")} 2023 `);
        controls.createA(div, "copyright", "/view?page=copyright", _T("COPYRIGHT"));
        controls.create(div, "span", "copyright", ".");
    };

    const renderPageAsync = async (parent) => {
        if (!currentAppointmentId) {
            await renderEncryptKeyAsync(parent);
        }
        const contentDiv = controls.createDiv(parent, "content");
        contentDiv.id = "content-id";
        render();
        renderCopyright(parent);
    };

    const renderEncryptKeyAsync = async () => {
        const parent = document.body;
        utils.create_menu(parent);
        renderHeader(parent);
        const encryptKey = await utils.get_encryption_key_async(currentUser);
        const div = controls.createDiv(parent, "hide");
        div.id = "div-encryptkey-id";
        const encryptP = controls.create(div, "p");
        encryptP.id = "p-encryptkey-appointment-id";
        controls.create(encryptP, "p", "encryptkey-appointment", _T("INFO_ENCRYPTION_APPOINTMENT"));
        const keyP = controls.create(div, "p");
        const keyLabel = controls.createLabel(keyP, undefined, _T("LABEL_KEY"));
        keyLabel.htmlFor = "input-encryptkey-id";
        const inputKey = controls.createInputField(keyP, _T("TEXT_KEY"), () => onChangeEncryptKeyAsync(), undefined, 32, 32);
        inputKey.id = "input-encryptkey-id";
        inputKey.addEventListener("change", () => onChangeEncryptKeyAsync());
        if (encryptKey) {
            inputKey.value = encryptKey;
        }
        const saveP = controls.create(div, "p");
        const show = encryptKey == undefined;
        controls.createCheckbox(saveP, "checkbox-save-encryptkey-id", undefined, undefined, !show, () => onChangeEncryptKeyAsync());
        controls.create(saveP, "span", undefined, _T("OPTION_SAVE_KEY_IN_BROWSER"));
        utils.show_encrypt_key(currentUser, show);
        utils.set_menu_items(currentUser);
    };

    // callbacks

    const onChange = () => {
        if (!changed) {
            const saveButton = document.getElementById("save-button-id");
            controls.show(saveButton, true);
            changed = true;
        }
    };

    const onDateNext = () => {
        const appointment = getAppointment();
        if (currentOptionIdx >= 2) {
            return;
        }
        if (currentOptionIdx + 1 >= appointment.options.length) {
            const option = appointment.options[currentOptionIdx];
            let year = option.year;
            let month = option.month + 1;
            if (month > 12) {
                month = 1;
                year += 1;
            }
            appointment.options.push({ "year": year, "month": month, "votes": []});
        }
        currentOptionIdx += 1;
        const option = appointment.options[currentOptionIdx];
        const date = new Date(option.year, option.month - 1, 1);
        const datestr = utils.format_date(date, { year: "numeric", month: "long" });
        const span = document.getElementById("date-span-id");
        span.textContent = datestr;
        dirty = true;
        const prevButton = document.getElementById("prev-button-id");
        controls.show(prevButton, true);
        if (currentOptionIdx > 1) {
            const nextButton = document.getElementById("next-button-id");
            controls.hide(nextButton);
        }
    };

    const onDatePrevious = () => {
        const appointment = getAppointment();
        if (currentOptionIdx == 0) {
            return;
        }
        currentOptionIdx -= 1;
        const option = appointment.options[currentOptionIdx];
        const date = new Date(option.year, option.month - 1, 1);
        const datestr = utils.format_date(date, { year: "numeric", month: "long" });
        const span = document.getElementById("date-span-id");
        span.textContent = datestr;
        dirty = true;
        const nextButton = document.getElementById("next-button-id");
        controls.show(nextButton, true);
        if (currentOptionIdx == 0) {
            const prevButton = document.getElementById("prev-button-id");
            controls.hide(prevButton);
        }
    };

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

    const onNewAppointment = () => {
        const appointment = { "description": "Neuer Termin", "id": crypto.randomUUID(), "participants": [], "options": [] };
        const date = new Date();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        appointment.options.push({ "month": month, "year": year, "votes": [] });
        appointments.push(appointment);
        save();
        renderManageAppointments();
    };

    const onDeleteAppointment = () => {
        const appointment = getAppointment();
        appointments = appointments.filter(a => a.id != appointment.id);
        save();
        renderManageAppointments();
    };

    const onUpdateAppointment = () => {
        const appointment = getAppointment();
        const descriptionInput = document.getElementById("description-id");
        const participantsInput = document.getElementById("participants-id");
        appointment.description = descriptionInput.value;
        appointment.participants = [];
        const arr = participantsInput.value.replaceAll(",", " ").replaceAll(";", " ").split(" ");
        const nameSet = new Set();
        arr.forEach(elem => {
            const str = elem.trim();
            if (str.length > 0) {
                nameSet.add(str);
            }
        });
        nameSet.forEach(name => appointment.participants.push(name));
        appointment.participants.sort();
        cleanOptions(appointment);
        currentOptionIdx = 0;
        changed = false;
        save();
        renderManageAppointments();
    };

    const cleanOptions = (appointment) => {
        if (appointment.options.length > 1 && appointment.options[appointment.options.length - 1].votes.length == 0) {
            appointment.options.pop();
            cleanOptions(appointment);
        }        
    };

    const onEditAppointment = (appointment) => {
        currentAppointmentId = appointment.id;
        renderEditAppointment();
    };

    const onVoteAppointment = (appointment) => {
        window.open(`/makeadate?id=${appointment.id}`, "_blank");
    };

    const onChooseNameButton = (name) => {
        myName = name;
        save();
        render();
    };

    const onDayCheckbox = (v) => {
        let checkbox = document.getElementById(`day-checkbox-${v.day}`);
        if (checkbox) {
            if (checkbox.checked) {
                v.accepted.push(myName);
            }
            else {
                v.accepted = v.accepted.filter(name => name != myName);
            }
            save();
            renderListView();
        }
    };

    const onCalendarViewButton = () => {
        listView = false;
        render();
    };

    const onListViewButton = () => {
        listView = true;
        render();
    };

    const onBackButton = () => {
        currentOptionIdx -= 1;
        render();
    };

    const onContinueButton = () => {
        currentOptionIdx += 1;
        render();
    };

    const onLogoutButton = () => {
        logout();
        renderLogout();
    };

    const onResize = () => {
        const canvas = document.getElementById("calendar-id");
        if (canvas) {
            init();
            setCanvasSize(canvas);
            dirty = true;
        }
    };

    const onCanvasMouseDown = (evt) => {
        const appointment = getAppointment();
        const x = Math.floor(evt.offsetX / dayWidth);
        const y = Math.floor((evt.offsetY - headerHeight) / dayHeight);
        if (x >= 0 && x <= 7 && y >= 0 && y <= 6) {
            const option = appointment.options[currentOptionIdx];
            const day = dayMatrix[y][x];
            if (day) {
                const vote = option.votes.find(v => v.day == day);
                if (editAppointment) {
                    if (vote && vote.accepted.length == 0) {
                        option.votes = option.votes.filter(v => v.day != day);
                    }
                    else if (!vote) {
                        option.votes.push({ "day": day, "accepted": [] });
                    }
                    onChange();
                    dirty = true;
                }
                else if (vote) {
                    if (vote.accepted.includes(myName)) {
                        vote.accepted = vote.accepted.filter(name => name != myName);
                    }
                    else {
                        vote.accepted.push(myName);
                    }
                    vote.accepted.sort();
                    dirty = true;
                    save();
                }
            }
        }
    };

    const onChangeEncryptKeyAsync = async () => {
        const saveInBrowser = document.getElementById("checkbox-save-encryptkey-id").checked;
        const val = document.getElementById("input-encryptkey-id").value.trim();
        if (val.length === 0 || !saveInBrowser) {
            await utils.set_encryption_key_async(currentUser);
        }
        else {
            await utils.set_encryption_key_async(currentUser, val);
        }
        cryptoKey = undefined;
        render();
    };

    // encryption key hanndling

    const hasEncryptKey = () => {
        let elem = document.getElementById("input-encryptkey-id");
        return elem && elem.value.trim().length > 0;
    };

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

    const encodeText = (text, resolve, reject) => {
        initCryptoKey(() => utils.encode_message(cryptoKey, text, resolve, reject), reject);
    };

    const decodeText = (text, resolve, reject) => {
        initCryptoKey(() => utils.decode_message(cryptoKey, text, resolve, reject), reject);
    };

    // public API

    return {
        renderInit: renderInit,
        onResize: onResize,
    };
})();

// --- window loaded event

window.onload = () => {
    window.addEventListener("resize", makeadate.onResize);
    utils.auth_lltoken(() => utils.set_locale(() => makeadate.renderInit()));
};

window.onclick = (event) => utils.hide_menu(event);