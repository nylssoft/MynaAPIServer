var skat = (() => {

    "use strict";

    // UI elements

    let inputUsername;
    let divMain;
    let checkBoxOuvert;
    let checkBoxHand;
    let checkBoxSchneider;
    let checkBoxSchwarz;
    let divLayoutLeft;

    // state

    let embedded;

    let ticket;
    let model;
    let pollStateEnabled = false;
    let showLastStitch = false;
    let giveUpClicked = false;
    let speedUpClicked = false;
    let logoutClicked = false;
    let letsStartClicked = false;
    let specialSortOption = true;
    let showReservations = false;
    let showResultInWindow = false;
    let currentSkatResultId;

    let imgHeight = 140;
    let imgWidth = 90;

    let currentUser;
    let photos = {};
    let guestMode = false;
    let reservations;

    let helpDiv;

    let version = "2.3.3";

    let computerGame = false;
    let computerInternalState;
    let computerActionCount = 0;

    // helper

    const handleError = (errMsg) => {
        console.error(_T(errMsg));
        utils.remove_session_storage("skatstate");
        enablePollState();
    };

    const clearTicket = () => {
        ticket = undefined;
        utils.remove_session_storage("skatticket");
        utils.remove_local_storage("skatticket");
    };

    const setTicket = (t) => {
        ticket = t;
        utils.set_session_storage("skatticket", t);
        utils.set_local_storage("skatticket", t);
    };

    const getTicket = () => {
        let t = utils.get_session_storage("skatticket");
        if (!t) {
            t = utils.get_local_storage("skatticket");
        }
        return t;
    };

    const getState = () => {
        return utils.get_session_storage("skatstate");
    };

    const setState = (state) => {
        utils.set_session_storage("skatstate", state);
    };

    const enablePollState = () => {
        if (!pollStateEnabled && !computerGame) {
            if (utils.is_debug()) utils.debug("POLL STATE ENABLED.");
            pollStateEnabled = true;
        }
    };

    const disablePollState = () => {
        if (pollStateEnabled) {
            if (utils.is_debug()) utils.debug("POLL STATE DISABLED.");
            pollStateEnabled = false;
        }
    };

    const translateLabels = (labels) => {
        let txt = "";
        if (labels && labels.length > 0) {
            labels.forEach((label) => {
                if (txt.length > 0) {
                    txt += " ";
                }
                txt += _T(label);
            });
        }
        return txt;
    };

    const getCardImage = (card) => {
        let str = card.orderNumber.toString();
        if (str.length == 1) {
            str = "0" + str;
        }
        return `images/skat/${str}.gif`;
    };

    const getCardDescription = (card) => {
        return _T(`TEXT_${card.color.toUpperCase()}`) + " " + _T(`TEXT_${card.value.toUpperCase()}`);
    };

    const isOuvert = () => {
        return model &&
            model.skatTable &&
            model.skatTable.gameStarted &&
            !model.skatTable.gameEnded &&
            model.skatTable.gamePlayer &&
            (!model.skatTable.player || model.skatTable.player && model.skatTable.gamePlayer.name != model.skatTable.player.name) &&
            (model.skatTable.gamePlayer.game.option.ouvert || model.skatTable.isSpeedUp);
    };

    const getColors = (cards) => {
        let ret = [];
        cards.forEach(c => {
            if (!ret.includes(c.color)) {
                ret.push(c.color);
            }
        });
        return ret;
    };

    const getColorType = (color) => {
        if (color == "Hearts" || color == "Diamonds") return "Red";
        return "Black";
    };

    const getColoredCards = (color, cards) => {
        let ret = [];
        cards.forEach((card) => {
            if (card.color == color) {
                ret.push(card);
            }
        });
        return ret;
    };

    const sortColors = (guess, colors, trumpColor) => {
        let idx = 0;
        if (colors.length == 0) return guess;
        while (idx < colors.length) {
            let c = colors[idx];
            if (!guess.includes(c) &&
                (guess.length == 0 && (!trumpColor || getColorType(trumpColor) != getColorType(c)) ||
                    guess.length > 0 && getColorType(guess[guess.length - 1]) != getColorType(c))) {
                let newguess = guess.slice();
                newguess.push(c);
                let restcolors = colors.slice(0, idx);
                restcolors = restcolors.concat(colors.slice(idx + 1));
                let ret = sortColors(newguess, restcolors);
                if (ret) return ret;
            }
            idx++;
        }
        return undefined;
    };

    const findFirstNonTrump = (game, cards) => {
        for (let idx = 0; idx < cards.length; idx++) {
            if (!skatengine.isTrump(game, cards[idx])) {
                return idx;
            }
        }
        return -1;
    };

    const sortCards = (game, cards) => {
        if (cards.length <= 2) return cards;
        let idx = findFirstNonTrump(game, cards);
        if (idx < 0) return cards;
        let trumpCards = cards.slice(0, idx);
        let nonTrumpCards = cards.slice(idx);
        let colors = getColors(nonTrumpCards);
        let trumpColor;
        if (game.type == "Color" &&
            trumpCards.length > 0 &&
            trumpCards[trumpCards.length - 1].value != "Jack") {
            trumpColor = game.color;
        }
        let sortedColors = sortColors([], colors, trumpColor);
        if (sortedColors) {
            let sortedCards = [];
            if (trumpCards && trumpCards.length > 0) {
                sortedCards = trumpCards;
            }
            sortedColors.forEach((color) => {
                let coloredCards = getColoredCards(color, nonTrumpCards);
                sortedCards = sortedCards.concat(coloredCards);
            });
            return sortedCards;
        }
        return cards;
    };

    const getPlayerName = () => {
        if (model && model.skatTable) {
            if (model.skatTable.player) {
                return model.skatTable.player.name;
            }
            if (model.skatTable.inactivePlayer) {
                return model.skatTable.inactivePlayer.name;
            }
        }
        return "";
    };

    const isPlaying = (user) => {
        if (model && model.skatTable) {
            if (!model.skatTable.inactivePlayer || user.name != model.skatTable.inactivePlayer.name) {
                return true;
            }
        }
        return false;
    };

    const getFreeReservationTimes = (d) => {
        let today = new Date();
        let freeTimes = {};
        let availableHours = new Set([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
        let is_today = today.getFullYear() == d.getFullYear() &&
            today.getMonth() == d.getMonth() &&
            today.getDate() == d.getDate();
        if (is_today) {
            availableHours.forEach(h => {
                if (h < today.getHours()) {
                    availableHours.delete(h);
                }
            });
        }
        reservations.forEach(r => {
            const rd = new Date(r.reservedUtc);
            if (rd.getFullYear() == d.getFullYear() &&
                rd.getMonth() == d.getMonth() &&
                rd.getDate() == d.getDate()) {
                let hour = rd.getHours();
                let duration = (r.duration / 60) - 1;
                while (duration >= 0) {
                    availableHours.delete(hour + duration);
                    duration--;
                }
            }
        });
        availableHours.forEach(h => {
            for (let d = 0; d <= 3; d++) {
                if (availableHours.has(h + d)) {
                    let l = freeTimes[h];
                    if (!l) {
                        l = [];
                    }
                    l.push(d + 1);
                    freeTimes[h] = l;
                }
                else {
                    break;
                }
            }
        });
        return freeTimes;
    };

    const getCurrentUsername = () => currentUser ? currentUser.name : _T("TEXT_YOU");

    // rendering

    const draw = () => {
        window.requestAnimationFrame(draw);
        if (computerGame && computerActionCount > 0) {
            computerActionCount -= 1;
            if (computerActionCount == 0) {
                onComputerAction();
            }
        }
    };

    const renderTableFull = (parent, ignoreToken) => {
        if (ignoreToken || !currentUser) {
            controls.create(parent, "p", undefined, _T("INFO_TABLE_FULL"));
            controls.createButton(parent, _T("BUTTON_GUEST_VIEW"), () => window.open("/skat?guest", "_blank"));
            setActive(false);
        }
        else {
            let divParent = controls.createDiv(parent);
            model.allUsers.forEach((skatuser) => {
                if (skatuser.name == currentUser.name) {
                    utils.set_window_location(`/skat?login=${encodeURI(currentUser.name)}`);
                    return;
                }
            });
            renderTableFull(divParent, true);
        }
    };

    const renderUserList = (parent) => {
        if (!embedded) {
            helpDiv = controls.createDiv(document.body);
            utils.create_menu(parent);
            let title = currentUser ? `${currentUser.name} - ${_T("HEADER_SKAT")}` : _T("HEADER_SKAT");
            const h1 = controls.create(parent, "h1", undefined, title);
            const helpImg = controls.createImg(h1, "help-button", 24, 24, "/images/buttons/help.png", _T("BUTTON_HELP"));
            helpImg.addEventListener("click", () => onUpdateHelp(true));
            const token = utils.get_authentication_token();
            if (token) {
                const imgResults = controls.createImg(parent, "results-img-open", 32, 32, "/images/buttons/games-card_game.png", _T("BUTTON_GAME_RESULTS"));
                imgResults.addEventListener("click", () => dispatchShowResults());
            }
            if (currentUser && currentUser.photo) {
                const imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo, _T("BUTTON_PROFILE"));
                imgPhoto.addEventListener("click", () => utils.set_window_location("/usermgmt"));
            }
        }
        let divInfoImages = controls.createDiv(parent, "infoimages");
        controls.createImg(divInfoImages, "card-img", imgWidth, imgHeight, "/images/skat/28.gif", `${_T("TEXT_CLUBS")} ${_T("TEXT_JACK")}`);
        controls.createImg(divInfoImages, "card-img", imgWidth, imgHeight, "/images/skat/20.gif", `${_T("TEXT_SPADES")} ${_T("TEXT_JACK")}`);
        controls.createImg(divInfoImages, "card-img", imgWidth, imgHeight, "/images/skat/12.gif", `${_T("TEXT_HEARTS")} ${_T("TEXT_JACK")}`);
        controls.createImg(divInfoImages, "card-img", imgWidth, imgHeight, "/images/skat/04.gif", `${_T("TEXT_DIAMONDS")} ${_T("TEXT_JACK")}`);
        if (model.allUsers.length > 0) {
            controls.create(parent, "p", undefined, _T("INFO_PLAYERS_AT_TABLE"));
            let ul = controls.create(parent, "ul");
            let idx = 1;
            model.allUsers.forEach((user) => {
                let li = controls.create(ul, "li");
                let img = controls.createImg(li, "player-img", 45, 45, undefined, user.name);
                let photo = photos[user.name.toLowerCase()];
                if (!photo) {
                    photo = `/images/skat/profiles/default${idx}.png`;
                    photos[user.name.toLowerCase()] = photo;
                    img.src = photo;
                    utils.fetch_api_call(`/api/pwdman/photo?username=${encodeURI(user.name)}`, undefined,
                        (p) => {
                            if (utils.is_debug()) utils.debug(`PHOTO RETRIEVED: ${p}.`);
                            if (p) {
                                photos[user.name.toLowerCase()] = p;
                                img.src = p;
                            }
                        },
                        (errMsg) => console.error(_T(errMsg)));
                }
                else {
                    img.src = photo;
                }
                controls.create(li, "span", undefined, user.name).style.marginLeft = "10pt";
                idx++;
            });
        }
        if (!embedded) {
            utils.set_menu_items(currentUser);
        }
    };

    const renderReservations = (parent) => {
        if (!showReservations || !reservations) return;
        let divReservations = controls.createDiv(parent, "layout-reservations");
        let divPage = controls.createDiv(divReservations);
        let divHeader = controls.createDiv(divPage, "reservation-header");
        divHeader.textContent = _T("INFO_TABLE_RESERVATIONS");
        if (currentUser) {
            let imgAdd = controls.createImg(divHeader, "reservation-img", 32, 32, "/images/buttons/list-add-4.png", _T("BUTTON_ADD_RESERVATION"));
            imgAdd.addEventListener("click", () => btnReserve_click(divReservations));
        }
        reservations.forEach(r => {
            let dd = new Date(r.reservedUtc);
            let daystr = utils.format_date(dd, { "month": "numeric", "day": "numeric" });
            let h = dd.getHours() + r.duration / 60;
            let txt = `${daystr} ${dd.getHours()}-${h} ${r.players.join(", ")}`;
            let divReservation = controls.create(divPage, "p", undefined, txt);
            if (currentUser && (currentUser.name == r.reservedBy || currentUser.roles.includes("skatadmin"))) {
                let imgRemove = controls.createImg(divReservation, "reservation-img", 32, 32, "/images/buttons/list-remove-4.png", _T("BUTTON_CANCEL_RESERVATION"));
                imgRemove.id = `imgremove-${r.id}`;
                imgRemove.addEventListener("click", (elem) => {
                    const reservationId = elem.target.id.substring(10);
                    let token = utils.get_authentication_token();
                    disablePollState();
                    utils.fetch_api_call("api/skat/reservation",
                        {
                            method: "DELETE",
                            headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                            body: JSON.stringify(reservationId)
                        },
                        () => {
                            if (utils.is_debug()) utils.debug("RESERVATION DELETED.");
                            btnShowReservations_click();
                        },
                        handleError);
                });
            }
        });
        controls.createButton(divPage, _T("BUTTON_OK"), () => {
            showReservations = false;
            render();
        });
    };

    const renderCalendar = (parent, month, year) => {
        controls.removeAllChildren(parent);
        let today = new Date();
        let date = new Date(year, month);
        let firstDay = (date.getDay() + 6) % 7;
        let daysInMonth = 32 - new Date(year, month, 32).getDate();
        let table = controls.create(parent, "table");
        let caption = controls.create(table, "caption");
        controls.createSpan(caption, undefined, utils.format_date(date, { year: "numeric", month: "long" }));
        if (today.getMonth() < month) {
            controls.createImageButton(caption, _T("BUTTON_PREV_MONTH"),
                () => btnPreviousMonth_click(parent, year, month),
                "/images/buttons/arrow-left-2.png", 16, "reservation-transparent");
        }
        if (today.getMonth() == month) {
            controls.createImageButton(caption, _T("BUTTON_NEXT_MONTH"),
                () => btnNextMonth_click(parent, year, month),
                "/images/buttons/arrow-right-2.png", 16, "reservation-transparent");
        }
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
                    let msg = `${day}`;
                    if (isToday) {
                        msg += "*";
                    }
                    if (month == today.getMonth() && day < today.getDate()) {
                        controls.createSpan(td, undefined, msg);
                    }
                    else {
                        let d = day;
                        /* jshint -W083 */
                        controls.createA(td, undefined, "#open", msg, () => renderAddReservation(parent, d, month, year));
                        /* jshint +W083 */
                    }
                    day++;
                }
            }
        }
        controls.createButton(parent, _T("BUTTON_BACK"), () => render());
    };

    const renderAddReservation = (parent, day, month, year) => {
        controls.removeAllChildren(parent);
        let dd = new Date(Date.UTC(year, month, day));
        let dt = utils.format_date(dd, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
        let captionDiv = controls.createDiv(parent, "reservation-calendar-caption");
        captionDiv.textContent = `${dt}`;
        let freeTimes = getFreeReservationTimes(dd);
        let options = [];
        Object.keys(freeTimes).forEach(h => {
            options.push({ name: _T("OPTION_TIME_1", h), value: `${h}` });
        });
        let timeDiv = controls.createDiv(parent);
        let timeLabel = controls.createLabel(timeDiv, "reservation-label", _T("LABEL_TIME"));
        timeLabel.htmlFor = "reservation-hour-id";
        let selectHour = controls.createSelect(timeDiv, "reservation-hour-id", "reservation-select", options);
        selectHour.value = undefined;
        let durationDiv = controls.createDiv(parent);
        let durationLabel = controls.createLabel(durationDiv, "reservation-label", _T("LABEL_DURATION"));
        durationLabel.htmlFor = "reservation-duration-id";
        let selectDuration = controls.createSelect(durationDiv, "reservation-duration-id", "reservation-select", []);
        selectHour.addEventListener("change", (elem) => {
            controls.removeAllChildren(selectDuration);
            let durations = freeTimes[elem.target.value];
            if (durations) {
                let option;
                durations.forEach(duration => {
                    let txt = duration > 1 ? _T("OPTION_HOURS_1", duration) : _T("OPTION_HOUR_1", duration);
                    option = controls.create(selectDuration, "option", undefined, txt);
                    option.setAttribute("value", `${duration}`);
                });
                if (option) {
                    option.setAttribute("selected", "true");
                }
            }
        });
        for (let playerIdx = 1; playerIdx <= 4; playerIdx++) {
            let playerDiv = controls.createDiv(parent);
            let playerLabel = controls.createLabel(playerDiv, "reservation-label", _T("LABEL_PLAYER_1", playerIdx));
            playerLabel.htmlFor = `reservation-player${playerIdx}-id`;
            let playerInput = controls.createInputField(playerDiv, _T("TEXT_PLAYER_1", playerIdx), undefined, "reservation-input", 20, 32);
            playerInput.id = `reservation-player${playerIdx}-id`;
            if (playerIdx == 1) {
                playerInput.value = currentUser.name;
                playerInput.disabled = true;
            }
        }
        controls.createButton(parent, _T("BUTTON_RESERVE"), () => {
            let token = utils.get_authentication_token();
            let r = {};
            let hour = document.getElementById("reservation-hour-id").value;
            let reservedUtc = new Date(year, month, day, hour);
            r.reservedUtc = reservedUtc;
            r.duration = document.getElementById("reservation-duration-id").value * 60;
            r.players = [];
            for (let idx = 1; idx <= 4; idx++) {
                let val = document.getElementById(`reservation-player${idx}-id`).value;
                if (val && val.length > 0) {
                    r.players.push(val);
                }
            }
            disablePollState();
            utils.fetch_api_call("api/skat/reservation",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(r)
                },
                () => {
                    if (utils.is_debug()) utils.debug("RESERVATION ADDED.");
                    btnShowReservations_click();
                },
                (errMsg) => {
                    document.getElementById("reserve-error-id").textContent = _T(errMsg);
                    enablePollState();
                });
        });
        controls.createButton(parent, _T("BUTTON_BACK"), () => renderCalendar(parent, month, year));
        controls.createDiv(parent, "error").id = "reserve-error-id";
    };

    const setActive = (isActive) => {
        if (embedded) return;
        document.body.className = isActive ? "active-background" : "inactive-background";
    };

    const renderLogin = (parent) => {
        setActive(true);
        if (!currentUser) {
            controls.create(parent, "p", undefined, _T("INFO_YOU_CAN_PLAY"));
            let label = controls.createLabel(parent, undefined, _T("LABEL_NAME"));
            label.htmlFor = "username-id";
            inputUsername = controls.createInputField(parent, _T("TEXT_NAME"), btnLogin_click, "username-input", 20, 32);
            inputUsername.placeholder = _T("TEXT_NAME");
            inputUsername.id = "username-id";
            if (!utils.is_mobile()) {
                inputUsername.focus();
            }
            controls.createButton(parent, _T("BUTTON_LOGIN"), btnLogin_click);
            let p = controls.create(parent, "p", undefined, _T("INFO_REGISTER"));
            const currentUrl = utils.get_window_location();
            controls.createButton(p, _T("BUTTON_REGISTER"), () => {
                utils.set_window_location("/pwdman?register&nexturl=" + encodeURI(currentUrl));
            });
            if (!showReservations) {
                controls.createButton(parent, _T("BUTTON_RESERVATIONS"), () => btnShowReservations_click());
            }
        }
        else {
            let parentdiv = controls.create(parent, "p");
            controls.create(parentdiv, "p", undefined, _T("INFO_YOU_CAN_PLAY_1", currentUser.name));
            inputUsername = controls.createInputField(parentdiv, _T("TEXT_NAME"), btnLogin_click, "hide", 20, 32);
            inputUsername.value = currentUser.name;
            controls.createButton(parentdiv, _T("BUTTON_PLAY_WITH"), btnLogin_click);
            if (!showReservations) {
                controls.createButton(parent, _T("BUTTON_RESERVATIONS"), () => btnShowReservations_click());
            }
        }
        const pComputer = controls.create(parent, "p");
        controls.createButton(pComputer, _T("BUTTON_COMPUTER_GAME"), () => onStartComputerGame());
    };

    const renderWaitForUsers = (parent) => {
        controls.create(parent, "p", "activity", _T("INFO_WAIT_FOR_ALL"));
        setActive(false);
    };

    const renderStartGame = (parent) => {
        if (model.allUsers.length < 4) {
            controls.create(parent, "p", undefined, _T("INFO_WAIT_FOR_4_PLAYERS"));
        }
        else {
            controls.create(parent, "p", undefined, _T("INFO_ALL_LOGGED_IN_START_GAME"));
        }
        controls.createButton(parent, _T("BUTTON_START_GAME"), btnStartGame_click);
        setActive(true);
    };

    const renderCards = (parent, overlap, cards, show, action, addspace) => {
        let cnt = 0;
        let container = parent;
        cards.forEach(card => {
            if (addspace && (cnt % 3 == 0)) {
                container = controls.createDiv(parent, undefined);
                container.style = "white-space:nowrap;display:inline-block;";
            }
            let gif = show ? getCardImage(card) : "/images/skat/back.gif";
            let img = controls.createImg(container, "card-img", imgWidth, imgHeight, `${gif}`);
            if (show) {
                img.title = getCardDescription(card);
                if (action) {
                    img.addEventListener("click", () => action(card));
                }
            }
            else {
                img.title = _T("TEXT_SKAT");
            }
            if (cnt > 0 && overlap) {
                if (addspace && (cnt % 3 == 0)) {
                    img.style.marginLeft = "5pt";
                }
                else {
                    img.style.marginLeft = "-20pt";
                }
            }
            cnt++;
        });
    };

    const renderStitch = (parent) => {
        if (!model.skatTable.gameStarted) {
            renderSkat(parent);
        }
        else {
            if (showLastStitch) {
                renderLastStitch(parent);
            }
            else {
                if (model.skatTable.stitch.length == 0) {
                    if (!model.skatTable.gameEnded) {
                        controls.createImg(parent, "card-img", imgWidth, imgHeight, "/images/skat/empty.png", undefined, _T("TEXT_PLACEHOLDER"));
                    }
                }
                else {
                    renderCards(parent, true, model.skatTable.stitch, true, btnStitchCard_click);
                }
            }
        }
    };

    const renderLastStitch = (parent) => {
        if (!model.skatTable.gameStarted || !model.skatTable.lastStitch || !showLastStitch) return;
        if (model.skatTable.lastStitch.length > 0) {
            renderCards(parent, true, model.skatTable.lastStitch, true, btnLastStitchCard_click);
        }
    };

    const renderSkat = (parent) => {
        if (model.skatTable.gameStarted) return;
        if (!model.skatTable.canPickupSkat) {
            renderCards(parent, false, [1, 1], false);
        }
        else {
            if (model.skatTable.skat.length == 0) {
                if (!model.skatTable.gameEnded) {
                    controls.createImg(parent, "card-img", imgWidth, imgHeight, "/images/skat/empty.png", undefined, _T("TEXT_PLACEHOLDER"));
                }
            }
            else {
                renderCards(parent, false, model.skatTable.skat, true, btnSkatCard_click);
            }
        }
    };

    const renderOuvertOrScoreCards = (parent) => {
        if (isOuvert()) {
            renderCards(parent, true, model.skatTable.ouvert, true);
        }
        else if (model.skatTable.gameEnded) {
            renderCards(parent, true, model.skatTable.stitches, true, undefined, true);
        }
    };

    const renderViewCards = (parent) => {
        let viewCards;
        if (specialSortOption && model.skatTable.player && model.skatTable.player.game) {
            viewCards = sortCards(model.skatTable.player.game, model.skatTable.cards);
        }
        else {
            viewCards = model.skatTable.cards;
        }
        renderCards(parent, true, viewCards, true, btnPlayerCard_click);
    };

    const renderActions = (parent) => {
        let active = false;
        if (showLastStitch) {
            controls.createButton(parent, _T("BUTTON_BACK_LAST_STITCH"), btnLastStitchCard_click, "StopViewLastStitch");
        }
        else if (giveUpClicked) {
            controls.create(parent, "span", "confirmation", _T("INFO_REALLY_GIVE_UP"));
            controls.createButton(parent, _T("BUTTON_YES"), btnGiveUp_click, "GiveUpYes");
            controls.createButton(parent, _T("BUTTON_NO"), btnGiveUp_click, "GiveUpNo");
            active = true;
        }
        else if (speedUpClicked) {
            controls.create(parent, "span", "confirmation", _T("INFO_REALLY_SPEED_UP"));
            controls.createButton(parent, _T("BUTTON_YES"), btnSpeedUp_click, "SpeedUpYes");
            controls.createButton(parent, _T("BUTTON_NO"), btnSpeedUp_click, "SpeedUpNo");
            active = true;
        }
        else if (logoutClicked) {
            controls.create(parent, "span", "confirmation", _T("INFO_REALLY_LEAVE_TABLE"));
            controls.createButton(parent, _T("BUTTON_YES"), btnLogout_click, "LogoutYes");
            controls.createButton(parent, _T("BUTTON_NO"), btnLogout_click, "LogoutNo");
            active = true;
        }
        else if (letsStartClicked && model.skatTable.player) {
            const txt = translateLabels(model.skatTable.player.game.descriptionLabels);
            controls.create(parent, "span", "confirmation", _T("INFO_REALLY_PLAY_1", txt));
            controls.createButton(parent, _T("BUTTON_YES"), btnLetsStart_click, "LetsStartYes");
            controls.createButton(parent, _T("BUTTON_NO"), btnLetsStart_click, "LetsStartNo");
            active = true;
        }
        else {
            if (model.skatTable.canStartNewGame && model.currentUser) {
                if (!model.currentUser.startGameConfirmed || computerGame) {
                    if (computerGame) {
                        controls.createButton(parent, _T("BUTTON_NEW_GAME"), btnStartGame_click, "StartGame");
                    }
                    else if (model.skatTable.player) {
                        controls.createButton(parent, _T("BUTTON_OK"), btnConfirmStartGame_click, "ConfirmStartGame");
                    }
                    controls.createButton(parent, _T("BUTTON_GAME_HISTORY"), () => onShowGameHistory());
                    controls.createButton(parent, _T("BUTTON_RESULT_TABLE"), () => dispatchShowResult());
                    active = true;
                }
                else if (model.skatTable.player) {
                    let wait = false;
                    model.allUsers.forEach((user) => {
                        if (isPlaying(user) && !user.startGameConfirmed) {
                            wait = true;
                        }
                    });
                    if (!wait) {
                        controls.createButton(parent, _T("BUTTON_NEW_GAME"), btnStartGame_click, "StartGame");
                        active = true;
                    }
                    else {
                        controls.create(parent, "p", undefined, _T("INFO_WAIT_CONFIRMATION_OTHER"));
                        controls.createButton(parent, _T("BUTTON_CANCEL"), btnCancelConfirmStartGame_click, "CancelConfirmStartGame");
                        setActive(false);
                    }
                }
            }
            if (!model.skatTable.isSpeedUp) {
                if (model.skatTable.canCollectStitch) {
                    controls.createButton(parent, _T("BUTTON_COLLECT_STITCH"), btnStitchCard_click, "CollectStitch");
                    active = true;
                }
                if (model.skatTable.canViewLastStitch) {
                    controls.createButton(parent, _T("BUTTON_VIEW_LAST_STITCH"), btnLastStitchCard_click, "ViewLastStitch");
                }
                if (model.skatTable.canGiveUp && !computerGame) {
                    controls.createButton(parent, _T("BUTTON_GIVE_UP"), btnGiveUp_click, "GiveUpQuestion");
                }
                if (model.skatTable.canSpeedUp && !computerGame) {
                    controls.createButton(parent, _T("BUTTON_SPEED_UP"), btnSpeedUp_click, "SpeedUp");
                }
            }
            else {
                if (model.skatTable.canConfirmSpeedUp) {
                    controls.createButton(parent, _T("BUTTON_CONFIRM_SPEED_UP"), btnSpeedUpConfirm_click, "ConfirmSpeedUp");
                    controls.createButton(parent, _T("BUTTON_CONTINUE_PLAY"), btnContinuePlay_click, "ContinuePlay");
                    active = true;
                }
                else {
                    controls.create(parent, "p", undefined, _T("INFO_WAIT_CONFIRM_SPEED_UP"));
                }
            }
            model.skatTable.actions.forEach((action) => {
                controls.createButton(parent, _T(action.descriptionLabel), btnAction_click, action.name);
                active = true;
            });
            if (model.skatTable.player && model.skatTable.player.tooltipLabels && model.skatTable.player.tooltipLabels.length > 0) {
                controls.create(parent, "span", "tooltip", translateLabels(model.skatTable.player.tooltipLabels));
            }
        }
        if (active) {
            setActive(true);
        }
    };

    const renderSpecialSort = (parent) => {
        if (model.skatTable.player && model.skatTable.cards.length > 2) {
            controls.createCheckbox(parent, "sortoption", "Sort", _T("OPTION_SORT_ALTERNATING_COLORS"), specialSortOption, btnSpecialSortOption_click, false);
        }
    };

    const renderGame = (parent) => {
        if (!model.skatTable.player || !model.skatTable.player.game) return;
        let game = model.skatTable.player.game;
        let gameStarted = model.skatTable.gameStarted;
        let divGameType = controls.create(parent, "div", "gametype");
        controls.createRadiobutton(divGameType, "r1", "gametype", "Grand", _T("TEXT_GRAND"), game.type == "Grand", btnGameType_click, gameStarted);
        if (!computerGame) {
            controls.createRadiobutton(divGameType, "r2", "gametype", "Null", _T("TEXT_NULL"), game.type == "Null", btnGameType_click, gameStarted);
        }
        controls.createRadiobutton(divGameType, "r3", "gametype", "Clubs", _T("TEXT_CLUBS"), game.type == "Color" && game.color == "Clubs", btnGameType_click, gameStarted);
        controls.createRadiobutton(divGameType, "r4", "gametype", "Spades", _T("TEXT_SPADES"), game.type == "Color" && game.color == "Spades", btnGameType_click, gameStarted);
        controls.createRadiobutton(divGameType, "r5", "gametype", "Hearts", _T("TEXT_HEARTS"), game.type == "Color" && game.color == "Hearts", btnGameType_click, gameStarted);
        controls.createRadiobutton(divGameType, "r6", "gametype", "Diamonds", _T("TEXT_DIAMONDS"), game.type == "Color" && game.color == "Diamonds", btnGameType_click, gameStarted);
        let divGameOption = controls.create(parent, "div", "gameoption");
        checkBoxOuvert = controls.createCheckbox(divGameOption, "c1", "Ouvert", _T("TEXT_OUVERT"), game.option.ouvert, btnGameOption_click, !model.skatTable.canSetOuvert);
        checkBoxHand = controls.createCheckbox(divGameOption, "c2", "Hand", _T("TEXT_HAND"), game.option.hand, btnGameOption_click, !model.skatTable.canSetHand);
        checkBoxSchneider = controls.createCheckbox(divGameOption, "c3", "Schneider", _T("TEXT_SCHNEIDER"), game.option.schneider, btnGameOption_click, !model.skatTable.canSetSchneider);
        checkBoxSchwarz = controls.createCheckbox(divGameOption, "c4", "Schwarz", _T("TEXT_SCHWARZ"), game.option.schwarz, btnGameOption_click, !model.skatTable.canSetSchwarz);
    };

    const renderHeader = (parent) => {
        controls.create(parent, "p", undefined, translateLabels(model.skatTable.messageLabels));
    };

    const renderSummaryPlayer = (elem, player) => {
        elem.textContent = player.name;
        if (model.skatTable.currentPlayer &&
            model.skatTable.currentPlayer.name == player.name) {
            elem.className += " blinking";
        }
        let img = controls.createImg(elem, "player-img", 90, 90, undefined, player.name);
        let photo = photos[player.name.toLowerCase()];
        if (!photo) {
            for (let idx = 0; idx < model.allUsers.length; idx++) {
                if (model.allUsers[idx].name == player.name) {
                    photo = `/images/skat/profiles/default${idx + 1}.png`;
                    photos[player.name.toLowerCase()] = photo;
                    img.src = photo;
                    break;
                }
            }
            utils.fetch_api_call(`/api/pwdman/photo?username=${encodeURI(player.name)}`, undefined,
                (p) => {
                    if (utils.is_debug()) utils.debug(`PHOTO RETRIEVED (render summary): ${p}.`);
                    if (p) {
                        photos[player.name.toLowerCase()] = p;
                        img.src = p;
                    }
                },
                (errMsg) => console.error(_T(errMsg)));
        }
        else {
            img.src = photo;
        }
        if (!model.skatTable.gamePlayer) {
            if (model.skatTable.bidSaid && player.bidStatus == 0 && model.skatTable.currentBidValue > 0) {
                controls.createSpan(elem, undefined, `${model.skatTable.currentBidValue}?`);
            }
            else if (!model.skatTable.bidSaid && player.bidStatus == 0 && model.skatTable.currentBidValue > 0) {
                controls.createSpan(elem, undefined, `${model.skatTable.currentBidValue}`);
            }
            else if (!model.skatTable.bidSaid && player.bidStatus == 1 && model.skatTable.currentBidValue > 0) {
                controls.createSpan(elem, undefined, _T("TEXT_ACCEPT_BID"));
            }
            else if (player.bidStatus == 2) {
                controls.createSpan(elem, undefined, _T("TEXT_DECLINE_BID"));
            }
        }
    };

    const renderSummary = (parent, left, right, bottom) => {
        controls.create(parent, "div", "summary-currentplayer", _T("INFO_PLAY_1", model.skatTable.gameCounter));
        model.skatTable.players.forEach((p) => {
            let classname = p.name == getPlayerName() ? "summary-currentplayer" : "summary-otherplayer";
            controls.create(parent, "div", classname, _T(p.summaryLabel));
        });
        if (!model.skatTable.gameEnded) {
            let leftPlayer;
            let middlePlayer;
            let rightPlayer;
            if (!model.skatTable.player) {
                if (model.skatTable.inactivePlayer) {
                    middlePlayer = skatengine.getNextPlayer(model, model.skatTable.inactivePlayer);
                    leftPlayer = skatengine.getNextPlayer(model, middlePlayer);
                }
                else {
                    middlePlayer = model.skatTable.players[0];
                    leftPlayer = model.skatTable.players[1];
                }
            }
            else {
                leftPlayer = skatengine.getNextPlayer(model, model.skatTable.player);
                middlePlayer = model.skatTable.player;
            }
            rightPlayer = skatengine.getNextPlayer(model, leftPlayer);
            if (isOuvert() && model.skatTable.ouvert.length > 0) {
                left.className += "-ouvert";
                right.className += "-ouvert";
            }
            renderSummaryPlayer(left, leftPlayer);
            renderSummaryPlayer(right, rightPlayer);
            renderSummaryPlayer(bottom, middlePlayer);
        }
    };

    const renderLogoutAlert = (parent) => {
        if (model && model.currentUser && model.nextReservation && model.nextReservation.players) {
            let nowUtc = new Date();
            let reservedUtc = new Date(model.nextReservation.reservedUtc);
            let elapsed = reservedUtc - nowUtc;
            if (elapsed < 10 * 60 * 1000 &&
                !model.nextReservation.players.includes(model.currentUser.name)) {
                let sec = Math.ceil(elapsed / 1000);
                let names = model.nextReservation.players.join(", ");
                let txt;
                if (sec <= 0) {
                    txt = _T("INFO_TABLE_RESERVED_FOR_1", names);
                }
                else {
                    let val;
                    let unit;
                    if (sec > 60) {
                        val = Math.ceil(sec / 60);
                        unit = (val <= 1) ? _T("TEXT_MINUTE") : _T("TEXT_MINUTES");
                    }
                    else {
                        val = sec;
                        unit = sec <= 1 ? _T("TEXT_SECOND"): _T("TEXT_SECONDS");
                    }
                    txt = _T("INFO_TABLE_RESERVED_IN_1_2_3", val, unit, names);
                }
                controls.createDiv(parent, "reservation-logout-alert").textContent = txt;
            }
        }
    };

    const renderCopyright = (parent) => {
        if (embedded) return;
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `${_T("HEADER_SKAT")} ${version}. ${_T("TEXT_COPYRIGHT_YEAR")} `);
        controls.createA(div, "copyright", "/view?page=copyright", _T("COPYRIGHT"));
        if (ticket || computerGame) {
            controls.createButton(div, _T("BUTTON_LEAVE_TABLE"), btnLogout_click, "Logout", "logout-button");
        }
        renderLogoutAlert(parent);
    };

    const renderMainPage = (parent) => {
        let divSummary = controls.createDiv(parent);
        let divHeader = controls.createDiv(parent, "header-section");
        let divOuvert = controls.createDiv(parent, "cards-section");
        let divCenter = controls.createDiv(parent);
        let divLeft = controls.createDiv(parent, "left-section");
        let divStitch = controls.createDiv(divCenter, "stitch-section");
        let divBottom = controls.createDiv(divCenter, "bottom-section");
        let divCards = controls.createDiv(divCenter, "cards-section");
        let divSpecialSort = controls.createDiv(divCenter, "specialsort-section");
        let divRight = controls.createDiv(parent, "right-section");
        let divActions = controls.createDiv(parent, "actions-section");
        let divGame = controls.createDiv(parent);
        let divCopyright = controls.createDiv(parent);
        if (model.skatTable.player) {
            if (model.skatTable.currentPlayer &&
                model.skatTable.player.name == model.skatTable.currentPlayer.name ||
                !model.skatTable.gameStarted &&
                model.skatTable.gamePlayer &&
                model.skatTable.gamePlayer.name == model.skatTable.player.name) {
                setActive(true);
            }
        }
        renderSummary(divSummary, divLeft, divRight, divBottom);
        renderHeader(divHeader);
        renderOuvertOrScoreCards(divOuvert);
        renderStitch(divStitch);
        renderViewCards(divCards);
        renderSpecialSort(divSpecialSort);
        renderActions(divActions);
        renderGame(divGame);
        renderCopyright(divCopyright);
    };

    const renderUsername = (parent) => {
        if (!model.currentUser) {
            clearTicket();
            render();
            return;
        }
        document.title = `${_T("HEADER_SKAT")} - ${model.currentUser.name}`;
        if (model.skatTable) {
            renderMainPage(parent);
        }
        else {
            renderUserList(parent);
            if (model.allUsers.length < 3) {
                renderWaitForUsers(parent);
            }
            else {
                renderStartGame(parent);
            }
            renderCopyright(parent);
        }
    };

    const onStatistics = (parent, playerNames) => {
        const startYearElem = document.getElementById("result-statistics-startyear-id");
        if (!startYearElem || startYearElem.selectedOptions.length == 0) return;
        const startYear = startYearElem.selectedOptions[0].value;
        const token = utils.get_authentication_token();
        utils.fetch_api_call(`api/skat/statistics/${startYear}`,
            {
                method: "POST",
                headers: { "token": token, "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify(playerNames)
            },
            r => {
                if (utils.is_debug()) {
                    utils.debug("STATISTICS RETRIEVED.");
                    utils.debug(r);
                }
                const acc = { tournamentCount: r.tournaments, players: [] };
                r.statistics.forEach(m => acc.players[m.playerName] = m);
                renderStatistics(parent, acc, playerNames, startYear);
            },
            handleError);
    };

    const renderStatistics = (parent, acc, playerNames, startYear) => {
        controls.removeAllChildren(parent);
        const table = controls.create(parent, "table");
        controls.create(table, "caption", undefined, `${_T("INFO_TOURNAMENT_STATISTIC")} ${_T("TEXT_FROM")} ${startYear}`);
        const theader = controls.create(table, "thead");
        const tr = controls.create(theader, "tr");
        controls.create(tr, "th", undefined, _T("COLUMN_PLAYER"));
        controls.create(tr, "th", undefined, _T("COLUMN_TOURNAMENTS_WON"));
        controls.create(tr, "th", undefined, _T("COLUMN_GAMES_PLAYED"));
        controls.create(tr, "th", undefined, _T("COLUMN_GAMES_WON"));
        controls.create(tr, "th", undefined, _T("COLUMN_GAMES_LOST"));
        controls.create(tr, "th", undefined, _T("COLUMN_AVG_GAME_VALUE"));
        const tbody = controls.create(table, "tbody");
        let totalWon = 0;
        let totalLost = 0;
        let totalSumGameValue = 0;
        playerNames.sort((p1, p2) => {
            const data1 = acc.players[p1];
            const data2 = acc.players[p2];
            return data2.tournamentsWon - data1.tournamentsWon;
        });
        let pos = 1;
        let prevData;
        playerNames.forEach(playerName => {
            const data = acc.players[playerName];
            const gamesTotal = data.gamesWon + data.gamesLost;
            const gameAvgValue = gamesTotal > 0 ? data.sumGameValue / gamesTotal : 0;
            if (prevData && data.tournamentsWon < prevData.tournamentsWon) {
                pos++;
            }
            const tr = controls.create(tbody, "tr");
            controls.create(tr, "td", undefined, `${pos}. ${playerName}`);
            controls.create(tr, "td", undefined, `${data.tournamentsWon}`);
            controls.create(tr, "td", undefined, `${data.gamesWon + data.gamesLost}`);
            controls.create(tr, "td", undefined, `${data.gamesWon}`);
            controls.create(tr, "td", undefined, `${data.gamesLost}`);
            controls.create(tr, "td", undefined, `${gameAvgValue.toFixed(1)}`);
            totalWon += data.gamesWon;
            totalLost += data.gamesLost;
            totalSumGameValue += data.sumGameValue;
            prevData = data;
        });
        const total = totalWon + totalLost;
        const totalAvgGameValue = total > 0 ? totalSumGameValue / total : 0;
        const tfooter = controls.create(table, "tfoot");
        const trfoot = controls.create(tfooter, "tr");
        controls.create(trfoot, "td", undefined, _T("COLUMN_TOTAL"));
        controls.create(trfoot, "td", undefined, `${acc.tournamentCount}`);
        controls.create(trfoot, "td", undefined, `${total}`);
        controls.create(trfoot, "td", undefined, `${totalWon}`);
        controls.create(trfoot, "td", undefined, `${totalLost}`);
        controls.create(trfoot, "td", undefined, `${totalAvgGameValue.toFixed(1)}`);
        const p = controls.create(parent, "p");
        controls.createButton(p, _T("BUTTON_BACK"), () => onShowResults());
    };


    const renderResults = (results, skatadmin) => {
        disablePollState();
        controls.removeAllChildren(document.body);
        if (!showResultInWindow) {
            const backButtonDiv = controls.createDiv(document.body);
            controls.createButton(backButtonDiv, _T("BUTTON_BACK"), () => render());
        }
        let parent = document.body;
        if (results.length == 0) {
            controls.createLabel(parent, undefined, _T("INFO_MISSING_GAME_RESULTS"));            
            return;
        }
        const p = controls.create(parent, "p");
        p.id = "results-overview-id";
        const div = controls.createDiv(parent);
        const options = [];
        const fullYears = [];
        results.forEach((result,index) => {
            const started = new Date(result.startedUtc);
            if (!fullYears.includes(started.getFullYear())) {
                fullYears.unshift(started.getFullYear());
            }
            options.push({ name: utils.format_date(started), value: `${result.id}` });
            if (index === 0) {
                let token = utils.get_authentication_token();
                utils.fetch_api_call(`api/skat/resultbyid?id=${result.id}`, { headers: { "token": token } },
                    (result) => {
                        if (utils.is_debug()) {
                            utils.debug("RESULT RETRIEVED.");
                            utils.debug(result);
                        }
                        renderResultTable(div, result, true, fullYears);
                    },
                    handleError);                    
            }
        });
        const label = controls.createLabel(p, undefined, _T("INFO_GAMES_AT") + " ");
        label.htmlFor = "result-select-id";
        const select = controls.createSelect(p, "result-select-id", "result-select", options);
        const span = controls.createSpan(p);
        span.id = "result-caption-id";
        select.addEventListener("change", (elem) => {
            if (skatadmin) {
                const padmin = document.querySelector("#result-admin-id");
                controls.removeAllChildren(padmin);
                controls.createButton(padmin, _T("BUTTON_DELETE"), () => onDeleteSkatResult(true));
            }
            let token = utils.get_authentication_token();
            utils.fetch_api_call(`api/skat/resultbyid?id=${elem.target.value}`, { headers: { "token": token } },
                (result) => {
                    if (utils.is_debug()) {
                        utils.debug("RESULT RETRIEVED.");
                        utils.debug(result);
                    }
                    renderResultTable(div, result, true, fullYears);
                },
                handleError);                    
        });
        if (skatadmin) {
            const padmin = controls.createDiv(p);
            padmin.id = "result-admin-id";
            controls.createButton(padmin, _T("BUTTON_DELETE"), () => onDeleteSkatResult(true));
        }
    };

    const renderResult = (result) => {
        disablePollState();
        renderResultTable(document.body, result);
    };

    const renderResultTable = (parent, result, hideBackButton, fullYears) => {
        controls.removeAllChildren(parent);
        if (!hideBackButton && !showResultInWindow) {
            const backButtonDiv = controls.createDiv(parent);
            controls.createButton(backButtonDiv, _T("BUTTON_BACK"), () => render());
        }
        currentSkatResultId = result ? result.id : undefined;
        if (!result || !result.endedUtc) {
            controls.createLabel(parent, undefined, _T("INFO_TABLE_NOT_AVAILABLE"));
            return;
        }
        let started = new Date(result.startedUtc);
        let ended = new Date(result.endedUtc);
        let topt = { "hour": "numeric", "minute": "numeric" };
        let cnt = 1;
        let table = controls.create(parent, "table");
        const resultCaption = document.querySelector("#result-caption-id");
        if (resultCaption) {
            resultCaption.textContent = " " + _T("INFO_FROM_TO_1_2", utils.format_time(started, topt), utils.format_time(ended, topt));
        }
        else {
            const caption = _T("INFO_GAMES_AT_FROM_TO_1_2_3",
                utils.format_date(started), utils.format_time(started, topt), utils.format_time(ended, topt));
            controls.create(table, "caption", undefined, caption);
        }
        let theader = controls.create(table, "thead");
        let tr = controls.create(theader, "tr");
        controls.create(tr, "th", undefined, " ");
        controls.create(tr, "th", undefined, `${result.playerNames[0]}`);
        controls.create(tr, "th", undefined, `${result.playerNames[1]}`);
        controls.create(tr, "th", undefined, `${result.playerNames[2]}`);
        if (result.playerNames.length > 3) {
            controls.create(tr, "th", undefined, `${result.playerNames[3]}`);
        }
        controls.create(tr, "th", undefined, _T("TEXT_GAME"));
        let tbody = controls.create(table, "tbody");
        let scores = [0, 0, 0, 0];
        let playerWins = [0, 0, 0, 0];
        let playerLoss = [0, 0, 0, 0];
        let otherWins = [0, 0, 0, 0];
        result.history.forEach((h) => {
            let trClassName = (cnt > 1 && ((cnt - 1) % result.playerNames.length) == 0) ? "result-bordertop" : undefined;
            tr = controls.create(tbody, "tr", trClassName);
            controls.create(tr, "td", undefined, `${cnt}`);
            let idx = result.playerNames.findIndex((e) => e == h.gamePlayerName);
            scores[idx] += h.gameValue;
            let opponentPlayerNames = [];
            let opponentPlayerIndex = [];
            h.playerCards.forEach((pc) => {
                if (pc.playerName != h.gamePlayerName) {
                    opponentPlayerNames.push(pc.playerName);
                }
            });
            for (let col = 0; col < result.playerNames.length; col++) {
                let td = controls.create(tr, "td");
                if (col == idx) {
                    td.textContent = `${scores[idx]}`;
                }
                else {
                    if (opponentPlayerNames.includes(result.playerNames[col])) {
                        opponentPlayerIndex.push(col);
                        td.textContent = "-";
                    }
                    else {
                        td.textContent = " ";
                    }
                }
            }
            if (h.gameValue > 0) {
                playerWins[idx] += 1;
            }
            else if (h.gameValue < 0) {
                playerLoss[idx] += 1;
                otherWins[opponentPlayerIndex[0]] += 1;
                otherWins[opponentPlayerIndex[1]] += 1;
            }
            let tddetails = controls.create(tr, "td");
            controls.createA(tddetails, undefined, "#open", `${h.gameValue}`, () => renderGameHistory(parent, result, h));
            cnt++;
        });
        table = controls.create(parent, "table");
        controls.create(table, "caption", undefined, _T("TEXT_TOURNAMENT_SCORE"));
        theader = controls.create(table, "thead");
        tr = controls.create(theader, "tr");
        for (let idx = 0; idx < result.playerNames.length; idx++) {
            controls.create(tr, "th", undefined, `${result.playerNames[idx]}`);
        }
        tbody = controls.create(table, "tbody");
        tr = controls.create(tbody, "tr");
        let otherScore = result.playerNames.length == 4 ? 30 : 40;
        for (let idx = 0; idx < result.playerNames.length; idx++) {
            let points = scores[idx] + playerWins[idx] * 50 - playerLoss[idx] * 50 + otherWins[idx] * otherScore;
            let td = controls.create(tr, "td");
            controls.create(td, "div", undefined, `${scores[idx]}`);
            controls.create(td, "div", undefined, `+ ${playerWins[idx]} * 50`);
            controls.create(td, "div", undefined, `- ${playerLoss[idx]} * 50`);
            controls.create(td, "div", undefined, `+ ${otherWins[idx]} * ${otherScore}`);
            controls.create(td, "div", undefined, `= ${points}`);
        }
        if (!computerGame && currentUser && fullYears) {
            const statisticsDiv = controls.createDiv(parent);
            controls.createButton(statisticsDiv, _T("BUTTON_STATISTICS"), () => onStatistics(document.body, result.playerNames));
            const startYearOptions = fullYears.map(fullYear => { return { name: fullYear, value: fullYear }; });
            const startYearlabel = controls.createLabel(statisticsDiv, undefined, `${_T("TEXT_FROM")} `);
            startYearlabel.htmlFor = "result-statistics-startyear-id";
            const startYearSelect = controls.createSelect(statisticsDiv, "result-statistics-startyear-id", "result-select", startYearOptions);
            startYearSelect.addEventListener("change", () => onStatistics(document.body, result.playerNames));
        }
    };

    const renderGameHistory = (parent, result, gameHistory) => {
        disablePollState();
        const p = document.getElementById("results-overview-id");
        if (p) {
            p.style.display = "none";
        }
        controls.removeAllChildren(parent);
        if (!result) {
            const backButtonDiv = controls.createDiv(parent);
            controls.createButton(backButtonDiv, _T("BUTTON_BACK"), () => render());
        }
        if (!gameHistory) {
            controls.create(parent, "p", undefined, _T("INFO_GAME_HISTORY_NOT_AVAILABLE"));
            return;
        }
        let gameP = controls.create(parent, "p");
        if (gameHistory.gameValue == 0) {
            gameP.textContent = _T("INFO_ALL_PLAYER_PASS");
        }
        else {
            let txt = translateLabels(gameHistory.gameTextLabels);
            if (txt.length === 0) {
                txt = gameHistory.gameText;
            }
            gameP.textContent = _T("INFO_GAME_PLAYED_1_2_3_4", gameHistory.gamePlayerName, txt, gameHistory.gamePlayerScore, gameHistory.gameValue);
        }
        if (result) {
            let buttonDiv = controls.createDiv(parent);
            controls.createButton(buttonDiv, _T("BUTTON_BACK"), () => {
                if (p) {
                    p.style.display = "block";
                }
                renderResultTable(parent, result);
            });
        }
        controls.create(parent, "p", undefined, _T("LABEL_SKAT"));
        let divSkat = controls.createDiv(parent);
        renderCards(divSkat, true, gameHistory.skat, true, undefined, true);
        gameHistory.playerCards.forEach((pc) => {
            const labelCardsOf = pc.playerName == _T("TEXT_YOU") ? _T("LABEL_YOUR_CARDS") : _T("LABEL_CARDS_OF_1", pc.playerName);
            controls.create(parent, "p", undefined, labelCardsOf);
            let d = controls.createDiv(parent);
            renderCards(d, true, pc.cards, true, undefined, false);
        });
        controls.create(parent, "p", undefined, _T("LABEL_PUT_BACK"));
        let divBack = controls.createDiv(parent);
        renderCards(divBack, true, gameHistory.back, true, undefined, true);
        let cnt = 1;
        for (let idx = 0; idx <= gameHistory.played.length - 3; idx += 3) {
            let p1 = gameHistory.played[idx];
            let p2 = gameHistory.played[idx+1];
            let p3 = gameHistory.played[idx+2];
            controls.create(parent, "p", undefined, _T("LABEL_STITCH_1_2_3_4", cnt, p1.player, p2.player, p3.player));
            let divStitch = controls.createDiv(parent);
            renderCards(divStitch, true, [p1.card, p2.card, p3.card], true, undefined, true);
            cnt++;
        }
    };

    const renderModel = (m) => {
        model = m;
        if (computerGame && model) {
            computerInternalState = model.internalState;
            if (model.skatTable && model.skatTable.currentPlayer && model.skatTable.currentPlayer.name != getCurrentUsername()) {
                computerActionCount = 100;
            }
        }
        setState(model.state);
        controls.removeAllChildren(document.body);
        if (!embedded) {
            utils.create_cookies_banner(document.body);
        }
        setActive(false);
        if (model.allUsers.length == 0) {
            clearTicket();
        }
        divLayoutLeft = controls.createDiv(document.body, "layout-left");
        divMain = controls.createDiv(divLayoutLeft);
        if (!ticket && !computerGame) {
            if (guestMode) {
                document.title = `${_T("HEADER_SKAT")} - ${_T("INFO_GUEST_VIEW")}`;
                if (model.skatTable) {
                    renderMainPage(divMain);
                }
                else {
                    controls.create(divMain, "p", undefined, _T("INFO_NO_RUNNING_GAME"));
                    renderCopyright(divMain);
                }
            }
            else {
                renderReservations(document.body);
                renderUserList(divMain);
                if (model.allUsers.length > 3 || model.isTableFull) {
                    renderTableFull(divMain);
                }
                else {
                    renderLogin(divMain);
                    controls.createDiv(divMain, "error").id = "login-error-id";
                }
                renderCopyright(divMain);
            }
        }
        else {
            renderUsername(divMain);
        }
        enablePollState();
    };

    const fetchModel = (ticket) => {
        disablePollState();
        if (computerGame) {
            utils.fetch_api_call("api/skat/computer/model",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json" },
                    body: JSON.stringify({ CurrentPlayerName: getCurrentUsername(), InternalState: computerInternalState })
                },
                m => {
                    if (utils.is_debug()) {
                        utils.debug(`COMPUTER MODEL RETRIEVED (fetchModel).`);
                    }
                    renderModel(m);
                },
                handleError);
            return;
        }
        utils.fetch_api_call("api/skat/model", { headers: { "ticket": ticket } },
            (m) => {
                if (utils.is_debug()) {
                    utils.debug(`MODEL RETRIEVED (fetchModel). New state is ${m.state}`);
                    utils.debug(m);
                }
                renderModel(m);
            },
            handleError);
    };

    const login = (name) => {
        let token = utils.get_authentication_token();
        if (!name || name.length == 0 || !token) {
            utils.replace_window_location("/skat");
            return;
        }
        disablePollState();
        utils.fetch_api_call("api/skat/login",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify(name)
            },
            (loginModel) => {
                if (utils.is_debug()) {
                    utils.debug("LOGGED IN (login).");
                    utils.debug(loginModel);
                }
                if (loginModel && loginModel.ticket && loginModel.ticket.length > 0) {
                    setTicket(loginModel.ticket);
                }
                utils.replace_window_location("/skat");
            },
            (errMsg) => {
                handleError(errMsg);
                utils.replace_window_location("/skat");
            });
    };

    const render = () => {
        let params = new URLSearchParams(window.location.search);
        if (params.has("debug")) {
            utils.enable_debug(true);
            utils.debug("DEBUG enabled.");
        }
        if (params.has("embedded")) {
            embedded = true;
        }
        if (params.has("login")) {
            login(params.get("login"));
            return;
        }
        ticket = !computerGame ? getTicket() : undefined;
        if (params.has("result") || params.has("results")) {
            showResultInWindow = true;
            const parent = document.body;
            setActive(false);
            if (params.has("results")) {
                onShowResults();
            }
            else if (ticket) {
                onShowResult();
            }
            return;
        }
        if (params.has("admin")) {
            if (currentUser && currentUser.roles.includes("skatadmin")) {
                let parent = document.body;
                setActive(false);
                controls.removeAllChildren(parent);
                controls.create(parent, "p", undefined, _T("INFO_SKAT_ADMINISTRATION"));
                let p = controls.create(parent, "p");
                controls.createButton(p, _T("BUTTON_RESET"), () => onReset(p, true));
                controls.createButton(p, _T("BUTTON_TICKETS"), () => onShowTickets(p));
                controls.createButton(p, _T("BUTTON_GAME_RESULTS"), () => onShowResults());
            }
            else {
                utils.replace_window_location("/skat");
            }
            return;
        }
        if (params.has("guest")) {
            guestMode = true;
        }
        disablePollState();
        if (embedded && !computerGame) {
            onStartComputerGame();
            return;
        }
        fetchModel(ticket);
    };

    const renderInit = () => {
        window.requestAnimationFrame(draw);
        currentUser = undefined;
        let token = utils.get_authentication_token();
        if (!token) {
            render();
            return;
        }
        disablePollState();
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            (user) => {
                if (utils.is_debug()) {
                    utils.debug("USER RETRIEVED (renderInit).");
                    utils.debug(user);
                }
                currentUser = user;
                render();
            },
            (errmsg) => {
                console.error(_T(errmsg));
                utils.logout();
                render();
            });
    };

    // callbacks

    const onStartComputerGame = () => {
        computerGame = true;
        computerActionCount = 0;
        computerInternalState = undefined;
        skatengine.initComputerPlayModel(getCurrentUsername());
        disablePollState();
        utils.fetch_api_call("api/skat/computer/model",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ CurrentPlayerName: getCurrentUsername(), ComputerPlayerName1: _T("TEXT_COMPUTER_1"), ComputerPlayerName2: _T("TEXT_COMPUTER_2") })
            },
            m => {
                if (utils.is_debug()) {
                    utils.debug("COMPUTER MODEL RETRIEVED (onStartComputerGame).");
                }
                renderModel(m);
            },
            handleError);
    };

    const onComputerAction = () => {
        if (!computerGame || !computerInternalState || !model || !model.skatTable || !model.skatTable.currentPlayer) return;
        utils.fetch_api_call("api/skat/computer/model",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ CurrentPlayerName: model.skatTable.currentPlayer.name, InternalState: computerInternalState })
            },
            m => {
                if (utils.is_debug()) {
                    utils.debug("COMPUTER MODEL RETRIEVED (onComputerAction).");
                }
                if (!m.skatTable.gameStarted) {
                    if (!m.skatTable.gameEnded) {
                        if (m.skatTable.actions.length > 0) {
                            const idx = skatengine.getRandom(0, m.skatTable.actions.length - 1);
                            const action = m.skatTable.actions[idx].name;
                            utils.fetch_api_call("api/skat/computer/bid",
                                {
                                    method: "POST",
                                    headers: { "Accept": "application/json", "Content-Type": "application/json" },
                                    body: JSON.stringify({ Action: action, CurrentPlayerName: m.skatTable.currentPlayer.name, InternalState: m.internalState, IsHumanPlayer: false })
                                },
                                (internalState) => {
                                    if (utils.is_debug()) utils.debug("COMPUTER BID OR ACTION.");
                                    computerInternalState = internalState;
                                    render();
                                },
                                handleError);
                        }
                    }
                }
                else if (!m.skatTable.gameEnded) {
                    if (m.skatTable.canCollectStitch) {
                        skatengine.collectComputerPlayStitch(m.skatTable.currentPlayer.name);
                        utils.fetch_api_call("api/skat/computer/collectstitch",
                            {
                                method: "POST",
                                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                                body: JSON.stringify({ CurrentPlayerName: m.skatTable.currentPlayer.name, InternalState: m.internalState })
                            },
                            (internalState) => {
                                if (utils.is_debug()) utils.debug("COMPUTER COLLECT STITCH.");
                                computerInternalState = internalState;
                                render();
                            },
                            (errMsg) => handleError(errMsg));
                        return;
                    }
                    if (m.skatTable.playableCards.length > 0) {
                        const card = skatengine.chooseComputerPlayCard(m, m.skatTable.currentPlayer.name);
                        skatengine.storeComputerPlayCard(m, m.skatTable.currentPlayer.name, card);
                        utils.fetch_api_call("api/skat/computer/playcard",
                            {
                                method: "POST",
                                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                                body: JSON.stringify({ Card: card.orderNumber, CurrentPlayerName: m.skatTable.currentPlayer.name, InternalState: m.internalState })
                            },
                            (internalState) => {
                                if (utils.is_debug()) utils.debug("COMPUTER PLAY CARD.");
                                computerInternalState = internalState;
                                render();
                            },
                            (errMsg) => handleError(errMsg));
                    }
                }
            },
            handleError);
    };

    const onShowGameHistory = () => {
        if (!ticket) {
            if (computerInternalState) {
                utils.fetch_api_call("api/skat/computer/gamehistory",
                    {
                        method: "POST",
                        headers: { "Accept": "application/json", "Content-Type": "application/json" },
                        body: JSON.stringify({ InternalState: computerInternalState })
                    },
                    (gamehistory) => {
                        if (utils.is_debug()) {
                            utils.debug("COMPUTER GAME HISTORY RETRIEVED.");
                            utils.debug(gamehistory);
                        }
                        renderGameHistory(document.body, undefined, gamehistory);
                    },
                    handleError);
                return;
            }
        }
        else {
            utils.fetch_api_call("api/skat/gamehistory", { headers: { "ticket": ticket } },
                (gamehistory) => {
                    if (utils.is_debug()) {
                        utils.debug("GAME HISTORY RETRIEVED.");
                        utils.debug(gamehistory);
                    }
                    renderGameHistory(document.body, undefined, gamehistory);
                },
                handleError);
            return;
        }
    };

    const dispatchShowResult = () => {
        if (computerGame || utils.is_mobile()) {
            onShowResult();
        }
        else {
            window.open("/skat?result", "_blank");
        }
    };

    const onShowResult = () => {
        if (!ticket) {
            if (computerInternalState) {
                utils.fetch_api_call("api/skat/computer/result",
                    {
                        method: "POST",
                        headers: { "Accept": "application/json", "Content-Type": "application/json" },
                        body: JSON.stringify({ InternalState: computerInternalState })
                    },
                    (result) => {
                        if (utils.is_debug()) {
                            utils.debug("COMPUTER RESULT RETRIEVED (render).");
                            utils.debug(result);
                        }
                        renderResult(result);
                    },
                    handleError);
                return;
            }
        }
        else {
            utils.fetch_api_call("api/skat/result", { headers: { "ticket": ticket } },
                (result) => {
                    if (utils.is_debug()) {
                        utils.debug("RESULT RETRIEVED (render).");
                        utils.debug(result);
                    }
                    renderResult(result);
                },
                handleError);
            return;
        }
    };

    const dispatchShowResults = () => {
        if (computerGame || utils.is_mobile()) {
            onShowResults();
        }
        else {
            window.open("/skat?results", "_blank");
        }
    };
    
    const onShowResults = () => {
        if (currentUser) {
            let token = utils.get_authentication_token();
            utils.fetch_api_call("api/skat/results", { headers: { "token": token } },
                (results) => {
                    if (utils.is_debug()) {
                        utils.debug("RESULTS RETRIEVED (render).");
                        utils.debug(results);
                    }
                    renderResults(results, currentUser.roles.includes("skatadmin"));
                },
                handleError);
            return;
        }
    };

    const onUpdateHelp = (show) => {
        if (helpDiv) {
            helpDiv.className = show ? "help-div" : undefined;
            controls.removeAllChildren(helpDiv);
            if (show) {
                let contentDiv = controls.createDiv(helpDiv, "help-content");
                let mdDiv = controls.createDiv(contentDiv, "help-item");
                utils.fetch_api_call(`/api/pwdman/markdown/help-skat?locale=${utils.get_locale()}`, undefined,
                    (html) => {
                        if (utils.is_debug()) utils.debug("HELP RETRIEVED");
                        mdDiv.innerHTML = html;
                    }
                );
                controls.createButton(contentDiv, _T("BUTTON_OK"), () => onUpdateHelp(false)).focus();
            }
        }
    };

    const btnShowReservations_click = () => {
        disablePollState();
        utils.fetch_api_call("api/skat/reservation", undefined,
            (r) => {
                if (utils.is_debug()) {
                    utils.debug("RESERVATIONS RETRIEVED.");
                    utils.debug(r);
                }
                showReservations = true;
                reservations = r;
                render();
            },
            handleError);
    };

    const btnPreviousMonth_click = (calendarDiv, year, month) => {
        month -= 1;
        if (month < 0) {
            year -= 1;
            month = 11;
        }
        renderCalendar(calendarDiv, month, year);
    };

    const btnNextMonth_click = (calendarDiv, year, month) => {
        month += 1;
        if (month >= 12) {
            month = 0;
            year += 1;
        }
        renderCalendar(calendarDiv, month, year);
    };

    const btnReserve_click = (parent) => {
        disablePollState();
        controls.removeAllChildren(parent);
        let today = new Date();
        let div = controls.createDiv(parent);
        renderCalendar(div, today.getMonth(), today.getFullYear());
    };

    const btnLogin_click = () => {
        const name = inputUsername.value.trim();
        if (name.length > 0) {
            let token = utils.get_authentication_token();
            if (!token) {
                token = "";
            }
            disablePollState();
            utils.fetch_api_call("api/skat/login",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(name)
                },
                (loginModel) => {
                    if (utils.is_debug()) {
                        utils.debug("LOGGED IN (button).");
                        utils.debug(loginModel);
                    }
                    if (loginModel) {
                        if (loginModel.isAuthenticationRequired) {
                            const nexturl = `/skat?login=${name}`;
                            utils.set_window_location("/pwdman?nexturl=" + encodeURI(nexturl) + "&username=" + encodeURI(name));
                            return;
                        }
                        else if (loginModel.ticket && loginModel.ticket.length > 0) {
                            setTicket(loginModel.ticket);
                        }
                    }
                    render();
                },
                (errMsg) => {
                    document.getElementById("login-error-id").textContent = _T(errMsg);
                    enablePollState();
                });
        }
    };

    const btnStartGame_click = () => {
        if (computerGame) {
            skatengine.initComputerPlayModel(getCurrentUsername());
            utils.fetch_api_call("api/skat/computer/newgame",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json" },
                    body: JSON.stringify({ CurrentPlayerName: getCurrentUsername(), InternalState: computerInternalState })
                },
                (internalState) => {
                    if (utils.is_debug()) utils.debug("COMPUTER NEW GAME.");
                    computerInternalState = internalState;
                    render();
                },
                handleError);
            return;
        }
        disablePollState();
        utils.fetch_api_call("api/skat/newgame", { method: "POST", headers: { "ticket": ticket } },
            () => {
                if (utils.is_debug()) utils.debug("NEW GAME.");
                render();
            },
            handleError);
    };

    const btnConfirmStartGame_click = () => {
        if (computerGame) return;
        disablePollState();
        utils.fetch_api_call("api/skat/confirmstartgame", { method: "POST", headers: { "ticket": ticket } },
            () => {
                if (utils.is_debug()) utils.debug("CONFIRM START GAME.");
                render();
            },
            handleError);
    };

    const btnCancelConfirmStartGame_click = () => {
        if (computerGame) return;
        disablePollState();
        utils.fetch_api_call("api/skat/cancelconfirmstartgame", { method: "POST", headers: { "ticket": ticket } },
            () => {
                if (utils.is_debug()) utils.debug("CANCEL CONFIRM START GAME.");
                render();
            },
            handleError);
    };

    const btnGiveUp_click = (elem) => {
        if (computerGame) return;
        if (elem.value == "GiveUpYes") {
            disablePollState();
            utils.fetch_api_call("api/skat/giveup", { method: "POST", headers: { "ticket": ticket } },
                () => {
                    if (utils.is_debug()) utils.debug("GAVE UP.");
                    giveUpClicked = false;
                    render();
                },
                handleError);
        }
        else if (elem.value == "GiveUpNo") {
            giveUpClicked = false;
            render();
        }
        else {
            giveUpClicked = true;
            render();
        }
    };

    const btnSpeedUp_click = (elem) => {
        if (computerGame) return;
        if (elem.value == "SpeedUpYes") {
            disablePollState();
            utils.fetch_api_call("api/skat/speedup", { method: "POST", headers: { "ticket": ticket } },
                () => {
                    if (utils.is_debug()) utils.debug("SPEED UP.");
                    speedUpClicked = false;
                    render();
                },
                handleError);
        }
        else if (elem.value == "SpeedUpNo") {
            speedUpClicked = false;
            render();
        }
        else {
            speedUpClicked = true;
            render();
        }
    };

    const btnSpeedUpConfirm_click = () => {
        if (computerGame) return;
        disablePollState();
        utils.fetch_api_call("api/skat/confirmspeedup", { method: "POST", headers: { "ticket": ticket } },
            () => {
                if (utils.is_debug()) utils.debug("SPEED UP CONFIRMED.");
                render();
            },
            handleError);
    };

    const btnContinuePlay_click = () => {
        if (computerGame) return;
        disablePollState();
        utils.fetch_api_call("api/skat/continueplay", { method: "POST", headers: { "ticket": ticket } },
            () => {
                if (utils.is_debug()) utils.debug("CONTINUE PLAY.");
                render();
            },
            handleError);
    };

    const btnGameType_click = (elem) => {
        let gamecolor;
        let gametype = "Color";
        if (elem.value == "Grand") {
            gametype = "Grand";
        }
        else if (elem.value == "Null") {
            gametype = "Null";
        }
        else {
            gamecolor = elem.value;
        }
        if (computerGame) {
            utils.fetch_api_call("api/skat/computer/game",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json" },
                    body: JSON.stringify({ GameModel: { Type: gametype, Color: gamecolor }, CurrentPlayerName: getCurrentUsername(), InternalState: computerInternalState })
                },
                (internalState) => {
                    if (utils.is_debug()) utils.debug("COMPUTER CHANGED GAME.");
                    computerInternalState = internalState;
                    render();
                },
                handleError);
            return;
        }
        disablePollState();
        utils.fetch_api_call("api/skat/game",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                body: JSON.stringify({ "Type": gametype, "Color": gamecolor })
            },
            () => {
                if (utils.is_debug()) utils.debug("CHANGED GAME.");
                render();
            },
            handleError);
    };

    const btnGameOption_click = () => {
        if (computerGame) {
            utils.fetch_api_call("api/skat/computer/gameoption",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify(
                {
                    GameOptionModel:
                    {
                        ouvert: checkBoxOuvert.checked,
                        hand: checkBoxHand.checked,
                        schneider: checkBoxSchneider.checked,
                        schwarz: checkBoxSchwarz.checked
                    },
                    CurrentPlayerName: getCurrentUsername(),
                    InternalState: computerInternalState
                })
            },
            (internalState) => {
                if (utils.is_debug()) utils.debug("COMPUTER CHANGED GAME OPTION.");
                computerInternalState = internalState;
                render();
            },
            handleError);
            return;
        }
        disablePollState();
        utils.fetch_api_call("api/skat/gameoption",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                body: JSON.stringify({
                    "ouvert": checkBoxOuvert.checked,
                    "hand": checkBoxHand.checked,
                    "schneider": checkBoxSchneider.checked,
                    "schwarz": checkBoxSchwarz.checked
                })
            },
            () => {
                if (utils.is_debug()) utils.debug("CHANGED GAME OPTION.");
                render();
            },
            handleError);
    };

    const btnAction_click = (elem) => {
        let action = elem.value;
        if (action == "StartGame") {
            letsStartClicked = true;
            render();
        }
        else {
            if (computerGame) {
                utils.fetch_api_call("api/skat/computer/bid",
                    {
                        method: "POST",
                        headers: { "Accept": "application/json", "Content-Type": "application/json" },
                        body: JSON.stringify({ Action: action, CurrentPlayerName: getCurrentUsername(), InternalState: computerInternalState, IsHumanPlayer: true })
                    },
                    (internalState) => {
                        if (utils.is_debug()) utils.debug("COMPUTER BID (btnAction_click).");
                        computerInternalState = internalState;
                        render();
                    },
                    handleError);
                return;
            }
            disablePollState();
            utils.fetch_api_call("api/skat/bid",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                    body: JSON.stringify(action)
                },
                () => {
                    if (utils.is_debug()) utils.debug("BID.");
                    render();
                },
                handleError);
        }
    };

    const btnPlayerCard_click = (card) => {
        if (!model.skatTable.player ||
            model.skatTable.currentPlayer && model.skatTable.player.name != model.skatTable.currentPlayer.name ||
            !card ||
            showLastStitch ||
            model.skatTable.isSpeedUp) return;
        let found = false;
        model.skatTable.playableCards.forEach(c => {
            if (c.orderNumber == card.orderNumber) {
                found = true;
            }
        });
        if (!found) return;
        document.body.style.cursor = "wait";
        if (computerGame) {
            skatengine.storeComputerPlayCard(model, getCurrentUsername(), card);
            utils.fetch_api_call("api/skat/computer/playcard",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json" },
                    body: JSON.stringify({ Card: card.orderNumber, CurrentPlayerName: getCurrentUsername(), InternalState: computerInternalState })
                },
                (internalState) => {
                    if (utils.is_debug()) utils.debug("COMPUTER PLAY CARD (btnPlayerCard_click).");
                    computerInternalState = internalState;
                    render();
                    document.body.style.cursor = "default";
                },
                (errMsg) => {
                    handleError(errMsg);
                    document.body.style.cursor = "default";
                });
            return;
        }
        disablePollState();
        utils.fetch_api_call("api/skat/playcard",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                body: JSON.stringify(card.orderNumber)
            },
            () => {
                if (utils.is_debug()) utils.debug("PLAY CARD.");
                render();
                document.body.style.cursor = "default";
            },
            (errMsg) => {
                handleError(errMsg);
                document.body.style.cursor = "default";
            });
    };

    const btnSkatCard_click = (card) => {
        if (!model.skatTable.player || !card || showLastStitch || !model.skatTable.canPickupSkat) return;
        if (computerGame) {
            utils.fetch_api_call("api/skat/computer/pickupskat",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json" },
                    body: JSON.stringify({ Card: card.orderNumber, CurrentPlayerName: getCurrentUsername(), InternalState: computerInternalState })
                },
                (internalState) => {
                    if (utils.is_debug()) utils.debug("COMPUTER PICKUP SKAT (btnSkatCard_click).");
                    computerInternalState = internalState;
                    render();
                },
                handleError);
            return;
        }
        disablePollState();
        utils.fetch_api_call("api/skat/pickupskat",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                body: JSON.stringify(card.orderNumber)
            },
            () => {
                if (utils.is_debug()) utils.debug("PICKUP SKAT.");
                render();
            },
            handleError);
    };

    const btnLastStitchCard_click = () => {
        showLastStitch = !showLastStitch;
        render();
    };

    const btnStitchCard_click = () => {
        if (!model.skatTable.player ||
            showLastStitch ||
            !model.skatTable.canCollectStitch ||
            model.skatTable.isSpeedUp) return;
        disablePollState();
        document.body.style.cursor = "wait";
        if (computerGame) {
            skatengine.collectComputerPlayStitch(getCurrentUsername());
            utils.fetch_api_call("api/skat/computer/collectstitch",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json" },
                    body: JSON.stringify({ CurrentPlayerName: getCurrentUsername(), InternalState: computerInternalState })
                },
                (internalState) => {
                    if (utils.is_debug()) utils.debug("COMPUTER COLLECT STITCH (btnStitchCard_click).");
                    computerInternalState = internalState;
                    render();
                    document.body.style.cursor = "default";
                },
                (errMsg) => {
                    handleError(errMsg);
                    document.body.style.cursor = "default";
                });
            return;
        }
        utils.fetch_api_call("api/skat/collectstitch", { method: "POST", headers: { "ticket": ticket } },
            () => {
                if (utils.is_debug()) utils.debug("COLLECT STITCH.");
                render();
                document.body.style.cursor = "default";
            },
            (errMsg) => {
                handleError(errMsg);
                document.body.style.cursor = "default";
            });
    };

    const btnLogout_click = (elem) => {
        if (elem.value == "LogoutYes" || !model.skatTable) {
            if (computerGame) {
                logoutClicked = false;
                computerGame = false;
                computerInternalState = undefined;
                computerActionCount = 0;
                render();
                return;
            }
            disablePollState();
            utils.fetch_api_call("api/skat/logout", { method: "POST", headers: { "ticket": ticket } },
                () => {
                    if (utils.is_debug()) utils.debug("LOGOUT (button).");
                    logoutClicked = false;
                    ticket = undefined;
                    utils.logout_skat(() => render());
                },
                handleError);
        }
        else if (elem.value == "LogoutNo") {
            logoutClicked = false;
            render();
        }
        else {
            logoutClicked = true;
            render();
        }
    };

    const btnLetsStart_click = (elem) => {
        if (elem.value == "LetsStartYes") {
            if (computerGame) {
                utils.fetch_api_call("api/skat/computer/bid",
                    {
                        method: "POST",
                        headers: { "Accept": "application/json", "Content-Type": "application/json" },
                        body: JSON.stringify({ Action: "StartGame", CurrentPlayerName: getCurrentUsername(), InternalState: computerInternalState, IsHumanPlayer: true })
                    },
                    (internalState) => {
                        if (utils.is_debug()) utils.debug("COMPUTER BID (start game).");
                        letsStartClicked = false;
                        computerInternalState = internalState;
                        render();
                    },
                    handleError);
                return;
            }
            disablePollState();
            utils.fetch_api_call("api/skat/bid",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                    body: JSON.stringify("StartGame")
                },
                () => {
                    if (utils.is_debug()) utils.debug("BID (start game).");
                    letsStartClicked = false;
                    render();
                },
                handleError);
        }
        else if (elem.value == "LetsStartNo") {
            letsStartClicked = false;
            render();
        }
    };

    const btnSpecialSortOption_click = () => {
        specialSortOption = !specialSortOption;
        render();
    };

    const onDeleteSkatResult = (confirm) => {
        const parent = document.querySelector("#result-admin-id");
        if (!currentSkatResultId || !parent) return;
        if (confirm) {
            controls.removeAllChildren(parent);
            controls.create(parent, "p", "confirmation", _T("INFO_REALLY_DELETE_TABLE"));
            controls.createButton(parent, _T("BUTTON_YES"), () => onDeleteSkatResult(false));
            controls.createButton(parent, _T("BUTTON_NO"), () => onShowResults());
            return;
        }
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/skat/resultbyid",
            {
                method: "DELETE",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify(currentSkatResultId)
            },
            () => {
                if (utils.is_debug()) utils.debug("SKAT RESULT DELETED.");
                onShowResults();
            },
            handleError);
    };

    const onReset = (parent, confirm) => {
        if (confirm) {
            controls.removeAllChildren(parent);
            controls.create(parent, "p", "confirmation", _T("INFO_REALLY_RESET"));
            controls.createButton(parent, _T("BUTTON_YES"), () => onReset(parent, false));
            controls.createButton(parent, _T("BUTTON_NO"), () => utils.replace_window_location("/skat?admin"));
            return;
        }
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/skat/reset", { headers: { "token": token } },
            () => {
                if (utils.is_debug()) utils.debug("SKAT RESET.");
                utils.replace_window_location("/skat?admin");
            },
            handleError);
    };

    const onShowTickets = (parent) => {
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/skat/tickets", { headers: { "token": token } },
            (tickets) => {
                if (utils.is_debug()) {
                    utils.debug("TICKETS RETRIEVED.");
                    utils.debug(tickets);
                }
                controls.removeAllChildren(parent);
                controls.create(parent, "p", undefined, _T("LABEL_TICKETS"));
                tickets.forEach(ticket => {
                    controls.create(parent, "p", undefined, ticket);
                });
                controls.createButton(parent, "OK", () => utils.replace_window_location("/skat?admin"));
            },
            handleError);
    };

    const sleep = (interval) => new Promise(r => setTimeout(r, interval));

    const pollState = async () => {
        try {
            if (!pollStateEnabled || computerGame) {
                if (utils.is_debug()) utils.debug("Poll state disabled or computer game. Retry in 1 second.");
                await sleep(1000);
                await pollState();
            } else {
                if (utils.is_debug()) utils.debug("Poll state (up to 1 minute).");
                let clientstate = getState();
                if (clientstate == undefined) {
                    clientstate = 0;
                }
                const response = await fetch(`/api/skat/longpollstate/${clientstate}`);
                if (response.status != 200) {
                    const jsonError = await response.json();
                    console.error(`Poll state error: ${jsonError.title} Retry in 5 seconds.`);
                    await sleep(5000);
                    await pollState();
                } else {
                    const serverState = await response.json();
                    if (utils.is_debug()) utils.debug(`Received server state ${serverState}.`);
                    if (pollStateEnabled && serverState > clientstate) {
                        if (utils.is_debug()) utils.debug("State has changed. Rerender.");
                        setState(serverState);
                        render();
                    }
                    await pollState();
                }
            }
        } catch (err) {
            console.error(`Poll state error: ${err} Retry in 10 seconds.`);
            await sleep(10000);
            await pollState();
        }
    };

    // --- public API

    return {
        renderInit: renderInit,
        pollState: pollState
    };
})();

window.onload = () => {
    skat.pollState();
    utils.auth_lltoken(() => utils.set_locale(skat.renderInit));
};

window.onclick = (event) => utils.hide_menu(event);