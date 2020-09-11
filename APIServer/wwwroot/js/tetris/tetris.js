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

    // --- state
    let version = "1.0.6";

    let block;
    let nextBlock;
    let playground;
    let score;
    let lines;
    let level;
    let state;

    let speed;
    let clearPoints;
    let moveDownFrameCount;
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
        console.log(`Level ${level}: Speed is ${speed[Math.min(29, level)]} frames / cell.`);
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
        if (state == StateEnums.NEWBLOCK) {
            placeNewBlock();
        }
        else if (state == StateEnums.SOFTDROP) {
            if (keyPressed) {
                state = StateEnums.MOVEDOWN;
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
                        }
                    }
                }
                if (keyPressed === "ArrowDown" || keyPressed === " ") {
                    state = StateEnums.SOFTDROP;
                    keyPressed = undefined;
                }
                else if (keyPressed === "ArrowUp" || keyPressed === "a") {
                    if (block.rotateRight(playground)) {
                        dirtyBlock = true;
                    }
                    keyPressed = undefined;
                }
            }
            moveDownFrameCount++;
            if (moveDownFrameCount >= speed[Math.min(29,level)]) {
                moveDownFrameCount = 0;
                moveDown();
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
        }
        else {
            gameOverDiv.textContent = `GAME OVER`;
            gameOverDiv.style.visibility = "visible";
            newGameButton.style.visibility = "visible";
            state = StateEnums.GAMEOVER;
        }
    };

    // --- rendering HTML elements

    const createImage = (parent, url, size, action) => {
        let img = controls.create(parent, "img");
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

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent, "copyright");
        controls.create(div, "span", undefined, `Myna Tetris Version ${version}. Copyright 2020 `);
        let a = controls.createA(div, undefined, "https://github.com/nylssoft/", "Niels Stockfleth");
        a.target = "_blank";
        controls.create(div, "span", undefined, ". Alle Rechte vorbehalten.");
    };

    const renderTetris = (parent) => {
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

        let arrowDivLeft = controls.createDiv(parent, "arrow-left");
        createImage(arrowDivLeft, "/images/tetris/arrow-left-3.png", 32, "ArrowLeft");
        let arrowDivRight = controls.createDiv(parent, "arrow-right");
        createImage(arrowDivRight, "/images/tetris/arrow-right-3.png", 32, "ArrowRight");
        let arrowDivUp = controls.createDiv(parent, "arrow-up");
        createImage(arrowDivUp, "/images/tetris/arrow-up-3.png", 32, "ArrowUp");
        let arrowDivDown = controls.createDiv(parent, "arrow-down");
        createImage(arrowDivDown, "/images/tetris/arrow-down-3.png", 32, "ArrowDown");

        canvas = controls.create(parent, "canvas", "playground");
        canvas.width = pixelPerField * (playground.width + 2);
        canvas.height = pixelPerField * (playground.height + 2);

        canvasNextBlock = controls.create(info, "canvas", "nextblock");
        canvasNextBlock.width = pixelPerField * 6;
        canvasNextBlock.height = pixelPerField * 6;                
    };

    const render = () => {

        pixelPerField = 24;
        borderWidth = 3;

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

        console.log(`Level ${level}: Speed is ${speed[level]} frames / cell.`);

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

        let all = controls.createDiv(document.body);
        renderTetris(all);
        renderCopyright(all);

        requestAnimationFrame(draw);

        setBackgroundPicture();
    };

    const initKeyDownEvent = () => {
        document.addEventListener("keydown", e => {
            if (keyPressed != e.key) {
                keyPressed = e.key;
                keyPressedMax = 100;
                keyPressedCount = keyPressedMax;
            }
        });
        document.addEventListener("keyup", (e) => {
            if (e.key == "l") {
                increaseLevel();
            }
            keyPressed = undefined;
        });
    };

    // --- public API

    return {
        draw: draw,
        render: render,
        initBackgroundPictures: initBackgroundPictures,
        initKeyDownEvent: initKeyDownEvent
    };
})();

// --- window loaded event

window.onload = () => {
    fetch("/images/slideshow/pictures.json", { cache: "no-cache" })
        .then(response => {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                response.json().then(model => {
                    tetris.initBackgroundPictures(model.pictures);
                    tetris.initKeyDownEvent();
                    tetris.render();
                });
            }
        });
};
