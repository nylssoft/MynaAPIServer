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
        if (!this.move(playground, this.x, this.y, this._getNextRightOrientation())) {
            this.move(playground, this.x, this.y + 1, this._getNextRightOrientation());
        }
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
        let dir = (playground.width - x) >= playground.width / 2 ? 1 : -1;
        while (x >= 0 && x < playground.width) {
            x += dir;
            if (this._place(playground, x, y, o)) {
                return true;
            }
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
                pts = [[-1, 0], [0, 0], [0, 1], [0, 2]];
                break;
            case 1:
                pts = [[0, -1], [0, 0], [-1, 0], [-2, 0]];
                break;
            case 2:
                pts = [[0, 0], [1, 0], [0, -1], [0, -2]];
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
                pts = [[0, 0], [1, 0], [0, 1], [0, 2]];
                break;
            case 1:
                pts = [[0, 1], [0, 0], [-1, 0], [-2, 0]];
                break;
            case 2:
                pts = [[-1, 0], [0, 0], [0, -1], [0, -2]];
                break;
            case 3:
                pts = [[0, -1], [0, 0], [1, 0], [2, 0]];
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
                pts = [[0, 0], [0, 1], [-1, 0], [1, 0]];
                break;
            case 1:
                pts = [[0, 0], [0, 1], [0, -1], [1, 0]];
                break;
            case 2:
                pts = [[0, 0], [0, -1], [-1, 0], [1, 0]];
                break;
            case 3:
                pts = [[0, 0], [0, -1], [0, 1], [-1, 0]];
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
    let canvasNextBlock;

    // --- state

    let version = "1.0.2";

    let block;
    let nextBlock;
    let playground;
    let score;
    let lines;
    let level;
    let state;
    let speedDateTime;

    let pixelPerField;
    let borderWidth;

    let colorMap;

    let backgroundPictures;

    // --- background

    const setBackgroundPicture = () => {
        if (backgroundPictures && level < backgroundPictures.length + 1) {
            let pic = backgroundPictures[level - 1];
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

    const drawBlock = (ctx, b) => {
        let offx = pixelPerField;
        let offy = offx;
        let points = b.getRelativePoints(b.orientation);
        points.forEach(p => {
            let x = offx + (b.x + p[0]) * pixelPerField;
            let y = offy + (b.y + p[1]) * pixelPerField;
            drawRect(ctx, x, y, b.color);
        });
    };

    const draw = () => {
        let ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let offx = pixelPerField;
        let offy = offx;

        // border
        for (let y = 0; y <= pixelPerField * (playground.height +1); y += pixelPerField) {
            drawRect(ctx, 0, y, ColorEnums.BORDER);
            drawRect(ctx, pixelPerField * (playground.width + 1), y, ColorEnums.BORDER);
        }
        for (let x = 1; x < pixelPerField * (playground.width + 1); x += pixelPerField) {
            drawRect(ctx, x, 0, ColorEnums.BORDER);
            drawRect(ctx, x, pixelPerField * (playground.height + 1), ColorEnums.BORDER);
        }
        // playground
        if (playground) {
            for (let y = 0; y < playground.height; y++) {
                for (let x = 0; x < playground.width; x++) {
                    let c = playground.getColor(x, y);
                    if (c != ColorEnums.EMPTY) {
                        drawRect(ctx, offx + x * pixelPerField, offy + y * pixelPerField, c);
                    }
                }
            }
            if (state == StateEnums.DROPONEROW) {
                if (playground.dropOneRow()) {
                    window.requestAnimationFrame(draw);
                }
            }
        }
        // current block
        if (block) {
            drawBlock(ctx, block);
            if (state == StateEnums.SOFTDROP) {
                if (block.moveDown(playground)) {
                    window.requestAnimationFrame(draw);
                }
            }
        }
        // next block
        if (nextBlock) {
            let ctxnext = canvasNextBlock.getContext("2d");
            ctxnext.clearRect(0, 0, canvas.width, canvas.height);
            drawBlock(ctxnext, nextBlock);
        }
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
        if (nextBlock) {
            block = nextBlock;
            nextBlock = createNewBlock();
        }
        else {
            block = createNewBlock();
            nextBlock = createNewBlock();
        }
        if (block.placeFirstRow(playground)) {
            state = StateEnums.MOVEDOWN;
        }
        else {
            block = undefined;
            gameOverDiv.textContent = `GAME OVER`;
            gameOverDiv.style.visibility = "visible";
            state = StateEnums.GAMEOVER;
        }
        window.requestAnimationFrame(draw);
    };

    // --- rendering HTML elements

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

        let arrowDivLeft = controls.createDiv(parent, "arrows-left");
        controls.createImageButton(arrowDivLeft, "Pfeil Links",
            () => {
                if (playground && block && state === StateEnums.SOFTDROP) {
                    state = StateEnums.MOVEDOWN;
                }
                if (playground && block && state === StateEnums.MOVEDOWN) {
                    block.moveLeft(playground);
                    window.requestAnimationFrame(draw);
                }
            },
            "/images/tetris/arrow-left-3.png", 32, "arrow-img");
        let arrowDivRight = controls.createDiv(parent, "arrow-right");
        controls.createImageButton(arrowDivRight, "Pfeil Rechts",
            () => {
                if (playground && block && state === StateEnums.SOFTDROP) {
                    state = StateEnums.MOVEDOWN;
                }
                if (playground && block && state === StateEnums.MOVEDOWN) {
                    block.moveRight(playground);
                    window.requestAnimationFrame(draw);
                }
            },
            "/images/tetris/arrow-right-3.png", 32, "arrow-img");
        let arrowDivUp = controls.createDiv(parent, "arrow-up");
        controls.createImageButton(arrowDivUp, "Pfeil Oben",
            () => {
                if (playground && block && state === StateEnums.SOFTDROP) {
                    state = StateEnums.MOVEDOWN;
                }
                if (playground && block && state === StateEnums.MOVEDOWN) {
                    block.rotateRight(playground);
                    window.requestAnimationFrame(draw);
                }
            },
            "/images/tetris/arrow-up-3.png", 32, "arrow-img");
        let arrowDivDown = controls.createDiv(parent, "arrow-down");
        controls.createImageButton(arrowDivDown, "Pfeil Unten",
            () => {
                if (playground && block && state === StateEnums.MOVEDOWN) {
                    state = StateEnums.SOFTDROP;
                    window.requestAnimationFrame(draw);
                }
            },
            "/images/tetris/arrow-down-3.png", 32, "arrow-img");

        canvas = controls.create(parent, "canvas", "playground");
        canvas.width = pixelPerField * (playground.width + 2);
        canvas.height = pixelPerField * (playground.height + 2);

        canvasNextBlock = controls.create(info, "canvas", "nextblock");
        canvasNextBlock.width = pixelPerField * 6;
        canvasNextBlock.height = pixelPerField * 6;
        
        document.addEventListener("keydown", e => {
            if (playground && block) {
                if (state === StateEnums.SOFTDROP &&
                    (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp")) {
                    state = StateEnums.MOVEDOWN;
                }
                if (state === StateEnums.MOVEDOWN) {
                    if (e.key === "ArrowLeft") {
                        block.moveLeft(playground);
                    }
                    else if (e.key === "ArrowRight") {
                        block.moveRight(playground);
                    }
                    else if (e.key === "ArrowDown") {
                        state = StateEnums.SOFTDROP;
                    }
                    else if (e.key === "ArrowUp" || e.key === " ")
                        block.rotateRight(playground);
                }
                if (e.key == "l") {
                    increaseLevel();
                }
                window.requestAnimationFrame(draw);                    
            }
        });
        
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

        state = StateEnums.NEWBLOCK;
        score = 0;
        level = 1;
        lines = 0;
        controls.removeAllChildren(document.body);

        let all = controls.createDiv(document.body);
        renderTetris(all);
        renderCopyright(all);

        requestAnimationFrame(draw);

        setBackgroundPicture();
    };

    // timer callback

    const ontimer = () => {
        let currentDate = new Date();
        if (!speedDateTime) {
            speedDateTime = currentDate;
        }
        let ms = currentDate.getTime() - speedDateTime.getTime();
        let delayms
        if (state === StateEnums.NEWBLOCK) {
            delayms = 1000 - (1000 / 10) * (Math.min(10, level) - 1);
        }
        else {
            delayms = 500 - (500 / 10) * (Math.min(10, level) - 1) + 30;
        }
        if (ms < delayms) {
            return;
        }
        speedDateTime = currentDate;
        switch (state) {
            case StateEnums.GAMEOVER:
                break;
            case StateEnums.NEWBLOCK:
                placeNewBlock();
                break;
            case StateEnums.MOVEDOWN:
            case StateEnums.SOFTDROP:
                if (!block.moveDown(playground)) {
                    // @TODO: delay until block is fit to allow a move left or right
                    block.stop(playground);
                    block = undefined;
                    let scores = [40, 100, 300, 1200];
                    let fullRows = playground.clearFullRows();
                    if (fullRows > 0) {
                        score += scores[fullRows - 1] * level;
                        lines += fullRows;
                        if (lines >= level * 10) {
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
                }
                window.requestAnimationFrame(draw);
                break;
            case StateEnums.DROPONEROW:
                if (!playground.dropOneRow()) {
                    placeNewBlock();
                }
                window.requestAnimationFrame(draw);
                break;
            default:
                break;
        }
    };

    // --- public API

    return {
        draw: draw,
        render: render,
        initBackgroundPictures: initBackgroundPictures,
        ontimer: ontimer
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
                    tetris.render();
                    window.setInterval(tetris.ontimer, 10); // invoke every 10ms
                });
            }
        });
};
