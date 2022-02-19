"use strict";

var backgammon = (() => {

    // state

    let ticket;
    let model;
    let timerEnabled = false;

    let currentUser;
    let photos = {};
    let guestMode = false;

    let helpDiv;

    let endGameClicked = false;
    let giveUpClicked = false;

    let version = "0.9.4";

    let dirty;

    const colorCheckerWhite = "white";
    const colorCheckerBlack = "darkred";
    const colorCheckerSelected = "blue";
    const colorCheckerMoveTo = "lightblue";
    const colorPointLight = "palegreen";
    const colorPointDark = "darkseagreen";
    const colorLightBrown = "navajowhite";
    const colorDarkBrown = "peru";
    const colorShadowLight = "white";
    const colorShadowDark = "black";

    let checkerRadius;
    let pointWidth;
    let pointHeight;
    let borderWidth;
    let borderHeight;
    let checkerOverlay;
    let gapPointHeight
    let gapCheckers;

    let lastPos;
    let selectedItem;
    let moveItem;

    let diceImageMap = new Map();

    // helper

    const handleError = (err) => {
        console.error(err);
        window.sessionStorage.removeItem("backgammonstate");
        endGameClicked = false;
        giveUpClicked = false;
        enableTimer();
    }

    const clearTicket = () => {
        ticket = undefined;
        sessionStorage.removeItem("backgammonticket");
        localStorage.removeItem("backgammonticket");
    };

    const setTicket = (t) => {
        ticket = t;
        sessionStorage.setItem("backgammonticket", t);
        localStorage.setItem("backgammonticket", t);
    };

    const getTicket = () => {
        let t = sessionStorage.getItem("backgammonticket");
        if (!t) {
            t = localStorage.getItem("backgammonticket");
            if (t) {
                sessionStorage.setItem("backgammonticket", t);
            }
        }
        return t;
    }

    const getState = () => {
        return window.sessionStorage.getItem("backgammonstate");
    };

    const setState = (state) => {
        window.sessionStorage.setItem("backgammonstate", state);
    };

    const enableTimer = () => {
        console.log("TIMER ENABLED!");
        timerEnabled = true;
    };

    const disableTimer = () => {
        console.log("TIMER DISABLED!");
        timerEnabled = false;
    };

    const isPlaying = () => {
        return model && model.board && !model.board.gameOver;
    };

    const isActivePlayer = () => {
        return model && model.currentUser && model.board && model.currentUser.name === getActivePlayer();
    };

    const isBlackPlayer = () => {
        return model && model.currentUser && model.board && model.currentUser.name === model.board.blackPlayer;
    };

    const getOpponentPlayer = () => {
        if (isBlackPlayer()) {
            return model.board.whitePlayer;
        }
        return model.board.blackPlayer;
    };

    const getActivePlayer = () => {
        if (model.board.currentColor === "B") {
            return model.board.blackPlayer;
        }
        return model.board.whitePlayer;
    };

    const getStateMessage = () => {
        let msg = "";
        const pConfirmNextGame = document.getElementById("confirmnextgame");
        if (model && model.board) {
            if (model.board.gameOver) {
                if (model.currentUser && model.currentUser.name === model.board.winner) {
                    msg = "Du hast gewonnen.";
                }
                else {
                    msg = `${model.board.winner} hat gewonnen.`;                
                }
                if (model.board.giveUp) {
                    msg += " Das Spiel wurde aufgegeben.";
                }
                if (ticket && model.currentUser) {
                    if (model.board.nextGameRequested) {
                        if (model.currentUser.startGameConfirmed) {
                            controls.create(pConfirmNextGame, "p", undefined, "Du wartest auf die Best\u00E4tigung.");
                            document.body.className = "inactive-background";
                        }
                        else {
                            controls.create(pConfirmNextGame, "span", "confirmation", "N\u00E4chstes Spiel?");
                            controls.createButton(pConfirmNextGame, "Ja", () => btnConfirmNextGame_click(true));
                            controls.createButton(pConfirmNextGame, "Nein", () => btnConfirmNextGame_click(false));
                            document.body.className = "active-background";
                        }
                    }
                    else {
                        controls.createButton(pConfirmNextGame, "N\u00E4chstes Spiel", btnNextGame_click, "newgame").id = "newgame";
                        document.body.className = "active-background";
                    }
                }
            }
            else {
                controls.removeAllChildren(pConfirmNextGame);
                // roll to find out which player starts
                if (!model.board.gameStarted) {
                    if (model.board.doubleRoll) {
                        msg = "Pasch!";
                        if (model.currentUser) {
                            msg += " Du musst erneuert w\u00FCrfeln!";
                            document.body.className = "active-background";
                        }
                    }
                    else if (model.board.currentRollNumbers.length == 0) {
                        msg = "Wer f\u00E4ngt an?";
                        if (model.currentUser) {
                            document.body.className = "active-background";
                        }
                    }
                    else {
                        if (model.currentUser && !model.board.hasStartRoll) {
                            msg = "Du bist am Zug.";
                            document.body.className = "active-background";
                        }
                        else {
                            msg = `${getActivePlayer()} ist am Zug.`;
                            document.body.className = "inactive-background";
                        }
                    }
                }
                // game started
                else {
                    if (isActivePlayer()) {                        
                        msg = "Du bist dran.";
                        if (model.board.currentRollNumbers.length > 0) {
                            if (model.board.moves.length == 0) {
                                msg += " Es gibt keinen Zug mehr.";
                            }
                            else {
                                msg += ` Verbleibende Schritte: ${model.board.remainingRollNumbers.join(", ")}.`;
                            }
                        }
                        document.body.className = "active-background";
                    }
                    else {
                        msg = `${getActivePlayer()} ist am Zug.`;
                        if (model.board.currentRollNumbers.length > 0) {
                            if (model.board.moves.length == 0) {
                                msg += " Es gibt keinen Zug mehr.";
                            }
                            else {
                                msg += ` Verbleibende Schritte: ${model.board.remainingRollNumbers.join(", ")}.`;
                            }
                        }
                        document.body.className = "inactive-background";
                    }
                }
            }
        }
        return msg;
    };

    const updateCanvasWidthAndHeight = (canvas) => {
        canvas.width = pointWidth * 14 + 2 * borderWidth + 2;
        canvas.height = pointHeight * 2 + gapPointHeight + 2 * borderHeight + 2;
    };

    const calculatePointWidth = () => {
        const xmin = utils.is_mobile() ? 330 : 400;
        const w = Math.max(xmin, Math.min(window.innerHeight - 100, window.innerWidth - 100));
        setPointWidth(w);
    };

    const setPointWidth = (w) => {
        gapCheckers = utils.is_mobile() ? 2 : 7;
        pointWidth = Math.floor(w / 14);
        checkerRadius = Math.floor(pointWidth / 2) - gapCheckers;
        pointHeight = 5 * checkerRadius * 2;
        gapPointHeight = 4 * checkerRadius;
        checkerOverlay = Math.floor(checkerRadius / 2);
        borderWidth = Math.floor(pointWidth / 3);
        borderHeight = borderWidth;
    };

    const getPositionFromEvent = (evt) => {
        if (evt.offsetY > borderHeight && evt.offsetY < pointHeight * 2 + gapPointHeight + borderHeight) {
            if (evt.offsetX > borderWidth && evt.offsetX < borderWidth + 13 * pointWidth) {
                let x = Math.floor((evt.offsetX - borderWidth) / pointWidth);
                let y = Math.floor((evt.offsetY - borderHeight) / pointHeight);
                let pos = undefined;
                if (isBlackPlayer()) {
                    if (x >= 7 && x <= 12) {
                        if (y == 0) {
                            pos = 11 + x;
                        }
                        else {
                            pos = 12 - x;
                        }
                    }
                    else if (x == 6) {
                        pos = -1; // bar
                    }
                    else {
                        if (y == 0) {
                            pos = 12 + x;
                        }
                        else {
                            pos = 11 - x;
                        }
                    }
                }
                else {
                    if (x >= 7 && x <= 12) {
                        if (y == 0) {
                            pos = 12 - x;
                        }
                        else {
                            pos = 23 - (12 - x);
                        }
                    }
                    else if (x == 6) {
                        pos = -1; // bar
                    }
                    else {
                        if (y == 0) {
                            pos = 11 - x;
                        }
                        else {
                            pos = 12 + x;
                        }
                    }
                }
                return pos;
            }
        }
        return undefined;
    };
    
    const drawBoard = (ctx, items) => {
        const xm = pointWidth * 13 + 2 * borderWidth;
        const ym = pointHeight * 2 + gapPointHeight + 2 * borderHeight;
        // dark brown border
        ctx.fillStyle = colorDarkBrown;
        ctx.fillRect(0, 0, xm, ym);
        // light brown background
        ctx.fillStyle = colorLightBrown;
        ctx.fillRect(borderWidth, borderHeight, xm - 2 * borderWidth, ym - 2 * borderHeight);
        // bar
        ctx.fillStyle = colorDarkBrown;
        ctx.fillRect(borderWidth + pointWidth * 6, borderHeight, pointWidth, ym - 2 * borderHeight);
        // outer border
        ctx.strokeStyle = colorShadowDark;
        ctx.strokeRect(0, 0, xm, ym);
        // shadow black
        ctx.beginPath();
        ctx.moveTo(borderWidth, borderHeight);
        ctx.lineTo(borderWidth, ym - 1 * borderHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(borderWidth, borderHeight);
        ctx.lineTo(borderWidth + 6 * pointWidth, borderHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(borderWidth + 7 * pointWidth, borderHeight);
        ctx.lineTo(borderWidth + 7 * pointWidth, ym - 1 * borderHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(borderWidth + 7 * pointWidth, borderHeight);
        ctx.lineTo(borderWidth + 13 * pointWidth, borderHeight);
        ctx.stroke();
        // shadow white
        ctx.strokeStyle = colorShadowLight;
        ctx.beginPath();
        ctx.moveTo(borderWidth + 6 * pointWidth, borderHeight);
        ctx.lineTo(borderWidth + 6 * pointWidth, ym - 1 * borderHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(borderWidth, ym - 1 * borderHeight);
        ctx.lineTo(borderWidth + 6 * pointWidth, ym - 1 * borderHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(borderWidth + 13 * pointWidth, borderHeight);
        ctx.lineTo(borderWidth + 13 * pointWidth, ym - 1 * borderHeight);
        ctx.lineTo(borderWidth + 7 * pointWidth, ym - 1 * borderHeight);
        ctx.stroke();
        // points
        for (let pos = 0; pos <= 23; pos++) {
            drawPoint(ctx, pos);
        }
        // checkers
        items.forEach((item) => {
            drawCheckers(ctx, item.position, item.count, item.color);
        });
    };

    const drawCheckers = (ctx, pos, count, col) => {
        for (let idx = 1; idx <= count; idx++) {
            drawChecker(ctx, pos, idx, col);
        }
    };

    const drawChecker = (ctx, pos, nr, col, fillColor) => {
        const ym = pointHeight * 2 + gapPointHeight + 2 * borderHeight;
        let x, y;
        // y
        const n = Math.floor((nr - 1) / 5);
        const y1 = borderHeight + 1 + (nr - 1 - n * 5) * checkerRadius * 2 + checkerRadius - n * checkerOverlay;
        const y2 = ym - borderHeight - 1 - (nr - 1 - n * 5) * checkerRadius * 2 - checkerRadius - n * checkerOverlay;
        if (isBlackPlayer() && pos >= 12 && pos <= 23 ||
            !isBlackPlayer() && pos >= 0 && pos <= 11 ||
            (pos === -1 && (isBlackPlayer() && col === "B" || !isBlackPlayer() && col === "W")) ||
            (pos === -2 && (isBlackPlayer() && col === "W" || !isBlackPlayer() && col === "B"))) {
            y = y1;
        }
        else {
            y = y2;
        }
        // x
        if (pos === -1) {
            x = borderWidth + 6 * pointWidth + gapCheckers + checkerRadius;
        }
        else if (pos === -2) {
            x = 2 * borderWidth + 13 * pointWidth + checkerRadius + gapCheckers;
        }
        else if (pos >= 0 && pos <= 5) {
            x = borderWidth + 7 * pointWidth + (5 - pos) * pointWidth + gapCheckers + checkerRadius;
        }
        else if (pos >= 6 && pos <= 11) {
            x = borderWidth + (11 - pos) * pointWidth + gapCheckers + checkerRadius;
        }
        else if (pos >= 12 && pos <= 17) {
            x = borderWidth + (pos - 12) * pointWidth + gapCheckers + checkerRadius;
        }
        else if (pos >= 18 && pos <= 23) {
            x = borderWidth + 7 * pointWidth + (pos - 18) * pointWidth + gapCheckers + checkerRadius;
        }
        if (fillColor) {
            ctx.fillStyle = fillColor;
        }
        else {
            ctx.fillStyle = col === "W" ? colorCheckerWhite : colorCheckerBlack;
        }
        ctx.beginPath();
        ctx.arc(x, y, checkerRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = colorShadowDark;
        ctx.beginPath();
        ctx.arc(x, y, checkerRadius, 0, 2 * Math.PI);
        ctx.stroke();
    };

    const drawPoint = (ctx, pos) => {
        const w = pointWidth - gapCheckers;
        const ym = pointHeight * 2 + gapPointHeight + 2 * borderHeight;
        let x, y, yt;
        if (pos >= 0 && pos <= 5) {
            x = borderWidth + 7 * pointWidth + (5 - pos) * pointWidth + gapCheckers;
            y = borderHeight + 1;
            yt = y + pointHeight;
        }
        else if (pos >= 6 && pos <= 11) {
            x = borderWidth + (11 - pos) * pointWidth + gapCheckers;
            y = borderHeight + 1;
            yt = y + pointHeight;
        }
        else if (pos >= 12 && pos <= 17) {
            x = borderWidth + (pos - 12) * pointWidth + gapCheckers;
            y = ym - borderHeight - 1;
            yt = y - pointHeight;
        }
        else if (pos >= 18 && pos <= 23) {
            x = borderWidth + (7 + pos - 18) * pointWidth + gapCheckers;
            y = ym - borderHeight - 1;
            yt = y - pointHeight;
        }
        ctx.fillStyle = pos % 2 == 0 ? colorPointLight : colorPointDark;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w / 2, yt);
        ctx.lineTo(x + pointWidth - 2 * gapCheckers, y);
        ctx.fill();
        // shadow
        ctx.strokeStyle = colorShadowLight;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w / 2, yt);
        ctx.stroke();
        ctx.strokeStyle = colorShadowDark;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, yt);
        ctx.lineTo(x + pointWidth - 2 * gapCheckers, y);
        ctx.stroke();
    };

    const drawDice = (ctx) => {
        if (model && model.board && (model.board.currentRollNumbers.length > 0 || model.board.doubleRoll)) {
            const numbers = [];
            if (model.board.doubleRoll) {
                numbers.push(model.board.doubleRoll);
                numbers.push(model.board.doubleRoll);
            }
            else {
                model.board.currentRollNumbers.forEach((nr) => {
                    numbers.push(nr);
                });
            }
            let count = 0;
            numbers.forEach((nr) => {
                const image = diceImageMap.get(`dice${nr}`);
                if (!image) return; // not yet loaded
                let x = borderWidth + 2 * pointWidth + count * checkerRadius * 3;
                if (isActivePlayer()) {
                    x += 7 * pointWidth;
                }
                ctx.drawImage(image, x, borderHeight + pointHeight + checkerRadius, checkerRadius * 2, checkerRadius * 2);
                count++;
            });
        }
    };

    const draw = () => {
        const canvas = document.getElementById("playground-id");
        if (canvas && dirty) {
            console.log("DRAW");
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (model && model.board && model.board.items) {
                drawBoard(ctx, model.board.items);
                drawDice(ctx);
                if (moveItem !== undefined) {
                    drawChecker(ctx, moveItem.position, moveItem.count, model.board.currentColor, colorCheckerSelected);
                    if (lastPos !== undefined && lastPos != moveItem.position) {
                        model.board.moves.forEach((move) => {
                            if (move.from === moveItem.position && move.to === lastPos) {
                                let cnt = 1;
                                model.board.items.forEach((item) => {
                                    if (item.position === lastPos) {
                                        cnt = item.count;
                                    }
                                });
                                drawChecker(ctx, lastPos, cnt, model.board.currentColor, colorCheckerMoveTo);
                            }
                        });
                    }
                }
                else if (selectedItem !== undefined) {
                    drawChecker(ctx, selectedItem.position, selectedItem.count, model.board.currentColor, colorCheckerMoveTo);
                }
            }
            dirty = false;
        }
        window.requestAnimationFrame(draw);
    };

    const updateMessage = () => {
        const messageElem = document.getElementById("message-id");
        if (messageElem) {
            messageElem.textContent = getStateMessage();
        }
    };

    const updateLastUpdateTime = () => {
        const span = document.getElementById("lastupdatetime");
        if (span) {
            const time = new Date().toLocaleTimeString("de-DE");
            span.textContent = `. Letzte Aktualisierung: ${time}. `;
        }
    };

    const updateGiveUpButton = () => {
        const giveup = document.getElementById("giveupbutton");
        if (giveup) {
            const hide =
                !isPlaying() ||
                !isActivePlayer() ||
                !model.board.gameStarted;
            giveup.classList.toggle("hide", hide);
        }
    };

    const updateSkipButton = () => {
        const skip = document.getElementById("skipbutton");
        if (skip) {
            const hide =
                !isPlaying() ||
                !isActivePlayer() ||
                !model.board.gameStarted ||
                model.board.currentRollNumbers.length == 0 ||
                model.board.moves.length > 0;
            skip.classList.toggle("hide", hide);
        }
    };

    const updateRollButton = () => {
        const roll = document.getElementById("rollbutton");
        if (roll) {
            let hide = !model.currentUser || !isPlaying();
            if (!hide) {
                if (model.board.gameStarted) {
                    if (!isActivePlayer()) {
                        hide = true;
                    }
                    else {
                        hide = model.board.currentRollNumbers.length > 0;
                    }
                }
                else if (model.board.hasStartRoll) {
                    hide = true;
                }
            }
            roll.classList.toggle("hide", hide);
        }
    };

    const update = () => {
        disableTimer();
        utils.fetch_api_call("api/backgammon/model", { headers: { "ticket": ticket } },
            (m) => {
                console.log(`MODEL RETRIEVED (update): New state ${m.state}!`);
                console.log(m);
                setState(m.state);
                model = m;
                if (isPlaying()) {
                    updateRollButton();
                    updateSkipButton();
                    updateGiveUpButton();
                    updateLastUpdateTime();
                    updateMessage();
                    dirty = true;
                    enableTimer();
                }
                else {
                    renderModel(model);
                }
            },
            handleError);
    };

    const login = (name) => {
        const token = utils.get_authentication_token();
        if (!name || name.length == 0 || !token) {
            window.location.replace("/backgammon");
            return;
        }
        disableTimer();
        utils.fetch_api_call("api/backgammon/login",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify(name)
            },
            (loginModel) => {
                console.log(`LOGGED IN (login with name): new state ${loginModel.state}!`);
                setState(loginModel.state);
                if (loginModel.ticket && loginModel.ticket.length > 0) {
                    setTicket(loginModel.ticket);
                }
                window.location.replace("/backgammon");
            },
            (errMsg) => {
                handleError(errMsg);
                window.location.replace("/backgammon");
            });
    };

    const loadDiceImages = (finished) => {
        let loaded = 0;
        for (let idx = 1; idx < 7; idx++) {
            const image = new Image();
            image.onload = (evt) => {
                diceImageMap.set(`dice${idx}`, evt.currentTarget);
                loaded++;
                if (finished && loaded == 6) {
                    finished();
                }
            };
            image.src = `/images/backgammon/dice-${idx}.svg`;
        }
    };

    // rendering

    const renderBoardFull = (parent, ignoreToken) => {
        if (ignoreToken || !currentUser) {
            controls.create(parent, "p", undefined, "Das Brett ist leider schon belegt!");
            controls.createButton(parent, "Zuschauen als Gast", () => window.open("/backgammon?guest", "_blank"));
            document.body.className = "inactive-background";
        }
        else {
            let divParent = controls.createDiv(parent);
            model.allUsers.forEach((backgammonuser) => {
                if (backgammonuser.name == currentUser.name) {
                    window.location.href = `backgammon?login=${encodeURI(currentUser.name)}`;
                    return;
                }
            });
            renderBoardFull(divParent, true);
        }
    };

    const renderUserList = (parent) => {
        helpDiv = controls.createDiv(document.body);
        utils.create_menu(parent);
        let title = currentUser ? `${currentUser.name} - Backgammon` : "Backgammon";
        const h1 = controls.create(parent, "h1", undefined, title);
        const helpImg = controls.createImg(h1, "help-button", 24, 24, "/images/buttons/help.png", "Hilfe");
        helpImg.addEventListener("click", () => onUpdateHelp(true));
        if (currentUser && currentUser.photo) {
            let imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo, "Profil");
            imgPhoto.addEventListener("click", () => window.location.href = "/usermgmt");
        }
        // draw sample board
        const sampleCanvas = controls.create(parent, "canvas", "sample-playground");
        updateCanvasWidthAndHeight(sampleCanvas);
        const ctx = sampleCanvas.getContext("2d");
        drawBoard(ctx, []);
        // render content area        
        const divContent = controls.createDiv(parent, "content");
        if (model.allUsers.length > 0) {
            controls.create(divContent, "p", undefined, "Es sind folgende Spieler angemeldet:");
            const ul = controls.create(divContent, "ul");
            let idx = 1;
            model.allUsers.forEach((user) => {
                const li = controls.create(ul, "li");
                const img = controls.createImg(li, "player-img", 45, 45, undefined, user.name);
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
        utils.set_menu_items(currentUser);
    };

    const renderLogin = (parent) => {
        document.body.className = "active-background";
        if (!currentUser) {
            controls.create(parent, "p", undefined, "Du kannst noch mitspielen! Wie ist Dein Name?");
            const label = controls.createLabel(parent, undefined, "Name:");
            label.htmlFor = "username-id";
            const inputUsername = controls.createInputField(parent, "Name", btnLogin_click, "username-input", 20, 32);
            inputUsername.placeholder = "Name";
            inputUsername.id = "username-id";
            if (!utils.is_mobile()) {
                inputUsername.focus();
            }
            controls.createButton(parent, "Anmelden", btnLogin_click);
        }
        else {
            const parentdiv = controls.create(parent, "p");
            controls.create(parentdiv, "p", undefined, `${currentUser.name}! Du kannst noch mitspielen!`);
            const inputUsername = controls.createInputField(parentdiv, "Name", btnLogin_click, "hide", 20, 32);
            inputUsername.value = currentUser.name;
            inputUsername.id = "username-id";
            controls.createButton(parentdiv, "Mitspielen", btnLogin_click);
        }
    };

    const renderWaitForUsers = (parent) => {
        controls.create(parent, "p", "activity", "Du musst warten, bis sich ein weiterer Spieler anmeldet.");
        document.body.className = "inactive-background";
    };

    const renderStartGame = (parent) => {
        const divActions = controls.createDiv(parent);
        if (model && model.board) {
        }
        else {
            controls.createButton(divActions, "Spiel starten", btnStartGame_click);
            document.body.className = "active-background";
        }
    };

    const renderActions = (parent) => {
        if (model && model.board) {
            const opponent = document.getElementById("opponent-player-id");
            const current = document.getElementById("current-player-id");
            current.className = "playername-white";
            opponent.className = "playername-black";
            if (isBlackPlayer()) {
                current.className = "playername-black";
                opponent.className = "playername-white";
            }
            else {
                current.className = "playername-white";
                opponent.className = "playername-black";
            }
            if (model.currentUser) {
                opponent.textContent = getOpponentPlayer();
                current.textContent = model.currentUser.name;
            }
            else {
                opponent.textContent = model.board.blackPlayer;
                current.textContent = model.board.whitePlayer;
            }
        }
        controls.create(parent, "p").id = "message-id";
        controls.create(parent, "p").id = "confirmnextgame"
        if (endGameClicked) {
            controls.create(parent, "span", "confirmation", "Willst Du Dich wirklich abmelden?");
            controls.createButton(parent, "Ja", btnEndGame_click, "EndGameYes");
            controls.createButton(parent, "Nein", btnEndGame_click, "EndGameNo");
            document.body.className = "active-background";
            return true;
        }
        if (giveUpClicked) {
            controls.create(parent, "span", "confirmation", "Willst Du wirklich aufgeben?");
            controls.createButton(parent, "Ja", btnGiveUp_click, "GiveUpYes");
            controls.createButton(parent, "Nein", btnGiveUp_click, "GiveUpNo");
            document.body.className = "active-background";
            return true;
        }
        controls.createButton(parent, "W\u00FCrfeln", btnRoll_click, "rollbutton").id = "rollbutton";
        updateRollButton();
        controls.createButton(parent, "Weiter", btnSkip_click, "skipbutton").id = "skipbutton";
        updateSkipButton();
        controls.createButton(parent, "Aufgeben", btnGiveUp_click, "giveupbutton").id = "giveupbutton";
        updateGiveUpButton();
        return false;
    };

    const renderCopyright = (parent) => {
        const div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Backgammon ${version}. Copyright 2022 `);
        controls.createA(div, "copyright", "/markdown?page=homepage", "Niels Stockfleth");
        const time = new Date().toLocaleTimeString("de-DE");
        controls.create(div, "span", "copyright", `. Letzte Aktualisierung: ${time}. `).id = "lastupdatetime";
        if (ticket) {
            if (!model.board) {
                controls.createButton(div, "Abmelden", btnLogout_click, "Logout", "logout-button");
            }
            else {
                controls.createButton(div, "Abmelden", btnEndGame_click, "EndGame", "logout-button");
            }
        }
    };

    const renderMainPage = (parent) => {
        calculatePointWidth();
        controls.createDiv(parent).id = "opponent-player-id";
        const canvas = controls.create(parent, "canvas", "playground");
        canvas.id = "playground-id";
        updateCanvasWidthAndHeight(canvas);
        canvas.addEventListener("mousedown", onCanvasMouseDown);
        canvas.addEventListener("mousemove", onCanvasMouseMove);
        canvas.addEventListener("mouseleave", onCanvasMouseLeave);
        controls.createDiv(parent).id = "current-player-id";
        const divActions = controls.createDiv(parent, "actions-section");
        divActions.id = "actions"
        if (!renderActions(divActions)) {
            updateMessage();
        }
        renderCopyright(parent);
        dirty = true;
    };

    const renderUsername = (parent) => {
        if (!model.currentUser) {
            clearTicket();
            render();
            return;
        }
        document.title = `Backgammon - ${model.currentUser.name}`;
        if (model && model.board) {
            renderMainPage(parent);
        }
        else {
            renderUserList(parent);
            if (model.allUsers.length < 2) {
                renderWaitForUsers(parent);
            }
            else {
                renderStartGame(parent);
            }
            renderCopyright(parent);
        }
    };

    const renderModel = (m) => {
        model = m;
        controls.removeAllChildren(document.body);
        utils.create_cookies_banner(document.body);
        document.body.className = "inactive-background";
        if (model.allUsers.length == 0) {
            clearTicket();
        }
        const divLayoutLeft = controls.createDiv(document.body, "layout-left");
        const divMain = controls.createDiv(divLayoutLeft);
        if (!ticket) {
            if (guestMode) {
                document.title = "Backgammon - Gastansicht";
                if (model.board) {
                    renderMainPage(divMain);
                }
                else {
                    controls.create(divMain, "p", undefined, "Es wird gerade nicht gespielt.");
                    renderCopyright(divMain);
                }
            }
            else {
                renderUserList(divMain);
                if (model.isBoardFull) {
                    renderBoardFull(divMain);
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
        enableTimer();
    };

    const render = () => {
        const params = new URLSearchParams(window.location.search);
        if (params.has("login")) {
            login(params.get("login"));
            return;
        }
        ticket = getTicket();
        if (params.has("guest")) {
            guestMode = true;
        }
        const xmin = utils.is_mobile() ? 330 : 400;
        setPointWidth(xmin);
        disableTimer();
        utils.fetch_api_call("api/backgammon/model", { headers: { "ticket": ticket } },
            (m) => {
                console.log(`MODEL RETRIEVED (render): new state: ${m.state}!`);
                console.log(m);
                setState(m.state);
                renderModel(m);
            },
            handleError);
    };

    const renderInit = () => {
        currentUser = undefined;
        dirty = false;
        const token = utils.get_authentication_token();
        if (!token) {
            render();
            window.requestAnimationFrame(draw);
            return;
        }
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            (user) => {
                currentUser = user;
                render();
                window.requestAnimationFrame(draw);
            },
            (errmsg) => {
                console.error(errmsg);
                utils.logout();
                render();
                window.requestAnimationFrame(draw);
            });
    };

    // callbacks

    const onCanvasMouseDown = () => {
        if (moveItem === undefined && selectedItem != undefined) {
            moveItem = selectedItem;
            selectedItem == undefined;
            lastPos = undefined;
            dirty = true;
        }
        else if (moveItem !== undefined) {
            let found = false;
            let pos = lastPos === undefined ? -2 : lastPos;
            model.board.moves.forEach((move) => {
                if (!found && move.from === moveItem.position && move.to === pos) {
                    moveItem = undefined;
                    selectedItem = undefined;
                    lastPos = undefined;
                    found = true;
                    disableTimer();
                    console.log("MOVE...");
                    utils.fetch_api_call("api/backgammon/move",
                        {
                            method: "POST",
                            headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                            body: JSON.stringify({ from: move.from, to: move.to })
                        },
                        (state) => {
                            console.log(`MOVED: new state: ${state}.`);
                            setState(state);
                            update();
                            enableTimer();
                        },
                        handleError);
                }
            });
            if (!found) {
                moveItem = undefined;
                selectedItem = undefined;
                lastPos = undefined;
                dirty = true;
            }
        }
    };

    const onCanvasMouseMove = (evt) => {
        if (model && model.board && model.board.gameStarted &&
            isActivePlayer() && model.board.items && model.board.moves) {
            const pos = getPositionFromEvent(evt);
            if (lastPos != pos) {
                selectedItem = undefined;
                let clickedItem = undefined;
                const currentColor = isBlackPlayer() ? "B" : "W";
                if (moveItem === undefined) {
                    model.board.items.forEach((item) => {
                        if (item.position === pos && item.color == currentColor) {
                            clickedItem = item;
                        }
                    });
                    if (clickedItem !== undefined) {
                        model.board.moves.forEach((move) => {
                            if (moveItem === undefined && move.from == clickedItem.position) {
                                selectedItem = clickedItem;
                            }
                        });
                    }
                }
                lastPos = pos;
                dirty = true;
            }
        }
    };

    const onCanvasMouseLeave = () => {
        selectedItem = undefined;
        lastPos = undefined;
        dirty = true;
    };

    const onUpdateHelp = (show) => {
        if (helpDiv) {
            helpDiv.className = show ? "help-div" : undefined;
            controls.removeAllChildren(helpDiv);
            if (show) {
                const contentDiv = controls.createDiv(helpDiv, "help-content");
                const mdDiv = controls.createDiv(contentDiv, "help-item");
                utils.fetch_api_call("/api/pwdman/markdown/help-backgammon", undefined, (html) => mdDiv.innerHTML = html);
                controls.createButton(contentDiv, "OK", () => onUpdateHelp(false)).focus();
            }
        }
    };

    const btnLogin_click = () => {
        const inputUsername = document.getElementById("username-id");
        const name = inputUsername.value.trim();
        if (name.length > 0) {
            disableTimer();
            let token = utils.get_authentication_token();
            if (!token) {
                token = "";
            }
            utils.fetch_api_call("api/backgammon/login",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(name)
                },
                (loginModel) => {
                    console.log(`LOGGED IN: New state ${loginModel.state}!`);
                    console.log(loginModel);
                    setState(loginModel.state);
                    if (loginModel.isAuthenticationRequired) {
                        let nexturl = `/backgammon?login=${name}`;
                        window.location.href = "/pwdman?nexturl=" + encodeURI(nexturl)
                            + "&username=" + encodeURI(name);
                        return;
                    }
                    else if (loginModel.ticket && loginModel.ticket.length > 0) {
                        setTicket(loginModel.ticket);
                    }
                    render();
                },
                (errMsg) => {
                    document.getElementById("login-error-id").textContent = errMsg;
                    enableTimer();
                });
        }
    };

    const btnRoll_click = () => {
        disableTimer();
        utils.fetch_api_call("api/backgammon/roll", { method: "POST", headers: { "ticket": ticket } },
            (state) => {
                console.log(`ROLLED: new state: ${state}.`);
                setState(state);
                update();
                enableTimer();
            },
            handleError);
    };

    const btnNextGame_click = () => {
        disableTimer();
        utils.fetch_api_call("api/backgammon/nextgame", { method: "POST", headers: { "ticket": ticket } },
            (state) => {
                console.log(`NEXT GAME REQUESTED: New state ${state}!`);
                setState(state);
                render();
            },
            handleError);
    };

    const btnConfirmNextGame_click = (ok) => {
        disableTimer();
        utils.fetch_api_call("api/backgammon/confirmnextgame",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                body: JSON.stringify(ok)
            },
            (state) => {
                console.log(`CONFIRM NEXT GAME: New state ${state}!`);
                setState(state);
                render();
            },
            handleError);
    };

    const btnStartGame_click = () => {
        disableTimer();
        utils.fetch_api_call("api/backgammon/newgame",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket }
            },
            (state) => {
                console.log(`NEW GAME STARTED: New state ${state}!`);
                setState(state);
                render();
            },
            handleError);
    };

    const btnSkip_click = () => {
        disableTimer();
        utils.fetch_api_call("api/backgammon/skip", { method: "POST", headers: { "ticket": ticket } },
            (state) => {
                console.log(`SKIPPED: New state ${state}!`);
                setState(state);
                update();
                enableTimer();
            },
            handleError);
    };

    const btnGiveUp_click = (elem) => {
        if (elem.value == "GiveUpYes") {
            disableTimer();
            utils.fetch_api_call("api/backgammon/giveup", { method: "POST", headers: { "ticket": ticket } },
                (state) => {
                    console.log(`GAVE UP: New state ${state}!`);
                    setState(state);
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

    const btnEndGame_click = (elem) => {
        if (elem.value == "EndGameYes") {
            disableTimer();
            utils.fetch_api_call("api/backgammon/logout", { method: "POST", headers: { "ticket": ticket } },
                (state) => {
                    console.log(`LOGGED OUT (game): New state ${state}!`);
                    setState(state);
                    endGameClicked = false;
                    render();
                },
                handleError);
        }
        else if (elem.value == "EndGameNo") {
            endGameClicked = false;
            render();
        }
        else {
            endGameClicked = true;
            render();
        }
    };

    const btnLogout_click = () => {
        disableTimer();
        utils.fetch_api_call("api/backgammon/logout", { method: "POST", headers: { "ticket": ticket } },
            (state) => {
                console.log(`LOGGED OUT (ticket): New state ${state}!`);
                setState(state);
                ticket = undefined;
                window.sessionStorage.removeItem("backgammonticket");
                window.localStorage.removeItem("backgammonticket");
                render();
            },
            handleError);
    };

    const onResize = () => {
        const canvas = document.getElementById("playground-id");
        if (canvas && model && model.board && model.board.items) {
            calculatePointWidth();
            updateCanvasWidthAndHeight(canvas);
            dirty = true;
        }
    };

    const onTimer = () => {
        if (!timerEnabled) return;
        utils.fetch_api_call("api/backgammon/state", undefined,
            (state) => {
                const currentState = getState();
                if (currentState === undefined || state > currentState) {
                    console.log(`ON TIMER: STATE CHANGED: ${state}!`);
                    setState(state);
                    if (model && model.board) {
                        update();
                    }
                    else {
                        render();
                    }
                }
            },
            (errMsg) => console.error(errMsg));
    }

    // --- public API

    return {
        renderInit: renderInit,
        onTimer: onTimer,
        onResize: onResize,
        loadDiceImages: loadDiceImages
    };
})();

window.onload = () => {
    window.setInterval(backgammon.onTimer, 1000);
    window.addEventListener("resize", backgammon.onResize);
    utils.auth_lltoken(() => backgammon.loadDiceImages(backgammon.renderInit));
};

window.onclick = (event) => utils.hide_menu(event);
