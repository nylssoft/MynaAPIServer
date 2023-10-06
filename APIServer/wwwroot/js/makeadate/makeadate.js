var makeadate = (() => {

    "use strict";

    let version = "0.0.1";

    let acceptImg;
    let headerHeight = 20;
    let dayWidth;
    let dayHeight;
    let xmin;
    let ymin;
    let dirty;
    let dayMatrix;
    let myName;
    let data;
    let currentOptionIdx;
    let listView = false;

    let sampledata = {
        "description": "Doppelkopf bei Barbara um 19 Uhr",
        "participants": ["Niels", "Detlef", "Barbara", "Andreas", "Stefan"],
        "options": [
            {
                "year": 2023,
                "month": 10,
                "votes": [
                    { "day": 5, "accepted": ["Barbara"] },
                    { "day": 7, "accepted": [] },
                    { "day": 15, "accepted": ["Detlef", "Stefan"] },
                    { "day": 22, "accepted": ["Niels", "Stefan"] },
                    { "day": 30, "accepted": [] },
                ]
            },
            {
                "year": 2023,
                "month": 11,
                "votes": [
                    { "day": 11, "accepted": [] },
                    { "day": 12, "accepted": [] },
                    { "day": 13, "accepted": [] },
                    { "day": 18, "accepted": [] },
                    { "day": 19, "accepted": [] },
                ]
            },
            {
                "year": 2023,
                "month": 12,
                "votes": [
                    { "day": 1, "accepted": [] },
                    { "day": 2, "accepted": [] },
                    { "day": 7, "accepted": [] },
                    { "day": 8, "accepted": [] },
                    { "day": 9, "accepted": [] },
                ]
            },
        ]
    };

/*
    let rowColorEven = "#6495ED";
    let rowColorOdd = "#1E90FF";
    let dayNameColor = "white";
    let selectableDayColor = "white";
    let disabledDayColor = "gray";
*/
    let rowColorEven = "#FFFFFF";
    let rowColorOdd = "#EEEEEE";
    let dayNameColor = "#FFFFFF";
    let selectableDayColor = "#000000";
    let disabledDayColor = "#DDDDDD";
    let acceptedColor = "#00A400";
    let fontLarge = "24px serif";
    let fontSmall = "18px serif";

    const draw = () => {
        if (listView) {
            return;
        }
        const canvas = document.getElementById("calendar-id");
        window.requestAnimationFrame(draw);
        if (!canvas || !dirty || !acceptImg || !acceptImg.complete || !myName) {
            return;
        }
        dirty = false;

        const option = data.options[currentOptionIdx];
        let date = new Date(option.year, option.month - 1);
        let firstDay = (date.getDay() + 6) % 7;
        let daysInMonth = 32 - new Date(option.year, option.month - 1, 32).getDate();

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


        ctx.font = dayWidth < 100 ? fontSmall : fontLarge;
        let xstart = 0;
        let ystart = 30;
        let days = ["Mon", "Die", "Mit", "Don", "Fre", "Sam", "Son"];
        for (let idx = 0; idx < 7; idx++) {
            ctx.fillText(days[idx], xstart + idx * dayWidth + dayWidth / 4, headerHeight);
        }   
        let day = 1;

        for (let y = 0; y < 6; y++) {
            for (let x = 0; x < 7; x++) {
                ctx.fillStyle = y % 2 == 0 ? rowColorEven : rowColorOdd;
                ctx.fillRect(xstart + x * dayWidth, ystart + y * dayHeight, dayWidth - 2, dayHeight - 2);
                if ((y != 0 || x >= firstDay) && day <= daysInMonth) {
                    dayMatrix[y][x] = day;
                    if (myAcceptedDays.has(day)) {
                        ctx.drawImage(acceptImg, xstart + x * dayWidth, ystart + y * dayHeight, dayWidth, dayHeight);
                        ctx.fillStyle = selectableDayColor;
                    }
                    else {
                        ctx.fillStyle = selectableDays.has(day) ? selectableDayColor : disabledDayColor;
                    }
                    ctx.fillText(`${day}`, xstart + x * dayWidth + dayWidth / 3, ystart + y * dayHeight + dayHeight / 2);
                    if (acceptedCount.has(day)) {
                        ctx.fillText(`+${acceptedCount.get(day)}`, xstart + x * dayWidth + 5, ystart + y * dayHeight + dayHeight - 8);
                    }
                    day++;
                }
                else {
                    dayMatrix[y][x] = undefined;
                }
            }
        }
    };

    // storage and initialization

    const KEY_MYNAME = "makeadate-myname";
    const KEY_DATA = "makeadate-data";

    const save = () => {
        utils.set_session_storage(KEY_MYNAME, myName);
        utils.set_local_storage(KEY_MYNAME, myName);
        utils.set_session_storage(KEY_DATA, JSON.stringify(data));
        utils.set_local_storage(KEY_DATA, JSON.stringify(data));
    };

    const logout = () => {
        myName = undefined;
        utils.remove_session_storage(KEY_MYNAME);
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
        myName = utils.get_session_storage(KEY_MYNAME);
        if (!myName) {
            myName = utils.get_local_storage(KEY_MYNAME);
        }
        let json = utils.get_session_storage(KEY_DATA);
        if (!json) {
            json = utils.get_local_storage(KEY_DATA);
        }
        if (json) {
            data = JSON.parse(json);
        }
        if (!data) {
            data = sampledata;
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

    // rendering

    const render = () => {
        init();
        const parent = document.body;
        controls.removeAllChildren(parent);
        if (!myName) {
            renderSelectName(parent);
            return;
        }
        if (!currentOptionIdx) {
            currentOptionIdx = 0;
        }
        if (data.options.length == 0) {
            controls.create(parent, "p", undefined, "Keine Termine!");
            return;
        }
        controls.create(parent, "p", undefined, `Hallo ${myName}!`);
        controls.create(parent, "p", undefined, `Wann hast du Zeit f\u00FCr ${data.description}?`);
        const p = controls.create(parent, "p");
        if (data.options.length == 0) {
            controls.create(parent, "p", undefined, "Keine Termine!");
        }
        else {
            if (currentOptionIdx > 0) {
                controls.createButton(p, _T("BUTTON_BACK"), onBackButton);
            }
            if (currentOptionIdx < data.options.length - 1) {
                controls.createButton(p, _T("BUTTON_CONTINUE"), onContinueButton);
            }
            if (listView) {
                controls.createButton(p, "Kalendar", onCalendarViewButton);
            }
            else {
                controls.createButton(p, "Liste", onListViewButton);
            }
        }
        const option = data.options[currentOptionIdx];
        const date = new Date(option.year, option.month - 1, 1);
        const datestr = utils.format_date(date, { year: "numeric", month: "long" });
        controls.create(parent, "h2", undefined, datestr);
        const calendarDiv = controls.createDiv(parent);
        calendarDiv.id = "calendar-div-id";
        const listViewDiv = controls.createDiv(parent);
        listViewDiv.id = "listview-div-id";
        renderListView();
        renderCalendarView();
        const divLogout = controls.create(parent, "p");
        controls.createButton(divLogout, _T("BUTTON_LOGOUT"), onLogoutButton);
    };

    const renderSelectName = (parent) => {
        controls.create(parent, "h1", undefined, "Make a date!");
        controls.create(parent, "h2", undefined, data.description);
        controls.create(parent, "p", undefined, "Wie lautet dein Name?");
        data.participants.sort();
        data.participants.forEach(name => {
            const p = controls.create(parent, "p");
            controls.createButton(p, name, () => {
                myName = name;
                save();
                render();
            });
        });
    };

    const renderListView = (option) => {
        const listViewDiv = document.getElementById("listview-div-id");
        controls.removeAllChildren(listViewDiv);
        if (listView) {
            const dateoptions = {
                weekday: "long",
                day: "numeric",
            };
            const option = data.options[currentOptionIdx];
            option.votes.forEach(v => {
                const p = controls.create(listViewDiv, "p");
                const div = controls.createSpan(p);
                if (v.accepted.includes(myName)) {
                    controls.createButton(div, "-", () => onMinusButton(v));
                }
                else {
                    controls.createButton(div, "+", () => onPlusButton(v));
                }
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
            canvas.addEventListener("mouseup", onCanvasMouseUp);
            setCanvasSize(canvas);
            window.requestAnimationFrame(draw);
            dirty = true;
        }
    };

    // callbacks

    const onMinusButton = (v) => {
        v.accepted = v.accepted.filter(name => name != myName);
        save();
        renderListView();
    };

    const onPlusButton = (v) => {
        v.accepted.push(myName);
        save();
        renderListView();
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
        render();
    };

    const onResize = () => {
        const canvas = document.getElementById("calendar-id");
        if (canvas) {
            setCanvasSize(canvas);
            dirty = true;
        }
    };

    const onCanvasMouseUp = (evt) => {
        const x = Math.floor(evt.offsetX / dayWidth);
        const y = Math.floor((evt.offsetY - headerHeight) / dayHeight);
        if (x >= 0 && x <= 7 && y >= 0 && y <= 6) {
            const option = data.options[currentOptionIdx];
            const day = dayMatrix[y][x];
            const vote = option.votes.find(v => v.day == day);
            if (vote) {
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
    };

    // --- public API

    return {
        render: render,
        onResize: onResize,
    };
})();

// --- window loaded event

window.onload = () => {
    window.addEventListener("resize", makeadate.onResize);
    utils.auth_lltoken(() => utils.set_locale(() => makeadate.render()));
};
