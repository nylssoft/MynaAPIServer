"use strict";

var skatui = (() => {

    // UI elements
    let inputUsername;
    let inputTicket;
    let divMain;
    let checkBoxOuvert;
    let checkBoxHand;
    let checkBoxSchneider;
    let checkBoxSchwarz;

    // state
    let ticket;
    let model;
    let timerEnabled = false;
    let showLastStitch = false;

    // helper

    const getCardImage = (card) => {
        let str = card.orderNumber.toString();
        if (str.length == 1) {
            str = "0" + str;
        }
        return `images/skat/${str}.gif`;
    };

    // rendering

    const renderTableFull = (parent) => {
        skatutil.create(parent, "p", undefined, "Der Tisch ist leider schon voll!");
    };

    const renderUserList = (parent) => {
        skatutil.create(parent, "p", "welcome", "Willkommen bei Myna Skat!");
        let divInfoImages = skatutil.createDiv(parent);
        skatutil.createImg(divInfoImages, undefined, 90, 140, "/images/skat/28.gif");
        skatutil.createImg(divInfoImages, undefined, 90, 140, "/images/skat/20.gif");
        skatutil.createImg(divInfoImages, undefined, 90, 140, "/images/skat/12.gif");
        skatutil.createImg(divInfoImages, undefined, 90, 140, "/images/skat/04.gif");
        if (model.allUsers.length > 0) {
            skatutil.create(parent, "p", undefined, "Es sind folgende Spieler am Tisch:");
            let ul = skatutil.create(parent, "ul");
            model.allUsers.forEach((user) => skatutil.create(ul, "li", undefined, user.name));
        }
    };

    const renderLogin = (parent) => {
        skatutil.create(parent, "p", undefined, "Du kannst noch mitspielen! Wie ist Dein Name?");
        skatutil.createLabel(parent, undefined, "Name:");
        inputUsername = skatutil.createInputField(parent, "username", btnLogin_click);
        inputUsername.placeholder = "Name";
        inputUsername.focus();
        skatutil.createButton(parent, "Anmelden", btnLogin_click);
    };

    const renderLoginWithTicket = (parent) => {
        skatutil.create(parent, "p", undefined, "Du kannst Dich mit Deinem Zugangscode anmelden.");
        skatutil.createLabel(parent, undefined, "Zugangscode:");
        inputTicket = skatutil.createInputField(parent, "ticket", btnLoginWithTicket_click);
        inputTicket.placeholder = "Zugangscode";
        inputTicket.focus();
        skatutil.createButton(parent, "Anmelden", btnLoginWithTicket_click);
    };

    const renderConfirmStartGame = (parent) => {
        skatutil.createButton(parent, "OK", btnConfirmStartGame_click, "ConfirmStartGame");
    };

    const renderWaitForUsers = (parent) => {
        skatutil.create(parent, "p", "activity", "Du musst warten bis alle angemeldet sind.");
    };

    const renderTicket = (parent) => {
        skatutil.create(parent, "p", undefined, "Dein Zugangscode ist");
        skatutil.create(parent, "span", "ticket", ticket);
        skatutil.create(parent, "p", undefined, "Schreib ihn Dir auf, um Dich erneuert anmelden zu k\u00F6nnen.");
    };

    const renderStartGame = (parent) => {
        skatutil.create(parent, "p", undefined, "Alle sind angemeldet! Starte das Spiel!");
        skatutil.createButton(parent, "Spiel starten", btnStartGame_click);
    };

    const renderCards = (parent, cards, show, action) => {
        cards.forEach(card => {
            let gif = show ? getCardImage(card) : "/images/skat/back.gif";
            let img = skatutil.createImg(parent, "skat-card-img", 90, 140, `${gif}`);
            if (show) {
                img.title = card.description;
                if (action) {
                    img.addEventListener("click", e => action(card));
                }
            }
            else {
                img.title = "Skat";
            }
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
                        skatutil.createImg(parent, "skat-card-img", 90, 140, "/images/skat/empty.png");
                    }
                }
                else {
                    renderCards(parent, model.skatTable.stitch, true, btnStitchCard_click);
                }
            }
        }
    }

    const renderLastStitch = (parent) => {
        if (!model.skatTable.gameStarted || !model.skatTable.lastStitch || !showLastStitch) return;
        if (model.skatTable.lastStitch.length > 0) {
            renderCards(parent, model.skatTable.lastStitch, true, btnLastStitchCard_click);
        }
    }

    const renderSkat = (parent) => {
        if (model.skatTable.gameStarted || model.skatTable.skatTaken && !model.skatTable.canPickupSkat) return;
        if (!model.skatTable.canPickupSkat) {
            renderCards(parent, [1, 1], false);
        }
        else {
            if (model.skatTable.skat.length == 0) {
                if (!model.skatTable.gameEnded) {
                    skatutil.createImg(parent, "skat-card-img", 90, 140, "/images/skat/empty.png");
                }
            }
            else {
                renderCards(parent, model.skatTable.skat, true, btnSkatCard_click);
            }
        }
    };

    const renderOuvertOrScoreCards = (parent) => {
        if (model.skatTable.gameStarted && !model.skatTable.gameEnded &&
            model.skatTable.gamePlayer && model.skatTable.gamePlayer.game.option.ouvert &&
            model.skatTable.gamePlayer.name != model.skatTable.player.name) {
            renderCards(parent, model.skatTable.ouvert, true);
        }
        else if (model.skatTable.gameEnded) {
            renderCards(parent, model.skatTable.stitches, true);
        }
    };

    const renderActions = (parent) => {
        if (showLastStitch) {
            skatutil.createButton(parent, "Letzten Stich zur\u00FCcklegen", btnLastStitchCard_click, "StopViewLastStitch");
        }
        else {
            if (model.skatTable.canCollectStitch) {
                skatutil.createButton(parent, "Sitch einsammeln", btnStitchCard_click, "CollectStitch");
            }
            if (model.skatTable.canViewLastStitch) {
                skatutil.createButton(parent, "Letzten Stich zeigen", btnLastStitchCard_click, "ViewLastStitch");
            }
            if (model.skatTable.canStartNewGame) {
                if (!model.currentUser.startGameConfirmed) {
                    skatutil.createButton(parent, "OK", btnConfirmStartGame_click, "ConfirmStartGame");
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
                    }
                    else {
                        skatutil.create(parent, "p", undefined, "Du wartest auf die Best\u00E4tigung Deiner Mitspieler.");
                    }
                }
            }
            if (model.skatTable.canGiveUp) {
                skatutil.createButton(parent, "Aufgeben", btnGiveUp_click, "GiveUp");
            }
        }
        model.skatTable.actions.forEach((action) => {
            skatutil.createButton(parent, action.description, btnAction_click, action.name);
        });
        if (parent.childElementCount > 0) {
            document.body.style.backgroundColor = "#005000"; // @TODO: use CSS style
        }
    };

    const renderGame = (parent) => {
        if (!model.skatTable.player || !model.skatTable.player.game) return;
        let game = model.skatTable.player.game;
        let gameStarted = model.skatTable.gameStarted
        skatutil.createRadiobutton(parent, "r1", "gametype", "Grand", "Grand", game.type == "Grand", btnGameType_click, gameStarted);
        skatutil.createRadiobutton(parent, "r2", "gametype", "Null", "Null", game.type == "Null", btnGameType_click, gameStarted);
        skatutil.createRadiobutton(parent, "r3", "gametype", "Clubs", "Kreuz", game.type == "Color" && game.color == "Clubs", btnGameType_click, gameStarted);
        skatutil.createRadiobutton(parent, "r4", "gametype", "Spades", "Pik", game.type == "Color" && game.color == "Spades", btnGameType_click, gameStarted);
        skatutil.createRadiobutton(parent, "r5", "gametype", "Hearts", "Herz", game.type == "Color" && game.color == "Hearts", btnGameType_click, gameStarted);
        skatutil.createRadiobutton(parent, "r6", "gametype", "Diamonds", "Karo", game.type == "Color" && game.color == "Diamonds", btnGameType_click, gameStarted);

        checkBoxOuvert = skatutil.createCheckbox(parent, "c1", "Ouvert", "Ouvert", game.option.ouvert, btnGameOption_click, !model.skatTable.canSetOuvert);
        checkBoxHand = skatutil.createCheckbox(parent, "c2", "Hand", "Hand", game.option.hand, btnGameOption_click, !model.skatTable.canSetHand);
        checkBoxSchneider = skatutil.createCheckbox(parent, "c3", "Schneider", "Schneider", game.option.schneider, btnGameOption_click, !model.skatTable.canSetSchneider);
        checkBoxSchwarz = skatutil.createCheckbox(parent, "c4", "Schwarz", "Schwarz", game.option.schwarz, btnGameOption_click, !model.skatTable.canSetSchwarz);
    };

    const renderHeader = (parent) => {
        skatutil.create(parent, "p", "activity", model.skatTable.message);
    };

    const renderSummary = (parent) => {
        model.skatTable.players.forEach((p) => {
            let classname = p.name == model.skatTable.player.name ? "summary-currentplayer" : "summary-otherplayer";
            skatutil.create(parent, "div", classname, p.summary);
        });
    };

    const renderCopyright = (parent) => {
        let time = new Date().toLocaleTimeString();
        let prefix = "Myna Skat Version 1.0.4. Copyright 2020 Niels Stockfleth. Alle Rechte vorbehalten";
        skatutil.create(parent, "p", "copyright", `${prefix}. Letzte Aktualisierung: ${time}.`);
    };

    const renderMainPage = (parent) => {
        let divSummary = skatutil.createDiv(parent, "summary-section");
        let divHeader = skatutil.createDiv(parent, "header-section");
        let divOuvert = skatutil.createDiv(parent);
        let divCenter = skatutil.createDiv(parent);
        let divStitch = skatutil.createDiv(divCenter, "stitch-section");
        let divCards = skatutil.createDiv(divCenter, "cards-section");
        let divActions = skatutil.createDiv(parent);
        let divGame = skatutil.createDiv(parent);
        let divCopyright = skatutil.createDiv(parent);

        if (model.skatTable.player &&
            model.skatTable.currentPlayer &&
            model.skatTable.player.name == model.skatTable.currentPlayer.name ||
            !model.skatTable.gameStarted &&
            model.skatTable.gamePlayer &&
            model.skatTable.gamePlayer.name == model.skatTable.player.name) {
            document.body.style.backgroundColor = "#005000"; // @TODO: use CSS class to change color
        }

        renderSummary(divSummary);
        renderHeader(divHeader);
        renderOuvertOrScoreCards(divOuvert);
        renderStitch(divStitch);
        renderCards(divCards, model.skatTable.cards, true, btnPlayerCard_click);
        renderActions(divActions);
        renderGame(divGame);
        renderCopyright(divCopyright);
    };

    const renderUsername = (parent) => {
        if (!model.currentUser) {
            skatutil.create(parent, "p", undefined, "Du bist nicht angemeldet!");
            ticket = undefined;
            skatutil.clearTicket();
            renderLoginWithTicket();
            return;
        }
        document.title = `Myna Skat - ${model.currentUser.name}`;
        if (model.skatTable) {
            renderMainPage(parent);
        }
        else {
            renderUserList(parent);
            renderTicket(parent);
            let wait = model.allUsers.length < 3;
            if (!wait) {
                // @TODO: helper here
                model.allUsers.forEach((user) => {
                    if (!user.startGameConfirmed) {
                        wait = true;
                    }
                });
            }
            if (wait) {
                if (!model.currentUser.startGameConfirmed) {
                    renderConfirmStartGame(parent);
                }
                else {
                    renderWaitForUsers(parent);
                }
            }
            else {
                renderStartGame(parent);
            }
            renderCopyright(parent);
        }
    };

    const renderModel = (m) => {
        console.log(m);
        model = m;
        skatutil.setState(model.state);
        let body = document.querySelector("body");
        skatutil.removeAllChildren(body);
        body.style.backgroundColor = "#067E00"; // @TODO: use CSS

        divMain = skatutil.createDiv(body, "main");

        if (model.allUsers.length == 0) {
            skatutil.clearTicket();
            ticket = undefined;
        }

        if (!ticket) {
            renderUserList(divMain);
            if (model.allUsers.length == 3) {
                renderTableFull(divMain);
                renderLoginWithTicket(divMain);
            }
            else {
                renderLogin(divMain);
            }
            renderCopyright(divMain);
        }
        else {
            renderUsername(divMain);
        }
        timerEnabled = true; // rendering finished, enable timer now, all calls sync
    };

    const render = () => {
        // no timer callback during fetch
        timerEnabled = false;
        ticket = skatutil.getTicket();
        fetch("api/skat/model", { headers: { "ticket": ticket } })
            .then(response => response.json())
            .then(m => renderModel(m));
    };

    // callbacks

    const btnLogin_click = (elem) => {
        const name = inputUsername.value.trim();
        if (name.length > 0) {
            fetch("api/skat/login", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(name)
            })
                .then(response => response.json())
                .then((ticket) => {
                    if (ticket && ticket.length > 0) {
                        skatutil.setTicket(ticket);
                    }
                    render();
                })
        }
    };

    const btnLoginWithTicket_click = (elem) => {
        const t = inputTicket.value.trim();
        if (t.length > 0) {
            skatutil.setTicket(t);
            render();
        }
    };

    const btnStartGame_click = (elem) => {
        timerEnabled = false;
        fetch("api/skat/newgame", { method: "POST", headers: { "ticket": ticket } })
            .then(response => response.json())
            .then(() => render());
    };

    const btnConfirmStartGame_click = (elem) => {
        timerEnabled = false;
        fetch("api/skat/confirmstartgame", { method: "POST", headers: { "ticket": ticket } })
            .then(response => response.json())
            .then(() => render());
    };

    const btnGiveUp_click = (elem) => {
        timerEnabled = false;
        fetch("api/skat/giveup", { method: "POST", headers: { "ticket": ticket } })
            .then(response => response.json())
            .then(() => render());
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
            .then(() => render());
    };

    const btnGameOption_click = (elem) => {
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
            .then(() => render());
    };

    const btnAction_click = (elem) => {
        timerEnabled = false;
        console.log(elem);
        let action = elem.value;
        console.log(action);
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
            .then(() => render());
    };

    const btnPlayerCard_click = (card) => {
        if (!model.skatTable.player ||
            model.skatTable.currentPlayer && model.skatTable.player.name != model.skatTable.currentPlayer.name ||
            !card ||
            showLastStitch) return;
        let found = false;
        // @TODO: improve
        model.skatTable.playableCards.forEach(c => {
            if (c.orderNumber == card.orderNumber) {
                found = true;
            }
        })
        if (!found) return;
        timerEnabled = false; // async call
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
            .then(() => render());
    };

    const btnSkatCard_click = (card) => {
        if (!model.skatTable.player || !card || showLastStitch || !model.skatTable.canPickupSkat) return;
        timerEnabled = false; // async call
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
            .then(() => render());
    };

    const btnLastStitchCard_click = (card) => {
        showLastStitch = !showLastStitch;
        render();
    };

    const btnStitchCard_click = () => {
        if (!model.skatTable.player || showLastStitch || !model.skatTable.canCollectStitch) return;
        timerEnabled = false; // async call
        fetch("api/skat/collectstitch", { method: "POST", headers: { "ticket": ticket } })
            .then(response => response.json())
            .then(() => render());
    };

    function ontimer() {
        if (!timerEnabled) return;
        fetch("api/skat/state")
            .then(response => response.json())
            .then((d) => {
                if (d && d > 0) {
                    let statechanged = skatutil.getState();
                    if (!statechanged || d > statechanged) {
                        console.log(d);
                        skatutil.setState(d);
                        render(); // next try only if async rendering has finished
                    }
                }
            });
    }

    // --- public API

    return {
        render: render,
        ontimer: ontimer
    };
})();

window.onload = () => {
    window.setInterval(skatui.ontimer, 1000);
    skatui.render();
};
