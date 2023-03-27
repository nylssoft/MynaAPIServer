class Sprite {
    constructor(img, w, h) {
        this.image = img;
        this.w = w;
        this.h = h;
        this.x = 0;
        this.y = 0;
        this.rotate = 0;
        this.dx = 1;
        this.dy = 1;
        this.drotate = 1;
        this.lastX = undefined;
        this.lastY = undefined;
        this.lastRotate = undefined;
        this.scale = 1;
    }

    draw(ctx) {
        this.lastX = this.x;
        this.lastY = this.y;
        this.lastRotate = this.rotate;
        ctx.setTransform(this.scale, 0, 0, this.scale, this.x, this.y);
        ctx.rotate(this.rotate * Math.PI / 180);
        ctx.drawImage(this.image, -this.w / 2, -this.h / 2, this.w, this.h);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
}

var backgammon = (() => {

    "use strict";

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

    let version = "2.1.4";

    let dirty;

    const colorCheckerWhite = "white";
    const colorCheckerBlack = "darkred";
    const colorCheckerWhiteHighlightItem = "#e0e0e0";
    const colorCheckerBlackHighlightItem = "#e67b7b";
    const colorCheckerWhiteMoveItem = "#a0a0a0";
    const colorCheckerBlackMoveItem = "#dc0707";
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
    let gapPointHeight;
    let gapCheckers;

    let lastPos;
    let highlightItem;
    let moveItem;

    let imageMap = new Map();

    let gameOverSprites = [];
    let gameOverImageData;
    let gameOverDelay = 10;
    let gameOverMaxSpeed = 3;

    let computerGame = false;
    let computerActionCount = 0;

    const animateGameOver = (canvas, winner) => {
        const ctx = canvas.getContext("2d");
        addGameOverSprite(canvas, winner);
        if (gameOverImageData) {
            ctx.putImageData(gameOverImageData, 0, 0);
        }
        gameOverImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        gameOverSprites.forEach((sprite) => {
            sprite.rotate = (sprite.rotate + sprite.drotate) % 360;
            if (sprite.drotate < 0) {
                sprite.drotate = 360 + sprite.drotate;
            }
            sprite.x = (sprite.x + sprite.dx) % (canvas.width - pointWidth - borderWidth);
            if (sprite.x < 0) {
                sprite.x = canvas.width - pointWidth - borderWidth;
            }
            sprite.y = (sprite.y + sprite.dy) % canvas.height;
            if (sprite.y < 0) {
                sprite.y = canvas.height;
            }
            sprite.scale = pointWidth < 64 ? pointWidth / 64 : 1;
            sprite.draw(ctx);
        });
    };

    const addGameOverSprite = (canvas, winner) => {
        if (gameOverSprites.length < 15) {
            gameOverDelay -= 1;
            if (gameOverDelay <= 0) {
                gameOverDelay = 10;
                const img = winner ? imageMap.get("winner") : imageMap.get("looser");
                const sprite = new Sprite(img, 32, 32);
                sprite.x = Math.floor(Math.random() * (canvas.width - pointWidth - borderWidth - 16)) + 16;
                sprite.y = 0;
                sprite.dx = winner ? Math.random() * gameOverMaxSpeed * 2 + 1 : 0;
                if (sprite.dx > gameOverMaxSpeed) {
                    sprite.dx = gameOverMaxSpeed - sprite.dx + 2;
                }
                sprite.dy = winner ? Math.random() * gameOverMaxSpeed * 2 + 1 : Math.random() * gameOverMaxSpeed + 1;
                if (sprite.dy > gameOverMaxSpeed) {
                    sprite.dy = gameOverMaxSpeed - sprite.dy + 2;
                }
                sprite.drotate = winner ? Math.random() * gameOverMaxSpeed * 2 + 1 : 0;
                if (sprite.drotate > gameOverMaxSpeed) {
                    sprite.drotate = gameOverMaxSpeed - sprite.drotate + 2;
                }
                gameOverSprites.push(sprite);
            }
        }
    };

    // helper

    const handleError = (err) => {
        console.error(err);
        utils.remove_session_storage("backgammonstate");
        endGameClicked = false;
        giveUpClicked = false;
        enableTimer();
    };

    const clearTicket = () => {
        ticket = undefined;
        utils.remove_session_storage("backgammonticket");
        utils.remove_local_storage("backgammonticket");
    };

    const setTicket = (t) => {
        ticket = t;
        utils.set_session_storage("backgammonticket", t);
        utils.set_local_storage("backgammonticket", t);
    };

    const getTicket = () => {
        let t = utils.get_session_storage("backgammonticket");
        if (!t) {
            t = utils.get_local_storage("backgammonticket");
            if (t) {
                utils.set_session_storage("backgammonticket", t);
            }
        }
        return t;
    };

    const getState = () => {
        return utils.get_session_storage("backgammonstate");
    };

    const setState = (state) => {
        utils.set_session_storage("backgammonstate", state);
    };

    const enableTimer = () => {
        if (!timerEnabled) {
            if (utils.is_debug()) utils.debug("TIMER ENABLED.");
            timerEnabled = true;
        }
    };

    const disableTimer = () => {
        if (timerEnabled) {
            if (utils.is_debug()) utils.debug("TIMER DISABLED.");
            timerEnabled = false;
        }
    };

    const isPlaying = (m) => {
        m = m || model;
        return m && m.board && !m.board.gameOver;
    };

    const isActivePlayer = (m) => {
        m = m || model;
        return m && m.board && m.currentUser && m.currentUser.name === getActivePlayer(m);
    };

    const isBlackPlayer = (m) => {
        m = m || model;
        return m && m.currentUser && m.board && m.currentUser.name === m.board.blackPlayer;
    };

    const hasRolledDice = (m) => {
        m = m || model;
        return m && m.board && m.board.currentRollNumbers.length > 0;
    };

    const canRollDice = (m) => {
        m = m || model;
        if (m && m.board && !m.board.gameOver) {
            if (!m.board.gameStarted) {
                return m.currentUser && !m.board.hasStartRoll;
            }
            return isActivePlayer(m) && m.board.currentRollNumbers.length == 0;
        }
        return false;
    };

    const getOpponentPlayer = (m) => {
        m = m || model;
        if (isBlackPlayer(m)) {
            return m.board.whitePlayer;
        }
        return m.board.blackPlayer;
    };

    const getActivePlayer = (m) => {
        m = m || model;
        if (m.board.currentColor === "B") {
            return m.board.blackPlayer;
        }
        else if (m.board.currentColor === "W") {
            return m.board.whitePlayer;
        }
        return undefined;
    };

    const setActive = (isActive) => {
        document.body.className = isActive ? "active-background" : "inactive-background";
        const canvas = document.getElementById("player-canvas-id");
        if (canvas) {
            canvas.classList.toggle("hide", !isActive);
        }
    };

    const getStateMessage = () => {
        let isActive = false;
        let msg = "";
        const pConfirmNextGame = document.getElementById("confirmnextgame");
        if (model && model.board) {
            if (model.board.gameOver) {
                if (model.currentUser && model.currentUser.name === model.board.winner) {
                    msg = _T("INFO_YOU_HAVE_WON");
                }
                else {
                    msg = _T("INFO_HAS_WON_1", model.board.winner);
                }
                if (model.board.backgammon) {
                    msg += " " + _T("INFO_BACKGAMMON");
                }
                else if (model.board.gammon) {
                    msg += " " + _T("INFO_GAMMON");
                }
                if (model.board.giveUp) {
                    msg += " " + _T("INFO_GIVE_UP");
                }
                if (computerGame) {
                    controls.createButton(pConfirmNextGame, _T("BUTTON_NEXT_GAME"), () => {
                        computerGame = false;
                        render();
                    }, "newgame").id = "newgame";
                    isActive = true;
                }
                else if (ticket && model.currentUser) {
                    if (model.board.nextGameRequested) {
                        if (model.currentUser.startGameConfirmed) {
                            controls.create(pConfirmNextGame, "p", undefined, _T("INFO_WAIT_CONFIRMATION"));
                        }
                        else {
                            controls.create(pConfirmNextGame, "span", "confirmation", _T("INFO_QUESTION_NEXT_GAME"));
                            controls.createButton(pConfirmNextGame, _T("BUTTON_YES"), () => btnConfirmNextGame_click(true));
                            controls.createButton(pConfirmNextGame, _T("BUTTON_NO"), () => btnConfirmNextGame_click(false));
                            isActive = true;
                        }
                    }
                    else {
                        controls.createButton(pConfirmNextGame, _T("BUTTON_NEXT_GAME"), btnNextGame_click, "newgame").id = "newgame";
                        isActive = true;
                    }
                }
            }
            else {
                controls.removeAllChildren(pConfirmNextGame);
                // roll to find out which player starts
                if (!model.board.gameStarted) {
                    if (model.board.doubleRoll) {
                        msg = _T("INFO_DOUBLE");
                        if (model.currentUser) {
                            msg += " " +_T("INFO_ROLL_DICE_AGAIN");
                            isActive = true;
                        }
                    }
                    else if (model.board.currentRollNumbers.length == 0) {
                        msg = _T("INFO_QUESTION_WHO_STARTS");
                        if (model.currentUser) {
                            isActive = true;
                        }
                    }
                    else {
                        if (model.currentUser && !model.board.hasStartRoll) {
                            msg = _T("INFO_YOUR_TURN");
                            isActive = true;
                        }
                        else {
                            msg = _T("INFO_TURN_1", getOpponentPlayer());
                        }
                    }
                }
                // game started
                else {
                    if (isActivePlayer()) {                        
                        msg = _T("INFO_ITS_YOUR_TURN");
                        if (model.board.currentRollNumbers.length > 0) {
                            if (model.board.moves.length == 0) {
                                msg += " " + _T("INFO_NO_MOVE_AVAILABLE");
                            }
                            else {
                                msg += " " + _T("INFO_REMAINING_MOVES_1", model.board.remainingRollNumbers.join(", "));
                            }
                        }
                        isActive = true;
                    }
                    else {
                        msg = _T("INFO_TURN_1", getActivePlayer());
                        if (model.board.currentRollNumbers.length > 0) {
                            if (model.board.moves.length == 0) {
                                msg += " " + _T("INFO_NO_MOVE_AVAILABLE");
                            }
                            else {
                                msg += " " + _T("INFO_REMAINING_MOVES_1", model.board.remainingRollNumbers.join(", "));
                            }
                        }
                    }
                }
            }
        }
        setActive(isActive);
        return msg;
    };

    const updateCanvasWidthAndHeight = (canvas) => {
        canvas.width = pointWidth * 14 + 2 * borderWidth + 2;
        canvas.height = pointHeight * 2 + gapPointHeight + 2 * borderHeight + 2;
        gameOverMaxSpeed = Math.floor(canvas.height / 100);
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
                let pos;
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
            else if (evt.offsetX > borderWidth + 13 * pointWidth) {
                return -2; // off board
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

    const drawRollButton = (ctx) => {
        if (canRollDice()) {
            const rollImage = imageMap.get("roll");
            if (!rollImage) return;
            ctx.drawImage(rollImage,
                borderWidth + 6 * pointWidth + Math.floor((pointWidth - checkerRadius * 2) / 2),
                borderHeight + pointHeight + checkerRadius,
                checkerRadius * 2,
                checkerRadius * 2);
        }
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
                const image = imageMap.get(`dice${nr}`);
                if (!image) return;
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
        window.requestAnimationFrame(draw);
        if (computerGame && computerActionCount > 0) {
            computerActionCount -= 1;
            if (computerActionCount === 0) {
                onComputerAction();
            }
        }
        const canvas = document.getElementById("playground-id");
        if (canvas && dirty) {
            gameOverImageData = undefined;
            if (utils.is_debug()) utils.debug("DRAW.");
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const colorCheckerMoveItem = model.board.currentColor == "W" ? colorCheckerWhiteMoveItem : colorCheckerBlackMoveItem;
            const colorCheckerHighlightItem = model.board.currentColor == "W" ? colorCheckerWhiteHighlightItem : colorCheckerBlackHighlightItem;
            if (model && model.board && model.board.items) {
                drawBoard(ctx, model.board.items);
                drawDice(ctx);
                drawRollButton(ctx);
                if (moveItem !== undefined) {
                    drawChecker(ctx, moveItem.position, moveItem.count, model.board.currentColor, colorCheckerMoveItem);
                    if (lastPos !== undefined && lastPos != moveItem.position) {
                        model.board.moves.forEach((move) => {
                            if (move.from === moveItem.position && move.to === lastPos) {
                                let cnt = 1;
                                model.board.items.forEach((item) => {
                                    if (item.position === lastPos) {
                                        cnt = item.count;
                                        if (item.color == model.board.currentColor) {
                                            cnt += 1;
                                        }
                                    }
                                });
                                drawChecker(ctx, lastPos, cnt, model.board.currentColor, colorCheckerHighlightItem);
                            }
                        });
                    }
                }
                else if (highlightItem) {
                    drawChecker(ctx, highlightItem.position, highlightItem.count, model.board.currentColor, colorCheckerHighlightItem);
                }
            }
            dirty = false;
        }
        if (canvas && model && model.board && model.board.gameOver && model.currentUser) {
            animateGameOver(canvas, model.currentUser.name === model.board.winner);
        }
        else if (gameOverSprites.length > 0) {
            gameOverSprites = [];
        }
    };

    const updateMessage = () => {
        const messageElem = document.getElementById("message-id");
        if (messageElem) {
            messageElem.textContent = getStateMessage();
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

    const updateComputerAction = () => {
        if (computerGame && !(model.board.gameStarted && isActivePlayer() || !model.board.gameStarted && canRollDice())) {
            computerActionCount = 50 * 5;
        }
    };

    const updateRollButton = () => {
        const roll = document.getElementById("rollbutton");
        if (roll) {
            roll.classList.toggle("hide", !canRollDice());
        }
    };

    const updatePhoto = (img, name, fallback) => {
        let photo = photos[name.toLowerCase()];
        if (!photo) {
            photo = `/images/skat/profiles/default${fallback}.png`;
            photos[name.toLowerCase()] = photo;
            img.src = photo;
            utils.fetch_api_call(`/api/pwdman/photo?username=${encodeURI(name)}`, undefined,
                (p) => {
                    if (utils.is_debug()) utils.debug(`PHOTO RETRIEVED: ${p}.`);
                    if (p) {
                        photos[name.toLowerCase()] = p;
                        img.src = p;
                    }
                },
                (errMsg) => console.error(errMsg));
        }
        else {
            img.src = photo;
        }
    };

    const update = (to) => {
        if (computerGame) {
            updateRollButton();
            updateSkipButton();
            updateGiveUpButton();
            updateComputerAction();
            updateMessage();
            if (to) {
                updateHighlightItem(to);
            }
            dirty = true;
            return;
        }
        disableTimer();
        utils.fetch_api_call("api/backgammon/model", { headers: { "ticket": ticket } },
            (m) => {
                if (utils.is_debug()) {
                    utils.debug(`MODEL RETRIEVED (update): new state is ${m.state}.`);
                    utils.debug(m);
                }
                setState(m.state);
                model = m;
                if (isPlaying()) {
                    updateRollButton();
                    updateSkipButton();
                    updateGiveUpButton();
                    updateMessage();
                    if (to) {
                        updateHighlightItem(to);
                    }
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
            utils.replace_window_location("/backgammon");
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
                if (utils.is_debug()) {
                    utils.debug(`LOGIN (login with name): new state is ${loginModel.state}.`);
                    utils.debug(loginModel);
                }
                setState(loginModel.state);
                if (loginModel.ticket && loginModel.ticket.length > 0) {
                    setTicket(loginModel.ticket);
                }
                utils.replace_window_location("/backgammon");
            },
            (errMsg) => {
                handleError(errMsg);
                utils.replace_window_location("/backgammon");
            });
    };

    const loadImages = () => {
        for (let idx = 1; idx < 7; idx++) {
            const image = new Image();
            image.src = `/images/backgammon/dice-${idx}.svg`;
            imageMap.set(`dice${idx}`, image);
        }
        const rollImage = new Image();
        rollImage.src = "/images/backgammon/roll.png";
        imageMap.set("roll", rollImage);
        const winnerImage = new Image();
        winnerImage.src = "/images/backgammon/rating.png";
        imageMap.set("winner", winnerImage);
        const looserImage = new Image();
        looserImage.src = "/images/backgammon/clanbomber-2.png";
        imageMap.set("looser", looserImage);
    };

    const getCurrentItem = (pos) => {
        let posItem;
        model.board.items.forEach((item) => {
            if (item.position === pos && item.color == model.board.currentColor) {
                posItem = item;
            }
        });
        return posItem;
    };

    const updateHighlightItem = (pos) => {
        highlightItem = undefined;
        const posItem = getCurrentItem(pos);
        if (posItem) {
            model.board.moves.forEach((move) => {
                if (move.from == posItem.position) {
                    if (!moveItem || moveItem.position != move.from) {
                        highlightItem = posItem;
                    }
                }
            });
        }
    };

    const updateMoveItem = (pos) => {
        moveItem = undefined;
        const posItem = getCurrentItem(pos);
        if (posItem) {
            model.board.moves.forEach((move) => {
                if (move.from == posItem.position) {
                    moveItem = posItem;
                }
            });
        }
    };

    const move = (from, to, m) => {
        const isComputer = m;
        m = m || model;
        moveItem = undefined;
        let toMove;
        m.board.moves.forEach((move) => {
            if (!toMove && move.from === from && move.to === to) {
                toMove = move;
            }
        });
        if (toMove) {
            if (computerGame) {
                utils.fetch_api_call("api/backgammon/computer/move",
                    {
                        method: "POST",
                        headers: { "Accept": "application/json", "Content-Type": "application/json" },
                        body: JSON.stringify({ CurrentPlayerName: m.currentUser.name, State: m.internalState, Move: { from: toMove.from, to: toMove.to } })
                    },
                    (mnew) => {
                        if (isComputer) {
                            model.internalState = mnew.internalState;
                            onUpdateModel();
                        }
                        else {
                            model = mnew;
                            update(to);
                        }
                    },
                    handleError);
                return;
            }
            disableTimer();
            utils.fetch_api_call("api/backgammon/move",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "ticket": ticket },
                    body: JSON.stringify({ from: toMove.from, to: toMove.to })
                },
                (state) => {
                    if (utils.is_debug()) utils.debug(`MOVE: new state is ${state}.`);
                    setState(state);
                    update(to);
                    enableTimer();
                },
                handleError);
        }
    };

    // rendering

    const renderBoardFull = (parent, ignoreToken) => {
        if (ignoreToken || !currentUser) {
            controls.create(parent, "p", undefined, _T("INFO_BOARD_FULL"));
            controls.createButton(parent, _T("BUTTON_GUEST_VIEW"), () => window.open("/backgammon?guest", "_blank"));
            setActive(false);
        }
        else {
            let divParent = controls.createDiv(parent);
            model.allUsers.forEach((backgammonuser) => {
                if (backgammonuser.name == currentUser.name) {
                    utils.set_window_location(`/backgammon?login=${encodeURI(currentUser.name)}`);
                    return;
                }
            });
            renderBoardFull(divParent, true);
        }
    };

    const renderUserList = (parent) => {
        helpDiv = controls.createDiv(document.body);
        utils.create_menu(parent);
        let title = currentUser ? `${currentUser.name} - ${_T("HEADER_BACKGAMMON")}` : _T("HEADER_BACKGAMMON");
        const h1 = controls.create(parent, "h1", undefined, title);
        const helpImg = controls.createImg(h1, "help-button", 24, 24, "/images/buttons/help.png", _T("BUTTON_HELP"));
        helpImg.addEventListener("click", () => onUpdateHelp(true));
        if (currentUser && currentUser.photo) {
            const imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo, _T("BUTTON_PROFILE"));
            imgPhoto.addEventListener("click", () => utils.set_window_location("/usermgmt"));
        }
        // draw sample board
        setPointWidth(utils.is_mobile() ? 330 : 400);
        const sampleCanvas = controls.create(parent, "canvas", "sample-playground");
        updateCanvasWidthAndHeight(sampleCanvas);
        const ctx = sampleCanvas.getContext("2d");
        drawBoard(ctx, []);
        // render content area        
        const divContent = controls.createDiv(parent, "content");
        if (model.allUsers.length > 0) {
            controls.create(divContent, "p", undefined, _T("LABEL_LOGGED_IN_PLAYERS"));
            const ul = controls.create(divContent, "ul");
            let idx = 1;
            model.allUsers.forEach((user) => {
                const li = controls.create(ul, "li");
                const img = controls.createImg(li, "player-img", 45, 45, undefined, user.name);
                updatePhoto(img, user.name, idx == 1 ? 2 : 1);
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
            const label = controls.createLabel(parent, undefined, _T("LABEL_NAME"));
            label.htmlFor = "username-id";
            const inputUsername = controls.createInputField(parent, _T("TEXT_NAME"), btnLogin_click, "username-input", 20, 32);
            inputUsername.placeholder = _T("TEXT_NAME");
            inputUsername.id = "username-id";
            if (!utils.is_mobile()) {
                inputUsername.focus();
            }
            controls.createButton(parent, _T("BUTTON_LOGIN"), btnLogin_click);
        }
        else {
            const parentdiv = controls.create(parent, "p");
            controls.create(parentdiv, "p", undefined, _T("INFO_YOU_CAN_PLAY_1", currentUser.name));
            const inputUsername = controls.createInputField(parentdiv, _T("TEXT_NAME"), btnLogin_click, "hide", 20, 32);
            inputUsername.value = currentUser.name;
            inputUsername.id = "username-id";
            controls.createButton(parentdiv, _T("BUTTON_PLAY_WITH"), btnLogin_click);
        }
    };

    const renderWaitForUsers = (parent) => {
        controls.create(parent, "p", "activity", _T("INFO_WAIT_FOR_OTHER_PLAYER"));
        setActive(false);
    };

    const renderStartGame = (parent) => {
        const divActions = controls.createDiv(parent);
        if (model && model.board) {
        }
        else {
            controls.createButton(divActions, _T("BUTTON_START_GAME"), btnStartGame_click);
            setActive(true);
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
        controls.create(parent, "p").id = "confirmnextgame";
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
        controls.createButton(parent, _T("BUTTON_ROLL_DICE"), () => rollDice(), "rollbutton").id = "rollbutton";
        updateRollButton();
        controls.createButton(parent, _T("BUTTON_CONTINUE"), () => skip(), "skipbutton").id = "skipbutton";
        updateSkipButton();
        controls.createButton(parent, _T("BUTTON_GIVE_UP"), btnGiveUp_click, "giveupbutton").id = "giveupbutton";
        updateGiveUpButton();
        updateComputerAction();
        return false;
    };

    const renderCopyright = (parent) => {
        const div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `${_T("HEADER_BACKGAMMON")} ${version}. ${_T("TEXT_COPYRIGHT_YEAR")} `);
        controls.createA(div, "copyright", "/view?page=copyright", _T("COPYRIGHT"));
        if (ticket || computerGame) {
            if (!model.board && !computerGame) {
                controls.createButton(div, _T("BUTTON_LOGOUT"), btnLogout_click, "Logout", "logout-button");
            }
            else {
                controls.createButton(div, _T("BUTTON_LOGOUT"), btnEndGame_click, "EndGame", "logout-button");
            }
        }
    };

    const renderPlayerCanvas = (parent, isBlackPlayer) => {
        const canvas = controls.create(parent, "canvas", "player-canvas hide");
        canvas.width = 45;
        canvas.height = 45;
        canvas.id = "player-canvas-id";
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = isBlackPlayer ? colorCheckerBlack : colorCheckerWhite;
        ctx.beginPath();
        ctx.arc(22, 22, 16, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = colorShadowDark;
        ctx.beginPath();
        ctx.arc(22, 22, 16, 0, 2 * Math.PI);
        ctx.stroke();
    };

    const renderMainPage = (parent) => {
        calculatePointWidth();
        let playerTop;
        let playerBottom;
        if (model.currentUser) {
            playerTop = getOpponentPlayer();
            playerBottom = model.currentUser.name;
        }
        else {
            playerTop = model.board.blackPlayer;
            playerBottom = model.board.whitePlayer;
        }
        const playerTopDiv = controls.createDiv(parent, "player-top");
        const topImg = controls.createImg(playerTopDiv, "player-img", 45, 45, undefined, playerTop);
        updatePhoto(topImg, playerTop, playerTop === model.board.blackPlayer ? 1 : 2);
        const canvas = controls.create(parent, "canvas");
        controls.createSpan(playerTopDiv).id = "opponent-player-id";
        canvas.id = "playground-id";
        updateCanvasWidthAndHeight(canvas);
        canvas.addEventListener("mousedown", onCanvasMouseDown);
        canvas.addEventListener("mouseup", onCanvasMouseUp);
        canvas.addEventListener("mousemove", onCanvasMouseMove);
        canvas.addEventListener("mouseleave", onCanvasMouseLeave);
        canvas.addEventListener("dblclick", onCanvasDoubleClick);
        const playerBottomDiv = controls.createDiv(parent, "player-bottom");
        renderPlayerCanvas(playerBottomDiv, playerBottom === model.board.blackPlayer);
        const bottomImg = controls.createImg(playerBottomDiv, "player-img", 45, 45, undefined, playerBottom);
        updatePhoto(bottomImg, playerBottom, playerTop === model.board.blackPlayer ? 2 : 1);
        controls.createSpan(playerBottomDiv).id = "current-player-id";
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
        document.title = `${_T("HEADER_BACKGAMMON")} - ${model.currentUser.name}`;
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
        setActive(false);
        if (model.allUsers && model.allUsers.length == 0) {
            clearTicket();
        }
        const divMain = controls.createDiv(document.body, "main");
        if (computerGame) {
            renderMainPage(divMain);
            return;
        }
        if (!ticket) {
            if (guestMode) {
                document.title = `${_T("HEADER_BACKGAMMON")} - ${_T("INFO_GUEST_VIEW")}`;
                if (model.board) {
                    renderMainPage(divMain);
                }
                else {
                    controls.create(divMain, "p", undefined, _T("INFO_NO_RUNNING_GAME"));
                    controls.createButton(divMain, _T("BUTTON_COMPUTER_GAME"), () => onStartComputerGame());
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
                controls.createButton(divMain, _T("BUTTON_COMPUTER_GAME"), () => onStartComputerGame());
                renderCopyright(divMain);
            }
        }
        else {
            renderUsername(divMain);
        }
        enableTimer();
    };

    const onStartComputerGame = () => {
        computerGame = true;
        const name = currentUser ? currentUser.name : _T("TEXT_YOU");
        disableTimer();
        utils.fetch_api_call("api/backgammon/computer/model", {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ CurrentPlayerName: name, OpponentPlayerName: _T("TEXT_COMPUTER") })
            },
            m => renderModel(m),
            handleError);
        return;
    };

    const onUpdateModel = () => {
            utils.fetch_api_call("api/backgammon/computer/model", {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ CurrentPlayerName: model.currentUser.name, State: model.internalState })
            },
            m => renderModel(m),
            handleError);
    };

    const onComputerAction = () => {
        if (!computerGame || !model || !model.board || isActivePlayer()) return;
        utils.fetch_api_call("api/backgammon/computer/model", {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ CurrentPlayerName: _T("TEXT_COMPUTER"), State: model.internalState })
            },
            m => {
                if (canRollDice(m)) {
                    rollDice(m);
                }
                else if (m.board.gameStarted && !m.board.gameOver && m.board.currentRollNumbers.length) {
                    if (m.board.moves.length > 0) {
                        onChooseComputerMove(m);
                    }
                    else
                    {
                        skip(m);
                    }
                }
            },
            handleError);
    };

    const onChooseComputerMove = (m) => {
        utils.fetch_api_call("api/backgammon/computer/movetree", {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ CurrentPlayerName: _T("TEXT_COMPUTER"), State: m.internalState, BuildMoveTree: true })
            },
            mnew => {
                if (utils.is_debug()) utils.debug(mnew.board.moveTree);
                let bestProp;
                let bestNodes = [];
                mnew.board.moveTree.forEach(mn => {
                    let p = getLowestHitPropability(mn);
                    if (utils.is_debug()) utils.debug(`hit prop for ${mn.from} - ${mn.to} => ${p}`);
                    if (p != undefined && (bestProp == undefined || p <= bestProp)) {
                        if (bestProp != undefined && p < bestProp) {
                            bestNodes = [];
                        }
                        bestNodes.push(mn);
                        bestProp = p;
                    }
                });
                if (utils.is_debug()) {
                    bestNodes.forEach(n => utils.debug(`best move is ${n.from} -> ${n.to} with hit prop ${bestProp}.`));
                }
                const bestNode = chooseBestNode(bestNodes, mnew);
                if (utils.is_debug()) utils.debug(`Use best move ${bestNode.from} -> ${bestNode.to}.`);
                move(bestNode.from, bestNode.to, mnew);
            },
            handleError);
    };

    const chooseBestNode = (bestNodes, m) => {
        const hitable = m.board.items
            .filter(item => item.color == "W" && item.count == 1 && item.position >= 0)
            .map(item => item.position);
        let hit = false;
        let bestNode;
        bestNodes.forEach(n => {
            if (bestNode == undefined) {
                bestNode = n;
            }
            else if (bestNode.to != -2) {
                if (n.to == -2) {
                    bestNode = n;
                }
                else if (!hit) {
                    if (hitable.includes(n.to)) {
                        bestNode = n;
                        hit = true;
                    }
                    else if (n.from > bestNode.from || n.from == bestNode.from && n.to > bestNode.to) {
                        bestNode = n;
                    }
                }
            }
        });
        return bestNode;
    };

    const getLowestHitPropability = (node) => {
        if (node.childNodes.length === 0) {
            return node.hitPropability;
        }
        let bestChild;
        node.childNodes.forEach(childNode => {
            let p = getLowestHitPropability(childNode);
            if (p != undefined && (bestChild == undefined || p < bestChild)) {
                bestChild = p;
            }
        });
        return bestChild;
    };

    const render = () => {
        if (computerGame && model) {
            renderModel(model);
            return;
        }
        const params = new URLSearchParams(window.location.search);
        if (params.has("debug")) {
            utils.enable_debug(true);
            utils.debug("DEBUG enabled.");
        }
        if (params.has("login")) {
            login(params.get("login"));
            return;
        }
        ticket = getTicket();
        if (params.has("guest")) {
            guestMode = true;
        }
        disableTimer();
        utils.fetch_api_call("api/backgammon/model", { headers: { "ticket": ticket } },
            (m) => {
                if (utils.is_debug()) {
                    utils.debug(`MODEL RETRIEVED (render): new state: ${m.state}!`);
                    utils.debug(m);
                }
                setState(m.state);
                renderModel(m);
            },
            handleError);
    };

    const renderInit = () => {
        currentUser = undefined;
        dirty = false;
        loadImages();
        const token = utils.get_authentication_token();
        if (!token) {
            render();
            window.requestAnimationFrame(draw);
            return;
        }
        disableTimer();
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

    const onCanvasMouseDown = (evt) => {
        if (isActivePlayer() && model.board.gameStarted && hasRolledDice()) {
            const pos = getPositionFromEvent(evt);
            if (!moveItem) {
                if (utils.is_debug()) utils.debug(`MOUSE DOWN: mark item at position ${pos}.`);
                updateMoveItem(pos);
            }
            else {
                if (utils.is_debug()) utils.debug(`MOUSE DOWN: move item from position ${moveItem.position} to ${pos}.`);
                move(moveItem.position, pos);
            }
            updateHighlightItem(pos);
            lastPos = undefined;
            dirty = true;
        }
    };

    const onCanvasMouseUp = (evt) => {
        let moved = false;
        if (isActivePlayer() && model.board.gameStarted && hasRolledDice()) {
            const pos = getPositionFromEvent(evt);
            if (moveItem && moveItem.position != pos) {
                if (utils.is_debug()) utils.debug(`MOUSE UP: drag and drop item from position ${moveItem.pos} to ${pos}.`);
                moved = true;
                move(moveItem.position, pos);
                updateHighlightItem(pos);
                lastPos = undefined;
                dirty = true;
            }
        }
        if (!moved && canRollDice()) {
            const x = borderWidth + 6 * pointWidth + Math.floor((pointWidth - checkerRadius * 2) / 2);
            const y = borderHeight + pointHeight + checkerRadius;
            if (evt.offsetX >= x && evt.offsetX <= x + 2 * checkerRadius &&
                evt.offsetY >= y && evt.offsetY <= y + 2 * checkerRadius) {
                rollDice();
            }
        }
    };

    const onCanvasMouseMove = (evt) => {
        if (isActivePlayer() && model.board.gameStarted && hasRolledDice()) {
            const pos = getPositionFromEvent(evt);
            if (lastPos != pos) {
                if (utils.is_debug()) utils.debug(`MOUSE MOVE: update hightlight item at position ${pos}.`);
                updateHighlightItem(pos);
                lastPos = pos;
                dirty = true;
            }
        }
    };

    const onCanvasMouseLeave = () => {
        if (isActivePlayer() && model.board.gameStarted && hasRolledDice()) {
            if (utils.is_debug()) utils.debug("MOUSE LEAVE.");
            highlightItem = undefined;
            lastPos = undefined;
            dirty = true;
        }
    };

    const onCanvasDoubleClick = (evt) => {
        if (isActivePlayer() && model.board.gameStarted && hasRolledDice()) {
            const pos = getPositionFromEvent(evt);
            if (utils.is_debug()) utils.debug(`DOUBLE CLICK: bear off item at position ${pos}.`);
            const posItem = getCurrentItem(pos);
            if (posItem) {
                let toMove;
                model.board.moves.forEach((move) => {
                    if (move.from == posItem.position && move.to == -2) {
                        toMove = move;
                    }
                });
                if (toMove) {
                    highlightItem = undefined;
                    lastPos = undefined;
                    move(toMove.from, -2);
                    dirty = true;
                }
            }
        }
    };

    const onUpdateHelp = (show) => {
        if (helpDiv) {
            helpDiv.className = show ? "help-div" : undefined;
            controls.removeAllChildren(helpDiv);
            if (show) {
                const contentDiv = controls.createDiv(helpDiv, "help-content");
                const mdDiv = controls.createDiv(contentDiv, "help-item");
                utils.fetch_api_call(`/api/pwdman/markdown/help-backgammon?locale=${utils.get_locale()}`, undefined,
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
                    if (utils.is_debug()) {
                        utils.debug(`LOGIN: new state is ${loginModel.state}.`);
                        utils.debug(loginModel);
                    }
                    setState(loginModel.state);
                    if (loginModel.isAuthenticationRequired) {
                        const nexturl = `/backgammon?login=${name}`;
                        utils.set_window_location("/pwdman?nexturl=" + encodeURI(nexturl) + "&username=" + encodeURI(name));
                        return;
                    }
                    else if (loginModel.ticket && loginModel.ticket.length > 0) {
                        setTicket(loginModel.ticket);
                    }
                    render();
                },
                (errMsg) => {
                    document.getElementById("login-error-id").textContent = _T(errMsg);
                    enableTimer();
                });
        }
    };

    const rollDice = (m) => {
        const isComputer = m;
        m = m || model;
        if (computerGame) {
            utils.fetch_api_call("api/backgammon/computer/roll", {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ CurrentPlayerName: m.currentUser.name, State: m.internalState })
            },
                (mnew) => {
                    if (isComputer) {
                        model.internalState = mnew.internalState;
                        onUpdateModel();
                    }
                    else {
                        model = mnew;
                        update();
                    }
                },
                handleError);
            return;
        }
        disableTimer();
        utils.fetch_api_call("api/backgammon/roll", { method: "POST", headers: { "ticket": ticket } },
            (state) => {
                if (utils.is_debug()) utils.debug(`ROLL DICE: new state is ${state}.`);
                setState(state);
                update();
                enableTimer();
            },
            handleError);
    };

    const btnNextGame_click = () => {
        if (computerGame) {
            return;
        }
        disableTimer();
        utils.fetch_api_call("api/backgammon/nextgame", { method: "POST", headers: { "ticket": ticket } },
            (state) => {
                if (utils.is_debug()) utils.debug(`NEXT GAME REQUESTED: new state is ${state}.`);
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
                if (utils.is_debug()) utils.debug(`CONFIRM NEXT GAME: new state is ${state}.`);
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
                if (utils.is_debug()) utils.debug(`NEW GAME: new state is ${state}.`);
                setState(state);
                render();
            },
            handleError);
    };

    const skip = (m) => {
        if (computerGame) {
            const isComputer = m;
            m = m || model;
            utils.fetch_api_call("api/backgammon/computer/skip",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json" },
                    body: JSON.stringify({ CurrentPlayerName: m.currentUser.name, State: m.internalState })
                },
                (mnew) => {
                    if (isComputer) {
                        model.internalState = mnew.internalState;
                        onUpdateModel();
                    }
                    else {
                        model = mnew;
                        update();
                    }
                },
                handleError);
            return;
        }
        disableTimer();
        utils.fetch_api_call("api/backgammon/skip", { method: "POST", headers: { "ticket": ticket } },
            (state) => {
                if (utils.is_debug()) utils.debug(`SKIP: new state is ${state}.`);
                setState(state);
                update();
                enableTimer();
            },
            handleError);
    };

    const btnGiveUp_click = (elem) => {
        if (elem.value == "GiveUpYes") {
            if (computerGame) {
                utils.fetch_api_call("api/backgammon/computer/giveup",
                    {
                        method: "POST",
                        headers: { "Accept": "application/json", "Content-Type": "application/json" },
                        body: JSON.stringify({ CurrentPlayerName: model.currentUser.name, State: model.internalState })
                    },
                    (mnew) => {
                        model = mnew;
                        giveUpClicked = false;
                        render();
                    },
                    handleError);
                return;
            }
            disableTimer();
            utils.fetch_api_call("api/backgammon/giveup", { method: "POST", headers: { "ticket": ticket } },
                (state) => {
                    if (utils.is_debug()) utils.debug(`GIVE UP: new state is ${state}.`);
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
            if (computerGame) {
                computerGame = false;
                endGameClicked = false;
                render();
                return;
            }
            disableTimer();
            utils.fetch_api_call("api/backgammon/logout", { method: "POST", headers: { "ticket": ticket } },
                (state) => {
                    if (utils.is_debug()) utils.debug(`LOGOUT (game): new state is ${state}.`);
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
                if (utils.is_debug()) utils.debug(`LOGOUT (ticket): new state is ${state}.`);
                setState(state);
                ticket = undefined;
                utils.remove_session_storage("backgammonticket");
                utils.remove_local_storage("backgammonticket");
                render();
            },
            handleError);
    };

    const onResize = () => {
        const canvas = document.getElementById("playground-id");
        if (canvas && model && model.board && model.board.items) {
            if (gameOverSprites.length > 0) {
                gameOverSprites = [];
            }
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
                    if (utils.is_debug()) utils.debug(`ON TIMER: new state is ${state}.`);
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
    };

    // --- public API

    return {
        renderInit: renderInit,
        onTimer: onTimer,
        onResize: onResize,
        loadImages: loadImages
    };
})();

window.onload = () => {
    window.setInterval(backgammon.onTimer, 1000);
    window.addEventListener("resize", backgammon.onResize);
    utils.auth_lltoken(() => utils.set_locale(() => backgammon.renderInit()));
};

window.onclick = (event) => utils.hide_menu(event);
