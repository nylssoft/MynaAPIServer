"use strict";

var skatui = (() => {

    // UI elements

    let inputUsername;
    let divMain;
    let checkBoxOuvert;
    let checkBoxHand;
    let checkBoxSchneider;
    let checkBoxSchwarz;
    let divChat;
    let divLayoutLeft;
    let btnToogleChat;
    let inputChatText;
    let divSlideShowInfo;

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

    let version = "2.0.1";

    let slideShowPictures;
    let slideShowInterval = 10;
    let backgroundChanged;
    let backgroundIndex = 0;

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
        skatutil.create(parent, "p", undefined, "Der Tisch ist leider schon voll!");
        document.body.className = "inactive-background";
    };

    const renderUserList = (parent) => {
        skatutil.create(parent, "p", "welcome", "Willkommen bei Myna Skat!");
        let divInfoImages = skatutil.createDiv(parent);
        skatutil.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/28.gif");
        skatutil.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/20.gif");
        skatutil.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/12.gif");
        skatutil.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/04.gif");
        if (model.allUsers.length > 0) {
            skatutil.create(parent, "p", undefined, "Es sind folgende Spieler am Tisch:");
            let ul = skatutil.create(parent, "ul");
            let idx = 1;
            model.allUsers.forEach((user) => {
                let li = skatutil.create(ul, "li");
                if (skatPlayerImages) {
                    let img = skatPlayerImages[user.name.toLowerCase()];
                    if (!img) {
                        img = `/images/skat/profiles/Player${idx}.png`;
                        idx++;
                    }
                    if (img) {
                        skatutil.createImg(li, undefined, 32, 45, img);
                    }
                }
                skatutil.create(li, "span", undefined, user.name).style.marginLeft = "10pt";
            });
        }
    };

    const renderLogin = (parent) => {
        skatutil.create(parent, "p", undefined, "Du kannst noch mitspielen! Wie ist Dein Name?");
        skatutil.createLabel(parent, undefined, "Name:");
        inputUsername = skatutil.createInputField(parent, "username", btnLogin_click);
        inputUsername.placeholder = "Name";
        inputUsername.focus();
        skatutil.createButton(parent, "Anmelden", btnLogin_click);
        document.body.className = "active-background";
    };

    const renderWaitForUsers = (parent) => {
        skatutil.create(parent, "p", "activity", "Du musst warten, bis alle angemeldet sind.");
        document.body.className = "inactive-background";
    };

    const renderStartGame = (parent) => {
        skatutil.create(parent, "p", undefined, "Alle sind angemeldet! Starte das Spiel!");
        skatutil.createButton(parent, "Spiel starten", btnStartGame_click);
        document.body.className = "active-background";
    };

    const renderCards = (parent, overlap, cards, show, action, addspace) => {
        let cnt = 0;
        let container = parent;
        cards.forEach(card => {
            if (addspace && (cnt % 3 == 0)) {
                container = skatutil.createDiv(parent, undefined);
                container.style = "white-space:nowrap;display:inline-block;";
            }
            let gif = show ? getCardImage(card) : "/images/skat/back.gif";
            let img = skatutil.createImg(container, undefined, imgWidth, imgHeight, `${gif}`);
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
                        skatutil.createImg(parent, undefined, imgWidth, imgHeight, "/images/skat/empty.png");
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
                    skatutil.createImg(parent, undefined, imgWidth, imgHeight, "/images/skat/empty.png");
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
            skatutil.createButton(parent, "Letzten Stich zur\u00FCcklegen", btnLastStitchCard_click, "StopViewLastStitch");
        }
        else if (giveUpClicked) {
            skatutil.create(parent, "span", "confirmation", "Willst Du wirklich aufgeben?");
            skatutil.createButton(parent, "Ja", btnGiveUp_click, "GiveUpYes");
            skatutil.createButton(parent, "Nein", btnGiveUp_click, "GiveUpNo");
            active = true;
        }
        else if (speedUpClicked) {
            skatutil.create(parent, "span", "confirmation", "Willst Du wirklich abk\u00FCrzen?");
            skatutil.createButton(parent, "Ja", btnSpeedUp_click, "SpeedUpYes");
            skatutil.createButton(parent, "Nein", btnSpeedUp_click, "SpeedUpNo");
            active = true;
        }
        else if (logoutClicked) {
            skatutil.create(parent, "span", "confirmation", "Willst Du Dich wirklich abmelden?");
            skatutil.createButton(parent, "Ja", btnLogout_click, "LogoutYes");
            skatutil.createButton(parent, "Nein", btnLogout_click, "LogoutNo");
            active = true;
        }
        else if (letsStartClicked) {
            skatutil.create(parent, "span", "confirmation", `Willst Du Dich wirklich ${model.skatTable.player.game.description} spielen?`);
            skatutil.createButton(parent, "Ja", btnLetsStart_click, "LetsStartYes");
            skatutil.createButton(parent, "Nein", btnLetsStart_click, "LetsStartNo");
            active = true;
        }
        else {
            if (model.skatTable.canStartNewGame) {
                if (!model.currentUser.startGameConfirmed) {
                    skatutil.createButton(parent, "OK", btnConfirmStartGame_click, "ConfirmStartGame");
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
                        skatutil.createButton(parent, "Neues Spiel", btnStartGame_click, "StartGame");
                        active = true;
                    }
                    else {
                        skatutil.create(parent, "p", undefined, "Du wartest auf die Best\u00E4tigung Deiner Mitspieler.");
                    }
                }
            }
            if (!model.skatTable.isSpeedUp) {
                if (model.skatTable.canCollectStitch) {
                    skatutil.createButton(parent, "Stich einsammeln", btnStitchCard_click, "CollectStitch");
                    active = true;
                }
                if (model.skatTable.canViewLastStitch) {
                    skatutil.createButton(parent, "Letzten Stich zeigen", btnLastStitchCard_click, "ViewLastStitch");
                }
                if (model.skatTable.canGiveUp) {
                    skatutil.createButton(parent, "Aufgeben", btnGiveUp_click, "GiveUpQuestion");
                }
                if (model.skatTable.canSpeedUp) {
                    skatutil.createButton(parent, "Abk\u00FCrzen", btnSpeedUp_click, "SpeedUp");
                }
            }
            else {
                if (model.skatTable.canConfirmSpeedUp) {
                    skatutil.createButton(parent, "Spiel abk\u00FCrzen", btnSpeedUpConfirm_click, "ConfirmSpeedUp");
                    skatutil.createButton(parent, "Weiterspielen", btnContinuePlay_click, "ContinuePlay");
                    active = true;
                }
                else {
                    skatutil.create(parent, "p", undefined, "Spiel abk\u00FCrzen. Du wartest auf die Best\u00E4tigung Deiner Mitspieler.");
                }
            }
            model.skatTable.actions.forEach((action) => {
                skatutil.createButton(parent, action.description, btnAction_click, action.name);
                active = true;
            });
            if (model.skatTable.player && model.skatTable.player.tooltip && model.skatTable.player.tooltip.length > 0) {
                skatutil.create(parent, "span", "tooltip", model.skatTable.player.tooltip);
            }
        }
        if (active) {
            document.body.className = "active-background";
        }
    };

    const renderSpecialSort = (parent) => {
        if (model.skatTable.player && model.skatTable.cards.length > 2) {
            skatutil.createCheckbox(parent, "sortoption", "Sort", "Sortiere nach wechselnden Farben", specialSortOption, btnSpecialSortOption_click, false);
        }
    };

    const renderGame = (parent) => {
        if (!model.skatTable.player || !model.skatTable.player.game) return;
        let game = model.skatTable.player.game;
        let gameStarted = model.skatTable.gameStarted
        let divGameType = skatutil.create(parent, "div", "gametype");
        skatutil.createRadiobutton(divGameType, "r1", "gametype", "Grand", "Grand", game.type == "Grand", btnGameType_click, gameStarted);
        skatutil.createRadiobutton(divGameType, "r2", "gametype", "Null", "Null", game.type == "Null", btnGameType_click, gameStarted);
        skatutil.createRadiobutton(divGameType, "r3", "gametype", "Clubs", "Kreuz", game.type == "Color" && game.color == "Clubs", btnGameType_click, gameStarted);
        skatutil.createRadiobutton(divGameType, "r4", "gametype", "Spades", "Pik", game.type == "Color" && game.color == "Spades", btnGameType_click, gameStarted);
        skatutil.createRadiobutton(divGameType, "r5", "gametype", "Hearts", "Herz", game.type == "Color" && game.color == "Hearts", btnGameType_click, gameStarted);
        skatutil.createRadiobutton(divGameType, "r6", "gametype", "Diamonds", "Karo", game.type == "Color" && game.color == "Diamonds", btnGameType_click, gameStarted);
        let divGameOption = skatutil.create(parent, "div", "gameoption");
        checkBoxOuvert = skatutil.createCheckbox(divGameOption, "c1", "Ouvert", "Ouvert", game.option.ouvert, btnGameOption_click, !model.skatTable.canSetOuvert);
        checkBoxHand = skatutil.createCheckbox(divGameOption, "c2", "Hand", "Hand", game.option.hand, btnGameOption_click, !model.skatTable.canSetHand);
        checkBoxSchneider = skatutil.createCheckbox(divGameOption, "c3", "Schneider", "Schneider", game.option.schneider, btnGameOption_click, !model.skatTable.canSetSchneider);
        checkBoxSchwarz = skatutil.createCheckbox(divGameOption, "c4", "Schwarz", "Schwarz", game.option.schwarz, btnGameOption_click, !model.skatTable.canSetSchwarz);
    };

    const renderHeader = (parent) => {
        skatutil.create(parent, "p", undefined, model.skatTable.message);
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
                skatutil.createImg(elem, undefined, 65, 90, img);
            }
        }
        if (!model.skatTable.gamePlayer) {
            if (model.skatTable.bidSaid && player.bidStatus == 0 && model.skatTable.currentBidValue > 0) {
                skatutil.createSpan(elem, undefined, `${model.skatTable.currentBidValue}?`);
            }
            else if (!model.skatTable.bidSaid && player.bidStatus == 0 && model.skatTable.currentBidValue > 0) {
                skatutil.createSpan(elem, undefined, `${model.skatTable.currentBidValue}`);
            }
            else if (!model.skatTable.bidSaid && player.bidStatus == 1 && model.skatTable.currentBidValue > 0) {
                skatutil.createSpan(elem, undefined, "Ja!");
            }
            else if (player.bidStatus == 2) {
                skatutil.createSpan(elem, undefined, "Weg");
            }
        }
    };

    const renderSummary = (parent, left, right, bottom) => {
        skatutil.create(parent, "div", "summary-currentplayer", `Spiel ${model.skatTable.gameCounter}`);
        model.skatTable.players.forEach((p) => {
            let classname = p.name == model.skatTable.player.name ? "summary-currentplayer" : "summary-otherplayer";
            skatutil.create(parent, "div", classname, p.summary);
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
        let div = skatutil.createDiv(parent);
        skatutil.create(div, "span", "copyright", `Myna Skat Version ${version}. Copyright 2020 `);
        let a = skatutil.createA(div, "copyright", "https://github.com/nylssoft/", "Niels Stockfleth");
        a.target = "_blank";
        let time = new Date().toLocaleTimeString("de-DE");
        skatutil.create(div, "span", "copyright", `. Alle Rechte vorbehalten. Letzte Aktualisierung: ${time}.`);
        if (ticket) {
            skatutil.createButton(div, "Abmelden", btnLogout_click, "Logout", "logout-button");
        }
    };

    const renderMainPage = (parent) => {
        let divSummary = skatutil.createDiv(parent);
        let divHeader = skatutil.createDiv(parent, "header-section");
        let divOuvert = skatutil.createDiv(parent, "cards-section");
        let divCenter = skatutil.createDiv(parent);
        let divLeft = skatutil.createDiv(parent, "left-section");
        let divStitch = skatutil.createDiv(divCenter, "stitch-section");
        let divBottom = skatutil.createDiv(divCenter, "bottom-section");
        let divCards = skatutil.createDiv(divCenter, "cards-section");
        let divSpecialSort = skatutil.createDiv(divCenter, "specialsort-section");
        let divRight = skatutil.createDiv(parent, "right-section");
        let divActions = skatutil.createDiv(parent, "actions-section");
        let divGame = skatutil.createDiv(parent);
        let divCopyright = skatutil.createDiv(parent);
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
        document.title = `Myna Skat - ${model.currentUser.name}`;
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
        let divChatButton = skatutil.createDiv(parent, "layout-chat-button");
        let imgNewMessage = skatutil.createImg(divChatButton, "chat-img-newmessage", 32, 32, "/images/skat/mail-unread-new.png");
        btnToogleChat = skatutil.createButton(divChatButton, "", btnToogleChat_click, "ToogleChat", "chat-button");
        divChat = skatutil.createDiv(parent, "layout-right");
        let chatState = sessionStorage.getItem("chatstate");
        if (!chatState) {
            chatState = 0;
        }
        console.log(chatModel);
        let currentChatState = 0;
        if (chatModel && chatModel.history) {
            chatModel.history.forEach((msg) => {
                let divMsg = skatutil.createDiv(divChat, "chat-message");
                divMsg.textContent = msg;
            });
            currentChatState = chatModel.state;
        }
        console.log(chatState);
        console.log(currentChatState);
        if (ticket) {
            inputChatText = skatutil.createInputField(divChat, "Nachricht", btnChat_click, "chat-input", 36, 200);
            inputChatText.placeholder = "Nachricht..."
            if (lastChatText) {
                inputChatText.value = lastChatText;
            }
        }
        imgNewMessage.style.visibility = "hidden";
        if (showChat) {
            sessionStorage.setItem("chatstate", currentChatState);
            divChat.style.visibility = "visible";
            btnToogleChat.textContent = "Chat ausblenden";
            if (inputChatText) {
                inputChatText.focus();
            }
        }
        else {
            if (currentChatState > chatState) {
                imgNewMessage.style.visibility = "visible";
            }
            divChat.style.visibility = "hidden";
            btnToogleChat.textContent = "Chat einblenden";
        }
    };

    const renderModel = (m) => {
        console.log(m);
        if (inputChatText) {
            lastChatText = inputChatText.value; // keep old value if rendered again
        }
        model = m;
        skatutil.setState(model.state);
        skatutil.removeAllChildren(document.body);
        document.body.className = "inactive-background";
        if (model.allUsers.length == 0) {
            clearTicket();
        }
        divLayoutLeft = skatutil.createDiv(document.body, "layout-left");
        divMain = skatutil.createDiv(divLayoutLeft);
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
        if (!model || !model.allUsers || model.allUsers.length < 3) {
            divSlideShowInfo = skatutil.createDiv(document.body, "slideshow-info");
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
            .then(() => render())
            .catch((err) => console.error(err));
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
        fetch("api/skat/collectstitch", { method: "POST", headers: { "ticket": ticket } })
            .then(response => response.json())
            .then(() => render())
            .catch((err) => console.error(err));
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

    const btnToogleChat_click = () => {
        showChat = !showChat;
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

    const shuffle_array = (arr) => {
        let ridx;
        let tmp;
        let cidx = arr.length;
        while (0 !== cidx) {
            ridx = Math.floor(Math.random() * cidx);
            cidx -= 1;
            tmp = arr[cidx];
            arr[cidx] = arr[ridx];
            arr[ridx] = tmp;
        }
        return arr;
    };

    const concat_strings = (arr, delim) => {
        let str = "";
        let idx = 0;
        arr.forEach((a) => {
            if (a && a.length > 0) {
                if (idx > 0) {
                    str += delim;
                }
                str += a;
                idx++;
            }
        });
        return str;
    };

    const format_date = (dt) => {
        if (dt && dt.length > 0) {
            let locale = "de-DE";
            let options = { year: "numeric", month: "short", day: "numeric" };
            return new Date(dt).toLocaleDateString(locale, options);
        }
        return "";
    };

    function ontimer() {
        if (!timerEnabled) return;
        if (slideShowPictures && slideShowPictures.length > 0) {
            if (!model || !model.allUsers || model.allUsers.length < 3) {
                let currentDate = new Date();
                if (!backgroundChanged || ((currentDate.getTime() - backgroundChanged.getTime()) / 1000) > slideShowInterval) {
                    let pic = slideShowPictures[backgroundIndex];
                    document.body.style.background = `#000000 url('${pic.url}')`;
                    document.body.style.backgroundSize = "cover";
                    document.body.style.backgroundRepeat = "no-repeat";
                    backgroundIndex = (backgroundIndex + 1) % slideShowPictures.length;
                    backgroundChanged = currentDate;
                    if (divSlideShowInfo) {
                        let txts = [pic.summary, pic.city, pic.country, format_date(pic.date)];
                        divSlideShowInfo.textContent = concat_strings(txts, " // ");
                    }
                }
            }
            else if (document.body.hasAttribute("style")) {
                document.body.removeAttribute("style");
            }
        }
        fetch("api/skat/state")
            .then(response => response.json())
            .then((d) => {
                if (d && d > 0) {
                    let statechanged = skatutil.getState();
                    if (!statechanged || d > statechanged) {
                        console.log(d);
                        skatutil.setState(d);
                        render();
                    }
                }
            })
            .catch((err) => console.error(err));
    }

    const enableSlideShow = (pictures, interval) => {
        slideShowPictures = pictures;
        shuffle_array(slideShowPictures);
        if (interval) {
            slideShowInterval = interval;
        }
    };

    // --- public API

    return {
        render: render,
        enableSlideShow: enableSlideShow,
        ontimer: ontimer
    };
})();

window.onload = () => {
    window.setInterval(skatui.ontimer, 1000);
    fetch("/images/skat/slideshow/pictures.json", { cache: "no-cache" })
        .then(response => {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                response.json().then(
                    slideshow => skatui.enableSlideShow(slideshow.pictures, slideshow.interval));
            }
            else {
                console.log("Slideshow disabled.");
            }
        })
    skatui.render();
};
