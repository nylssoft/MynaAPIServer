"use strict";

var backgammon = (() => {

    // UI elements

    let inputUsername;
    let canvas;

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

    let pixelPerField;

    let version = "0.0.1";

    let dirty;

    // helper

    const handleError = (err) => {
        console.error(err);
        window.sessionStorage.removeItem("backgammonstate");
        timerEnabled = true;
        endGameClicked = false;
        giveUpClicked = false;
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

    const getPositionFromEvent = (evt) => {
        /*
        const ymax = pixelPerField * 7;
        const y = ymax - evt.offsetY + pixelPerField;
        const x = evt.offsetX;
        const col = Math.floor(x / pixelPerField);
        const row = Math.floor(y / pixelPerField);
        if (row >= 0 && row <= 7 && col >= 0 && col <= 7) {
            if (!model.currentUser || model.currentUser.name === model.board.whitePlayer) {
                return { row: row, col: col };
            }
            else {
                return { row: 7 - row, col: col };
            }
        }
        */
        return undefined;
    };

    const drawBoard = (ctx) => {
        /*
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                drawEmptyField(ctx, r, c);
            }
        }
        drawFigures(ctx);
        */
    };

    const drawEmptyField = (ctx, row, column) => {
        /*
        if (isBlackPlayer()) {
            row = 7 - row;
        }
        let color = row % 2 == 0 ? colorLight : colorDark;
        if (column % 2 == 1) {
            color = color == colorLight ? colorDark : colorLight;
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.fillRect(column * pixelPerField, pixelPerField * 7 - row * pixelPerField, pixelPerField, pixelPerField);
        */
    };

    const drawSampleBoard = (ctx) => {
        /*
        const px = 32;
        ctx.clearRect(0, 0, 8 * px, 8 * px);
        for (let r = 0; r < 8; r++) {
            let color = r % 2 == 0 ? colorLight : colorDark;
            for (let c = 0; c < 8; c++) {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.fillRect(c * px, px * 7 - r * px, px, px);
                color = color == colorLight ? colorDark : colorLight;
            }
        }
        const ymax = px * 7;
        let figures = [
            { type: "P", color: "W", row: 1, column: 0 },
            { type: "P", color: "W", row: 1, column: 1 },
            { type: "P", color: "W", row: 1, column: 2 },
            { type: "P", color: "W", row: 1, column: 3 },
            { type: "P", color: "W", row: 1, column: 4 },
            { type: "P", color: "W", row: 1, column: 5 },
            { type: "P", color: "W", row: 1, column: 6 },
            { type: "P", color: "W", row: 1, column: 7 },
            { type: "R", color: "W", row: 0, column: 0 },
            { type: "N", color: "W", row: 0, column: 1 },
            { type: "B", color: "W", row: 0, column: 2 },
            { type: "Q", color: "W", row: 0, column: 3 },
            { type: "K", color: "W", row: 0, column: 4 },
            { type: "B", color: "W", row: 0, column: 5 },
            { type: "N", color: "W", row: 0, column: 6 },
            { type: "R", color: "W", row: 0, column: 7 },
            { type: "P", color: "B", row: 6, column: 0 },
            { type: "P", color: "B", row: 6, column: 1 },
            { type: "P", color: "B", row: 6, column: 2 },
            { type: "P", color: "B", row: 6, column: 3 },
            { type: "P", color: "B", row: 6, column: 4 },
            { type: "P", color: "B", row: 6, column: 5 },
            { type: "P", color: "B", row: 6, column: 6 },
            { type: "P", color: "B", row: 6, column: 7 },
            { type: "R", color: "B", row: 7, column: 0 },
            { type: "N", color: "B", row: 7, column: 1 },
            { type: "B", color: "B", row: 7, column: 2 },
            { type: "Q", color: "B", row: 7, column: 3 },
            { type: "K", color: "B", row: 7, column: 4 },
            { type: "B", color: "B", row: 7, column: 5 },
            { type: "N", color: "B", row: 7, column: 6 },
            { type: "R", color: "B", row: 7, column: 7 },
        ];
        figures.forEach(f => {
            const image = figureImageMap.get(`${f.type}${f.color}`);
            if (image) {
                ctx.drawImage(image, f.column * px, ymax - f.row * px, px, px);
            }
        });
        */
    };

    const drawFigure = (ctx, f) => {
        /*
        const image = figureImageMap.get(`${f.type}${f.color}`);
        if (!image) return; // not yet loaded
        const row = isBlackPlayer() ? 7 - f.row : f.row;
        ctx.drawImage(image, f.column * pixelPerField, pixelPerField * 7 - row * pixelPerField, pixelPerField, pixelPerField);
        */
    };

    const drawFigures = (ctx) => {
        /*
        if (!model.board || !model.board.figures) return;
        model.board.figures.forEach(f => drawFigure(ctx, f));
        */
    };

    const drawSelectionRect = (ctx, figure) => {
        /*
        drawRect(ctx, figure.row, figure.column, colorSelection);
        if (previewMoves) {
            figure.moves.forEach(move => {
                drawRect(ctx, move.row, move.column, colorPreview);
            });
        }
        */
    };

    const drawRect = (ctx, row, col, color) => {
        /*
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        if (isBlackPlayer()) {
            row = 7 - row;
        }
        ctx.strokeRect(col * pixelPerField + 6, pixelPerField * 7 - row * pixelPerField + 6, pixelPerField - 12, pixelPerField - 12);
        */
    };

    const loadFigureImages = (finished) => {
        /*
        const names = ["BW", "BB", "KW", "KB", "NW", "NB", "PW", "PB", "QW", "QB", "RW", "RB"];
        let loaded = 0;
        names.forEach(name => {
            const image = new Image();
            image.onload = (evt) => {
                figureImageMap.set(name, evt.currentTarget);
                loaded++;
                if (finished && loaded == names.length) {
                    finished();
                }
            };
            image.src = `/images/chess/${name}.svg`;
        });
        */
    };

    const draw = () => {
        /*
        if (frameCounterlastMoved > 0) {
            frameCounterlastMoved--;
            if (frameCounterlastMoved == 0) {
                dirty = true;
            }
        }
        if (canvas && (dirty || dirtyClock)) {
            let ctx = canvas.getContext("2d");
            if (dirty) {
                drawBoard(ctx);
                drawClocks(ctx);
                if (selectedFigure) {
                    drawSelectionRect(ctx, selectedFigure);
                }
                if (isPlaying() && (isActivePlayer() || guestMode) && frameCounterlastMoved > 0) {
                    let idx = 0;
                    let color;
                    model.board.lastMoves.forEach(lm => {
                        color = colorMoves[idx];
                        drawFigure(ctx, lm.figure);
                        drawRect(ctx, lm.figure.row, lm.figure.column, color);
                        drawEmptyField(ctx, lm.row, lm.column);
                        if (model.board.lastStroke &&
                            model.board.lastStroke.row == lm.row &&
                            model.board.lastStroke.column == lm.column) {
                            drawFigure(ctx, model.board.lastStroke);
                        }
                        drawRect(ctx, lm.row, lm.column, color);
                        idx = (idx + 1) % colorMoves.length;
                    });
                }
                dirty = false;
                dirtyClock = false;
            }
            if (dirtyClock) {
                drawClocks(ctx);
                dirtyClock = false;
            }
        }
        */
        window.requestAnimationFrame(draw);
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
                if (model.board.giveUp) {
                    msg = `Das Spiel wurde aufgegeben. Gewinner ist ${model.board.winner}.`;
                }
                else {
                    msg = `Das Spiel ist zu Ende. Gewinner ist ${model.board.winner}.`;
                }
                if (ticket) {
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

                const hasStart = model.board.hasStartRoll;
                const rolls = model.board.currentRollNumbers;
                const remain = model.board.remainingRollNumbers;
                const double = model.board.doubleRoll;
                // roll to find out which player starts
                if (!model.board.gameStarted) {
                    if (double) {
                        msg += `${double}-${double}! Pasch! Es muss erneuert gew\u00FCrfelt werden. `;
                    }
                    if (!hasStart) {
                        msg += "Du musst w\u00FCrfeln.";
                        if (rolls.length > 0) {
                            msg += ` ${getOpponentPlayer()} hat ${rolls[0]} gew\u00FCrfelt.`;
                        }
                        document.body.className = "active-background";
                    }
                    else {
                        msg = `Du hast eine ${rolls[0]} gew\u00FCrfelt.`;
                        document.body.className = "inactive-background";
                    }
                }
                // game started
                else {
                    if (isActivePlayer()) {
                        if (rolls.length == 0) {
                            msg = "Du musst w\u00FCrfeln!";
                        }
                        else {
                            if (remain.length == 0) {
                                msg = `Es wurde ${rolls[0]} - ${rolls[1]} gew\u00FCfelt. Du kannst nicht mehr ziehen. Du musst den Zug aufgeben.`;
                            }
                            else {
                                msg = `Es wurde ${rolls[0]} - ${rolls[1]} gew\u00FCfelt. Du musst ziehen.`;
                                if (remain.length == 1) {
                                    msg += ` Du kannst jetzt noch ${remain[0]} Schritte machen.`;
                                }
                            }
                        }
                        document.body.className = "active-background";
                    }
                    else {
                        if (rolls.length == 0) {
                            msg = `${getOpponentPlayer()} muss w\u00FCrfeln.`;
                        }
                        else {
                            msg = `${getOpponentPlayer()} hat ${rolls[0]} - ${rolls[1]} gew\u00FCrfelt und muss jetzt ziehen.`;
                        }
                        document.body.className = "inactive-background";
                    }
                }
            }
        }
        return msg;
    };

    const updateMessage = () => {
        const messageElem = document.getElementById("message");
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
            giveup.classList.toggle("hide", !isPlaying() || !isActivePlayer() || !model.board.gameStarted);
        }
    };

    const updateRollButton = () => {
        const giveup = document.getElementById("rollbutton");
        if (giveup) {
            let hide = !isPlaying();
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
            giveup.classList.toggle("hide", hide);
        }
    };

    const update = () => {
        utils.fetch_api_call("api/backgammon/model", { headers: { "ticket": ticket } },
            (m) => {
                console.log(m);
                model = m;
                if (isPlaying()) {
                    updateRollButton();
                    updateGiveUpButton();
                    updateLastUpdateTime();
                    updateMessage();
                    dirty = true;
                }
                else {
                    renderModel(model);
                }
            },
            handleError);
    };

    const handlePositionChange = (pos) => {
        /*
        if (selectedFigure) {
            if (isActivePlayer()) {
                for (let idx = 0; idx < selectedFigure.moves.length; idx++) {
                    const move = selectedFigure.moves[idx];
                    if (pos.row === move.row && pos.col === move.column) {
                        placeFigure(selectedFigure.row, selectedFigure.column, move.row, move.column);
                        break;
                    }
                }
            }
            selectedFigure = undefined;
            dirty = true;
        }
        else {
            const figure = getFigure(pos.row, pos.col);
            if (figure && figure.moves.length > 0) {
                selectedFigure = figure;
                dirty = true;
                return;
            }
        }
        */
    };

    const login = (name) => {
        const token = utils.get_authentication_token();
        if (!name || name.length == 0 || !token) {
            window.location.replace("/backgammon");
            return;
        }
        utils.fetch_api_call("api/backgammon/login",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify(name)
            },
            (loginModel) => {
                if (loginModel && loginModel.ticket && loginModel.ticket.length > 0) {
                    setTicket(loginModel.ticket);
                }
                window.location.replace("/backgammon");
            },
            (errMsg) => {
                handleError(errMsg);
                window.location.replace("/backgammon");
            });
    };

    const setPixelPerWidth = () => {
        const xmin = utils.is_mobile() ? 330 : 400;
        const w = Math.max(xmin, Math.min(window.innerHeight - 100, window.innerWidth - 100));
        pixelPerField = w / 10;
    };

    // rendering

    const renderBoardFull = (parent, ignoreToken) => {
        if (ignoreToken || !currentUser) {
            controls.create(parent, "p", undefined, "Das Backgammonbrett ist leider schon belegt!");
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
        let sampleBoard = controls.create(parent, "canvas", "playground");
        sampleBoard.width = 32 * 8;
        sampleBoard.height = 32 * 8;
        let ctx = sampleBoard.getContext("2d");
        drawSampleBoard(ctx, 32);
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
            let label = controls.createLabel(parent, undefined, "Name:");
            label.htmlFor = "username-id";
            inputUsername = controls.createInputField(parent, "Name", btnLogin_click, "username-input", 20, 32);
            inputUsername.placeholder = "Name";
            inputUsername.id = "username-id";
            if (!utils.is_mobile()) {
                inputUsername.focus();
            }
            controls.createButton(parent, "Anmelden", btnLogin_click);
        }
        else {
            let parentdiv = controls.create(parent, "p");
            controls.create(parentdiv, "p", undefined, `${currentUser.name}! Du kannst noch mitspielen!`);
            inputUsername = controls.createInputField(parentdiv, "Name", btnLogin_click, "hide", 20, 32);
            inputUsername.value = currentUser.name;
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
        controls.create(parent, "p", undefined, "").id = "message";
        controls.create(parent, "p", undefined, "").id = "confirmnextgame"
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
        controls.createButton(parent, "Aufgeben", btnGiveUp_click, "giveupbutton").id = "giveupbutton";
        updateGiveUpButton();
        return false;
    };

    const renderCopyright = (parent) => {
        const div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna Backgammon ${version}. Copyright 2022 `);
        controls.createA(div, "copyright", "/markdown?page=homepage", "Niels Stockfleth");
        const time = new Date().toLocaleTimeString("de-DE");
        controls.create(div, "span", "copyright", `. Letzte Aktualisierung: ${time}. `).id = "lastupdatetime";
        if (ticket) {
            if (!model.board) {
                controls.createButton(div, "Abmelden (Logout)", btnLogout_click, "Logout", "logout-button");
            }
            else {
                controls.createButton(div, "Abmelden (EndGame)", btnEndGame_click, "EndGame", "logout-button");
            }
        }
    };

    const renderMainPage = (parent) => {
        let xoff = utils.is_mobile() ? 50 : 100;
        canvas = controls.create(parent, "canvas", "playground");
        canvas.width = pixelPerField * 8 + xoff;
        canvas.height = pixelPerField * 8 + 10;
        canvas.addEventListener("mouseup", onCanvasMouseUp);
        canvas.addEventListener("mousedown", onCanvasMouseDown);
        canvas.addEventListener("mousemove", onCanvasMouseMove);
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
        window.sessionStorage.setItem("backgammonstate", model.state.state);
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
        timerEnabled = true;
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
        setPixelPerWidth();
        timerEnabled = false;
        utils.fetch_api_call("api/backgammon/model", { headers: { "ticket": ticket } },
            (m) => renderModel(m),
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

    const onCanvasMouseUp = (evt) => {
        /*
        if (isPlaying()) {
            const pos = getPositionFromEvent(evt);
            if (pos) {
                if (selectedFigure && (pos.row != selectedFigure.row || pos.col != selectedFigure.column)) {
                    handlePositionChange(pos);
                }
                else {
                    dirty = true;
                }
            }
        }
        */
    };

    const onCanvasMouseDown = (evt) => {
        /*
        if (isPlaying()) {
            const pos = getPositionFromEvent(evt);
            if (pos) {
                handlePositionChange(pos);
            }
        }
        */
    };

    const onCanvasMouseMove = (evt) => {
        /*
        if (isPlaying()) {
            const pos = getPositionFromEvent(evt);
            if (pos) {
                if (!lastPos || lastPos.col != pos.col || lastPos.row != pos.row) {
                    lastPos = pos;
                    dirty = true;
                }
            }
            else if (lastPos) {
                dirty = true;
            }
        }
        */
    };

    const onUpdateHelp = (show) => {
        if (helpDiv) {
            helpDiv.className = show ? "help-div" : undefined;
            controls.removeAllChildren(helpDiv);
            if (show) {
                let contentDiv = controls.createDiv(helpDiv, "help-content");
                let mdDiv = controls.createDiv(contentDiv, "help-item");
                utils.fetch_api_call("/api/pwdman/markdown/help-backgammon", undefined, (html) => mdDiv.innerHTML = html);
                controls.createButton(contentDiv, "OK", () => onUpdateHelp(false)).focus();
            }
        }
    };

    const btnLogin_click = () => {
        const name = inputUsername.value.trim();
        if (name.length > 0) {
            timerEnabled = false;
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
                    if (loginModel) {
                        if (loginModel.isAuthenticationRequired) {
                            let nexturl = `/backgammon?login=${name}`;
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

    const btnRoll_click = () => {
        timerEnabled = false;
        utils.fetch_api_call("api/backgammon/roll", { method: "POST", headers: { "ticket": ticket } },
            () => {
                timerEnabled = true;
                update();
            },
            handleError);
    };

    const btnNextGame_click = () => {
        timerEnabled = false;
        utils.fetch_api_call("api/backgammon/nextgame", { method: "POST", headers: { "ticket": ticket } },
            () => render(),
            handleError);
    };

    const btnConfirmNextGame_click = (ok) => {
        timerEnabled = false;
        utils.fetch_api_call("api/backgammon/confirmnextgame",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                body: JSON.stringify(ok)
            },
            () => render(),
            handleError);
    };

    const btnStartGame_click = () => {
        timerEnabled = false;
        utils.fetch_api_call("api/backgammon/newgame",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket }
            },
            () => render(),
            handleError);
    };

    const btnGiveUp_click = (elem) => {
        if (elem.value == "GiveUpYes") {
            timerEnabled = false;
            utils.fetch_api_call("api/backgammon/giveup", { method: "POST", headers: { "ticket": ticket } },
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

    const btnEndGame_click = (elem) => {
        if (elem.value == "EndGameYes") {
            timerEnabled = false;
            utils.fetch_api_call("api/backgammon/logout", { method: "POST", headers: { "ticket": ticket } },
                () => {
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
        timerEnabled = false;
        utils.fetch_api_call("api/backgammon/logout", { method: "POST", headers: { "ticket": ticket } },
            () => {
                ticket = undefined;
                window.sessionStorage.removeItem("backgammonticket");
                window.localStorage.removeItem("backgammonticket");
                render();
            },
            handleError);
    };

    const onResize = () => {
        if (canvas && model && model.board) {
            setPixelPerWidth();
            canvas.width = pixelPerField * 8 + 100;
            canvas.height = pixelPerField * 8;
            dirty = true;
        }
    };

    const onTimer = () => {
        if (!timerEnabled) return;
        utils.fetch_api_call("api/backgammon/state", undefined,
            (sm) => {
                const d = sm.state;
                const statechanged = window.sessionStorage.getItem("backgammonstate");
                if (statechanged === undefined || d > statechanged) {
                    console.log("STATE CHANGED!");
                    console.log(statechanged);
                    console.log(d);
                    window.sessionStorage.setItem("backgammonstate", d);
                    if (model && model.board) {
                        update();
                    }
                    else {
                        render();
                    }
                }
                else if (model && model.board) {
                    model.state = sm;
                }
            },
            (errMsg) => console.error(errMsg));
    }

    // --- public API

    return {
        renderInit: renderInit,
        onTimer: onTimer,
        onResize: onResize,
    };
})();

window.onload = () => {
    window.setInterval(backgammon.onTimer, 1000);
    window.addEventListener("resize", backgammon.onResize);
    utils.auth_lltoken(backgammon.renderInit);
};

window.onclick = (event) => utils.hide_menu(event);