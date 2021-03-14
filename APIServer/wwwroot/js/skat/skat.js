"use strict";

var skat = (() => {

    // UI elements

    let inputUsername;
    let divMain;
    let checkBoxOuvert;
    let checkBoxHand;
    let checkBoxSchneider;
    let checkBoxSchwarz;
    let divChat;
    let divLayoutLeft;
    let inputChatText;

    // state

    let ticket;
    let model;
    let chatModel;
    let timerEnabled = false;
    let showLastStitch = false;
    let giveUpClicked = false;
    let speedUpClicked = false;
    let logoutClicked = false;
    let letsStartClicked = false;
    let specialSortOption = true;
    let showChat = false;
    let showReservations = false;
    let lastChatText = "";
    let currentSkatResultId;

    let imgHeight = 140;
    let imgWidth = 90;

    let currentUser;
    let photos = {};
    let guestMode = false;
    let reservations;

    let version = "1.3.11";

    // helper

    const handleError = (err) => {
        console.error(err);
        controls.clearState();
        timerEnabled = true;
    }

    const clearTicket = () => {
        ticket = undefined;
        sessionStorage.removeItem("ticket");
        localStorage.removeItem("ticket");
    };

    const setTicket = (t) => {
        ticket = t;
        sessionStorage.setItem("ticket", t);
        localStorage.setItem("ticket", t);
    };

    const getTicket = () => {
        let t = sessionStorage.getItem("ticket");
        if (!t) {
            t = localStorage.getItem("ticket");
        }
        return t;
    }

    const getCardImage = (card) => {
        let str = card.orderNumber.toString();
        if (str.length == 1) {
            str = "0" + str;
        }
        return `images/skat/${str}.gif`;
    };

    const getNextPlayer = (player) => {
        if (player) {
            for (let idx = 0; idx < model.skatTable.players.length; idx++) {
                if (player.name == model.skatTable.players[idx].name) {
                    player = model.skatTable.players[(idx + 1) % model.skatTable.players.length];
                    if (model.skatTable.inactivePlayer && player.name == model.skatTable.inactivePlayer.name) {
                        player = model.skatTable.players[(idx + 2) % model.skatTable.players.length];
                    }
                    return player;
                }
            }
        }
        return undefined;
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

    const isTrump = (game, card) => {
        return game.type != "Null" &&
            (card.value == "Jack" ||
                (game.type != "Grand" && card.color == game.color));
    };

    const findFirstNonTrump = (game, cards) => {
        for (let idx = 0; idx < cards.length; idx++) {
            if (!isTrump(game, cards[idx])) {
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
        let trumpColor = undefined;
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
    }

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
                    availableHours.delete(hour + duration)
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
    }

    // rendering

    const renderDropdown = (parent) => {
        let dropdownDiv = controls.create(parent, "div", "dropdown");
        let dropdownButton = controls.createImg(dropdownDiv, "dropbtn", 24, 24, "/images/skat/hamburger.svg");
        dropdownButton.addEventListener("click", () => {
            document.getElementById("dropdown-id").classList.toggle("show");
        });
        let dropdownContentDiv = controls.create(dropdownDiv, "div", "dropdown-content");
        dropdownContentDiv.id = "dropdown-id";
    };

    const renderDropdownContent = () => {
        let parent = document.getElementById("dropdown-id");
        if (!parent) return;
        controls.removeAllChildren(parent);
        controls.createA(parent, undefined, "/slideshow", "Bildergalerie");
        controls.createA(parent, undefined, "/notes", "Notizen");
        controls.createA(parent, undefined, "/diary", "Tagebuch");
        controls.createA(parent, undefined, "/tetris", "Tetris");
        if (currentUser) {
            controls.create(parent, "hr");
            controls.createA(parent, undefined, "/usermgmt", "Profil");
            controls.createA(parent, undefined, "/usermgmt?logout", "Abmelden");
        }
        controls.create(parent, "hr");
        controls.createA(parent, undefined, "/downloads", "Downloads");
        controls.createA(parent, undefined, "/impressum", "Impressum");
    };

    const renderTableFull = (parent, ignoreToken) => {
        if (ignoreToken || !currentUser) {
            controls.create(parent, "p", undefined, "Der Tisch ist leider schon voll!");
            controls.createButton(parent, "Zuschauen als Gast", () => window.open("/skat?guest", "_blank"));
            document.body.className = "inactive-background";
        }
        else {
            let divParent = controls.createDiv(parent);
            model.allUsers.forEach((skatuser) => {
                if (skatuser.name == currentUser.name) {
                    window.location.href = `skat?login=${encodeURI(currentUser.name)}`;
                    return;
                }
            });
            renderTableFull(divParent, true);
        }
    };

    const renderUserList = (parent) => {
        renderDropdown(parent);
        let title = currentUser ? `${currentUser.name} - Skat` : "Skat";
        controls.create(parent, "h1", undefined, title);
        if (currentUser && currentUser.photo) {
            let imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo);
            imgPhoto.title = "Profil";
            imgPhoto.addEventListener("click", () => window.location.href = "/usermgmt");
        }
        let divInfoImages = controls.createDiv(parent, "infoimages");
        controls.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/28.gif");
        controls.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/20.gif");
        controls.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/12.gif");
        controls.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/04.gif");
        if (model.allUsers.length > 0) {
            controls.create(parent, "p", undefined, "Es sind folgende Spieler am Tisch:");
            let ul = controls.create(parent, "ul");
            let idx = 1;
            model.allUsers.forEach((user) => {
                let li = controls.create(ul, "li");
                let img = controls.createImg(li, "player-img", 45, 45);
                let photo = photos[user.name.toLowerCase()];
                if (!photo) {
                    photo = `/images/skat/profiles/default${idx}.png`;
                    photos[user.name.toLowerCase()] = photo;
                    img.src = photo;
                    utils.fetch_api_call(`/api/pwdman/photo?username=${encodeURI(user.name)}`, undefined,
                        (p) => {
                            if (p) {
                                photos[user.name.toLowerCase()] = p;
                                img.src = p;
                            }
                        },
                        (errMsg) => console.error(errMsg));
                }
                else {
                    img.src = photo;
                }
                controls.create(li, "span", undefined, user.name).style.marginLeft = "10pt";
                idx++;
            });
        }
        renderDropdownContent();
    };

    const renderReservations = (parent) => {
        if (!showReservations || !reservations) return;
        let divReservations = controls.createDiv(parent, "layout-reservations");
        let divPage = controls.createDiv(divReservations);
        let divHeader = controls.createDiv(divPage, "reservation-header")
        divHeader.textContent = "Tischreservierungen";
        if (currentUser) {
            let imgAdd = controls.createImg(divHeader, "reservation-img", 32, 32, "/images/skat/list-add-4.png");
            imgAdd.title = "Reservierung hinzuf\u00FCgen";
            imgAdd.addEventListener("click", () => btnReserve_click(divReservations));
        }
        reservations.forEach(r => {
            let dd = new Date(r.reservedUtc);
            let daystr = dd.toLocaleDateString("de-DE", { "month": "numeric", "day": "numeric" });
            let h = dd.getHours() + r.duration / 60;
            let txt = `${daystr} ${dd.getHours()}-${h} ${r.players.join(", ")}`;
            let divReservation = controls.create(divPage, "p", undefined, txt);
            if (currentUser && (currentUser.name == r.reservedBy || currentUser.roles.includes("skatadmin"))) {
                let imgRemove = controls.createImg(divReservation, "reservation-img", 32, 32, "/images/skat/list-remove-4.png");
                imgRemove.title = "Reservierung entfernen";
                imgRemove.id = `imgremove-${r.id}`;
                imgRemove.addEventListener("click", (elem) => {
                    const reservationId = elem.target.id.substring(10);
                    let token = utils.get_authentication_token();
                    utils.fetch_api_call("api/skat/reservation",
                        {
                            method: "DELETE",
                            headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                            body: JSON.stringify(reservationId)
                        },
                        () => btnShowReservations_click(),
                        handleError);
                });
            }
        });
        controls.createButton(divPage, "OK", () => {
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
        controls.createSpan(caption, undefined,
            date.toLocaleDateString("de-DE", { year: "numeric", month: "long" }));
        if (today.getMonth() < month) {
            controls.createImageButton(caption, "Vorheriger Monat",
                () => btnPreviousMonth_click(parent, year, month),
                "/images/skat/arrow-left-2.png", 16, "reservation-transparent");
        }
        if (today.getMonth() == month) {
            controls.createImageButton(caption, "N\u00E4chster Monat",
                () => btnNextMonth_click(parent, year, month),
                "/images/skat/arrow-right-2.png", 16, "reservation-transparent");
        }
        let theader = controls.create(table, "thead");
        let tr = controls.create(theader, "tr");
        let th = controls.create(tr, "th", undefined, "Mo");
        th.title = "Montag";
        th = controls.create(tr, "th", undefined, "Di");
        th.title = "Dienstag";
        th = controls.create(tr, "th", undefined, "Mi");
        th.title = "Mittwoch";
        th = controls.create(tr, "th", undefined, "Do");
        th.title = "Donnerstag";
        th = controls.create(tr, "th", undefined, "Fr");
        th.title = "Freitag";
        th = controls.create(tr, "th", undefined, "Sa");
        th.title = "Samstag";
        th = controls.create(tr, "th", undefined, "So");
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
                    let msg = `${day}`;
                    if (isToday) {
                        msg += "*";
                    }
                    if (month == today.getMonth() && day < today.getDate()) {
                        controls.createSpan(td, undefined, msg);
                    }
                    else {
                        let d = day;
                        controls.createA(td, undefined, "#open", msg, () => renderAddReservation(parent, d, month, year));
                    }
                    day++;
                }
            }
        }
        controls.createButton(parent, "Zur\u00FCck", () => render());
    };

    const renderAddReservation = (parent, day, month, year) => {
        controls.removeAllChildren(parent);
        let dd = new Date(Date.UTC(year, month, day));
        let dt = dd.toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
        let captionDiv = controls.createDiv(parent, "reservation-calendar-caption");
        captionDiv.textContent = `${dt}`;
        let freeTimes = getFreeReservationTimes(dd);
        let options = [];
        Object.keys(freeTimes).forEach(h => {
            options.push({ name: `${h} Uhr`, value: `${h}` });
        });
        let timeDiv = controls.createDiv(parent);
        let timeLabel = controls.createLabel(timeDiv, "reservation-label", "Uhrzeit:");
        timeLabel.htmlFor = "reservation-hour-id";
        let selectHour = controls.createSelect(timeDiv, "reservation-hour-id", "reservation-select", options);
        selectHour.value = undefined;
        let durationDiv = controls.createDiv(parent);
        let durationLabel = controls.createLabel(durationDiv, "reservation-label", "Dauer:");
        durationLabel.htmlFor = "reservation-duration-id";
        let selectDuration = controls.createSelect(durationDiv, "reservation-duration-id", "reservation-select", []);
        selectHour.addEventListener("change", (elem) => {
            controls.removeAllChildren(selectDuration);
            let durations = freeTimes[elem.target.value];
            if (durations) {
                let option;
                durations.forEach(duration => {
                    let txt = `${duration} Stunde`;
                    if (duration > 1) {
                        txt += "n";
                    }
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
            let playerLabel = controls.createLabel(playerDiv, "reservation-label", `Spieler ${playerIdx}:`);
            playerLabel.htmlFor = `reservation-player${playerIdx}-id`;
            let playerInput = controls.createInputField(playerDiv, `Spieler ${playerIdx}`, undefined, "reservation-input", 20, 32);
            playerInput.id = `reservation-player${playerIdx}-id`;
            if (playerIdx == 1) {
                playerInput.value = currentUser.name;
                playerInput.disabled = true;
            }
        }
        controls.createButton(parent, "Reservieren", () => {
            let token = utils.get_authentication_token();
            let r = {};
            let hour = document.getElementById("reservation-hour-id").value;
            let reservedUtc = new Date(year, month, day, hour);
            r.reservedUtc = reservedUtc;
            r.duration = document.getElementById("reservation-duration-id").value * 60;
            r.players = [];
            for (let idx = 1; idx <= 4; idx++) {
                let val = document.getElementById(`reservation-player${idx}-id`).value
                if (val && val.length > 0) {
                    r.players.push(val);
                }
            }
            utils.fetch_api_call("api/skat/reservation",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(r)
                },
                () => btnShowReservations_click(),
                (errMsg) => document.getElementById("reserve-error-id").textContent = errMsg);
        });
        controls.createButton(parent, "Zur\u00FCck", () => renderCalendar(parent, month, year));
        controls.createDiv(parent, "error").id = "reserve-error-id";
    };

    const renderLogin = (parent) => {
        document.body.className = "active-background";
        if (!currentUser) {
            controls.create(parent, "p", undefined, "Du kannst noch mitspielen! Wie ist Dein Name?");
            let label = controls.createLabel(parent, undefined, "Name:");
            label.htmlFor = "username-id";
            inputUsername = controls.createInputField(parent, "Name", btnLogin_click, "username-input", 20, 32);
            inputUsername.placeholder = "Name";
            inputUsername.id = "username-id";
            if (!utils.is_mobile()) {
                inputUsername.focus();
            }
            controls.createButton(parent, "Anmelden", btnLogin_click);
            let p = controls.create(parent, "p", undefined, "Du hast noch kein Konto? Hier kannst Du dich registrieren. ");
            controls.createButton(p, "Registrieren", () => {
                window.location.href = "/pwdman?register&nexturl=" + encodeURI(window.location.href);
            });
            if (!showReservations) {
                controls.createButton(parent, "Reservierungen", () => btnShowReservations_click());
            }
        }
        else {
            let parentdiv = controls.create(parent, "p");
            controls.create(parentdiv, "p", undefined, `${currentUser.name}! Du kannst noch mitspielen!`);
            inputUsername = controls.createInputField(parentdiv, "Name", btnLogin_click, "hide", 20, 32);
            inputUsername.value = currentUser.name;
            controls.createButton(parentdiv, "Mitspielen", btnLogin_click);
            if (!showReservations) {
                controls.createButton(parent, "Reservierungen", () => btnShowReservations_click());
            }
        }
    };

    const renderWaitForUsers = (parent) => {
        controls.create(parent, "p", "activity", "Du musst warten, bis alle angemeldet sind.");
        document.body.className = "inactive-background";
    };

    const renderStartGame = (parent) => {
        if (model.allUsers.length < 4) {
            controls.create(parent, "p", undefined, "Warte auf einen vierten Spieler oder starte das Spiel zu dritt!");
        }
        else {
            controls.create(parent, "p", undefined, "Alle sind angemeldet! Starte das Spiel!");
        }
        controls.createButton(parent, "Spiel starten", btnStartGame_click);
        document.body.className = "active-background";
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
                img.title = card.description;
                if (action) {
                    img.addEventListener("click", e => action(card));
                }
            }
            else {
                img.title = "Skat";
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
                        controls.createImg(parent, "card-img", imgWidth, imgHeight, "/images/skat/empty.png");
                    }
                }
                else {
                    renderCards(parent, true, model.skatTable.stitch, true, btnStitchCard_click);
                }
            }
        }
    }

    const renderLastStitch = (parent) => {
        if (!model.skatTable.gameStarted || !model.skatTable.lastStitch || !showLastStitch) return;
        if (model.skatTable.lastStitch.length > 0) {
            renderCards(parent, true, model.skatTable.lastStitch, true, btnLastStitchCard_click);
        }
    }

    const renderSkat = (parent) => {
        if (model.skatTable.gameStarted) return;
        if (!model.skatTable.canPickupSkat) {
            renderCards(parent, false, [1, 1], false);
        }
        else {
            if (model.skatTable.skat.length == 0) {
                if (!model.skatTable.gameEnded) {
                    controls.createImg(parent, "card-img", imgWidth, imgHeight, "/images/skat/empty.png");
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
            controls.createButton(parent, "Letzten Stich zur\u00FCcklegen", btnLastStitchCard_click, "StopViewLastStitch");
        }
        else if (giveUpClicked) {
            controls.create(parent, "span", "confirmation", "Willst Du wirklich aufgeben?");
            controls.createButton(parent, "Ja", btnGiveUp_click, "GiveUpYes");
            controls.createButton(parent, "Nein", btnGiveUp_click, "GiveUpNo");
            active = true;
        }
        else if (speedUpClicked) {
            controls.create(parent, "span", "confirmation", "Willst Du wirklich abk\u00FCrzen?");
            controls.createButton(parent, "Ja", btnSpeedUp_click, "SpeedUpYes");
            controls.createButton(parent, "Nein", btnSpeedUp_click, "SpeedUpNo");
            active = true;
        }
        else if (logoutClicked) {
            controls.create(parent, "span", "confirmation", "Willst Du den Tisch wirklich verlassen?");
            controls.createButton(parent, "Ja", btnLogout_click, "LogoutYes");
            controls.createButton(parent, "Nein", btnLogout_click, "LogoutNo");
            active = true;
        }
        else if (letsStartClicked && model.skatTable.player) {
            controls.create(parent, "span", "confirmation", `Willst Du Dich wirklich ${model.skatTable.player.game.description} spielen?`);
            controls.createButton(parent, "Ja", btnLetsStart_click, "LetsStartYes");
            controls.createButton(parent, "Nein", btnLetsStart_click, "LetsStartNo");
            active = true;
        }
        else {
            if (model.skatTable.canStartNewGame && model.currentUser) {
                if (!model.currentUser.startGameConfirmed) {
                    if (model.skatTable.player) {
                        controls.createButton(parent, "OK", btnConfirmStartGame_click, "ConfirmStartGame");
                    }
                    controls.createButton(parent, "Spielverlauf", () => window.open(`${window.location.href}?gamehistory`, "_blank"));
                    controls.createButton(parent, "Tabelle", () => window.open(`${window.location.href}?result`, "_blank"));
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
                        controls.createButton(parent, "Neues Spiel", btnStartGame_click, "StartGame");
                        active = true;
                    }
                    else {
                        controls.create(parent, "p", undefined, "Du wartest auf die Best\u00E4tigung Deiner Mitspieler.");
                        document.body.className = "inactive-background";
                    }
                }
            }
            if (!model.skatTable.isSpeedUp) {
                if (model.skatTable.canCollectStitch) {
                    controls.createButton(parent, "Stich einsammeln", btnStitchCard_click, "CollectStitch");
                    active = true;
                }
                if (model.skatTable.canViewLastStitch) {
                    controls.createButton(parent, "Letzten Stich zeigen", btnLastStitchCard_click, "ViewLastStitch");
                }
                if (model.skatTable.canGiveUp) {
                    controls.createButton(parent, "Aufgeben", btnGiveUp_click, "GiveUpQuestion");
                }
                if (model.skatTable.canSpeedUp) {
                    controls.createButton(parent, "Abk\u00FCrzen", btnSpeedUp_click, "SpeedUp");
                }
            }
            else {
                if (model.skatTable.canConfirmSpeedUp) {
                    controls.createButton(parent, "Spiel abk\u00FCrzen", btnSpeedUpConfirm_click, "ConfirmSpeedUp");
                    controls.createButton(parent, "Weiterspielen", btnContinuePlay_click, "ContinuePlay");
                    active = true;
                }
                else {
                    controls.create(parent, "p", undefined, "Spiel abk\u00FCrzen. Du wartest auf die Best\u00E4tigung Deiner Mitspieler.");
                }
            }
            model.skatTable.actions.forEach((action) => {
                controls.createButton(parent, action.description, btnAction_click, action.name);
                active = true;
            });
            if (model.skatTable.player && model.skatTable.player.tooltip && model.skatTable.player.tooltip.length > 0) {
                controls.create(parent, "span", "tooltip", model.skatTable.player.tooltip);
            }
        }
        if (active) {
            document.body.className = "active-background";
        }
    };

    const renderSpecialSort = (parent) => {
        if (model.skatTable.player && model.skatTable.cards.length > 2) {
            controls.createCheckbox(parent, "sortoption", "Sort", "Sortiere nach wechselnden Farben", specialSortOption, btnSpecialSortOption_click, false);
        }
    };

    const renderGame = (parent) => {
        if (!model.skatTable.player || !model.skatTable.player.game) return;
        let game = model.skatTable.player.game;
        let gameStarted = model.skatTable.gameStarted
        let divGameType = controls.create(parent, "div", "gametype");
        controls.createRadiobutton(divGameType, "r1", "gametype", "Grand", "Grand", game.type == "Grand", btnGameType_click, gameStarted);
        controls.createRadiobutton(divGameType, "r2", "gametype", "Null", "Null", game.type == "Null", btnGameType_click, gameStarted);
        controls.createRadiobutton(divGameType, "r3", "gametype", "Clubs", "Kreuz", game.type == "Color" && game.color == "Clubs", btnGameType_click, gameStarted);
        controls.createRadiobutton(divGameType, "r4", "gametype", "Spades", "Pik", game.type == "Color" && game.color == "Spades", btnGameType_click, gameStarted);
        controls.createRadiobutton(divGameType, "r5", "gametype", "Hearts", "Herz", game.type == "Color" && game.color == "Hearts", btnGameType_click, gameStarted);
        controls.createRadiobutton(divGameType, "r6", "gametype", "Diamonds", "Karo", game.type == "Color" && game.color == "Diamonds", btnGameType_click, gameStarted);
        let divGameOption = controls.create(parent, "div", "gameoption");
        checkBoxOuvert = controls.createCheckbox(divGameOption, "c1", "Ouvert", "Ouvert", game.option.ouvert, btnGameOption_click, !model.skatTable.canSetOuvert);
        checkBoxHand = controls.createCheckbox(divGameOption, "c2", "Hand", "Hand", game.option.hand, btnGameOption_click, !model.skatTable.canSetHand);
        checkBoxSchneider = controls.createCheckbox(divGameOption, "c3", "Schneider", "Schneider", game.option.schneider, btnGameOption_click, !model.skatTable.canSetSchneider);
        checkBoxSchwarz = controls.createCheckbox(divGameOption, "c4", "Schwarz", "Schwarz", game.option.schwarz, btnGameOption_click, !model.skatTable.canSetSchwarz);
    };

    const renderHeader = (parent) => {
        controls.create(parent, "p", undefined, model.skatTable.message);
    };

    const renderSummaryPlayer = (elem, player) => {
        elem.textContent = player.name;
        if (model.skatTable.currentPlayer &&
            model.skatTable.currentPlayer.name == player.name) {
            elem.className += " blinking";
        }
        let img = controls.createImg(elem, "player-img", 90, 90);
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
                    if (p) {
                        photos[player.name.toLowerCase()] = p;
                        img.src = p;
                    }
                },
                (errMsg) => console.error(errMsg));
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
                controls.createSpan(elem, undefined, "Ja!");
            }
            else if (player.bidStatus == 2) {
                controls.createSpan(elem, undefined, "Weg");
            }
        }
    };

    const renderSummary = (parent, left, right, bottom) => {
        controls.create(parent, "div", "summary-currentplayer", `Spiel ${model.skatTable.gameCounter}`);
        model.skatTable.players.forEach((p) => {
            let classname = p.name == getPlayerName() ? "summary-currentplayer" : "summary-otherplayer";
            controls.create(parent, "div", classname, p.summary);
        });
        if (!model.skatTable.gameEnded) {
            let leftPlayer
            let middlePlayer;
            let rightPlayer;
            if (!model.skatTable.player) {
                if (model.skatTable.inactivePlayer) {
                    middlePlayer = getNextPlayer(model.skatTable.inactivePlayer);
                    leftPlayer = getNextPlayer(middlePlayer);
                }
                else {
                    middlePlayer = model.skatTable.players[0];
                    leftPlayer = model.skatTable.players[1];
                }
            }
            else {
                leftPlayer = getNextPlayer(model.skatTable.player);
                middlePlayer = model.skatTable.player;
            }
            rightPlayer = getNextPlayer(leftPlayer);
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
                    txt = `Der Tisch ist jetzt reserviert f\u00FCr ${names}. Du wirst gleich abgemeldet.`;
                }
                else {
                    let val;
                    let unit;
                    if (sec > 60) {
                        val = Math.ceil(sec / 60);
                        unit = (val <= 1) ? "Minute" : "Minuten";
                    }
                    else {
                        val = sec;
                        unit = sec <= 1 ? "Sekunde" : "Sekunden";
                    }
                    txt = `Der Tisch ist in ${val} ${unit} reserviert f\u00FCr ${names}. Du wirst dann automatisch abgemeldet.`;
                }
                controls.createDiv(parent, "reservation-logout-alert").textContent = txt;
            }
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna Skat ${version}. Copyright 2020-2021 `);
        controls.createA(div, "copyright", "/homepage", "Niels Stockfleth");
        let time = new Date().toLocaleTimeString("de-DE");
        controls.create(div, "span", "copyright", `. Letzte Aktualisierung: ${time}. `);
        if (ticket) {
            controls.createButton(div, "Tisch verlassen", btnLogout_click, "Logout", "logout-button");
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
                document.body.className = "active-background";
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
        document.title = `Skat - ${model.currentUser.name}`;
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

    const renderChat = (parent) => {
        let divChatButton = controls.createDiv(parent, "layout-chat-button");
        let imgMessage = controls.createImg(divChatButton, "chat-img-newmessage", 32, 32, "/images/skat/mail-unread-3.png");
        imgMessage.addEventListener("click", (e) => {
            showChat = !showChat;
            render();
        });
        let token = utils.get_authentication_token();
        if (token) {
            let imgResults = controls.createImg(divChatButton, "results-img-open", 32, 32, "/images/skat/games-card_game.png");
            imgResults.addEventListener("click", () => window.open("/skat?results", "_blank"));
            imgResults.title = "Spielergebnisse";
        }
        divChat = controls.createDiv(parent, "layout-right");
        let chatState = sessionStorage.getItem("chatstate");
        if (!chatState) {
            chatState = 0;
        }
        let currentChatState = 0;
        if (showChat && chatModel && chatModel.history) {
            chatModel.history.forEach((tm) => {
                let divMsg = controls.createDiv(divChat, "chat-message");
                divMsg.textContent = `${tm.username}: ${tm.message}`;
                divMsg.title = `${new Date(tm.createdUtc).toLocaleString("de-DE")}`;
                if (tm.message.startsWith("https://")) {
                    controls.createA(divMsg, "chat-link", tm.message, "\u00D6ffnen", () => window.open(tm.message, "_blank"));
                }
            });
            currentChatState = chatModel.state;
        }
        if (token) {
            inputChatText = controls.createInputField(divChat, "Nachricht", () => btnChat_click(), "chat-input", 36, 200);
            inputChatText.placeholder = "Nachricht..."
            if (lastChatText) {
                inputChatText.value = lastChatText;
            }
        }
        if (showChat) {
            imgMessage.title = "Chat ausblenden";
            sessionStorage.setItem("chatstate", currentChatState);
            divChat.style.visibility = "visible";
            if (inputChatText && !utils.is_mobile()) {
                inputChatText.focus();
            }
        }
        else {
            imgMessage.title = "Chat einblenden";
            if (currentChatState > chatState) {
                imgMessage.src = "/images/skat/mail-unread-new.png";
            }
            divChat.style.visibility = "hidden";
        }
    };

    const renderResults = (results, skatadmin) => {
        document.title = "Skat - Spielergebnisse";
        controls.removeAllChildren(document.body);
        document.body.className = "inactive-background";
        let parent = document.body;
        if (results.length == 0) {
            controls.createLabel(parent, undefined, "Es liegen noch keine Spielergebnisse f\u00FCr Dich vor.");            
            return;
        }
        let boxDiv = controls.createDiv(parent, "box");
        let div1 = controls.createDiv(boxDiv, "box-item");
        div1.id = "results-overview-id";
        let div2 = controls.createDiv(boxDiv, "box-item");
        let cnt = 1;
        results.forEach(result => {
            let started = new Date(result.startedUtc);
            let p = controls.create(div1, "p");
            let txt = `${started.toLocaleDateString("de-DE")}`;;
            controls.createRadiobutton(p, `result-id-${cnt++}`, "result", `${result.id}`, txt, false,
                (rb) => {
                    let token = utils.get_authentication_token();
                    utils.fetch_api_call(`api/skat/resultbyid?id=${rb.value}`, { headers: { "token": token } },
                        (result) => renderResultTable(div2, result),
                        handleError);                    
                });
        });
        if (skatadmin) {
            controls.createButton(div1, "L\u00F6schen", () => onDeleteSkatResult(div1, true));
        }
        let rb = document.getElementById("result-id-1");
        if (rb) {
            rb.click();
        }
    };

    const renderResult = (result) => {
        document.title = "Skat - Tabelle";
        document.body.className = "inactive-background";
        renderResultTable(document.body, result);
    };

    const renderResultTable = (parent, result) => {
        controls.removeAllChildren(parent);
        currentSkatResultId = result ? result.id : undefined;
        if (!result || !result.endedUtc) {
            controls.createLabel(parent, undefined, "Die Tabelle ist noch nicht verf\u00FCgbar.");
            return;
        }
        let started = new Date(result.startedUtc);
        let ended = new Date(result.endedUtc);
        let topt = { "hour": "numeric", "minute": "numeric" };
        let caption = `Spiele am ${started.toLocaleDateString("de-DE")} von ` +
            `${started.toLocaleTimeString("de-DE", topt)} bis ${ended.toLocaleTimeString("de-DE", topt)}.`;
        let cnt = 1;
        let table = controls.create(parent, "table");
        controls.create(table, "caption", undefined, caption);
        let theader = controls.create(table, "thead");
        let tr = controls.create(theader, "tr");
        controls.create(tr, "th", undefined, " ");
        controls.create(tr, "th", undefined, `${result.playerNames[0]}`);
        controls.create(tr, "th", undefined, `${result.playerNames[1]}`);
        controls.create(tr, "th", undefined, `${result.playerNames[2]}`);
        if (result.playerNames.length > 3) {
            controls.create(tr, "th", undefined, `${result.playerNames[3]}`);
        }
        controls.create(tr, "th", undefined, "Spiel");
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
            else {
                playerLoss[idx] += 1;
                otherWins[opponentPlayerIndex[0]] += 1;
                otherWins[opponentPlayerIndex[1]] += 1;
            }
            let tddetails = controls.create(tr, "td");
            controls.createA(tddetails, undefined, "#open", `${h.gameValue}`, () => renderGameHistory(parent, result, h));
            cnt++;
        });
        table = controls.create(parent, "table");
        controls.create(table, "caption", undefined, "Turnierwertung");
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
    };

    const renderGameHistory = (parent, result, gameHistory) => {
        if (!result) {
            document.title = "Skat - Spielverlauf";
            document.body.className = "inactive-background";
        }
        let div1 = document.getElementById("results-overview-id");
        if (div1) {
            div1.className = "hide";
        }
        controls.removeAllChildren(parent);
        if (!gameHistory) {
            controls.create(parent, "p", undefined, "Der Spielverlauf ist noch nicht verf\u00FCgbar.");
            return;
        }
        let gameP = controls.create(parent, "p");
        if (gameHistory.gameValue == 0) {
            gameP.textContent = "Alle Spieler haben gepasst.";
        }
        else {
            gameP.textContent = `${gameHistory.gamePlayerName} hat ${gameHistory.gameText} gespielt und ${gameHistory.gamePlayerScore} Augen bekommen. Das Spiel wurde mit ${gameHistory.gameValue} Punkten gewertet.`;
        }
        if (result) {
            let buttonDiv = controls.createDiv(parent);
            controls.createButton(buttonDiv, "Zur\u00FCck", () => {
                if (div1) {
                    div1.className = "box-item";
                }
                renderResultTable(parent, result);
            });
        }
        controls.create(parent, "p", undefined, "Skat:");
        let divSkat = controls.createDiv(parent);
        renderCards(divSkat, true, gameHistory.skat, true, undefined, true);
        gameHistory.playerCards.forEach((pc) => {
            controls.create(parent, "p", undefined, `Spielkarten von ${pc.playerName}:`);
            let d = controls.createDiv(parent);
            renderCards(d, true, pc.cards, true, undefined, false);
        });
        controls.create(parent, "p", undefined, "Gedr\u00FCckt:");
        let divBack = controls.createDiv(parent);
        renderCards(divBack, true, gameHistory.back, true, undefined, true);
        let cnt = 1;
        for (let idx = 0; idx <= gameHistory.played.length - 3; idx += 3) {
            let p1 = gameHistory.played[idx];
            let p2 = gameHistory.played[idx+1];
            let p3 = gameHistory.played[idx+2];
            controls.create(parent, "p", undefined, `Stich ${cnt}: ${p1.player}, ${p2.player}, ${p3.player}`);
            let divStitch = controls.createDiv(parent);
            renderCards(divStitch, true, [p1.card, p2.card, p3.card], true, undefined, true);
            cnt++;
        }
    };

    const renderModel = (m) => {
        if (inputChatText) {
            lastChatText = inputChatText.value; // keep old value if rendered again
        }
        model = m;
        controls.setState(model.state);
        controls.removeAllChildren(document.body);
        document.body.className = "inactive-background";
        if (model.allUsers.length == 0) {
            clearTicket();
        }
        divLayoutLeft = controls.createDiv(document.body, "layout-left");
        divMain = controls.createDiv(divLayoutLeft);
        renderChat(document.body);
        if (!ticket) {
            if (guestMode) {
                document.title = "Skat - Gastansicht";
                if (model.skatTable) {
                    renderMainPage(divMain);
                }
                else {
                    controls.create(divMain, "p", undefined, "Es wird gerade nicht gespielt.");
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
        timerEnabled = true;
    };

    const fetchModel = (ticket) => {
        timerEnabled = false;
        utils.fetch_api_call("api/skat/model", { headers: { "ticket": ticket } },
            (m) => renderModel(m),
            handleError);
    };

    const login = (name) => {
        let token = utils.get_authentication_token();
        if (!name || name.length == 0 || !token) {
            window.location.replace("/skat");
            return;
        }
        utils.fetch_api_call("api/skat/login",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify(name)
            },
            (loginModel) => {
                if (loginModel && loginModel.ticket && loginModel.ticket.length > 0) {
                    setTicket(loginModel.ticket);
                }
                window.location.replace("/skat");
            },
            (errMsg) => {
                handleError(errMsg);
                window.location.replace("/skat");
            });
    };

    const render = () => {
        let params = new URLSearchParams(window.location.search);
        if (params.has("login")) {
            login(params.get("login"));
            return;
        }
        ticket = getTicket();
        if (ticket && params.has("gamehistory")) {
            utils.fetch_api_call("api/skat/gamehistory", { headers: { "ticket": ticket } },
                gamehistory => renderGameHistory(document.body, undefined, gamehistory),
                handleError);
            return;
        }
        if (ticket && params.has("result")) {
            utils.fetch_api_call("api/skat/result", { headers: { "ticket": ticket } },
                (result) => renderResult(result),
                handleError);
            return;
        }
        if (params.has("results")) {
            if (currentUser) {
                let token = utils.get_authentication_token();
                utils.fetch_api_call("api/skat/results", { headers: { "token": token } },
                    (results) => renderResults(results, currentUser.roles.includes("skatadmin")),
                    handleError);
                return;
            }
        }
        if (params.has("admin")) {
            if (currentUser && currentUser.roles.includes("skatadmin")) {
                let parent = document.body;
                parent.className = "inactive-background";
                controls.removeAllChildren(parent);
                controls.create(parent, "p", undefined, "Skat Administration");
                let p = controls.create(parent, "p");
                controls.createButton(p, "Reset", () => onReset(p, true));
                controls.createButton(p, "Tickets", () => onShowTickets(p));
                controls.createButton(p, "Spielergebnisse", () => window.location.href = "/skat?results");
            }
            else {
                window.location.replace("/skat");
            }
            return;
        }
        if (params.has("guest")) {
            guestMode = true;
        }
        timerEnabled = false;
        utils.fetch_api_call("api/skat/chat", undefined,
            (cm) => {
                chatModel = cm;
                fetchModel(ticket);
            },
            (errMsg) => {
                handleError(errMsg);
                fetchModel(ticket);
            });
    };

    const renderInit = () => {
        currentUser = undefined;
        let token = utils.get_authentication_token();
        if (!token) {
            render();
            return;
        }
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            (user) => {
                currentUser = user;
                render();
            },
            (errmsg) => {
                console.error(errmsg);
                utils.logout();
                render();
            });
    };

    // callbacks

    const btnShowReservations_click = () => {
        utils.fetch_api_call("api/skat/reservation", undefined,
            (r) => {
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
        timerEnabled = false;
        controls.removeAllChildren(parent);
        let today = new Date();
        let div = controls.createDiv(parent);
        renderCalendar(div, today.getMonth(), today.getFullYear());
    };

    const btnLogin_click = () => {
        const name = inputUsername.value.trim();
        if (name.length > 0) {
            timerEnabled = false;
            let token = utils.get_authentication_token();
            if (!token) {
                token = "";
            }
            utils.fetch_api_call("api/skat/login",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(name)
                },
                (loginModel) => {
                    if (loginModel) {
                        if (loginModel.isAuthenticationRequired) {
                            let nexturl = `/skat?login=${name}`;
                            window.location.href = "/pwdman?nexturl=" + encodeURI(nexturl)
                                + "&username=" + encodeURI(name);
                            return;
                        }
                        else if (loginModel.ticket && loginModel.ticket.length > 0) {
                            setTicket(loginModel.ticket);
                        }
                    }
                    render();
                },
                (errMsg) => {
                    document.getElementById("login-error-id").textContent = errMsg;
                    timerEnabled = true;
                });
        }
    };

    const btnStartGame_click = () => {
        timerEnabled = false;
        utils.fetch_api_call("api/skat/newgame", { method: "POST", headers: { "ticket": ticket } },
            () => render(),
            handleError);
    };

    const btnConfirmStartGame_click = () => {
        timerEnabled = false;
        utils.fetch_api_call("api/skat/confirmstartgame", { method: "POST", headers: { "ticket": ticket } },
            () => render(),
            handleError);
    };

    const btnGiveUp_click = (elem) => {
        if (elem.value == "GiveUpYes") {
            timerEnabled = false;
            utils.fetch_api_call("api/skat/giveup", { method: "POST", headers: { "ticket": ticket } },
                () => {
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
        if (elem.value == "SpeedUpYes") {
            timerEnabled = false;
            utils.fetch_api_call("api/skat/speedup", { method: "POST", headers: { "ticket": ticket } },
                () => {
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
        timerEnabled = false;
        utils.fetch_api_call("api/skat/confirmspeedup", { method: "POST", headers: { "ticket": ticket } },
            () => render(),
            handleError);
    };

    const btnContinuePlay_click = () => {
        timerEnabled = false;
        utils.fetch_api_call("api/skat/continueplay", { method: "POST", headers: { "ticket": ticket } },
            () => render(),
            handleError);
    };

    const btnGameType_click = (elem) => {
        timerEnabled = false;
        let gamecolor = undefined;
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
        utils.fetch_api_call("api/skat/game",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                body: JSON.stringify({ "Type": gametype, "Color": gamecolor })
            },
            () => render(),
            handleError);
    };

    const btnGameOption_click = () => {
        timerEnabled = false;
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
            () => render(),
            handleError);
    };

    const btnAction_click = (elem) => {
        timerEnabled = false;
        let action = elem.value;
        if (action == "StartGame") {
            letsStartClicked = true;
            render();
        }
        else {
            utils.fetch_api_call("api/skat/bid",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                    body: JSON.stringify(action)
                },
                () => render(),
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
        timerEnabled = false;
        document.body.style.cursor = "wait";
        utils.fetch_api_call("api/skat/playcard",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                body: JSON.stringify(card.orderNumber)
            },
            () => {
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
        timerEnabled = false;
        utils.fetch_api_call("api/skat/pickupskat",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                body: JSON.stringify(card.orderNumber)
            },
            () => render(),
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
        timerEnabled = false;
        document.body.style.cursor = "wait";
        utils.fetch_api_call("api/skat/collectstitch", { method: "POST", headers: { "ticket": ticket } },
            () => {
                document.body.style.cursor = "default";
                render();
            },
            (errMsg) => {
                handleError(errMsg);
                document.body.style.cursor = "default";
            });
    };

    const btnLogout_click = (elem) => {
        if (elem.value == "LogoutYes" || !model.skatTable) {
            timerEnabled = false;
            utils.fetch_api_call("api/skat/logout", { method: "POST", headers: { "ticket": ticket } },
                () => {
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
            timerEnabled = false;
            utils.fetch_api_call("api/skat/bid",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                    body: JSON.stringify("StartGame")
                },
                () => {
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

    const btnChat_click = () => {
        if (inputChatText && inputChatText.value.trim().length > 0) {
            timerEnabled = false;
            let token = utils.get_authentication_token();
            utils.fetch_api_call("api/skat/chat",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(inputChatText.value)
                },
                () => {
                    inputChatText.value = "";
                    render();
                },
                handleError);
        }
    };

    const onDeleteSkatResult = (parent, confirm) => {
        if (!currentSkatResultId) return;
        if (confirm) {
            controls.removeAllChildren(parent);
            controls.create(parent, "p", "confirmation", "Willst Du wirklich diese Tabelle l\u00F6schen?");
            controls.createButton(parent, "Ja", () => onDeleteSkatResult(parent, false));
            controls.createButton(parent, "Nein", () => window.location.replace("/skat?results"));
            return;
        }
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/skat/resultbyid",
            {
                method: "DELETE",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify(currentSkatResultId)
            },
            () => window.location.replace("/skat?results"),
            handleError);
    };

    const onReset = (parent, confirm) => {
        if (confirm) {
            controls.removeAllChildren(parent);
            controls.create(parent, "p", "confirmation", "Willst Du wirklich alles zur\u00FCcksetzen?");
            controls.createButton(parent, "Ja", () => onReset(parent, false));
            controls.createButton(parent, "Nein", () => window.location.replace("/skat?admin"));
            return;
        }
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/skat/reset", { headers: { "token": token } },
            () => window.location.replace("/skat?admin"),
            handleError);
    };

    const onShowTickets = (parent) => {
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/skat/tickets", { headers: { "token": token } },
            (tickets) => {
                controls.removeAllChildren(parent);
                controls.create(parent, "p", undefined, "Tickets:");
                tickets.forEach(ticket => {
                    controls.create(parent, "p", undefined, ticket);
                });
                controls.createButton(parent, "OK", () => window.location.replace("/skat?admin"));
            },
            handleError);
    };

    const ontimer = () => {
        if (!timerEnabled) return;
        utils.fetch_api_call("api/skat/state", undefined,
            (d) => {
                let statechanged = controls.getState();
                if (!statechanged || d > statechanged) {
                    controls.setState(d);
                    render();
                }
            },
            handleError);
    }

    // --- public API

    return {
        renderInit: renderInit,
        ontimer: ontimer
    };
})();

window.onload = () => {
    window.setInterval(skat.ontimer, 1000);
    utils.auth_lltoken(skat.renderInit);
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