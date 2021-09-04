"use strict";

var chess = (() => {

    // UI elements

    let inputUsername;
    let canvas;

    // state

    let ticket;
    let model;
    let timerEnabled = false;

    let dirty;
    let dirtyClock;

    let currentUser;
    let photos = {};
    let guestMode = false;

    let helpDiv;

    let endGameClicked = false;

    let figureImageMap = new Map();
    let pixelPerField;

    let lastPos;
    let selectedFigure;
    let previewMoves = false;

    let frameCounterlastMoved = 0;

    let simulate = false;
    let simulateCounter = 0;
    let simulateDelay = 5;

    let version = "0.9.2";

    // helper

    const handleError = (err) => {
        console.error(err);
        window.sessionStorage.removeItem("chessstate");
        timerEnabled = true;
        endGameClicked = false;
    }

    const clearTicket = () => {
        ticket = undefined;
        sessionStorage.removeItem("chessticket");
        localStorage.removeItem("chessticket");
    };

    const setTicket = (t) => {
        ticket = t;
        sessionStorage.setItem("chessticket", t);
        localStorage.setItem("chessticket", t);
    };

    const getTicket = () => {
        let t = sessionStorage.getItem("chessticket");
        if (!t) {
            t = localStorage.getItem("chessticket");
            if (t) {
                sessionStorage.setItem("chessticket", t);
            }
        }
        return t;
    }

    const getFigure = (row, col) => {
        if (!model.board || !model.board.figures) return undefined;
        for (let idx = 0; idx < model.board.figures.length; idx++) {
            const f = model.board.figures[idx];
            if (f.row === row && f.column === col) {
                return f;
            }
        }
        return undefined;
    };

    const getPositionFromEvent = (evt) => {
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
        return undefined;
    };

    const formatClock = (totalSeconds) => {
        let m = "";
        let s = "";
        const min = Math.floor(totalSeconds / 60);
        const sec = totalSeconds - min * 60;
        if (min < 10) {
            m = "0";
        }
        m += `${min}`;
        if (sec < 10) {
            s = "0";
        }
        s += `${sec}`;
        return `${m}:${s}`;
    };

    const drawClocks = (ctx) => {
        if (!model || !model.state || !model.board) return;
        let w = formatClock(model.state.whiteClock);
        let b = formatClock(model.state.blackClock);
        let pw = model.board.whitePlayer;
        let pb = model.board.blackPlayer;
        ctx.font = "18px Arial";
        ctx.fillStyle = "#7FFF00";
        if (isBlackPlayer()) {
            [w, b] = [b, w];
            [pw, pb] = [pb, pw];
        }
        ctx.clearRect(8 * pixelPerField + 20, 0, 8 * pixelPerField + 100, 8 * pixelPerField);
        ctx.fillText(pb, 8 * pixelPerField + 20, 18);
        ctx.fillText(b, 8 * pixelPerField + 20, 48);
        ctx.fillText(pw, 8 * pixelPerField + 20, 8 * pixelPerField - 48);
        ctx.fillText(w, 8 * pixelPerField + 20, 8 * pixelPerField - 18);
    };

    const drawEmptyBoard = (ctx) => {
        const color1 = "#b88b4a";
        const color2 = "#e3c16f";
        const px = pixelPerField;
        ctx.clearRect(0, 0, 8 * px, 8 * px);
        for (let r = 0; r < 8; r++) {
            ctx.fillStyle = "#7FFF00";
            let color;
            if (!model.currentUser || !model.board || model.currentUser.name === model.board.whitePlayer) {
                color = r % 2 == 0 ? color1 : color2;
            }
            else {
                color = r % 2 == 0 ? color2 : color1;
            }
            for (let c = 0; c < 8; c++) {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.fillRect(c * px, px * 7 - r * px, px, px);
                color = color == color1 ? color2 : color1;
            }
        }
    };

    const drawSampleBoard = (ctx) => {
        const color1 = "#b88b4a";
        const color2 = "#e3c16f";
        const px = 32;
        ctx.clearRect(0, 0, 8 * px, 8 * px);
        for (let r = 0; r < 8; r++) {
            ctx.fillStyle = "#7FFF00";
            let color = r % 2 == 0 ? color1 : color2;
            for (let c = 0; c < 8; c++) {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.fillRect(c * px, px * 7 - r * px, px, px);
                color = color == color1 ? color2 : color1;
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
    };

    const drawFigures = (ctx) => {
        if (!model.board || !model.board.figures) return;
        const ymax = pixelPerField * 7;
        model.board.figures.forEach(f => {
            const image = figureImageMap.get(`${f.type}${f.color}`);
            if (image) {
                if (!model.currentUser || model.currentUser.name === model.board.whitePlayer) {
                    ctx.drawImage(image, f.column * pixelPerField, ymax - f.row * pixelPerField, pixelPerField, pixelPerField);
                }
                else {
                    const rowInverse = 7 - f.row;
                    ctx.drawImage(image, f.column * pixelPerField ,
                        ymax - rowInverse * pixelPerField, pixelPerField, pixelPerField);
                }
            }
        });
    };

    const drawSelectionRect = (ctx, figure) => {
        const ymax = pixelPerField * 7;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#38f';
        let row = figure.row;
        if (model.currentUser && model.currentUser.name === model.board.blackPlayer) {
            row = 7 - figure.row;
        }
        ctx.strokeRect(figure.column * pixelPerField + 6, ymax - row * pixelPerField + 6, pixelPerField - 12, pixelPerField - 12);
        if (previewMoves) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#000000';
            figure.moves.forEach(move => {
                let row = move.row;
                if (model.currentUser.name === model.board.blackPlayer) {
                    row = 7 - move.row;
                }
                ctx.strokeRect(
                    16 + move.column * pixelPerField,
                    16 + ymax - row * pixelPerField,
                    pixelPerField - 32,
                    pixelPerField - 32);
            });
        }
    };

    const drawRect = (ctx, row, col, color) => {
        const ymax = pixelPerField * 7;
        ctx.lineWidth = 3;
        if (color) {
            ctx.strokeStyle = color;
        }
        else {
            ctx.strokeStyle = '#38f';
        }
        if (model.currentUser && model.currentUser.name === model.board.blackPlayer) {
            row = 7 - row;
        }
        ctx.strokeRect(col * pixelPerField + 6, ymax - row * pixelPerField + 6, pixelPerField - 12, pixelPerField - 12);
    };

    const loadFigureImages = (finished) => {
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
    };

    const draw = () => {
        if (frameCounterlastMoved > 0) {
            frameCounterlastMoved--;
            if (frameCounterlastMoved == 0) {
                dirty = true;
            }
        }
        if (canvas && (dirty || dirtyClock)) {
            let ctx = canvas.getContext("2d");
            if (dirty) {
                drawEmptyBoard(ctx);
                drawFigures(ctx);
                drawClocks(ctx);
                if (selectedFigure) {
                    drawSelectionRect(ctx, selectedFigure);
                }
                if (isPlaying() && isActivePlayer() && frameCounterlastMoved > 0) {
                    if (model.board.lastMovedFigure) {
                        drawRect(ctx, model.board.lastMovedFigure.row, model.board.lastMovedFigure.column, "yellow");
                    }
                    if (model.board.lastMovedDestination) {
                        drawRect(ctx, model.board.lastMovedDestination.row, model.board.lastMovedDestination.column, "yellow");
                    }
                }
                dirty = false;
                dirtyClock = false;
            }
            if (dirtyClock) {
                drawClocks(ctx);
                dirtyClock = false;
            }
        }
        window.requestAnimationFrame(draw);
    };

    const isGameStarted = () => {
        return model && model.board && model.board.gameStarted;
    };

    const isPlaying = () => {
        return isGameStarted() && !model.board.gameOver;
    };

    const isActivePlayer = () => {
        return model && model.currentUser && model.board && model.currentUser.name === getActivePlayer();
    };

    const isBlackPlayer = () => {
        return model && model.currentUser && model.board && model.currentUser.name === model.board.blackPlayer;
    }

    const getActivePlayer = () => {
        if (model.board.currentColor === "B") {
            return model.board.blackPlayer;
        }
        return model.board.whitePlayer;
    };

    const getStateMessage = () => {
        let msg = "";
        const pConfirmNextGame = document.getElementById("confirmnextgame");
        if (isGameStarted()) {
            if (model.board.gameOver) {
                if (model.board.checkMate) {
                    msg = `Schach Matt! Das Spiel ist zu Ende. Gewinner ist ${model.board.winner}.`;
                }
                else if (model.board.staleMate) {
                    msg = "Patt! Das Spiel ist zu Ende.";
                }
                else if (model.board.timeOut) {
                    msg = `Die Zeit ist abgelaufen! Das Spiel ist zu Ende. Gewinner ist ${model.board.winner}.`;
                }
                else if (model.board.kingStrike) {
                    msg = `Der K\u00F6nig wurde geschlagen! Das Spiel ist zu Ende. Gewinner ist ${model.board.winner}.`;
                }
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
            else {
                controls.removeAllChildren(pConfirmNextGame);
                if (model.board.check) {
                    msg = "Schach! ";
                }
                if (isActivePlayer()) {
                    msg += "Du bist am Zug!";
                    document.body.className = "active-background";
                }
                else {
                    document.body.className = "inactive-background";
                }
            }
        }
        return msg;
    };

    const simulateMove = () => {
        let moves = [];
        model.board.figures.forEach(f => {
            f.moves.forEach(m => moves.push({figure: f, move: m}));
        });
        if (moves.length > 0) {
            const m = moves[Math.floor(Math.random() * moves.length)];
            placeFigure(m.figure.row, m.figure.column, m.move.row, m.move.column);
        }
    };

    const placeFigure = (fromRow, fromColumn, toRow, toColumn) => {
        document.body.style.cursor = "wait";
        utils.fetch_api_call("api/chess/place",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                body: JSON.stringify(
                    {
                        FromRow: fromRow,
                        FromColumn: fromColumn,
                        ToRow: toRow,
                        ToColumn: toColumn
                    })
            },
            () => {
                document.body.style.cursor = "default";
                selectedFigure = undefined;
                if (simulate) {
                    simulateCounter = simulateDelay;
                }
                update();
            },
            (errMsg) => {
                handleError(errMsg);
                document.body.style.cursor = "default";
                selectedFigure = undefined;
                dirty = true;
            });
    };

    const updateMessage = () => {
        const messageElem = document.getElementById("message");
        if (messageElem) {
            messageElem.textContent = getStateMessage();
        }
    };

    const update = () => {
        utils.fetch_api_call("api/chess/model", { headers: { "ticket": ticket } },
            (m) => {
                model = m;
                if (isPlaying()) {
                    if (isActivePlayer()) {
                        frameCounterlastMoved = 60; // 1 second
                    }
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
    };

    const login = (name) => {
        const token = utils.get_authentication_token();
        if (!name || name.length == 0 || !token) {
            window.location.replace("/chess");
            return;
        }
        utils.fetch_api_call("api/chess/login",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify(name)
            },
            (loginModel) => {
                if (loginModel && loginModel.ticket && loginModel.ticket.length > 0) {
                    setTicket(loginModel.ticket);
                }
                window.location.replace("/chess");
            },
            (errMsg) => {
                handleError(errMsg);
                window.location.replace("/chess");
            });
    };

    // rendering

    const renderBoardFull = (parent, ignoreToken) => {
        if (ignoreToken || !currentUser) {
            controls.create(parent, "p", undefined, "Das Schachbrett ist leider schon belegt!");
            controls.createButton(parent, "Zuschauen als Gast", () => window.open("/chess?guest", "_blank"));
            document.body.className = "inactive-background";
        }
        else {
            let divParent = controls.createDiv(parent);
            model.allUsers.forEach((chessuser) => {
                if (chessuser.name == currentUser.name) {
                    window.location.href = `chess?login=${encodeURI(currentUser.name)}`;
                    return;
                }
            });
            renderBoardFull(divParent, true);
        }
    };

    const renderUserList = (parent) => {
        helpDiv = controls.createDiv(document.body);
        utils.create_menu(parent);
        let title = currentUser ? `${currentUser.name} - Schach` : "Schach";
        const h1 = controls.create(parent, "h1", undefined, title);
        const helpImg = controls.createImg(h1, "help-button", 24, 24, "/images/buttons/help.png");
        helpImg.title = "Hilfe";
        helpImg.addEventListener("click", () => onUpdateHelp(true));
        if (currentUser && currentUser.photo) {
            let imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo);
            imgPhoto.title = "Profil";
            imgPhoto.addEventListener("click", () => window.location.href = "/usermgmt");
        }
        // draw sample chessboard
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
                const img = controls.createImg(li, "player-img", 45, 45);
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
        const divColor = controls.createDiv(parent);
        const colorOptions = [{ name: "Weiss", value: "W" }, { name: "Schwarz", value: "B" }];
        const labelColor = controls.createLabel(divColor, undefined, "Farbe: ");
        labelColor.htmlFor = "mycolor";
        const selectColor = controls.createSelect(divColor, "mycolor", "options", colorOptions);
        if (isBlackPlayer()) {
            selectColor.value = "B";
        }
        else {
            selectColor.value = "W";
        }
        const divGame = controls.createDiv(parent);
        const gameOptions = [
            { name: "Blitzschach 5 Minuten", value: "fastchess" },
            { name: "Schach 15 Minuten", value: "chess15" },
            { name: "Schach 30 Minuten", value: "chess30" },
            { name: "Schach 60 Minuten", value: "chess60" }
        ];
        const labelGame = controls.createLabel(divGame, undefined, "Spiel: ");
        labelGame.htmlFor = "gameoption";
        const selectGame = controls.createSelect(divGame, "gameoption", "options", gameOptions);
        if (model.board) {
            selectGame.value = model.board.gameOption;
        }
        const divActions = controls.createDiv(parent);
        if (model && model.board && !model.board.gameStarted) {
            selectColor.disabled = true;
            selectGame.disabled = true;
            if (!model.currentUser.startGameConfirmed) {
                controls.create(divActions, "span", "confirmation", "Spiel starten?");
                controls.createButton(divActions, "Ja", () => btnConfirmStartGame_click(true));
                controls.createButton(divActions, "Nein", () => btnConfirmStartGame_click(false));
                document.body.className = "active-background";
            }
            else {
                controls.create(divActions, "p", undefined, "Du wartest auf die Best\u00E4tigung.");
                document.body.className = "inactive-background";
            }
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
        return false;
    };

    const renderCopyright = (parent) => {
        const div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna Schach ${version}. Copyright 2021 `);
        controls.createA(div, "copyright", "/markdown?page=homepage", "Niels Stockfleth");
        const time = new Date().toLocaleTimeString("de-DE");
        controls.create(div, "span", "copyright", `. Letzte Aktualisierung: ${time}. `);
        if (ticket && (!model.board || !model.board.gameStarted)) {
            controls.createButton(div, "Abmelden", btnLogout_click, "Logout", "logout-button");
        }
        if (isGameStarted()) {
            controls.createButton(div, "Abmelden", btnEndGame_click, "EndGame", "logout-button");
        }
    };

    const renderMainPage = (parent) => {
        canvas = controls.create(parent, "canvas", "playground");
        canvas.width = pixelPerField * 8 + 100;
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
        document.title = `Schach - ${model.currentUser.name}`;
        if (model.board && model.board.gameStarted) {
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
        window.sessionStorage.setItem("chessstate", model.state.state);
        controls.removeAllChildren(document.body);
        document.body.className = "inactive-background";
        if (model.allUsers.length == 0) {
            clearTicket();
        }
        const divLayoutLeft = controls.createDiv(document.body, "layout-left");
        const divMain = controls.createDiv(divLayoutLeft);
        if (!ticket) {
            if (guestMode) {
                document.title = "Schach - Gastansicht";
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
        if (params.has("preview")) {
            previewMoves = true;
        }
        if (params.has("simulate")) {
            simulate = true;
            const delay = parseInt(params.get("simulate"));
            if (!isNaN(delay)) {
                simulateDelay = delay;
            }
            else {
                simulateDelay = 5;
            }
            simulateCounter = simulateDelay;
        }
        selectedFigure = undefined;
        lastPos = undefined;
        const w = Math.max(400, Math.min(window.innerHeight - 100, window.innerWidth - 100));
        pixelPerField = w / 10;
        timerEnabled = false;
        utils.fetch_api_call("api/chess/model", { headers: { "ticket": ticket } },
            (m) => renderModel(m),
            handleError);
    };

    const renderInit = () => {
        currentUser = undefined;
        dirty = false;
        dirtyClock = false;
        frameCounterlastMoved = 60;
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
    };

    const onCanvasMouseDown = (evt) => {
        if (isPlaying()) {
            const pos = getPositionFromEvent(evt);
            if (pos) {
                handlePositionChange(pos);
            }
        }
    };

    const onCanvasMouseMove = (evt) => {
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
    };

    const onUpdateHelp = (show) => {
        if (helpDiv) {
            helpDiv.className = show ? "help-div" : undefined;
            controls.removeAllChildren(helpDiv);
            if (show) {
                let contentDiv = controls.createDiv(helpDiv, "help-content");
                let mdDiv = controls.createDiv(contentDiv, "help-item");
                utils.fetch_api_call("/api/pwdman/markdown/help-chess", undefined, (html) => mdDiv.innerHTML = html);
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
            utils.fetch_api_call("api/chess/login",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(name)
                },
                (loginModel) => {
                    if (loginModel) {
                        if (loginModel.isAuthenticationRequired) {
                            let nexturl = `/chess?login=${name}`;
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

    const btnNextGame_click = () => {
        timerEnabled = false;
        utils.fetch_api_call("api/chess/nextgame", { method: "POST", headers: { "ticket": ticket } },
            () => render(),
            handleError);
    };

    const btnConfirmNextGame_click = (ok) => {
        timerEnabled = false;
        utils.fetch_api_call("api/chess/confirmnextgame",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                body: JSON.stringify(ok)
            },
            () => render(),
            handleError);
    };

    const btnStartGame_click = () => {
        const myColor = document.getElementById("mycolor").value;
        const gameOption = document.getElementById("gameoption").value;
        if (myColor && gameOption) {
            timerEnabled = false;
            utils.fetch_api_call("api/chess/newgame",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                    body: JSON.stringify({
                        MyColor: myColor,
                        GameOption: gameOption
                    })
                },
                () => render(),
                handleError);
        }
    };

    const btnConfirmStartGame_click = (ok) => {
        timerEnabled = false;
        utils.fetch_api_call("api/chess/confirmstartgame",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                body: JSON.stringify(ok)
            },
            () => render(),
            handleError);
    };

    const btnEndGame_click = (elem) => {
        if (elem.value == "EndGameYes") {
            timerEnabled = false;
            utils.fetch_api_call("api/chess/logout", { method: "POST", headers: { "ticket": ticket } },
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
        utils.fetch_api_call("api/chess/logout", { method: "POST", headers: { "ticket": ticket } },
            () => {
                ticket = undefined;
                window.sessionStorage.removeItem("chessticket");
                window.localStorage.removeItem("chessticket");
                render();
            },
            handleError);
    };

    const onresize = () => {
        if (canvas && model && model.board && model.board.gameStarted) {
            const w = Math.max(400, Math.min(window.innerHeight - 100, window.innerWidth - 100));
            pixelPerField = w / 10;
            canvas.width = pixelPerField * 8 + 100;
            canvas.height = pixelPerField * 8;
            dirty = true;
        }
    };

    const ontimer = () => {
        if (!timerEnabled) return;
        if (simulate && isPlaying() && isActivePlayer() && simulateCounter > 0) {
            simulateCounter--;
            if (simulateCounter == 0) {
                simulateMove();
            }
        }
        utils.fetch_api_call("api/chess/state", undefined,
            (sm) => {
                const d = sm.state;
                const statechanged = window.sessionStorage.getItem("chessstate");
                if (!statechanged || d > statechanged) {
                    window.sessionStorage.setItem("chessstate", d);
                    if (model && model.board && model.board.gameStarted) {
                        update();
                    }
                    else {
                        render();
                    }
                }
                else if (model && model.board && model.board.gameStarted) {
                    model.state = sm;
                    dirtyClock = true;
                }
            },
            (errMsg) => console.error(errMsg));
    }

    // --- public API

    return {
        renderInit: renderInit,
        ontimer: ontimer,
        onresize: onresize,
        loadFigureImages: loadFigureImages
    };
})();

window.onload = () => {
    window.setInterval(chess.ontimer, 1000);
    window.addEventListener("resize", chess.onresize);
    utils.auth_lltoken(() => chess.loadFigureImages(chess.renderInit));
};

window.onclick = (event) => utils.hide_menu(event);