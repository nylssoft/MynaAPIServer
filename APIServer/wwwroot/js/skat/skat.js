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
    let lastChatText = "";

    let imgHeight = 140;
    let imgWidth = 90;

    let version = "1.0.1";

    // helper

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
        for (let idx = 0; idx < model.skatTable.players.length; idx++) {
            if (player.name == model.skatTable.players[idx].name) {
                return model.skatTable.players[(idx + 1) % model.skatTable.players.length];
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
            model.skatTable.gamePlayer.name != model.skatTable.player.name &&
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

    // rendering

    const renderTableFull = (parent) => {
        controls.create(parent, "p", undefined, "Der Tisch ist leider schon voll!");
        document.body.className = "inactive-background";
    };

    const renderUserList = (parent) => {
        controls.create(parent, "p", "welcome", "Willkommen beim Online Skat!");
        let divInfoImages = controls.createDiv(parent);
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
                if (skatPlayerImages) {
                    let img = skatPlayerImages[user.name.toLowerCase()];
                    if (!img) {
                        img = `/images/skat/profiles/Player${idx}.png`;
                        idx++;
                    }
                    if (img) {
                        controls.createImg(li, undefined, 32, 45, img);
                    }
                }
                controls.create(li, "span", undefined, user.name).style.marginLeft = "10pt";
            });
        }
    };

    const renderLogin = (parent) => {
        controls.create(parent, "p", undefined, "Du kannst noch mitspielen! Wie ist Dein Name?");
        controls.createLabel(parent, undefined, "Name:");
        inputUsername = controls.createInputField(parent, "username", btnLogin_click);
        inputUsername.placeholder = "Name";
        inputUsername.focus();
        controls.createButton(parent, "Anmelden", btnLogin_click);
        document.body.className = "active-background";
    };

    const renderWaitForUsers = (parent) => {
        controls.create(parent, "p", "activity", "Du musst warten, bis alle angemeldet sind.");
        document.body.className = "inactive-background";
    };

    const renderStartGame = (parent) => {
        controls.create(parent, "p", undefined, "Alle sind angemeldet! Starte das Spiel!");
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
            let img = controls.createImg(container, undefined, imgWidth, imgHeight, `${gif}`);
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
                        controls.createImg(parent, undefined, imgWidth, imgHeight, "/images/skat/empty.png");
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
                    controls.createImg(parent, undefined, imgWidth, imgHeight, "/images/skat/empty.png");
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
            controls.create(parent, "span", "confirmation", "Willst Du Dich wirklich abmelden?");
            controls.createButton(parent, "Ja", btnLogout_click, "LogoutYes");
            controls.createButton(parent, "Nein", btnLogout_click, "LogoutNo");
            active = true;
        }
        else if (letsStartClicked) {
            controls.create(parent, "span", "confirmation", `Willst Du Dich wirklich ${model.skatTable.player.game.description} spielen?`);
            controls.createButton(parent, "Ja", btnLetsStart_click, "LetsStartYes");
            controls.createButton(parent, "Nein", btnLetsStart_click, "LetsStartNo");
            active = true;
        }
        else {
            if (model.skatTable.canStartNewGame) {
                if (!model.currentUser.startGameConfirmed) {
                    controls.createButton(parent, "OK", btnConfirmStartGame_click, "ConfirmStartGame");
                    active = true;
                }
                else {
                    let wait = false;
                    model.allUsers.forEach((user) => {
                        if (!user.startGameConfirmed) {
                            wait = true;
                        }
                    });
                    if (!wait) {
                        controls.createButton(parent, "Neues Spiel", btnStartGame_click, "StartGame");
                        active = true;
                    }
                    else {
                        controls.create(parent, "p", undefined, "Du wartest auf die Best\u00E4tigung Deiner Mitspieler.");
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
        if (skatPlayerImages) {
            let img = skatPlayerImages[player.name.toLowerCase()];
            if (!img) {
                for (let idx = 0; idx < model.allUsers.length; idx++) {
                    if (model.allUsers[idx].name == player.name) {
                        img = `/images/skat/profiles/Player${idx+1}.png`;
                        break;
                    }
                }
            }
            if (img) {
                controls.createImg(elem, undefined, 65, 90, img);
            }
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
            let classname = p.name == model.skatTable.player.name ? "summary-currentplayer" : "summary-otherplayer";
            controls.create(parent, "div", classname, p.summary);
        });
        if (!model.skatTable.gameEnded) {
            let leftPlayer = getNextPlayer(model.skatTable.player);
            let rightPlayer = getNextPlayer(leftPlayer);
            if (isOuvert() && model.skatTable.ouvert.length > 0) {
                left.className += "-ouvert";
                right.className += "-ouvert";
            }
            renderSummaryPlayer(left, leftPlayer);
            renderSummaryPlayer(right, rightPlayer);
            renderSummaryPlayer(bottom, model.skatTable.player);
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna Skat Version ${version}. Copyright 2020 `);
        let a = controls.createA(div, "copyright", "https://github.com/nylssoft/", "Niels Stockfleth");
        a.target = "_blank";
        let time = new Date().toLocaleTimeString("de-DE");
        controls.create(div, "span", "copyright", `. Alle Rechte vorbehalten. Letzte Aktualisierung: ${time}.`);
        if (ticket) {
            controls.createButton(div, "Abmelden", btnLogout_click, "Logout", "logout-button");
        }
        else {
            let specialDiv = controls.createDiv(div, "special");
            controls.createA(specialDiv, "special-link", "/skatadmin.html", "Administration");
            controls.createA(specialDiv, "special-link", "/skatticket.html", "Ticketanmeldung");
        }
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
        if (model.skatTable.player &&
            model.skatTable.currentPlayer &&
            model.skatTable.player.name == model.skatTable.currentPlayer.name ||
            !model.skatTable.gameStarted &&
            model.skatTable.gamePlayer &&
            model.skatTable.gamePlayer.name == model.skatTable.player.name) {
            document.body.className = "active-background";
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
        document.title = `Online Skat - ${model.currentUser.name}`;
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

    const renderChat = (parent, ticket) => {
        let divChatButton = controls.createDiv(parent, "layout-chat-button");
        let imgMessage = controls.createImg(divChatButton, "chat-img-newmessage", 32, 32, "/images/skat/mail-unread-3.png");
        imgMessage.addEventListener("click", (e) => {
            showChat = !showChat;
            render();
        });
        divChat = controls.createDiv(parent, "layout-right");
        let chatState = sessionStorage.getItem("chatstate");
        if (!chatState) {
            chatState = 0;
        }
        console.log(chatModel);
        let currentChatState = 0;
        if (chatModel && chatModel.history) {
            chatModel.history.forEach((msg) => {
                let divMsg = controls.createDiv(divChat, "chat-message");
                divMsg.textContent = msg;
            });
            currentChatState = chatModel.state;
        }
        console.log(chatState);
        console.log(currentChatState);
        if (ticket) {
            inputChatText = controls.createInputField(divChat, "Nachricht", btnChat_click, "chat-input", 36, 200);
            inputChatText.placeholder = "Nachricht..."
            if (lastChatText) {
                inputChatText.value = lastChatText;
            }
        }
        if (showChat) {
            imgMessage.title = "Chat ausblenden";
            sessionStorage.setItem("chatstate", currentChatState);
            divChat.style.visibility = "visible";
            if (inputChatText) {
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

    const renderModel = (m) => {
        console.log(m);
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
        renderChat(document.body, ticket);
        if (!ticket) {
            renderUserList(divMain);
            if (model.allUsers.length == 3) {
                renderTableFull(divMain);
            }
            else {
                renderLogin(divMain);
            }
            renderCopyright(divMain);
        }
        else {
            renderUsername(divMain);
        }
        timerEnabled = true;
    };

    const fetchModel = (ticket) => {
        timerEnabled = false;
        fetch("api/skat/model", { headers: { "ticket": ticket } })
            .then(response => response.json())
            .then(m => renderModel(m))
            .catch((err) => console.error(err));
    };

    const render = () => {
        ticket = getTicket();
        timerEnabled = false;
        fetch("api/skat/chat")
            .then(response => response.json())
            .then(chat => {
                chatModel = chat;
                fetchModel(ticket);
            })
            .catch((err) => console.error(err));
    };

    // callbacks

    const btnLogin_click = () => {
        const name = inputUsername.value.trim();
        if (name.length > 0) {
            timerEnabled = false;
            fetch("api/skat/login", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(name)
            })
                .then(response => response.json())
                .then((t) => {
                    if (t && t.length > 0) {
                        setTicket(t);
                    }
                    render();
                })
                .catch((err) => console.error(err));
        }
    };

    const btnStartGame_click = () => {
        timerEnabled = false;
        fetch("api/skat/newgame", { method: "POST", headers: { "ticket": ticket } })
            .then(response => response.json())
            .then(() => render())
            .catch((err) => console.error(err));
    };

    const btnConfirmStartGame_click = () => {
        timerEnabled = false;
        fetch("api/skat/confirmstartgame", { method: "POST", headers: { "ticket": ticket } })
            .then(response => response.json())
            .then(() => render())
            .catch((err) => console.error(err));
    };

    const btnGiveUp_click = (elem) => {
        if (elem.value == "GiveUpYes") {
            timerEnabled = false;
            fetch("api/skat/giveup", { method: "POST", headers: { "ticket": ticket } })
                .then(response => response.json())
                .then(() => {
                    giveUpClicked = false;
                    render();
                })
                .catch((err) => console.error(err));
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
            fetch("api/skat/speedup", { method: "POST", headers: { "ticket": ticket } })
                .then(response => response.json())
                .then(() => {
                    speedUpClicked = false;
                    render();
                })
                .catch((err) => console.error(err));
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
        fetch("api/skat/confirmspeedup", { method: "POST", headers: { "ticket": ticket } })
            .then(response => response.json())
            .then(() => render())
            .catch((err) => console.error(err));
    };

    const btnContinuePlay_click = () => {
        timerEnabled = false;
        fetch("api/skat/continueplay", { method: "POST", headers: { "ticket": ticket } })
            .then(response => response.json())
            .then(() => render())
            .catch((err) => console.error(err));
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
        fetch("api/skat/game", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "ticket": ticket
            },
            body: JSON.stringify({ "Type": gametype, "Color": gamecolor })
        })
            .then(response => response.json())
            .then(() => render())
            .catch((err) => console.error(err));
    };

    const btnGameOption_click = () => {
        timerEnabled = false;
        fetch("api/skat/gameoption", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "ticket": ticket
            },
            body: JSON.stringify({
                "ouvert": checkBoxOuvert.checked,
                "hand": checkBoxHand.checked,
                "schneider": checkBoxSchneider.checked,
                "schwarz": checkBoxSchwarz.checked
            })
        })
            .then(response => response.json())
            .then(() => render())
            .catch((err) => console.error(err));
    };

    const btnAction_click = (elem) => {
        timerEnabled = false;
        console.log(elem);
        let action = elem.value;
        console.log(action);
        if (action == "StartGame") {
            letsStartClicked = true;
            render();
        }
        else {
            fetch("api/skat/bid", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "ticket": ticket
                },
                body: JSON.stringify(action)
            })
                .then(response => response.json())
                .then(() => render())
                .catch((err) => console.error(err));
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
        fetch("api/skat/playcard", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "ticket": ticket
            },
            body: JSON.stringify(card.orderNumber)
        })
            .then(response => response.json())
            .then(() => {
                render();
                document.body.style.cursor = "default";
            })
            .catch((err) => {
                console.error(err);
                document.body.style.cursor = "default";
            });
    };

    const btnSkatCard_click = (card) => {
        if (!model.skatTable.player || !card || showLastStitch || !model.skatTable.canPickupSkat) return;
        timerEnabled = false;
        fetch("api/skat/pickupskat", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "ticket": ticket
            },
            body: JSON.stringify(card.orderNumber)
        })
            .then(response => response.json())
            .then(() => render())
            .catch((err) => console.error(err));
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
        fetch("api/skat/collectstitch", { method: "POST", headers: { "ticket": ticket } })
            .then(response => response.json())
            .then(() => {
                document.body.style.cursor = "default";
                render();
            })
            .catch((err) => {
                console.error(err);
                document.body.style.cursor = "default";
            });
    };

    const btnLogout_click = (elem) => {
        if (elem.value == "LogoutYes" || !model.skatTable) {
            timerEnabled = false;
            fetch("api/skat/logout", { method: "POST", headers: { "ticket": ticket } })
                .then(response => response.json())
                .then(() => {
                    logoutClicked = false;
                    render();
                })
                .catch((err) => console.error(err));
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
            fetch("api/skat/bid", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "ticket": ticket
                },
                body: JSON.stringify("StartGame")
            })
                .then(response => response.json())
                .then(() => {
                    letsStartClicked = false;
                    render();
                })
                .catch((err) => console.error(err));
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
            fetch("api/skat/chat", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "ticket": ticket
                },
                body: JSON.stringify(inputChatText.value)
            })
                .then(response => response.json())
                .then(() => {
                    inputChatText.value = "";
                    render();
                })
                .catch((err) => console.error(err));
        }
    };

    function ontimer() {
        if (!timerEnabled) return;
        fetch("api/skat/state")
            .then(response => response.json())
            .then((d) => {
                if (d && d > 0) {
                    let statechanged = controls.getState();
                    if (!statechanged || d > statechanged) {
                        console.log(d);
                        controls.setState(d);
                        render();
                    }
                }
            })
            .catch((err) => console.error(err));
    }

    // --- public API

    return {
        render: render,
        ontimer: ontimer
    };
})();

window.onload = () => {
    window.setInterval(skat.ontimer, 1000);
    skat.render();
};
