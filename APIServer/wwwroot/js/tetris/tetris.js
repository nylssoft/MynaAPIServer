"use strict";

const ColorEnums = Object.freeze({
    "EMPTY": 0,
    "BORDER": 1,
    "ORANGE": 2,
    "BLUE": 3,
    "YELLOW": 4,
    "CYAN": 5,
    "RED": 6,
    "GREEN": 7,
    "PURBLE": 8
});

const StateEnums = Object.freeze({
    "GAMEOVER": 0,
    "NEWBLOCK": 1,
    "DROPONEROW": 3,
    "SOFTDROP": 4,
    "MOVEDOWN": 5
});

class Playground {
    constructor(width, height) {        
        this.width = width;
        this.height = height;
        this.rows = new Array(this.height);
        this.scrollRows = [];
        for (let i = 0; i < this.height; i++) {
            this.rows[i] = new Array(this.width).fill(ColorEnums.EMPTY);
        }
    }

    isFree(x, y) {
        return this.getColor(x, y) === ColorEnums.EMPTY;
    }

    getColor(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            return this.rows[y][x];
        }
        return ColorEnums.BORDER;
    }

    setColor(x, y, c) {
        this.rows[y][x] = c;
    }

    clearFullRows() {
        let fullRows = 0;
        for (let y = 0; y < this.height; y++) {
            let hasFree = this.rows[y].some(c => c === ColorEnums.EMPTY);
            if (!hasFree) {
                fullRows += 1;
                this.scrollRows.push(y);
                for (let x = 0; x < this.width; x++) {
                    this.rows[y][x] = ColorEnums.EMPTY;
                }
            }
        }
        return fullRows;
    }

    hasDropRows() {
        return this.scrollRows.length > 0;
    }

    dropOneRow() {
        let y = this.scrollRows.shift();
        if (y) {
            while (y > 0) {
                for (let x = 0; x < this.width; x++) {
                    this.rows[y][x] = this.rows[y - 1][x];
                }
                y -= 1;
            }
            return true;
        }
        return false;
    }

}

class Block {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.orientation = 0;
        this.color = ColorEnums.BORDER;
    }

    // --- public overrides

    getRelativePoints(orientation) {
        return [];
    }

    // --- public members

    placeFirstRow(playground) {
        let firstRowsOccupied = playground.rows[0].some( c => c !== ColorEnums.EMPTY);
        return !firstRowsOccupied && this._place(playground, 4, 0, 0);
    }

    rotateRight(playground) {
        return this.move(playground, this.x, this.y, this._getNextRightOrientation());
    }

    move(playground, x, y, o) {
        if (o === undefined) {
            o = this.orientation;
        }
        if (y === undefined) {
            y = this.y;
        }
        x = (x === undefined) ? this.x : x;
        if (this._place(playground, x, y, o)) {
            return true;
        }
        return false;
    }

    moveLeft(playground) {
        return this._place(playground, this.x - 1, this.y, this.orientation);
    }

    moveRight(playground) {
        return this._place(playground, this.x + 1, this.y, this.orientation);
    }

    moveDown(playground) {
        return this._place(playground, this.x, this.y + 1, this.orientation);
    }

    stop(playground) {
        let points = this.getRelativePoints(this.orientation);
        points.forEach(p => {
            playground.setColor(this.x + p[0], this.y + p[1], this.color);
        });
    }

    // --- private members

    _place(playground, x, y, orientation) {
        if (this._canPlace(playground, x, y, orientation)) {
            this.x = x;
            this.y = y;
            this.orientation = orientation;
            return true;
        }
        return false;
    }

    _canPlace(playground, x, y, orientation) {
        let points = this.getRelativePoints(orientation);
        let isBlocked = points.some(p => {
            return !playground.isFree(x + p[0], y + p[1]);
        });
        return !isBlocked;
    }

    _getNextRightOrientation() {
        return (this.orientation + 1) % 4;
    }
}

class LBlock extends Block {

    constructor() {
        super();
        this.color = ColorEnums.ORANGE;
    }

    rotateRight(playground) {
        if (!super.rotateRight(playground)) {
            if (this.orientation == 0 && this.x == 0) {
                return this.move(playground, this.x + 1, this.y, this._getNextRightOrientation());
            }
            else if (this.orientation == 2 && this.x == playground.width - 2) {
                if (this.move(playground, this.x - 1, this.y, this._getNextRightOrientation())) {
                    this.move(playground, this.x + 1, this.y);
                    return true;
                }
            }
            return false;
        }
        return true;
    }

    getRelativePoints(o) {
        let pts;
        switch (o) {
            case 0:
                pts = [[0, 0], [1, 0], [1, 1], [1, 2]];
                break;
            case 1:
                pts = [[-1, 2], [0, 2], [1, 2], [1, 1]];
                break;
            case 2:
                pts = [[0, 0], [0, 1], [0, 2], [1, 2]];
                break;
            case 3:
                pts = [[0, 0], [1, 0], [2, 0], [0, 1]];
                break;
        }
        return pts;
    }
}

class JBlock extends Block {
    constructor() {
        super();
        this.color = ColorEnums.BLUE;
    }

    rotateRight(playground) {
        if (!super.rotateRight(playground)) {
            if (this.orientation == 0 && this.x == 1) {
                if (this.move(playground, this.x + 1, this.y, this._getNextRightOrientation())) {
                    this.move(playground, this.x - 1, this.y);
                    return true;
                }
            }
            else if (this.orientation == 2 && this.x == playground.width -  1) {
                return this.move(playground, this.x - 1, this.y, this._getNextRightOrientation());
            }
            return false;
        }
        return true;
    }

    getRelativePoints(o) {
        let pts;
        switch (o) {
            case 0:
                pts = [[-1, 0], [0, 0], [-1, 1], [-1, 2]];
                break;
            case 1:
                pts = [[-2, 0], [-1, 0], [0, 0], [0, 1]];
                break;
            case 2:
                pts = [[0, 0], [0, 1], [0, 2], [-1, 2]];
                break;
            case 3:
                pts = [[-1, 1], [-1, 2], [0, 2], [1, 2]];
                break;
        }
        return pts;
    }
}

class OBlock extends Block {
    constructor() {
        super();
        this.color = ColorEnums.YELLOW;
    }

    getRelativePoints(o) {
        return [[0, 0], [1, 0], [0, 1], [1, 1]];
    }

}

class ZBlock extends Block {
    constructor() {
        super();
        this.color = ColorEnums.RED;
    }

    rotateRight(playground) {
        if (!super.rotateRight(playground)) {
            if ((this.orientation == 1 || this.orientation == 3) && this.x == playground.width - 1) {
                if (this.move(playground, this.x - 1, this.y, this._getNextRightOrientation())) {
                    this.move(playground, this.x + 1, this.y);
                    return true;
                }
            }
            return false;
        }
        return true;
    }

    getRelativePoints(o) {
        let pts;
        switch (o) {
            case 0:
            case 2:
                pts = [[-1, 0], [0, 0], [0, 1], [1, 1]];
                break;
            case 1:
            case 3:
                pts = [[0, 0], [0, 1], [-1, 1], [-1, 2]];
                break;
        }
        return pts;
    }
}

class SBlock extends Block {
    constructor() {
        super();
        this.color = ColorEnums.GREEN;
    }

    rotateRight(playground) {
        if (!super.rotateRight(playground)) {
            if ((this.orientation == 1 || this.orientation == 3) && this.x == 0) {
                if (this.move(playground, this.x + 1, this.y, this._getNextRightOrientation())) {
                    this.move(playground, this.x - 1, this.y);
                    return true;
                }
            }
            return false;
        }
        return true;
    }

    getRelativePoints(o) {
        let pts;
        switch (o) {
            case 0:
            case 2:
                pts = [[0, 0], [1, 0], [-1, 1], [0, 1]];
                break;
            case 1:
            case 3:
                pts = [[0, 0], [0, 1], [1, 1], [1, 2]];
                break;
        }
        return pts;
    }
}

class TBlock extends Block {
    constructor() {
        super();
        this.color = ColorEnums.PURBLE;
    }

    rotateRight(playground) {
        if (!super.rotateRight(playground)) {
            if (this.orientation == 0 && this.x == playground.width - 1) {
                return this.move(playground, this.x - 1, this.y, this._getNextRightOrientation());
            }
            else if (this.orientation == 2 && this.x == 0) {
                return this.move(playground, this.x + 1, this.y, this._getNextRightOrientation());
            }
            return false;
        }
        return true;
    }

    getRelativePoints(o) {
        let pts;
        switch (o) {
            case 0:
                pts = [[0, 0], [0, 1], [0, 2], [-1, 1]];
                break;
            case 1:
                pts = [[0, 0], [0, 1], [-1, 1], [1, 1]];
                break;
            case 2:
                pts = [[0, 0], [0, 1], [1, 1], [0, 2]];
                break;
            case 3:
                pts = [[0, 1], [-1, 1], [1, 1], [0, 2]];
                break;
        }
        return pts;
    }

}

class IBlock extends Block {
    constructor() {
        super();
        this.color = ColorEnums.CYAN;
    }

    rotateRight(playground) {
        if (!super.rotateRight(playground)) {
            if ((this.orientation == 2 || this.orientation == 0) && this.x < 2) {
                return this.move(playground, 2, this.y, this._getNextRightOrientation());
            }
            else if ((this.orientation == 2 || this.orientation == 0) && this.x == playground.width - 1) {
                return this.move(playground, this.x - 1, this.y, this._getNextRightOrientation());
            }
            return false;
        }
        return true;
    }

    getRelativePoints(o) {
        let pts;
        switch (o) {
            case 0:
            case 2:
                pts = [[0, 0], [0, 1], [0, 2], [0, 3]];
                break;
            case 1:
            case 3:
                pts = [[0, 2], [-1, 2], [-2, 2], [1, 2]];
                break;
        }
        return pts;
    }
}

var tetris = (() => {

    // --- UI elements

    let canvas;
    let scoreDiv;
    let levelDiv;
    let linesDiv;
    let gameOverDiv;
    let newGameButton;
    let canvasNextBlock;
    let highScoreDiv;
    let addHighScoreDiv;
    let inputUserName;
    let helpDiv;

    // --- state
    let version = "1.2.24";

    let block;
    let nextBlock;
    let blockMoveDownCount;
    let isPaused;
    let isHelpPage;
    let playground;
    let score;
    let lines;
    let level;
    let state;
    let blockTouchY = undefined;

    let speed;
    let clearPoints;
    let moveDownFrameCount;
    let lastMoveDown;
    let keyPressedCount;
    let keyPressedMax;
    let keyPressed;
    let dirtyBorder;
    let dirtyPlayground;
    let dirtyBlock;
    let dirtyNextBlock;

    let pixelPerField;
    let borderWidth;

    let colorMap;

    let backgroundPictures;
    let highScores;

    let currentUser;

    // --- background

    const setBackgroundPicture = () => {
        if (backgroundPictures && level < backgroundPictures.length + 1) {
            let pic = backgroundPictures[level];
            document.body.style.background = `#000000 url('${pic.url}')`;
            document.body.style.backgroundSize = "cover";
            document.body.style.backgroundRepeat = "no-repeat";
        }
    }

    const initBackgroundPictures = (pictures) => {
        backgroundPictures = pictures;
        utils.shuffle_array(backgroundPictures);
    }

    const increaseLevel = () => {
        level += 1;
        levelDiv.textContent = `Stufe: ${level}`;
        setBackgroundPicture();
    }

    // --- drawing canvas

    const drawRect = (ctx, x, y, c) => {
        ctx.fillStyle = colorMap[c].center;
        ctx.beginPath();
        ctx.fillRect(x + borderWidth, y + borderWidth, pixelPerField - borderWidth * 2, pixelPerField - borderWidth);

        ctx.fillStyle = colorMap[c].top;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + borderWidth, y + borderWidth);
        ctx.lineTo(x + pixelPerField - borderWidth, y + borderWidth);
        ctx.lineTo(x + pixelPerField, y);
        ctx.fill();

        ctx.fillStyle = colorMap[c].bottom;
        ctx.beginPath();
        ctx.moveTo(x, y + pixelPerField);
        ctx.lineTo(x + borderWidth, y + pixelPerField - borderWidth);
        ctx.lineTo(x + pixelPerField - borderWidth, y + pixelPerField - borderWidth);
        ctx.lineTo(x + pixelPerField, y + pixelPerField);
        ctx.fill();

        ctx.fillStyle = colorMap[c].leftright;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + borderWidth, y + borderWidth);
        ctx.lineTo(x + borderWidth, y + pixelPerField - borderWidth);
        ctx.lineTo(x, y + pixelPerField);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + pixelPerField, y);
        ctx.lineTo(x + pixelPerField - borderWidth, y + borderWidth);
        ctx.lineTo(x + pixelPerField - borderWidth, y + pixelPerField - borderWidth);
        ctx.lineTo(x + pixelPerField, y + pixelPerField);
        ctx.fill();
    };

    const drawNextBlock = (ctx) => {
        let offx = pixelPerField;
        let offy = offx;
        let points = nextBlock.getRelativePoints(nextBlock.orientation);
        points.forEach(p => {
            let x = offx + (nextBlock.x + p[0]) * pixelPerField;
            let y = offy + (nextBlock.y + p[1]) * pixelPerField;
            drawRect(ctx, x, y, nextBlock.color);
        });
    };

    const drawBlock = (ctx) => {
        clearPoints.forEach(p => {
            ctx.clearRect(p.x, p.y, pixelPerField, pixelPerField);
        });
        clearPoints = [];
        let offx = pixelPerField;
        let offy = offx;
        let points = block.getRelativePoints(block.orientation);
        points.forEach(p => {
            let x = offx + (block.x + p[0]) * pixelPerField;
            let y = offy + (block.y + p[1]) * pixelPerField;
            drawRect(ctx, x, y, block.color);
            clearPoints.push({ "x": x, "y": y });
        });
    };

    const drawBorder = (ctx) => {
        for (let y = 0; y <= pixelPerField * (playground.height + 1); y += pixelPerField) {
            drawRect(ctx, 0, y, ColorEnums.BORDER);
            drawRect(ctx, pixelPerField * (playground.width + 1), y, ColorEnums.BORDER);
        }
        for (let x = 1; x < pixelPerField * (playground.width + 1); x += pixelPerField) {
            drawRect(ctx, x, 0, ColorEnums.BORDER);
            drawRect(ctx, x, pixelPerField * (playground.height + 1), ColorEnums.BORDER);
        }
    };

    const drawPlayground = (ctx) => {
        let offx = pixelPerField;
        let offy = offx;
        ctx.clearRect(offx, offy, playground.width * pixelPerField, playground.height * pixelPerField);
        for (let y = 0; y < playground.height; y++) {
            for (let x = 0; x < playground.width; x++) {
                let c = playground.getColor(x, y);
                if (c != ColorEnums.EMPTY) {
                    drawRect(ctx, offx + x * pixelPerField, offy + y * pixelPerField, c);
                }
            }
        }
    };

    const moveDown = () => {
        if (block.moveDown(playground)) {
            dirtyBlock = true;
            return;
        }
        if (state == StateEnums.SOFTDROP) {
            moveDownFrameCount++;
            if (moveDownFrameCount < speed[Math.min(29, level)]) {
                return;
            }
            moveDownFrameCount = 0;
        }
        if (!lastMoveDown) {
            lastMoveDown = true;
            return;
        }
        lastMoveDown = false;
        keyPressed = undefined;
        block.stop(playground);
        block = undefined;
        clearPoints = [];
        dirtyPlayground = true;
        let scores = [40, 100, 300, 1200];
        let fullRows = playground.clearFullRows();
        if (fullRows > 0) {
            score += scores[fullRows - 1] * (level + 1);
            lines += fullRows;
            if (lines >= (level + 1) * 10) {
                increaseLevel();
            }
        }
        scoreDiv.textContent = `Punkte: ${score}`;
        linesDiv.textContent = `Linien: ${lines}`;
        if (playground.hasDropRows()) {
            state = StateEnums.DROPONEROW;
        }
        else {
            placeNewBlock();
        }
    };

    const draw = () => {
        // game logic
        if (isPaused) {
            window.requestAnimationFrame(draw);
            return;
        }
        if (state == StateEnums.NEWBLOCK) {
            placeNewBlock();
        }
        else if (state == StateEnums.SOFTDROP) {
            if (keyPressed && keyPressed != "ArrowDown") {
                state = StateEnums.MOVEDOWN;
                if (keyPressed != "ArrowLeft" && keyPressed != "ArrowRight") {
                    keyPressed = undefined;
                }
                moveDownFrameCount = 0;
            }
            else {
                moveDown();
            }
        }
        else if (state == StateEnums.DROPONEROW) {
            if (!playground.dropOneRow()) {
                placeNewBlock();
            }
            else {
                dirtyPlayground = true;
            }
        }
        else if (state == StateEnums.MOVEDOWN) {
            let speedcnt = speed[Math.min(29, level)];
            if (blockMoveDownCount < 3) {
                speedcnt = speed[Math.min(5, level)];
            }
            let skipMoveDown = false;
            if (keyPressed) {
                keyPressedCount++;
                if (keyPressedCount >= keyPressedMax) {
                    if (keyPressed === "ArrowLeft") {
                        if (block.moveLeft(playground)) {
                            dirtyBlock = true;
                            if (keyPressedMax > 16) {
                                keyPressedMax = 16;
                            }
                            else {
                                keyPressedMax = 6;
                            }
                            keyPressedCount = 0;
                            skipMoveDown = true;
                        }
                    }
                    else if (keyPressed === "ArrowRight") {
                        if (block.moveRight(playground)) {
                            dirtyBlock = true;
                            if (keyPressedMax > 16) {
                                keyPressedMax = 16;
                            }
                            else {
                                keyPressedMax = 6;
                            }
                            keyPressedCount = 0;
                            skipMoveDown = true;
                        }
                    }
                }
                if (keyPressed === "ArrowDown" || keyPressed === " ") {
                    state = StateEnums.SOFTDROP;
                    keyPressed = undefined;
                    skipMoveDown = true;
                }
                else if (keyPressed === "ArrowUp" || keyPressed === "a") {
                    if (block.rotateRight(playground)) {
                        dirtyBlock = true;
                    }
                    keyPressed = undefined;
                    skipMoveDown = true;
                }
            }
            if (!skipMoveDown) {
                moveDownFrameCount++;
                if (moveDownFrameCount >= speedcnt) {
                    moveDownFrameCount = 0;
                    moveDown();
                    blockMoveDownCount++;
                }
            }
        }
        // drawing
        let ctx = canvas.getContext("2d");
        if (dirtyBorder) {
            drawBorder(ctx);
            dirtyBorder = false;
        }
        if (dirtyPlayground && playground) {
            drawPlayground(ctx);
            dirtyPlayground = false;
        }
        if (dirtyBlock && block) {
            drawBlock(ctx);
            dirtyBlock = false;
        }
        if (dirtyNextBlock && nextBlock) {
            let ctxnext = canvasNextBlock.getContext("2d");
            ctxnext.clearRect(0, 0, canvas.width, canvas.height);
            drawNextBlock(ctxnext);
            dirtyNextBlock = false;
        }
        window.requestAnimationFrame(draw);
    };

    // --- block methods

    const createNewBlock = () => {
        let idx = Math.floor(Math.random() * 7);
        switch (idx) {
            case 0:
                return new LBlock();
            case 1:
                return new JBlock();
            case 2:
                return new IBlock();
            case 3:
                return new TBlock();
            case 4:
                return new ZBlock();
            case 5:
                return new SBlock();
            default:
                return new OBlock();
        }
    }

    const placeNewBlock = () => {
        block = undefined;
        let newBlock;
        clearPoints = [];
        if (nextBlock) {
            newBlock = nextBlock;
            nextBlock = createNewBlock();
        }
        else {
            newBlock = createNewBlock();
            nextBlock = createNewBlock();
        }
        if (newBlock.placeFirstRow(playground)) {
            block = newBlock;
            state = StateEnums.MOVEDOWN;
            moveDownFrameCount = 0;
            keyPressedCount = 0;
            dirtyBlock = true;
            dirtyNextBlock = true;
            blockMoveDownCount = 0;
        }
        else {
            gameOverDiv.textContent = `GAME OVER`;
            gameOverDiv.style.visibility = "visible";
            newGameButton.style.visibility = "visible";
            state = StateEnums.GAMEOVER;
            fetch("api/tetris/highscore")
                .then(response => response.json())
                .then(h => {
                    highScores = h;
                    if (score > 0 && (highScores.length < 10 || highScores[9].score < score)) {
                        addHighScoreDiv.style.visibility = "visible";
                        if (!utils.is_mobile()) {
                            inputUserName.focus();
                        }
                    }
                    else {
                        highScoreDiv.style.visibility = highScores.length > 0 ? "visible" : "hidden";
                    }
                })
                .catch((err) => console.error(err));
        }
    };

    // --- rendering HTML elements

    const createImage = (parent, url, size, action, title) => {
        let img = controls.create(parent, "img");
        if (title) {
            img.title = title;
        }
        img.src = url;
        img.height = size;
        img.width = size;
        img.addEventListener("mousedown", e => {
            e.preventDefault();
            keyPressed = action;
            keyPressedMax = 100;
            keyPressedCount = keyPressedMax;
        });
        img.addEventListener("mouseup", e => {
            e.preventDefault();
            keyPressed = undefined;
        });
        img.addEventListener("touchstart", e => {
            e.preventDefault();
            keyPressed = action;
            keyPressedMax = 100;
            keyPressedCount = keyPressedMax;
        });
        img.addEventListener("touchend", e => {
            e.preventDefault();
            keyPressed = undefined;
        });
        img.addEventListener("touchcancel", e => {
            e.preventDefault();
            keyPressed = undefined;
        });
    }

    const renderHeader = (parent) => {
        let title = currentUser ? `${currentUser.name} - Tetris` : "Tetris";
        controls.create(parent, "h1", "header", title);
        if (currentUser && currentUser.photo) {
            let imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo, "Profil");
            imgPhoto.addEventListener("click", () => window.location.href = "/usermgmt");
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent, "copyright");
        controls.create(div, "span", undefined, `Myna Tetris ${version}. Copyright 2020-2021 `);
        controls.createA(div, undefined, "/markdown?page=homepage", "Niels Stockfleth");
        controls.create(div, "span", undefined, ".");
    };

    const renderHighScoreEntries = () => {
        controls.removeAllChildren(highScoreDiv);
        highScoreDiv.style.visibility = "hidden";
        fetch("api/tetris/highscore")
            .then(response => response.json())
            .then(h => {
                highScores = h;
                let pos = 1;
                highScores.forEach(hs => {
                    let e = controls.createDiv(highScoreDiv, "highscore");
                    e.textContent = `${pos}. ${hs.name} - ${hs.score}`;
                    let lstr = "Linien";
                    if (hs.lines == 1) lstr = "Linie";
                    let dstr = new Date(hs.created).toLocaleString("de-DE");
                    e.title = `${hs.score} Punkte. Level ${hs.level}. ${hs.lines} ${lstr}. Spiel vom ${dstr}.`;
                    pos++;
                });
                if (highScores.length > 0 && (!utils.is_mobile() || state === StateEnums.GAMEOVER)) {
                    highScoreDiv.style.visibility = "visible";
                }
            })
            .catch((err) => console.error(err));
    };

    const renderHighScores = (parent) => {
        highScoreDiv = controls.createDiv(parent, "highscores");
        highScoreDiv.style.visibility = "hidden";
        addHighScoreDiv = controls.createDiv(parent, "addhighscore");
        addHighScoreDiv.style.visibility = "hidden";
        let msg = controls.createDiv(addHighScoreDiv, undefined);
        msg.textContent = "Gl\u00FCckwunsch! Du darfst Dich in die Bestenliste eintragen!";
        inputUserName = controls.createInputField(addHighScoreDiv, "Name", addHighScore, "username-input", 10, 10);
        inputUserName.placeholder = "Name";
        renderHighScoreEntries();
    };

    const onUpdateHelp = (show) => {
        if (helpDiv) {
            helpDiv.className = show ? "help-div" : "invisible-div";
            controls.removeAllChildren(helpDiv);
            isHelpPage = show;
            isPaused = show;
            if (show) {                
                let contentDiv = controls.createDiv(helpDiv, "help-content");
                let mdDiv = controls.createDiv(contentDiv, "help-item");
                utils.fetch_api_call("/api/pwdman/markdown/help-tetris", undefined, (html) => mdDiv.innerHTML = html);
                controls.createButton(contentDiv, "Weiterspielen", () => onUpdateHelp(false), undefined, "help-continue").focus();
            }
        }
    };

    const renderHelp = (parent) => {
        let helpImg = controls.createImg(parent, "help-button", 24, 24, "/images/buttons/help.png", "Hilfe");
        helpImg.addEventListener("click", () => onUpdateHelp(true));
        helpDiv = controls.createDiv(parent, "invisible-div");
    };

    const onCanvasTouchStart = (e) => {
        e.preventDefault();
        const canvas = document.querySelector(".playground");
        const touches = e.changedTouches;
        if (touches.length === 1 && state != StateEnums.GAMEOVER && block) {
            const touch = touches[0];
            const rect = canvas.getBoundingClientRect();
            const tx = touch.clientX - rect.x;
            const ty = touch.clientY - rect.y;
            const offx = pixelPerField;
            const offy = offx;
            const points = block.getRelativePoints(block.orientation);
            let pminx = Number.MAX_SAFE_INTEGER,
                pminy = Number.MAX_SAFE_INTEGER,
                pmaxx = 0,
                pmaxy = 0;
            points.forEach(p => {
                const x = offx + (block.x + p[0]) * pixelPerField;
                const y = offy + (block.y + p[1]) * pixelPerField;
                pminx = Math.min(x, pminx);
                pmaxx = Math.max(x, pmaxx);
                pminy = Math.min(y, pminy);
                pmaxy = Math.max(y, pmaxy);
            });
            keyPressed = undefined;
            blockTouchY = undefined;
            if (tx >= pminx - pixelPerField && tx <= pmaxx + 2 * pixelPerField &&
                ty >= pminy - pixelPerField && ty <= pmaxy + 2 * pixelPerField) {
                blockTouchY = touch.clientY;
            }
            else if (tx < pminx) {
                keyPressed = "ArrowLeft";
            }
            else if (tx > pmaxx + pixelPerField) {
                keyPressed = "ArrowRight";
            }
            if (keyPressed) {
                keyPressedMax = 100;
                keyPressedCount = keyPressedMax;
            }
        }
    };

    const onCanvasTouchEnd = (e) => {
        e.preventDefault();
        keyPressed = undefined;
        const touches = e.changedTouches;
        if (blockTouchY > 0 && touches.length === 1 && state != StateEnums.GAMEOVER) {
            const touch = touches[0];
            const diff = touch.clientY - blockTouchY;
            if (diff < pixelPerField) {
                keyPressed = "ArrowUp";
            }
            else if (diff > 3 * pixelPerField) {
                keyPressed = "ArrowDown"
            }
            if (keyPressed) {
                keyPressedMax = 100;
                keyPressedCount = keyPressedMax;
            }
        }
        blockTouchY = undefined;
    };

    const renderTetris = (parent) => {
        renderHelp(parent);
        renderHighScores(parent);
        let info = controls.createDiv(parent, "info");
        scoreDiv = controls.createDiv(info);
        scoreDiv.textContent = `Punkte: ${score}`;
        levelDiv = controls.createDiv(info);
        levelDiv.textContent = `Stufe: ${level}`;
        linesDiv = controls.createDiv(info);
        linesDiv.textContent = `Linien: ${lines}`;
        let nextDiv = controls.createDiv(info);
        nextDiv.textContent = "N\u00E4chste Form:";

        gameOverDiv = controls.createDiv(parent, "gameover");
        gameOverDiv.style.visibility = "hidden";

        newGameButton = controls.createButton(parent, "Neues Spiel", () => { render(); }, "newgame", "newgame");
        newGameButton.style.visibility = "hidden";
        
        controls.createDiv(parent, "arrow-div");
        let arrowDivLeft = controls.createDiv(parent, "arrow-left");
        createImage(arrowDivLeft, "/images/buttons/arrow-left-3.png", 32, "ArrowLeft", "Links");
        let arrowDivRight = controls.createDiv(parent, "arrow-right");
        createImage(arrowDivRight, "/images/buttons/arrow-right-3.png", 32, "ArrowRight", "Rechts");
        let arrowDivUp = controls.createDiv(parent, "arrow-up");
        createImage(arrowDivUp, "/images/buttons/arrow-up-3.png", 32, "ArrowUp", "Drehen");
        let arrowDivDown = controls.createDiv(parent, "arrow-down");
        createImage(arrowDivDown, "/images/buttons/arrow-down-3.png", 32, "ArrowDown", "Fallen");

        canvas = controls.create(parent, "canvas", "playground");
        canvas.width = pixelPerField * (playground.width + 2);
        canvas.height = pixelPerField * (playground.height + 2);

        canvas.addEventListener("touchstart", onCanvasTouchStart, { passive: false });
        canvas.addEventListener("touchend", onCanvasTouchEnd, { passive: false });
        canvas.addEventListener("touchcancel", onCanvasTouchEnd, { passive: false });
        canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

        canvasNextBlock = controls.create(info, "canvas", "nextblock");
        canvasNextBlock.width = pixelPerField * 6;
        canvasNextBlock.height = pixelPerField * 6;                
    };

    const render = () => {
        playground = new Playground(10, 20);

        colorMap = {}
        colorMap[ColorEnums.ORANGE] = {
            center: "#f0a000", leftright: "#d89000", top: "#fbe3b3", bottom: "#795000"
        }
        colorMap[ColorEnums.CYAN] = {
            center: "#00f0f0", leftright: "#00d8d8", top: "#b3fbfb", bottom: "#007878"
        }
        colorMap[ColorEnums.RED] = {
            center: "#f00000", leftright: "#d80000", top: "#fbb3b3", bottom: "#780000"
        }
        colorMap[ColorEnums.GREEN] = {
            center: "#00f000", leftright: "#00d800", top: "#b3fbb3", bottom: "#007800"
        }
        colorMap[ColorEnums.PURBLE] = {
            center: "#a000f0", leftright: "#9000d8", top: "#e3b3fb", bottom: "#500078"
        }
        colorMap[ColorEnums.YELLOW] = {
            center: "#f0f000", leftright: "#d8d800", top: "#fbfbb3", bottom: "#787800"
        }
        colorMap[ColorEnums.BLUE] = {
            center: "#0000f0", leftright: "#0000d8", top: "#b3b3fb", bottom: "#000078"
        }
        colorMap[ColorEnums.BORDER] = {
            center: "#787878", leftright: "#a1a2a1", top: "#d7d7d7", bottom: "#373737"
        }

        speed = [
            48, // level 0
            43, // level 1
            38, // level 2
            33, // level 3
            28, // level 4
            23, // level 5
            18, // level 6
            13, // level 7
            8,  // level 8
            6,  // level 9
            5, 5, 5, // level 10 - 12
            4, 4, 4, // level 13 - 15
            3, 3, 3, // level 16-18
            2, 2, 2, 2, 2, 2, 2, 2, 2, 2, // level 19-28
            1]; // level 29+

        state = StateEnums.NEWBLOCK;
        score = 0;
        level = 0;
        lines = 0;

        blockMoveDownCount = 0;
        isPaused = false;
        keyPressed = undefined;
        keyPressedCount = 0;
        keyPressedMax = 100;
        moveDownFrameCount = 0;
        clearPoints = [];
        block = undefined;
        nextBlock = undefined;
        dirtyBorder = true;
        dirtyPlayground = true;
        dirtyBlock = true;
        dirtyNextBlock = true;

        controls.removeAllChildren(document.body);
        utils.create_cookies_banner(document.body);

        let all = controls.createDiv(document.body);
        utils.create_menu(all);
        renderHeader(all);
        renderTetris(all);
        renderCopyright(all);
        utils.set_menu_items(currentUser);

        setBackgroundPicture();
    };

    const renderInit = () => {
        currentUser = undefined;
        let token = utils.get_authentication_token();
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

    // --- callbacks

    const addHighScore = () => {
        const name = inputUserName.value.trim();
        if (name.length > 0) {
            fetch("api/tetris/highscore", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ "Name": name, "Score": score, "Lines": lines, "Level": level })
            })
                .then(response => response.json())
                .then(() => {
                    addHighScoreDiv.style.visibility = "hidden";
                    renderHighScoreEntries();
                })
                .catch((err) => console.error(err));
        }
    };

    // --- initialization

    const initKeyDownEvent = () => {
        document.addEventListener("keydown", e => {
            if (isHelpPage) return;
            if (state != StateEnums.GAMEOVER) {
                if (e.key.startsWith("Arrow")) {
                    e.preventDefault();
                }
                if (keyPressed != e.key) {
                    keyPressed = e.key;
                    keyPressedMax = 100;
                    keyPressedCount = keyPressedMax;
                }
            }
        });
        document.addEventListener("keyup", (e) => {
            if (isHelpPage) {
                onUpdateHelp(false);
                return;
            }
            if (e.key == "h") {
                onUpdateHelp(true);
                return;
            }
            if (state != StateEnums.GAMEOVER) {
                if (e.key.startsWith("Arrow")) {
                    e.preventDefault();
                }
                if (e.key == "l") {
                    increaseLevel();
                }
                keyPressed = undefined;
            }
            isPaused = !isPaused && e.key == "p";
        });
    };

    const init = (sm) => {
        if (utils.is_mobile()) {
            pixelPerField = 18;
            borderWidth = 2;
        }
        else {
            pixelPerField = 24;
            borderWidth = 3;
        }
        initBackgroundPictures(sm.pictures);
        initKeyDownEvent();
        renderInit();
    };

    // --- public API

    return {
        init: init
    };
})();

// --- window loaded event

window.onload = () => {
    utils.auth_lltoken(() => {
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/pwdman/slideshow", { headers: { "token": token } },
            (model) => tetris.init(model),
            (errMsg) => console.error(errMsg));
    });
};

window.onclick = (event) => utils.hide_menu(event);