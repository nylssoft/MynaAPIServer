var chess = (() => {

    "use strict";

    // UI elements

    let inputUsername;
    let canvas;

    // state

    let embedded;
    let autoStartComputerGame;

    let ticket;
    let model;
    let pollStateEnabled = false;
    let referenceTime;

    let dirty;
    let dirtyClock;

    let currentUser;
    let photos = {};
    let guestMode = false;

    let helpDiv;

    let endGameClicked = false;
    let giveUpClicked = false;

    let figureImageMap = new Map();
    let pixelPerField;

    let lastPos;
    let selectedFigure;
    let previewMoves = false;

    let frameCounterlastMoved = 0;

    let simulate = false;
    let simulateCounter = 0;
    let simulateDelay = 5;

    const colorLight = "#b88b4a";
    const colorDark = "#e3c16f";
    const colorClocks = "#7FFF00";
    const colorSelection = "#3388ff";
    const colorPreview = "black";
    const colorMoves = [colorSelection, "yellow"];

    const delayLastMoved = 30; // 30 frames = 0.5 seconds

    let version = "2.0.8";

    // helper

    const handleError = (err) => {
        console.error(err);
        utils.remove_session_storage("chessstate");
        endGameClicked = false;
        giveUpClicked = false;
        enablePollState();
    };

    const clearTicket = () => {
        ticket = undefined;
        utils.remove_session_storage("chessticket");
        utils.remove_local_storage("chessticket");
    };

    const setTicket = (t) => {
        ticket = t;
        utils.set_session_storage("chessticket", t);
        utils.set_local_storage("chessticket", t);
    };

    const getTicket = () => {
        let t = utils.get_session_storage("chessticket");
        if (!t) {
            t = utils.get_local_storage("chessticket");
            if (t) {
                utils.set_session_storage("chessticket", t);
            }
        }
        return t;
    };

    const getState = () => {
        return utils.get_session_storage("chessstate");
    };

    const setState = (state) => {
        utils.set_session_storage("chessstate", state);
    };

    const enablePollState = () => {
        if (!pollStateEnabled) {
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

    const formatClock = (totalMilliseconds) => {
        let m = "";
        let s = "";
        const totalSeconds = Math.floor(totalMilliseconds / 1000);
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

    const getCapturedFigures = () => {
        const capturedFigures = {};
        ["W", "B"].forEach((c) => {
            ["P", "N", "B", "R", "Q", "K"].forEach((t) => {
                let cnt;
                switch (t) {
                    case "P":
                        cnt = 8;
                        break;
                    case "K":
                    case "Q":
                        cnt = 1;
                        break;
                    default:
                        cnt = 2;
                        break;
                }
                capturedFigures[`${t}${c}`] = cnt;
            });
        });
        model.board.figures.forEach((figure) => {
            capturedFigures[`${figure.type}${figure.color}`] -= 1;
        });
        return capturedFigures;
    };

    const drawInfoArea = (ctx) => {
        if (!model || !model.state || !model.board) return;
        let w = formatClock(model.state.whiteClock);
        let b = formatClock(model.state.blackClock);
        let pw = model.board.whitePlayer;
        let pb = model.board.blackPlayer;
        let xoff;
        let yoff;
        let cy;
        if (utils.is_mobile()) {
            ctx.font = "11px Arial";
            xoff = 5;
            yoff = 20;
            cy = 10;
        }
        else {
            ctx.font = "18px Arial";
            xoff = 10;
            yoff = 30;
            cy = 18;
        }
        ctx.fillStyle = colorClocks;
        if (isBlackPlayer()) {
            [w, b] = [b, w];
            [pw, pb] = [pb, pw];
        }
        // info area for clock text and captured figures
        const infoX = 8 * pixelPerField;
        const infoY = 0;
        const infoW = canvas.width - infoX;
        const infoH = 8 * pixelPerField;
        const textH = 2 * yoff;
        // clear info area
        ctx.clearRect(infoX, infoY, infoW, infoH);
        // draw clock text
        ctx.fillText(pb, infoX + xoff, cy);
        ctx.fillText(b, infoX + xoff, cy + yoff);
        ctx.fillText(pw, infoX + xoff, infoH - cy - yoff);
        ctx.fillText(w, infoX + xoff, infoH - cy);
        // draw captured figures
        const fw = Math.floor(Math.min(infoW / 4, pixelPerField / 2));
        const capturedFigures = getCapturedFigures();
        ["W", "B"].forEach((c) => {
            let fy;
            if (isBlackPlayer()) {
                fy = c == "B" ? infoY + textH : infoH - cy - yoff - fw - yoff;
            }
            else {
                fy = c == "W" ? infoY + textH : infoH - cy - yoff - fw - yoff;
            }
            let fx = infoX;
            let fidx = 0;
            ["P", "B", "N", "R", "Q", "K"].forEach((t) => {
                let cnt = capturedFigures[`${t}${c}`];
                while (cnt > 0) {
                    const image = figureImageMap.get(`${t}${c}`);
                    if (embedded) {
                        ctx.fillStyle = colorLight;
                        ctx.fillRect(fx, fy, fw, fw);
                    }
                    ctx.drawImage(image, fx, fy, fw, fw);
                    fx += fw;
                    cnt--;
                    fidx++;
                    if (fidx >= 4) {
                        fx = infoX;
                        fidx = 0;
                        if (isBlackPlayer()) {
                            fy = fy + (c == "B" ? fw : -fw);
                        }
                        else {
                            fy = fy + (c == "W" ? fw : -fw);
                        }
                    }
                }
            });
        });
    };

    const drawBoard = (ctx) => {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                drawEmptyField(ctx, r, c);
            }
        }
        drawFigures(ctx);
    };

    const drawEmptyField = (ctx, row, column) => {
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
    };

    const drawSampleBoard = (ctx) => {
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
    };

    const drawFigure = (ctx, f) => {
        const image = figureImageMap.get(`${f.type}${f.color}`);
        if (!image) return; // not yet loaded
        const row = isBlackPlayer() ? 7 - f.row : f.row;
        ctx.drawImage(image, f.column * pixelPerField, pixelPerField * 7 - row * pixelPerField, pixelPerField, pixelPerField);
    };

    const drawFigures = (ctx) => {
        if (!model.board || !model.board.figures) return;
        model.board.figures.forEach(f => drawFigure(ctx, f));
    };

    const drawSelectionRect = (ctx, figure) => {
        drawRect(ctx, figure.row, figure.column, colorSelection);
        if (previewMoves) {
            figure.moves.forEach(move => {
                drawRect(ctx, move.row, move.column, colorPreview);
            });
        }
    };

    const drawRect = (ctx, row, col, color) => {
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        if (isBlackPlayer()) {
            row = 7 - row;
        }
        ctx.strokeRect(col * pixelPerField + 6, pixelPerField * 7 - row * pixelPerField + 6, pixelPerField - 12, pixelPerField - 12);
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
                if (utils.is_debug()) utils.debug("DRAW BOARD.");
                drawBoard(ctx);
                drawInfoArea(ctx);
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
                drawInfoArea(ctx);
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
    };

    const getActivePlayer = () => {
        if (model.board.currentColor === "B") {
            return model.board.blackPlayer;
        }
        return model.board.whitePlayer;
    };

    const setActive = (isActive) => {
        if (embedded) return;
        document.body.className = isActive ? "active-background" : "inactive-background";
    };

    const getStateMessage = () => {
        let msg = "";
        const pConfirmNextGame = document.getElementById("confirmnextgame");
        if (isGameStarted()) {
            if (model.board.gameOver) {
                if (model.board.checkMate) {
                    msg = _T("INFO_CHECK_MATE_WINNER_1", model.board.winner);
                }
                else if (model.board.staleMate) {
                    msg = _T("INFO_STALE_MATE");
                }
                else if (model.board.timeOut) {
                    msg = _T("INFO_TIME_OUT_WINNER_1", model.board.winner);
                }
                else if (model.board.kingStrike) {
                    msg = _T("INFO_KING_STRIKE_WINNER_1", model.board.winner);
                }
                else if (model.board.giveUp) {
                    msg = _T("INFO_GIVE_UP_WINNER_1", model.board.winner);
                }
                if (ticket) {
                    if (model.board.nextGameRequested) {
                        if (model.currentUser.startGameConfirmed) {
                            controls.create(pConfirmNextGame, "p", undefined, _T("INFO_WAIT_CONFIRMATION"));
                            setActive(false);
                        }
                        else {
                            controls.create(pConfirmNextGame, "span", "confirmation", _T("INFO_QUESTION_NEXT_GAME"));
                            controls.createButton(pConfirmNextGame, _T("BUTTON_YES"), () => btnConfirmNextGame_click(true));
                            controls.createButton(pConfirmNextGame, _T("BUTTON_NO"), () => btnConfirmNextGame_click(false));
                            setActive(true);
                        }
                    }
                    else {
                        controls.createButton(pConfirmNextGame, _T("BUTTON_NEXT_GAME"), btnNextGame_click, "newgame").id = "newgame";
                        setActive(true);
                    }
                }
            }
            else {
                controls.removeAllChildren(pConfirmNextGame);
                if (model.board.check) {
                    msg = _T("INFO_CHECK") + " ";
                }
                if (isActivePlayer()) {
                    msg += _T("INFO_YOUR_TURN");
                    setActive(true);
                }
                else {
                    setActive(false);
                }
            }
        }
        return msg;
    };

    const simulateMove = () => {
        let moves = [];
        model.board.figures.forEach(f => {
            f.moves.forEach(m => moves.push({ figure: f, move: m }));
        });
        if (moves.length > 0) {
            const m = moves[Math.floor(Math.random() * moves.length)];
            placeFigure(m.figure.row, m.figure.column, m.move.row, m.move.column);
        }
    };

    const placeFigure = (fromRow, fromColumn, toRow, toColumn) => {
        document.body.style.cursor = "wait";
        disablePollState();
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
            (state) => {
                if (utils.is_debug()) utils.debug(`PLACED FIGURE. New state is ${state}.`);
                setState(state);
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

    const updateLastMovedButton = () => {
        const lastmoved = document.getElementById("lastmovedbutton");
        if (lastmoved) {
            lastmoved.classList.toggle("hide", !isPlaying() || !isActivePlayer() || model.board.lastMoves.length === 0);
        }
    };

    const updateGiveUpButton = () => {
        const giveup = document.getElementById("giveupbutton");
        if (giveup) {
            giveup.classList.toggle("hide", !isPlaying() || !isActivePlayer());
        }
    };

    const update = () => {
        disablePollState();
        utils.fetch_api_call("api/chess/model", { headers: { "ticket": ticket } },
            (m) => {
                if (utils.is_debug()) {
                    utils.debug(`MODEL RETRIEVED (update). New state is ${m.state.state}.`);
                    utils.debug(m);
                }
                setState(m.state.state);
                model = m;
                if (isPlaying()) {
                    if (isActivePlayer() || guestMode) {
                        frameCounterlastMoved = delayLastMoved;
                    }
                    updateLastMovedButton();
                    updateGiveUpButton();
                    updateMessage();
                    dirty = true;
                    enablePollState();
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
            utils.replace_window_location("/chess");
            return;
        }
        disablePollState();
        utils.fetch_api_call("api/chess/login",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify(name)
            },
            (loginModel) => {
                if (utils.is_debug()) {
                    utils.debug(`LOGIN (name). New state is ${loginModel.state}.`);
                    utils.debug(loginModel);
                }
                setState(loginModel.state);
                if (loginModel && loginModel.ticket && loginModel.ticket.length > 0) {
                    setTicket(loginModel.ticket);
                }
                utils.replace_window_location("/chess");
            },
            (errMsg) => {
                handleError(errMsg);
                utils.replace_window_location("/chess");
            });
    };

    const setPixelPerWidth = () => {
        const xmin = utils.is_mobile() ? 330 : 400;
        const w = Math.max(xmin, Math.min(window.innerHeight - 100, window.innerWidth - 100));
        pixelPerField = w / 10;
    };

    const setCanvasWidthAndHeight = () => {
        if (canvas) {
            setPixelPerWidth();
            const xoff = utils.is_mobile() ? 50 : 100;
            canvas.width = window.innerWidth - xoff;
            canvas.height = pixelPerField * 8;
        }
    };

    // rendering

    const renderBoardFull = (parent, ignoreToken) => {
        if (ignoreToken || !currentUser) {
            controls.create(parent, "p", undefined, _T("INFO_CHESS_BOARD_FULL"));
            controls.createButton(parent, _T("BUTTON_GUEST_VIEW"), () => window.open("/chess?guest", "_blank"));
            setActive(false);
        }
        else {
            let divParent = controls.createDiv(parent);
            model.allUsers.forEach((chessuser) => {
                if (chessuser.name == currentUser.name) {
                    utils.set_window_location(`/chess?login=${encodeURI(currentUser.name)}`);
                    return;
                }
            });
            renderBoardFull(divParent, true);
        }
    };

    const renderUserList = (parent) => {
        if (embedded) return;
        helpDiv = controls.createDiv(document.body);
        utils.create_menu(parent);
        let title = currentUser ? `${currentUser.name} - ${_T("HEADER_CHESS")}` : _T("HEADER_CHESS");
        const h1 = controls.create(parent, "h1", undefined, title);
        const helpImg = controls.createImg(h1, "help-button", 24, 24, "/images/buttons/help.png", _T("BUTTON_HELP"));
        helpImg.addEventListener("click", () => onUpdateHelp(true));
        if (currentUser && currentUser.photo) {
            const imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo, _T("BUTTON_PROFILE"));
            imgPhoto.addEventListener("click", () => utils.set_window_location("/usermgmt"));
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
            controls.create(divContent, "p", undefined, _T("LABEL_LOGGED_IN_PLAYERS"));
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
                            if (utils.is_debug()) utils.debug(`PHOTO RETRIEVED: ${p}.`);
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
        }
        else {
            let parentdiv = controls.create(parent, "p");
            controls.create(parentdiv, "p", undefined, _T("INFO_YOU_CAN_PLAY_1", currentUser.name));
            inputUsername = controls.createInputField(parentdiv, _T("TEXT_NAME"), btnLogin_click, "hide", 20, 32);
            inputUsername.value = currentUser.name;
            controls.createButton(parentdiv, _T("BUTTON_PLAY_WITH"), btnLogin_click);
        }
    };

    const renderWaitForUsers = (parent) => {
        if (model.canPlayAgainstComputer) {
            controls.create(parent, "p", "activity", _T("INFO_PLAY_AGAINST_COMPUTER"));
            controls.createButton(parent, _T("BUTTON_START_COMPUTER_GAME"), btnPlayComputer_click);
        }
        else {
            controls.create(parent, "p", "activity", _T("INFO_WAIT_FOR_OTHER_PLAYER"));
        }
        setActive(false);
    };

    const renderStartGame = (parent) => {
        const labelClassname = model.isComputerGame ? "optionslabel1" : "optionslabel2";
        const divColor = controls.createDiv(parent);
        const colorOptions = [{ name: _T("OPTION_WHITE"), value: "W" }, { name: _T("OPTION_BLACK"), value: "B" }];
        const labelColor = controls.createLabel(divColor, labelClassname, _T("LABEL_COLOR") + " ");
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
            { name: _T("OPTION_CHESS_MIN_1", 15), value: "chess15" },
            { name: _T("OPTION_CHESS_MIN_1", 30), value: "chess30" },
            { name: _T("OPTION_CHESS_MIN_1", 60), value: "chess60" }
        ];
        if (!model.isComputerGame) {
            gameOptions.unshift({ name: _T("OPTION_FAST_CHESS"), value: "fastchess" });
        }
        const labelGame = controls.createLabel(divGame, labelClassname, _T("LABEL_GAME") + " ");
        labelGame.htmlFor = "gameoption";
        const selectGame = controls.createSelect(divGame, "gameoption", "options", gameOptions);
        if (model.board) {
            selectGame.value = model.board.gameOption;
        }
        else if (model.isComputerGame) {
            selectGame.value = "chess60";
        }
        if (model.isComputerGame) {
            const divLevel = controls.createDiv(parent);
            const levelOptions = [];
            for (let lvl = 1; lvl < 10; lvl++) {
                levelOptions.push({ name: _T("OPTION_LEVEL_1", lvl), value: `${lvl}` });
            }
            const labelLevel = controls.createLabel(divLevel, labelClassname, _T("LABEL_LEVEL") + " ");
            labelLevel.htmlFor = "level";
            const selectLevel = controls.createSelect(divLevel, "level", "options", levelOptions);
            selectLevel.value = "1";
            const divEngine = controls.createDiv(parent);
            const engineOptions = [];
            model.chessEngineNames.forEach((engineName) => {
                engineOptions.push({ name: engineName, value: engineName });
            });
            const labelEngine = controls.createLabel(divEngine, labelClassname, _T("LABEL_CHESS_ENGINE") + " ");
            labelEngine.htmlFor = "engine";
            const selectEngine = controls.createSelect(divEngine, "engine", "options", engineOptions);
            selectEngine.value = model.chessEngineNames[0];
        }
        const divActions = controls.createDiv(parent);
        if (model && model.board && !model.board.gameStarted) {
            selectColor.disabled = true;
            selectGame.disabled = true;
            if (!model.currentUser.startGameConfirmed) {
                controls.create(divActions, "span", "confirmation", _T("INFO_QUESTION_START_GAME"));
                controls.createButton(divActions, _T("BUTTON_YES"), () => btnConfirmStartGame_click(true));
                controls.createButton(divActions, _T("BUTTON_NO"), () => btnConfirmStartGame_click(false));
                setActive(true);
            }
            else {
                controls.create(divActions, "p", undefined, _T("INFO_WAIT_CONFIRMATION"));
                setActive(false);
            }
        }
        else {
            const txt = model.isComputerGame ? _T("BUTTON_START_COMPUTER_GAME") : _T("BUTTON_START_GAME");
            controls.createButton(divActions, txt, btnStartGame_click);
            setActive(true);
        }
    };

    const renderActions = (parent) => {
        controls.create(parent, "p", undefined, "").id = "message";
        controls.create(parent, "p", undefined, "").id = "confirmnextgame";
        if (endGameClicked) {
            controls.create(parent, "span", "confirmation", _T("INFO_REALLY_LOGOUT"));
            controls.createButton(parent, _T("BUTTON_YES"), btnEndGame_click, "EndGameYes");
            controls.createButton(parent, _T("BUTTON_NO"), btnEndGame_click, "EndGameNo");
            setActive(true);
            return true;
        }
        if (giveUpClicked) {
            controls.create(parent, "span", "confirmation", _T("INFO_REALLY_GIVE_UP"));
            controls.createButton(parent, _T("BUTTON_YES"), btnGiveUp_click, "GiveUpYes");
            controls.createButton(parent, _T("BUTTON_NO"), btnGiveUp_click, "GiveUpNo");
            setActive(true);
            return true;
        }
        controls.createButton(parent, _T("BUTTON_LAST_MOVE"), btnLastMove_click, "lastmovedbutton").id = "lastmovedbutton";
        updateLastMovedButton();
        controls.createButton(parent, _T("BUTTON_GIVE_UP"), btnGiveUp_click, "giveupbutton").id = "giveupbutton";
        updateGiveUpButton();
        return false;
    };

    const renderCopyright = (parent) => {
        if (embedded) return;
        const div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `${_T("HEADER_CHESS")} ${version}. ${_T("TEXT_COPYRIGHT_YEAR")} `);
        controls.createA(div, "copyright", "/view?page=copyright", _T("COPYRIGHT"));
        if (ticket && (!model.board || !model.board.gameStarted)) {
            controls.createButton(div, _T("BUTTON_LOGOUT"), btnLogout_click, "Logout", "logout-button");
        }
        if (ticket && isGameStarted()) {
            controls.createButton(div, _T("BUTTON_LOGOUT"), btnEndGame_click, "EndGame", "logout-button");
        }
    };

    const renderMainPage = (parent) => {
        canvas = controls.create(parent, "canvas", "playground");
        setCanvasWidthAndHeight();
        canvas.addEventListener("mouseup", onCanvasMouseUp);
        canvas.addEventListener("mousedown", onCanvasMouseDown);
        canvas.addEventListener("mousemove", onCanvasMouseMove);
        const divActions = controls.createDiv(parent, "actions-section");
        divActions.id = "actions";
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
        document.title = `${_T("HEADER_CHESS")} - ${model.currentUser.name}`;
        if (model.board && model.board.gameStarted) {
            renderMainPage(parent);
        }
        else {
            renderUserList(parent);
            if (!model.isComputerGame && model.allUsers.length < 2) {
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
        setState(model.state.state);
        controls.removeAllChildren(document.body);
        if (!embedded) {
            utils.create_cookies_banner(document.body);
        }
        setActive(false);
        if (model.allUsers.length == 0) {
            clearTicket();
        }
        const divMain = controls.createDiv(document.body, "main");
        if (!ticket) {
            if (embedded && !autoStartComputerGame) {
                autoStartComputerGame = true;
                startEmbeddedComputerGame();
                return;
            }
            if (guestMode) {
                document.title = `${_T("HEADER_CHESS")} - ${_T("INFO_GUEST_VIEW")}`;
                if (model.board) {
                    renderMainPage(divMain);
                }
                else {
                    controls.create(divMain, "p", undefined, _T("INFO_NO_RUNNING_GAME"));
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
        enablePollState();
    };

    const startEmbeddedComputerGame = () => {
        utils.fetch_api_call("api/chess/login",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify(_T("TEXT_YOU"))
            },
            (loginModel) => {
                setState(loginModel.state);
                setTicket(loginModel.ticket);
                btnPlayComputer_click();
            });
    };

    const render = () => {
        const params = new URLSearchParams(window.location.search);
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
        setPixelPerWidth();
        disablePollState();
        utils.fetch_api_call("api/chess/model", { headers: { "ticket": ticket } },
            (m) => {
                if (utils.is_debug()) {
                    utils.debug(`MODEL RETRIEVED (render). New state is ${m.state.state}.`);
                    utils.debug(m);
                }
                setState(m.state.state);
                renderModel(m);
            },
            handleError);
    };

    const renderInit = () => {
        currentUser = undefined;
        dirty = false;
        dirtyClock = false;
        frameCounterlastMoved = delayLastMoved;
        const token = utils.get_authentication_token();
        if (!token) {
            render();
            window.requestAnimationFrame(draw);
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
        if (isPlaying() && isActivePlayer()) {
            const pos = getPositionFromEvent(evt);
            if (pos) {
                if (selectedFigure && (pos.row != selectedFigure.row || pos.col != selectedFigure.column)) {
                    if (utils.is_debug()) utils.debug(`MOUSE UP. Handle position change for position (${pos.row}, ${pos.col}).`);
                    handlePositionChange(pos);
                }
                else {
                    if (utils.is_debug()) utils.debug("MOUSE UP. Redraw");
                    dirty = true;
                }
            }
        }
    };

    const onCanvasMouseDown = (evt) => {
        if (isPlaying() && isActivePlayer()) {
            const pos = getPositionFromEvent(evt);
            if (pos) {
                if (utils.is_debug()) utils.debug(`MOUSE DOWN. Handle position change for position (${pos.row}, ${pos.col}).`);
                handlePositionChange(pos);
            }
        }
    };

    const onCanvasMouseMove = (evt) => {
        if (isPlaying() && isActivePlayer()) {
            const pos = getPositionFromEvent(evt);
            if (pos) {
                if (!lastPos || lastPos.col != pos.col || lastPos.row != pos.row) {
                    lastPos = pos;
                    if (utils.is_debug()) utils.debug(`MOUSE MOVE. Last position changed to (${pos.row}, ${pos.col}).`);
                    dirty = true;
                }
            }
            else if (lastPos) {
                lastPos = undefined;
                if (utils.is_debug()) utils.debug("MOUSE MOVE. Last pos is now undefined.");
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
                utils.fetch_api_call(`/api/pwdman/markdown/help-chess?locale=${utils.get_locale()}`, undefined,
                    (html) => {
                        if (utils.is_debug()) utils.debug("HELP RETRIEVED");
                        mdDiv.innerHTML = html;
                    }
                );
                controls.createButton(contentDiv, _T("BUTTON_OK"), () => onUpdateHelp(false)).focus();
            }
        }
    };

    const btnLogin_click = () => {
        const name = inputUsername.value.trim();
        if (name.length > 0) {
            disablePollState();
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
                    if (utils.is_debug()) {
                        utils.debug(`LOGIN (button). New state is ${loginModel.state}.`);
                        utils.debug(loginModel);
                    }
                    setState(loginModel.state);
                    if (loginModel.isAuthenticationRequired) {
                        const nexturl = `/chess?login=${name}`;
                        utils.set_window_location("/pwdman?nexturl=" + encodeURI(nexturl) + "&username=" + encodeURI(name));
                        return;
                    }
                    else if (loginModel.ticket && loginModel.ticket.length > 0) {
                        setTicket(loginModel.ticket);
                    }
                    render();
                },
                (errMsg) => {
                    document.getElementById("login-error-id").textContent = errMsg;
                    enablePollState();
                });
        }
    };

    const btnPlayComputer_click = () => {
        disablePollState();
        utils.fetch_api_call("api/chess/computergame", { method: "POST", headers: { "ticket": ticket } },
            (state) => {
                if (utils.is_debug()) utils.debug(`COMPUTER GAME. New state is ${state}.`);
                setState(state);
                render();
            },
            handleError);
    };

    const btnNextGame_click = () => {
        disablePollState();
        utils.fetch_api_call("api/chess/nextgame", { method: "POST", headers: { "ticket": ticket } },
            (state) => {
                if (utils.is_debug()) utils.debug(`NEXT GAME. New state is ${state}.`);
                setState(state);
                render();
            },
            handleError);
    };

    const btnConfirmNextGame_click = (ok) => {
        disablePollState();
        utils.fetch_api_call("api/chess/confirmnextgame",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                body: JSON.stringify(ok)
            },
            (state) => {
                if (utils.is_debug()) utils.debug(`CONFIRM NEXT GAME. New state is ${state}.`);
                setState(state);
                render();
            },
            handleError);
    };

    const btnStartGame_click = () => {
        const myColor = document.getElementById("mycolor").value;
        const gameOption = document.getElementById("gameoption").value;
        if (myColor && gameOption) {
            const settings = {
                MyColor: myColor,
                GameOption: gameOption,
                Level: 1
            };
            if (model.isComputerGame) {
                const level = document.getElementById("level").value;
                if (level) {
                    const lvl = parseInt(level);
                    if (Number.isInteger(lvl)) {
                        settings.Level = lvl;
                    }
                }
                settings.ChessEngineName = document.getElementById("engine").value;
            }
            disablePollState();
            utils.fetch_api_call("api/chess/newgame",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                    body: JSON.stringify(settings)
                },
                (state) => {
                    if (utils.is_debug()) utils.debug(`NEW GAME. New state is ${state}.`);
                    setState(state);
                    render();
                },
                handleError);
        }
    };

    const btnConfirmStartGame_click = (ok) => {
        disablePollState();
        utils.fetch_api_call("api/chess/confirmstartgame",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                body: JSON.stringify(ok)
            },
            (state) => {
                if (utils.is_debug()) utils.debug(`CONFIRM START GAME. New state is ${state}.`);
                setState(state);
                render();
            },
            handleError);
    };

    const btnLastMove_click = () => {
        frameCounterlastMoved = delayLastMoved;
        dirty = true;
    };

    const btnGiveUp_click = (elem) => {
        if (elem.value == "GiveUpYes") {
            disablePollState();
            utils.fetch_api_call("api/chess/giveup", { method: "POST", headers: { "ticket": ticket } },
                (state) => {
                    if (utils.is_debug()) utils.debug(`GIVE UP. New state is ${state}.`);
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
            disablePollState();
            utils.fetch_api_call("api/chess/logout", { method: "POST", headers: { "ticket": ticket } },
                (state) => {
                    if (utils.is_debug()) utils.debug(`LOGOUT (EndGame). New state is ${state}.`);
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
        disablePollState();
        utils.fetch_api_call("api/chess/logout", { method: "POST", headers: { "ticket": ticket } },
            (state) => {
                if (utils.is_debug()) utils.debug(`LOGOUT (Button). New state is ${state}.`);
                setState(state);
                ticket = undefined;
                utils.remove_session_storage("chessticket");
                utils.remove_local_storage("chessticket");
                render();
            },
            handleError);
    };

    const onResize = () => {
        if (canvas && model && model.board && model.board.gameStarted) {
            setCanvasWidthAndHeight();
            dirty = true;
        }
    };

    const sleep = (interval) => new Promise(r => setTimeout(r, interval));

    const pollState = async () => {
        try {
            if (!pollStateEnabled) {
                if (utils.is_debug()) utils.debug("Poll state disabled. Retry in 1 second.");
                await sleep(1000);
                await pollState();
            } else {
                if (utils.is_debug()) utils.debug("Poll state (up to 1 minute).");
                let clientstate = getState();
                if (clientstate == undefined) {
                    clientstate = 0;
                }
                const response = await fetch(`/api/chess/longpollstate/${clientstate}`);
                if (response.status != 200) {
                    const jsonError = await response.json();
                    console.error(`Poll state error: ${jsonError.title} Retry in 5 seconds.`);
                    await sleep(5000);
                    await pollState();
                } else {
                    const sm = await response.json();
                    referenceTime = Date.now();
                    const d = sm.state;
                    if (utils.is_debug()) utils.debug(`Received server state ${d}.`);
                    if (pollStateEnabled && d > clientstate) {
                        if (utils.is_debug()) utils.debug("State has changed. Rerender.");
                        setState(d);
                        if (model && model.board && model.board.gameStarted) {
                            update();
                        }
                        else {
                            render();
                        }
                    } else if (model && model.board && model.board.gameStarted) {
                        model.state = sm;
                        dirtyClock = true;
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

    const onTimer = () => {
        if (!pollStateEnabled) return;
        if (model && model.board && model.board.gameStarted && referenceTime) {
            const elapsed = Date.now() - referenceTime;
            if (model.board.currentColor === "B") {
                model.state.blackClock = Math.max(0, model.state.blackClock - elapsed);
            } else {
                model.state.whiteClock = Math.max(0, model.state.whiteClock - elapsed);
            }
            referenceTime = Date.now();
            dirtyClock = true;
            if (simulate && isPlaying() && isActivePlayer() && simulateCounter > 0) {
                simulateCounter--;
                if (simulateCounter == 0) {
                    simulateMove();
                }
            }
        }
    };

    // --- public API

    return {
        renderInit: renderInit,
        pollState: pollState,
        onTimer: onTimer,
        onResize: onResize,
        loadFigureImages: loadFigureImages
    };
})();

window.onload = () => {
    chess.pollState();
    window.setInterval(chess.onTimer, 1000);
    window.addEventListener("resize", chess.onResize);
    utils.auth_lltoken(() => utils.set_locale(() => chess.loadFigureImages(chess.renderInit)));
};

window.onclick = (event) => utils.hide_menu(event);