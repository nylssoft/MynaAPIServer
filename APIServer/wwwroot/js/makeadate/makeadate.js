var makeadate = (() => {

    "use strict";

    let version = "0.9.2";
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
    let drawAppointment;
    
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
        if (!canvas || !drawAppointment || !dirty || !acceptImg || !acceptImg.complete || !editAppointment && !myName) {
            return;
        }
        dirty = false;
        const appointment = drawAppointment;
        const option = appointment.definition.options[currentOptionIdx];
        const date = new Date(option.year, option.month - 1);
        const firstDay = (date.getDay() + 6) % 7;
        const daysInMonth = 32 - new Date(option.year, option.month - 1, 32).getDate();
        const selectableDays = new Set();
        const myAcceptedDays = new Set();
        const acceptedCount = new Map();
        const bestVotes = getBestVotes(appointment);
        if (editAppointment) {
            option.days.forEach(d => selectableDays.add(d));
            appointment.votes.forEach(v => {
                const acceptedOption = v.accepted.find(o => o.year == option.year && o.month == option.month);
                if (acceptedOption) {
                    acceptedOption.days.forEach(d => {
                        let cnt = acceptedCount.get(d);
                        if (!cnt) {
                            cnt = 0;
                        }
                        cnt += 1;
                        acceptedCount.set(d, cnt);
                    });
                }
            });
        }
        else {
            const myUserUuid = getUserUuid(appointment, myName);
            option.days.forEach(d => selectableDays.add(d));
            appointment.votes.forEach(v => {
                const acceptedOption = v.accepted.find(o => o.year == option.year && o.month == option.month);
                if (acceptedOption) {
                    if (v.userUuid == myUserUuid) {
                        acceptedOption.days.forEach(d => myAcceptedDays.add(d));
                    }
                    acceptedOption.days.forEach(d => {
                        let cnt = acceptedCount.get(d);
                        if (!cnt) {
                            cnt = 0;
                        }
                        cnt += 1;
                        acceptedCount.set(d, cnt);
                    });
                }
            });
        }
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = dayNameColor;
        ctx.font = utils.is_mobile() ? fontSmall : fontLarge;
        let xstart = 0;
        let ystart = 30;
        let days = [_T("COLUMN_MON"), _T("COLUMN_TUE"), _T("COLUMN_WED"), _T("COLUMN_THU"), _T("COLUMN_FRI"), _T("COLUMN_SAT"), _T("COLUMN_SON")];
        for (let idx = 0; idx < 7; idx++) {
            ctx.fillText(days[idx], xstart + idx * dayWidth + dayWidth / 4, headerHeight);
        }   
        let day = 1;
        for (let y = 0; y < 6; y++) {
            for (let x = 0; x < 7; x++) {
                if ((y != 0 || x >= firstDay) && day <= daysInMonth) {
                    const dc = day;
                    const isBestVote = bestVotes.some(v => v.year == option.year && v.month == option.month && v.day == dc);
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
                        ctx.fillStyle = acceptedDayColor;
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
                        ctx.fillStyle = acceptedDayColor;
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

    // storage and initialization

    const KEY_MYNAME = "makeadate-myname";

    const logout = () => {
        myName = undefined;
        utils.remove_local_storage(KEY_MYNAME);
    };
   
    const init = (appointment) => {
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
        if (appointment && myName) {
            const participantNames = appointment.definition.participants.map(p => p.username);
            if (!participantNames.includes(myName)) {
                myName = undefined;
            }
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

    const handleError = (errMsg) => {
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        renderError(parent, errMsg);
    };

    const getUserUuid = (appointment, name) => {
        const participant = appointment.definition.participants.find(p => p.username == name);
        if (participant) {
            return participant.userUuid;
        }
        return undefined;
    };

    const getUsername = (appointment, userUuid) => {
        const participant = appointment.definition.participants.find(p => p.userUuid == userUuid);
        if (participant) {
            return participant.username;
        }
        return undefined;
    };

    const getVote = (appointment, userUuid) => appointment.votes.find(v => v.userUuid == userUuid);

    const getVoteOption = (year, month, vote) => vote.accepted.find(opt => opt.year == year && opt.month == month);

    const getCurrentOption = (appointment) => appointment.definition.options[currentOptionIdx];

    const getBestVotes = (appointment) => {
        let bestVotes = [];
        let bestCount = 0;
        appointment.definition.options.forEach(option => {
            const acceptedCount = new Map();
            appointment.votes.forEach(v => {
                const acceptedOption = v.accepted.find(o => o.year == option.year && o.month == option.month);
                if (acceptedOption) {
                    acceptedOption.days.forEach(d => {
                        let cnt = acceptedCount.get(d);
                        if (!cnt) {
                            cnt = 0;
                        }
                        cnt += 1;
                        acceptedCount.set(d, cnt);
                        if (cnt >= bestCount) {
                            if (cnt > bestCount) {
                                bestVotes = [];
                            }
                            bestVotes.push({ "year": option.year, "month": option.month, "day": d });
                            bestCount = cnt;
                        }
                    });
                }
            });
        });
        if (utils.is_debug()) {
            utils.debug("Best votes:");
            utils.debug(bestVotes);
        }
        return bestVotes;
    };

    const isEditAppointmentAllowed = (appointment) => {
        return !appointment.votes.some(v => v.accepted.some(opt => opt.days.length > 0));
    };

    // async service calls

    const fetchCurrentUserAsync = (parent, token) => {
        if (utils.is_debug()) utils.debug("Fetch current user...");
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            (user) => {
                if (utils.is_debug()) {
                    utils.debug("Current user:");
                    utils.debug(user);
                }
                currentUser = user;
                renderPageAsync(parent, true);
            },
            handleError
        );
    };

    const createAppointmentAsync = (token, resolve, reject) => {
        const uuid = crypto.randomUUID();
        const date = new Date();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const definition = {
            "Description": _T("TEXT_NEW_APPOINTMENT"),
            "Participants": [],
            "Options": [{ "Year": year, "Month": month, "Days": [] }]
        };
        getRandomKeyAsync(token, (securityKey) => {
            if (utils.is_debug()) utils.debug(`Security key generated: ${securityKey}.`);
            encodeTextAsync(
                securityKey,
                (ownerKey) => {
                    if (utils.is_debug()) utils.debug(`Encoded security key (owner key): ${ownerKey}.`);
                    const appointment = { "OwnerKey": ownerKey, "Definition": definition };
                    const headers = { "Accept": "application/json", "Content-Type": "application/json", "token": token, "securitykey": securityKey };
                    if (utils.is_debug()) utils.debug("Create new appointment...");
                    utils.fetch_api_call(
                        `api/appointment/${uuid}`,
                        { method: "POST", headers: headers, body: JSON.stringify(appointment) },
                        resolve,
                        reject);
                },
                reject);
        },
            reject);
    };

    const updateAppointmentAsync = (token, appointment, resolve, reject) => {
        const headers = { "Accept": "application/json", "Content-Type": "application/json", "token": token, "securitykey": appointment.securityKey };
        if (utils.is_debug()) utils.debug("Update appointment...");
        const definition = {
            "Description": appointment.definition.description,
            "Participants": [],
            "Options": []
        };
        appointment.definition.participants.forEach(p => {
            definition.Participants.push({ "Username": p.username, "UserUuid": p.userUuid });
        });
        appointment.definition.options.forEach(o => {
            definition.Options.push({ "Year": o.year, "Month": o.month, "Days": o.days });
        });
        utils.fetch_api_call(
            `api/appointment/${appointment.uuid}`,
            { method: "PUT", headers: headers, body: JSON.stringify(definition) },
            resolve,
            reject);
    };

    const getAppointmentDetailsAsync = (resolve, reject) => {
        const token = utils.get_authentication_token();
        getAppointmentsAsync(
            token,
            (uuidKeys) => {
                if (uuidKeys.length == 0) {
                    resolve([]);
                    return;
                }
                const batch = [];
                uuidKeys.forEach(uuidKey => {
                    batch.push({ "Method": "GET", "Uuid": uuidKey.uuid, "SecurityKey": uuidKey.securityKey });
                });
                batchGetAppointmentsAsync(token, batch, uuidKeys, resolve, reject);
            },
            reject);
    };

    const batchGetAppointmentsAsync = (token, batch, uuidKeys, resolve, reject) => {
        const headers = { "Accept": "application/json", "Content-Type": "application/json", "token": token};
        if (utils.is_debug()) utils.debug("Batch fetch appointment details...");
        utils.fetch_api_call(
            `api/appointment/batch`,
            { method: "POST", headers: headers, body: JSON.stringify(batch) },
            (appointments) => {
                appointments.forEach(appointment => {
                    const uuidKey = uuidKeys.find(uuidKey => uuidKey.uuid == appointment.uuid);
                    appointment.securityKey = uuidKey.securityKey;
                });
                resolve(appointments);
            },
            reject);

    };

    const getAppointmentsAsync = (token, resolve, reject) => {
        if (utils.is_debug()) utils.debug("Fetch appointments...");
        utils.fetch_api_call(
            "api/appointment",
            { headers: { "token": token } },
            appointments => {
                const uuidKeys = [];
                appointments.forEach(appointment => {
                    uuidKeys.push({ "uuid": appointment.uuid, "ownerKey": appointment.ownerKey });
                });
                const arr = [...uuidKeys];
                decodeOwnerKeyAsync(uuidKeys, arr, resolve, reject);
            },
            reject);
    };

    const decodeOwnerKeyAsync = (uuidKeys, rest, resolve, reject) => {
        if (rest.length > 0) {
            const app = rest.pop();
            decodeTextAsync(
                app.ownerKey,
                (securityKey) => {
                    app.securityKey = securityKey;
                    decodeOwnerKeyAsync(uuidKeys, rest, resolve, reject);
                },
                reject);
            return;
        }
        resolve(uuidKeys);
    };

    const deleteAppointmentAsync = (token, uuid, resolve, reject) => {
        if (utils.is_debug()) utils.debug("Delete appointment...");
        const headers = { "Accept": "application/json", "Content-Type": "application/json", "token": token };
        utils.fetch_api_call(
            `api/appointment/${uuid}`,
            { method: "DELETE", headers: headers },
            resolve,
            reject);
    };

    const getRandomKeyAsync = (token, resolve, reject) => {
        if (utils.is_debug()) utils.debug("Fetch random key...");
        utils.fetch_api_call(
            "api/appointment/randomkey",
            { headers: { "token": token } },
            resolve,
            reject);
    };

    const getAppointmentAsync = (uuid, securityKey, resolve, reject) => {
        if (utils.is_debug()) utils.debug("Fetch appointment...");
        utils.fetch_api_call(
            `api/appointment/${uuid}`,
            { headers: { "securitykey": securityKey } },
            resolve,
            reject);
    };

    const updateVoteAsync = (appointment, v, resolve, reject) => {
        const headers = { "Accept": "application/json", "Content-Type": "application/json", "securitykey": appointment.securityKey };
        if (utils.is_debug()) utils.debug("Update vote...");
        const vote = { "UserUUid": v.userUuid, "Accepted": [] };
        v.accepted.forEach(opt => {
            vote.Accepted.push({ "Year": opt.year, "Month": opt.month, "Days": opt.days });
        });
        utils.fetch_api_call(
            `api/appointment/${appointment.uuid}/vote`,
            { method: "PUT", headers: headers, body: JSON.stringify(vote) },
            resolve,
            reject);
    };

    // rendering

    const renderInit = () => {
        const parent = document.body;
        controls.removeAllChildren(parent);
        const params = new URLSearchParams(window.location.search);
        if (params.has("debug")) {
            utils.enable_debug(true);
            utils.debug("DEBUG enabled.");
        }
        if (!params.has("id")) {
            const token = utils.get_authentication_token();
            if (!token) {
                const nexturl = "/makeadate";
                utils.set_window_location("/pwdman?nexturl=" + encodeURI(nexturl));
                return;
            }
            if (!currentUser) {
                fetchCurrentUserAsync(parent, token);
                return;
            }
        }
        renderPageAsync(parent, !params.has("id"));
        return;
    };

    const renderError = (parent, errMsg) => {
        controls.createDiv(parent, "error").textContent = _T(errMsg);
    };

    const render = () => {
        const params = new URLSearchParams(window.location.search);
        const idparam = params.get("id");
        if (!idparam) {
            renderManageAppointments();
            return;
        }
        const idstr = atob(idparam);
        const arr = idstr.split("#");
        if (arr.length == 2) {
            const uuid = arr[0];
            const securityKey = arr[1];
            getAppointmentAsync(
                uuid,
                securityKey,
                (appointment) => {
                    appointment.securityKey = securityKey;
                    init(appointment);
                    const parent = document.getElementById("content-id");
                    if (appointment.definition.participants.length == 0) {
                        controls.create(parent, "p", undefined, _T("INFO_APPOINTMENT_NO_PARTICIPANTS_1", appointment.definition.description));
                        return;
                    }
                    if (!appointment.definition.options.some(opt => opt.days.length > 0)) {
                        controls.create(parent, "p", undefined, _T("INFO_APPOINTMENT_NO_OPTIONS_1", appointment.definition.description));
                        return;
                    }
                    if (!currentOptionIdx || currentOptionIdx >= appointment.definition.options.length) {
                        currentOptionIdx = 0;
                    }
                    if (!myName) {
                        renderSelectName(appointment);
                        return;
                    }
                    renderVoteAppointment(appointment);
                },
                handleError
            );
        }
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
        controls.createButton(parent, _T("BUTTON_NEW_APPOINTMENT"), () => onNewAppointment());
        controls.create(parent, "p", undefined, _T("LABEL_APPOINTMENTS"));
        const li = controls.create(parent, "ul");
        getAppointmentDetailsAsync(
            (all) => {
                all.sort((a, b) => a.definition.description.localeCompare(b.definition.description));
                all.forEach(a => {
                    const ul = controls.create(li, "li");
                    controls.create(ul, "p", undefined, `${a.definition.description}\u00a0\u00a0\u00a0`);
                    controls.createButton(ul, _T("BUTTON_EDIT"), () => onEditAppointment(a.uuid));
                    controls.createButton(ul, _T("BUTTON_VOTE"), () => onVoteAppointment(a));
                });
            },
            handleError);
    };

    const renderEditAppointment = (appointment) => {
        const canChange = isEditAppointmentAllowed(appointment);
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        controls.createDiv(parent, "gap");
        editAppointment = true;
        currentOptionIdx = 0;
        const option = appointment.definition.options[currentOptionIdx];
        // edit description
        const descriptionP = controls.create(parent, "p");
        const descriptionLabel = controls.createLabel(descriptionP, undefined, _T("LABEL_DESCRIPTION"));
        descriptionLabel.htmlFor = "description-id";
        const descriptionInput = controls.createInputField(descriptionP, _T("TEXT_DESCRIPTION"), undefined, undefined, 50, 255);
        descriptionInput.id = "description-id";
        descriptionInput.value = appointment.definition.description;
        descriptionInput.addEventListener("input", onChange);
        if (!canChange) {
            descriptionInput.setAttribute("readonly", "readonly");
        }
        // edit participants
        const participantsP = controls.create(parent, "p");
        const participantsLabel = controls.createLabel(participantsP, undefined, _T("LABEL_PARTICIPANTS"));
        participantsLabel.htmlFor = "participants-id";
        const participantsInput = controls.createInputField(participantsP, _T("TEXT_PARTICIPANTS"), undefined, undefined, 50, 255);
        participantsInput.id = "participants-id";
        const participantNames = appointment.definition.participants.map(p => p.username);
        participantsInput.value = participantNames.join(", ");
        if (!canChange) {
            participantsInput.setAttribute("readonly", "readonly");
        }
        participantsInput.addEventListener("input", onChange);
        // show URL
        const urlP = controls.create(parent, "p");
        const urlLabel = controls.createLabel(urlP, undefined, _T("LABEL_URL"));
        urlLabel.htmlFor = "url-id";
        const urlInput = controls.createInputField(urlP, _T("TEXT_URL"), undefined, undefined, 50, 255);
        urlInput.id = "url-id";
        urlInput.value = buildAppointmentUrl(appointment);
        urlInput.setAttribute("readonly", "readonly");
        controls.createImageButton(urlLabel, _T("BUTTON_COPY_TO_CLIPBOARD_1", _T("TEXT_URL")),
            () => navigator.clipboard.writeText(urlInput.value), "/images/buttons/edit-copy-6.png", 16, "transparent");
        // edit options
        const date = new Date(option.year, option.month - 1, 1);
        const datestr = utils.format_date(date, { year: "numeric", month: "long" });
        const optionsP = controls.create(parent, "p", undefined, _T("INFO_APPOINTMENT_OPTIONS"));
        const prevButton = controls.createButton(optionsP, "<", () => onDatePrevious(appointment));
        prevButton.id = "prev-button-id";
        controls.hide(prevButton);
        const dateSpan = controls.create(optionsP, "span", "date", datestr);
        dateSpan.id = "date-span-id";
        const nextButton = controls.createButton(optionsP, ">", () => onDateNext(appointment));
        nextButton.id = "next-button-id";
        const calendarDiv = controls.createDiv(optionsP);
        calendarDiv.id = "calendar-div-id";
        renderCalendarView(appointment);
        // action buttons
        const saveButton = controls.createButton(parent, _T("BUTTON_SAVE"), () => onUpdateAppointment(appointment));
        saveButton.id = "save-button-id";
        if (!changed) {
            controls.hide(saveButton);
        }
        controls.createButton(parent, _T("BUTTON_DELETE"), () => renderDeleteApppointment(appointment));
        controls.createButton(parent, _T("BUTTON_BACK"), () => renderCancelEditApppointment(appointment));
    };

    const renderDeleteApppointment = (appointment) => {
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        controls.createDiv(parent, "gap");
        const pConfirm = controls.create(parent, "p");
        controls.create(pConfirm, "span", "confirmation", _T("INFO_REALLY_DELETE_APPOINTMENT_1", appointment.definition.description));
        controls.createButton(pConfirm, _T("BUTTON_YES"), () => onDeleteAppointment(appointment));
        controls.createButton(pConfirm, _T("BUTTON_NO"), () => renderEditAppointment(appointment));
    };

    const renderCancelEditApppointment = (appointment) => {
        if (changed) {
            const parent = document.getElementById("content-id");
            controls.removeAllChildren(parent);
            controls.createDiv(parent, "gap");
            const pConfirm = controls.create(parent, "p");
            controls.create(pConfirm, "span", "confirmation", _T("INFO_REALLY_CANCEL_EDIT_APPOINTMENT_1", appointment.definition.description));
            controls.createButton(pConfirm, _T("BUTTON_YES"), () => renderManageAppointments());
            controls.createButton(pConfirm, _T("BUTTON_NO"), () => renderEditAppointment(appointment));
            return;
        }
        renderManageAppointments();
    };

    const renderLogout = () => {
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        controls.create(parent, "h2", undefined, _T("HEADER_MAKEADATE"));
        controls.create(parent, "p", undefined, _T("INFO_THANK_YOU"));
        controls.create(parent, "p", undefined, _T("INFO_LOGGED_OUT"));
    };

    const renderSelectName = (appointment) => {
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        controls.create(parent, "h2", undefined, _T("HEADER_MAKEADATE"));
        controls.create(parent, "p", undefined, _T("INFO_FIND_APPOINTMENT_1", appointment.definition.description));
        controls.create(parent, "p", undefined, _T("INFO_QUESTION_YOUR_NAME"));
        appointment.definition.participants.forEach(p => {
            const para = controls.create(parent, "p");
            controls.createButton(para, p.username, () => onChooseNameButton(p.username));
        });
    };

    const renderVoteAppointment = (appointment) => {
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        controls.create(parent, "h2", undefined, _T("INFO_HELLO_1", myName));
        controls.create(parent, "p", undefined, _T("INFO_QUESTION_TIME_FOR_1", appointment.definition.description));
        const option = appointment.definition.options[currentOptionIdx];
        const date = new Date(option.year, option.month - 1, 1);
        const datestr = utils.format_date(date, { year: "numeric", month: "long" });
        const optionsP = controls.create(parent, "p");
        const prevButton = controls.createButton(optionsP, "<", () => onBackButton(appointment));
        prevButton.id = "prev-button-id";
        if (currentOptionIdx == 0) {
            controls.hide(prevButton);
        }
        const dateSpan = controls.create(optionsP, "span", "date", datestr);
        dateSpan.id = "date-span-id";
        const nextButton = controls.createButton(optionsP, ">", () => onContinueButton(appointment));
        nextButton.id = "next-button-id";
        if (currentOptionIdx == appointment.definition.options.length - 1) {
            controls.hide(nextButton);
        }
        const calendarDiv = controls.createDiv(parent);
        calendarDiv.id = "calendar-div-id";
        const listViewDiv = controls.createDiv(parent);
        listViewDiv.id = "listview-div-id";
        renderListView(appointment);
        renderCalendarView(appointment);
        const divFooter = controls.create(parent, "p");
        if (listView) {
            controls.createButton(divFooter, _T("BUTTON_VIEW_CALENDAR"), () => onCalendarViewButton());
        }
        else {
            controls.createButton(divFooter, _T("BUTTON_VIEW_LIST"), () => onListViewButton());
        }
        controls.createButton(divFooter, _T("BUTTON_LOGOUT"), () => onLogoutButton());
    };

    const renderListView = (appointment) => {
        const listViewDiv = document.getElementById("listview-div-id");
        controls.removeAllChildren(listViewDiv);
        if (listView) {
            const dateoptions = {
                weekday: "long",
                day: "numeric",
            };
            const option = getCurrentOption(appointment);
            option.days.forEach(d => {
                const acceptedUsernames = [];
                appointment.votes.forEach(vote => {
                    const opt = getVoteOption(option.year, option.month, vote);
                    if (opt && opt.days.includes(d)) {
                        acceptedUsernames.push(getUsername(appointment, vote.userUuid));
                    }
                });
                const p = controls.create(listViewDiv, "p");
                const checked = acceptedUsernames.includes(myName);
                controls.createCheckbox(p, `day-checkbox-${d}`, undefined, undefined, checked, () => onDayCheckbox(appointment, d));
                const date = new Date(option.year, option.month - 1, d);
                const datestr = utils.format_date(date, dateoptions);
                let names = acceptedUsernames.join(', ');
                if (names.length == 0) {
                    names = " - ";
                }
                controls.create(p, "span", undefined, `${datestr}: ${names}`);
            });
            dirty = false;
        }
    };

    const renderCalendarView = (appointment) => {
        const calendarDiv = document.getElementById("calendar-div-id");
        controls.removeAllChildren(calendarDiv);
        if (!listView) {
            drawAppointment = appointment;
            const canvas = controls.create(calendarDiv, "canvas");
            canvas.id = "calendar-id";
            canvas.addEventListener("mousedown", (evt) => onCanvasMouseDown(evt, appointment));
            setCanvasSize(canvas);
            window.requestAnimationFrame(draw);
            dirty = true;
        }
    };

    const renderHeader = (parent) => {
        helpDiv = controls.createDiv(document.body);
        const h1 = controls.create(parent, "h1", undefined, `${currentUser.name} - ${_T("HEADER_MAKEADATE")}`);
        const helpImg = controls.createImg(h1, "help-button", 24, 24, "/images/buttons/help.png", _T("BUTTON_HELP"));
        helpImg.addEventListener("click", () => onUpdateHelp(true));
        if (currentUser && currentUser.photo) {
            let imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo, _T("BUTTON_PROFILE"));
            imgPhoto.addEventListener("click", () => utils.set_window_location("/usermgmt"));
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `${_T("HEADER_MAKEADATE")} ${version}. ${_T("TEXT_COPYRIGHT_YEAR")} `);
        controls.createA(div, "copyright", "/view?page=copyright", _T("COPYRIGHT"));
        controls.create(div, "span", "copyright", ".");
        controls.createDiv(parent, "gap");
    };

    const renderPageAsync = async (parent, manage) => {
        if (manage) {
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

    const onDateNext = (appointment) => {
        if (currentOptionIdx >= 2) {
            return;
        }
        if (currentOptionIdx + 1 >= appointment.definition.options.length) {
            const option = appointment.definition.options[currentOptionIdx];
            let year = option.year;
            let month = option.month + 1;
            if (month > 12) {
                month = 1;
                year += 1;
            }
            appointment.definition.options.push({ "year": year, "month": month, "days": []});
        }
        currentOptionIdx += 1;
        const option = appointment.definition.options[currentOptionIdx];
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

    const onDatePrevious = (appointment) => {
        if (currentOptionIdx == 0) {
            return;
        }
        currentOptionIdx -= 1;
        const option = appointment.definition.options[currentOptionIdx];
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
        const token = utils.get_authentication_token();
        createAppointmentAsync(
            token,
            (modifiedUtc) => {
                if (utils.is_debug()) utils.debug(`New appointment created. Last modified: ${modifiedUtc}.`);
                renderManageAppointments();
            },
            handleError);
    };

    const onDeleteAppointment = (appointment) => {
        const token = utils.get_authentication_token();
        deleteAppointmentAsync(
            token,
            appointment.uuid,
            (deleted) => {
                if (utils.is_debug()) utils.debug(`Appointment deleted: ${deleted}.`);
                renderManageAppointments();
            },
            handleError);
    };

    const onUpdateAppointment = (appointment) => {
        const descriptionInput = document.getElementById("description-id");
        const participantsInput = document.getElementById("participants-id");
        appointment.definition.description = descriptionInput.value;
        appointment.definition.participants = [];
        const arr = participantsInput.value.replaceAll(",", " ").replaceAll(";", " ").split(" ");
        const nameSet = new Set();
        arr.forEach(elem => {
            const str = elem.trim();
            if (str.length > 0) {
                nameSet.add(str);
            }
        });
        nameSet.forEach(name => appointment.definition.participants.push(
            {
                "username": name,
                "userUuid": crypto.randomUUID()
            }));
        appointment.definition.participants.sort((p1, p2) => p1.username.localeCompare(p2.username));
        cleanOptions(appointment);
        const token = utils.get_authentication_token();
        updateAppointmentAsync(
            token,
            appointment,
            (modifiedUtc) => {
                if (utils.is_debug()) utils.debug(`Appointment updated. Last modfified: ${modifiedUtc}.`);
                currentOptionIdx = 0;
                changed = false;
                renderManageAppointments();
            },
            handleError);
    };

    const cleanOptions = (appointment) => {
        if (appointment.definition.options.length > 1 && appointment.definition.options[appointment.definition.options.length - 1].days.length == 0) {
            appointment.definition.options.pop();
            cleanOptions(appointment);
        }        
    };

    const onEditAppointment = (uuid) => {
        getAppointmentDetailsAsync(
            (all) => {
                const appointment = all.find(a => a.uuid == uuid);
                if (appointment) {
                    drawAppointment = appointment;
                    renderEditAppointment(appointment);                    
                }
            },
            handleError);
    };

    const onVoteAppointment = (appointment) => {        
        window.open(`/makeadate?id=${buildAppointmentIdRequestParam(appointment)}`, "_blank");
    };

    const onChooseNameButton = (name) => {
        myName = name;
        utils.set_local_storage(KEY_MYNAME, myName);
        render();
    };

    const onDayCheckbox = (appointment, day) => {
        let checkbox = document.getElementById(`day-checkbox-${day}`);
        if (!checkbox) return;
        const option = getCurrentOption(appointment);
        const myVote = getVote(appointment, getUserUuid(appointment, myName));
        let voteOption = getVoteOption(option.year, option.month, myVote);
        if (!voteOption) {
            voteOption = { "year": option.year, "month": option.month, "days": [] };
            myVote.accepted.push(voteOption);
            myVote.accepted.sort((a, b) => (a.year - b.year) * 1000 + (a.month - b.month));
        }
        if (checkbox.checked) {
            voteOption.days.push(day);
        }
        else {
            voteOption.days = voteOption.days.filter(d => d != day);
        }
        voteOption.days.sort((a, b) => a - b);
        cleanOptions(appointment);
        updateVoteAsync(
            appointment,
            myVote,
            (modifiedUtc) => {
                if (utils.is_debug()) utils.debug(`Vote updated. Last modified: ${modifiedUtc}.`);
                renderListView(appointment);
            },
            handleError
        );
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

    const onCanvasMouseDown = (evt, appointment) => {
        const x = Math.floor(evt.offsetX / dayWidth);
        const y = Math.floor((evt.offsetY - headerHeight) / dayHeight);
        if (editAppointment && !isEditAppointmentAllowed(appointment)) {
            return;
        }
        if (x >= 0 && x < 7 && y >= 0 && y < 6) {
            const option = appointment.definition.options[currentOptionIdx];
            const day = dayMatrix[y][x];
            if (option && day) {
                if (editAppointment) {
                    if (option.days.includes(day)) {
                        option.days = option.days.filter(d => d != day);
                    }
                    else {
                        option.days.push(day);
                    }
                    option.days.sort((a, b) => a - b);
                    onChange();
                    dirty = true;
                }
                else if (option.days.includes(day)) {
                    const myUserUuid = getUserUuid(appointment, myName);
                    const vote = appointment.votes.find(v => v.userUuid == myUserUuid);
                    if (vote && myUserUuid) {
                        let acceptedOption = vote.accepted.find(o => o.year == option.year && o.month == option.month);
                        if (!acceptedOption) {
                            acceptedOption = { "year": option.year, "month": option.month, "days": [] };
                            vote.accepted.push(acceptedOption);
                            vote.accepted.sort((a, b) => (a.year - b.year) * 1000 + (a.month - b.month));
                        }
                        if (acceptedOption.days.includes(day)) {
                            acceptedOption.days = acceptedOption.days.filter(d => d != day);
                        }
                        else {
                            acceptedOption.days.push(day);
                        }
                        updateVoteAsync(
                            appointment,
                            vote,
                            (modifiedUtc) => {
                                if (utils.is_debug()) utils.debug(`Vote updated. Last modified: ${modifiedUtc}.`);
                                dirty = true;
                            },
                            handleError
                        );
                    }
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

    const encodeTextAsync = (text, resolve, reject) => {
        initCryptoKey(() => utils.encode_message(cryptoKey, text, resolve, reject), reject);
    };

    const decodeTextAsync = (text, resolve, reject) => {
        initCryptoKey(() => utils.decode_message(cryptoKey, text, resolve, reject), reject);
    };

    const buildAppointmentIdRequestParam = (appointment) => {
        const idparam = btoa(`${appointment.uuid}#${appointment.securityKey}`);
        return encodeURI(idparam);
    };

    const buildAppointmentUrl = (appointment) => {
        const requestId = buildAppointmentIdRequestParam(appointment);
        const port = location.port == "443" ? "" : `:${location.port}`;
        return `${location.protocol}//${location.hostname}${port}/makeadate?id=${requestId}`;
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