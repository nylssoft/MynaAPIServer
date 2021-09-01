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

    let logoutClicked = false;

    let figureImageMap = new Map();
    let pixelPerField;

    let lastPos;
    let selectedFigure;

    // helper

    const handleError = (err) => {
        console.error(err);
        window.sessionStorage.removeItem("chessstate");
        timerEnabled = true;
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
        let w = formatClock(model.state.whiteClock);
        let b = formatClock(model.state.blackClock);
        let pw = model.board.whitePlayer;
        let pb = model.board.blackPlayer;
        ctx.font = "18px Arial";
        ctx.fillStyle = "#7FFF00";
        if (model.currentUser && model.currentUser.name == model.board.blackPlayer) {
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
        ctx.clearRect(0, 0, 8 * pixelPerField, 8 * pixelPerField);
        for (let r = 0; r < 8; r++) {
            ctx.fillStyle = "#7FFF00";
            let color;
            if (!model.currentUser || model.currentUser.name === model.board.whitePlayer) {
                color = r % 2 == 0 ? color1 : color2;
            }
            else {
                color = r % 2 == 0 ? color2 : color1;
            }
            for (let c = 0; c < 8; c++) {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.fillRect(c * pixelPerField, pixelPerField * 7 - r * pixelPerField, pixelPerField, pixelPerField);
                color = color == color1 ? color2 : color1;
            }
        }
    };

    const drawFigures = (ctx) => {
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
        // preview of possible moves, may be a help option
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
        if (dirty || dirtyClock) {
            let ctx = canvas.getContext("2d");
            if (dirty) {
                drawEmptyBoard(ctx);
                drawFigures(ctx);
                drawClocks(ctx);
                if (!selectedFigure && lastPos) {
                    const figure = getFigure(lastPos.row, lastPos.col);
                    if (figure && figure.moves.length > 0) {
                        drawSelectionRect(ctx, figure);
                    }
                }
                dirty = false;
            }
            if (dirtyClock) {
                drawClocks(ctx);
                dirtyClock = false;
            }
        }
        window.requestAnimationFrame(draw);
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
        controls.create(parent, "p", undefined, "Alle sind angemeldet! Starte das Spiel!");
        controls.createButton(parent, "Spiel starten", btnStartGame_click);
        document.body.className = "active-background";
    };

    const renderFooter = (parent) => {
        if (ticket && !model.board) {
            const div = controls.createDiv(parent);
            controls.createButton(div, "Abmelden", btnLogout_click, "Logout");
        }
    };

    const renderActions = (parent) => {
        const messageElem = controls.create(parent, "p", undefined, "");
        messageElem.id = "message";
        let active = false;
        if (logoutClicked) {
            controls.create(parent, "span", "confirmation", "Willst Du das Spiel wirklich beenden?");
            controls.createButton(parent, "Ja", btnLogout_click, "LogoutYes");
            controls.createButton(parent, "Nein", btnLogout_click, "LogoutNo");
            active = true;
        }
        else if (model.currentUser) {
            const img = controls.createImg(parent, "quitbutton", 32, 32, "/images/buttons/edit-delete-6.png");
            img.title = "Spiel beenden";
            img.addEventListener("click", btnLogout_click);
        }
        if (active) {
            document.body.className = "active-background";
        }
    };

    const getStateMessage = () => {
        let msg = "";
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
                msg = `Der Koenig wurde geschlagen! Das Spiel ist zu Ende. Gewinner ist ${model.board.winner}.`;
            }
        }
        else if (model.board.check) {
            msg = "Schach!";
        }
        return msg;
    };

    const renderMainPage = (parent) => {
        canvas = controls.create(parent, "canvas", "playground");
        canvas.width = pixelPerField * 8 + 100;
        canvas.height = pixelPerField * 8 + 10;
        canvas.addEventListener("click", onCanvasClick);
        canvas.addEventListener("mousemove", onCanvasMouseMove);
        const divActions = controls.createDiv(parent, "actions-section");
        divActions.id = "actions"
        const divFooter = controls.createDiv(parent);
        renderActions(divActions);
        renderFooter(divFooter);
        updateMessage();
        loadFigureImages(() => { dirty = true; });
    };

    const renderUsername = (parent) => {
        if (!model.currentUser) {
            clearTicket();
            render();
            return;
        }
        document.title = `Schach - ${model.currentUser.name}`;
        if (model.board) {
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
            renderFooter(parent);
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
                    renderFooter(divMain);
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
                renderFooter(divMain);
            }
        }
        else {
            renderUsername(divMain);
        }
        timerEnabled = true;
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
        timerEnabled = false;
        selectedFigure = undefined;
        lastPos = undefined;
        const w = Math.max(400, Math.min(window.innerHeight, window.innerWidth - 100));
        pixelPerField = w / 10;
        utils.fetch_api_call("api/chess/model", { headers: { "ticket": ticket } },
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

    const onCanvasClick = (evt) => {
        const pos = getPositionFromEvent(evt);
        let redraw = true;
        if (pos) {
            if (selectedFigure) {
                for (let idx = 0; idx < selectedFigure.moves.length; idx++) {
                    const move = selectedFigure.moves[idx];
                    if (pos.row === move.row && pos.col === move.column) {
                        redraw = false;
                        document.body.style.cursor = "wait";
                        utils.fetch_api_call("api/chess/place",
                            {
                                method: "POST",
                                headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                                body: JSON.stringify(
                                    {
                                        FromRow: selectedFigure.row,
                                        FromColumn: selectedFigure.column,
                                        ToRow: move.row,
                                        ToColumn: move.column
                                    })
                            },
                            () => {
                                render();
                                document.body.style.cursor = "default";
                            },
                            (errMsg) => {
                                handleError(errMsg);
                                document.body.style.cursor = "default";
                                selectedFigure = undefined;
                                dirty = true;
                            });
                        break;
                    }
                }
            }
            else {
                const figure = getFigure(pos.row, pos.col);
                if (figure && figure.moves.length > 0) {
                    selectedFigure = figure;
                    redraw = false;
                }
            }
        }
        if (redraw && selectedFigure) {
            selectedFigure = undefined;
            dirty = true;
        }
        lastPos = undefined;
    };

    const onCanvasMouseMove = (evt) => {
        if (!selectedFigure) {
            const pos = getPositionFromEvent(evt);
            if (pos) {
                if (!lastPos || lastPos.col != pos.col || lastPos.row != pos.row) {
                    lastPos = pos;
                    dirty = true;
                }
            }
            else if (lastPos) {
                lastPos = undefined;
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

    const btnStartGame_click = () => {
        timerEnabled = false;
        utils.fetch_api_call("api/chess/newgame", { method: "POST", headers: { "ticket": ticket } },
            () => render(),
            handleError);
    };

    const btnLogout_click = (elem) => {
        if (elem.value == "LogoutYes" || !model.board) {
            timerEnabled = false;
            utils.fetch_api_call("api/chess/logout", { method: "POST", headers: { "ticket": ticket } },
                () => {
                    logoutClicked = false;
                    ticket = undefined;
                    window.sessionStorage.removeItem("chessticket");
                    window.localStorage.removeItem("chessticket");
                    render();
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
                updateMessage();
                dirty = true;
            },
            handleError);
    };

    const onresize = () => {
        if (model && model.board) {
            const w = Math.max(400, Math.min(window.innerHeight, window.innerWidth - 100));
            pixelPerField = w / 10;
            canvas.width = pixelPerField * 8 + 100;
            canvas.height = pixelPerField * 8;
            dirty = true;
        }
    };

    const ontimer = () => {
        if (!timerEnabled) return;
        utils.fetch_api_call("api/chess/state", undefined,
            (sm) => {
                const d = sm.state;
                const statechanged = window.sessionStorage.getItem("chessstate");
                if (!statechanged || d > statechanged) {
                    window.sessionStorage.setItem("chessstate", d);
                    if (model && model.board) {
                        update();
                    }
                    else {
                        render();
                    }
                }
                else if (model && model.board) {
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
        onresize: onresize
    };
})();

window.onload = () => {
    window.setInterval(chess.ontimer, 1000);
    window.addEventListener("resize", chess.onresize);
    utils.auth_lltoken(chess.renderInit);
};

window.onclick = (event) => utils.hide_menu(event);