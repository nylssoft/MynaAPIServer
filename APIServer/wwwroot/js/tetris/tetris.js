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
        let scores = [0, 40, 100, 300, 1200];
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
        return scores[fullRows];
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
        if (!firstRowsOccupied) {
            let xarr = new Array(playground.width);
            for (let idx = 0; idx < xarr.length; idx++) {
                xarr[idx] = idx;
            }
            utils.shuffle_array(xarr);
            for (let idx = 0; idx < xarr.length; idx++) {
                if (this._place(playground, xarr[idx], 0, 0)) {
                    return true;
                }
            }
        }
        return false;
    }

    rotateRight(playground) {
        return this.move(playground, this.x, this._getNextRightOrientation());
    }

    move(playground, x, o) {
        if (o === undefined) {
            o = this.orientation;
        }
        if (this._place(playground, x, this.y, o)) {
            return true;
        }
        let dir = (playground.width - x) >= playground.width / 2 ? 1 : -1;
        while (x >= 0 && x < playground.width) {
            x += dir;
            if (this._place(playground, x, this.y, o)) {
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
                pts = [[0, 0], [0, 1], [0, -1], [-1, 0]];
                break;
            case 2:
                pts = [[0, 0], [0, -1], [-1, 0], [1, 0]];
                break;
            case 3:
                pts = [[0, 0], [0, -1], [0, 1], [1, 0]];
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
    let canvasNextBlock;
    let scoreDiv;

    // --- state

    let block;
    let nextBlock;
    let playground;
    let score;
    let state;
    let mouseX;
    
    let pixelPerField;
    let colorMap;

    // --- rendering

    const drawNextBlock = () => {
        if (!nextBlock) return;
        let offx = pixelPerField;
        let offy = 0;
        let ctx = canvasNextBlock.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.fillStyle = colorMap[nextBlock.color];
        let points = nextBlock.getRelativePoints(nextBlock.orientation);
        points.forEach(p => {
            let x = offx + (nextBlock.x + p[0]) * pixelPerField;
            let y = offy + (nextBlock.y + p[1]) * pixelPerField;
            ctx.fillRect(x, y, pixelPerField, pixelPerField);
        });
    };

    const draw = () => {
        let ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let offx = pixelPerField;
        let offy = 0;

        ctx.beginPath();
        // border
        ctx.fillStyle = "gray";
        ctx.fillRect(0, 0, pixelPerField, pixelPerField * playground.height);
        ctx.fillRect(pixelPerField * (playground.width + 1), 0, pixelPerField, pixelPerField * playground.height);
        ctx.fillRect(0, pixelPerField * playground.height, pixelPerField * (playground.width + 2), pixelPerField);
        // playground
        if (playground) {
            for (let y = 0; y < playground.height; y++) {
                for (let x = 0; x < playground.width; x++) {
                    let c = playground.getColor(x, y);
                    if (c != ColorEnums.EMPTY) {
                        ctx.fillStyle = colorMap[c];
                        ctx.fillRect(offx + x * pixelPerField, offy + y * pixelPerField, pixelPerField, pixelPerField);
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
            ctx.fillStyle = colorMap[block.color];
            let points = block.getRelativePoints(block.orientation);
            points.forEach(p => {
                let x = offx + (block.x + p[0]) * pixelPerField;
                let y = offy + (block.y + p[1]) * pixelPerField;
                ctx.fillRect(x, y, pixelPerField, pixelPerField);
            });

            if (state == StateEnums.SOFTDROP) {
                if (block.moveDown(playground)) {
                    window.requestAnimationFrame(draw);
                }
            }
        }

        drawNextBlock();
    };

    const moveToMouseX = (force) => {
        let xm = block.x;
        if (mouseX) {
            let offX = pixelPerField;
            xm = Math.floor((mouseX - offX) / pixelPerField);
            if (xm < 0) {
                xm = 0;
            }
            else if (xm >= playground.width) {
                xm = playground.width - 1;
            }
        }
        if (xm != block.x || force) {
            if (block.move(playground, xm)) {
                window.requestAnimationFrame(draw);
            }
        }
    };

    const renderTetris = (parent) => {
        scoreDiv = controls.createDiv(parent, "score");
        scoreDiv.textContent = `Score: ${score}`;
        
        canvas = controls.create(parent, "canvas", "playground");
        canvas.width = pixelPerField * (playground.width + 2);
        canvas.height = pixelPerField * (playground.height + 1);
        canvas.addEventListener("mousedown", e => {
            if (playground && block && state != StateEnums.SOFTDROP) {
                if (block.rotateRight(playground)) {
                    moveToMouseX(true);
                }
            }
        });
        canvas.addEventListener("mousemove", e => {
            if (playground && block && state === StateEnums.MOVEDOWN) {
                mouseX = e.offsetX;
                moveToMouseX();
            }
        });

        parent.onwheel = e => {
            e.preventDefault();
            if (playground && block && state === StateEnums.MOVEDOWN) {
                state = StateEnums.SOFTDROP;
                window.requestAnimationFrame(draw);
            }
        };

        canvasNextBlock = controls.create(parent, "canvas", "nextblock");
        canvasNextBlock.width = pixelPerField * 4;
        canvasNextBlock.height = pixelPerField * 4;
        /*
        document.addEventListener("keydown", e => {
            if (playground && block && state === StateEnums.MOVEDOWN) {
                state = StateEnums.SOFTDROP;
            }
        });
        */
    };

    const createBlock = (idx) => {
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
    const newBlock = () => {
        let idx = Math.floor(Math.random() * 7);
        if (nextBlock) {
            block = nextBlock;
            nextBlock = createBlock(idx);
        }
        else {
            block = createBlock(idx);
            idx = Math.floor(Math.random() * 7);
            nextBlock = createBlock(idx);
        }
        if (block.placeFirstRow(playground)) {
            moveToMouseX(true);
            state = StateEnums.MOVEDOWN;
        }
        else {
            scoreDiv.textContent = `Score: ${score}. GAME OVER!`;
            state = StateEnums.GAMEOVER;
        }
    };

    const ontimer = () => {
        switch (state) {
            case StateEnums.GAMEOVER:
                break;
            case StateEnums.NEWBLOCK:
                newBlock();
                break;
            case StateEnums.MOVEDOWN:
            case StateEnums.SOFTDROP:
                if (!block.moveDown(playground)) {
                    block.stop(playground);
                    block = undefined;
                    score += playground.clearFullRows();
                    scoreDiv.textContent = `Score: ${score}`;
                    if (playground.hasDropRows()) {
                        state = StateEnums.DROPONEROW;
                    }
                    else {
                        state = StateEnums.NEWBLOCK;
                    }
                }
                window.requestAnimationFrame(draw);
                break;
            case StateEnums.DROPONEROW:
                if (!playground.dropOneRow()) {
                    newBlock();
                }
                window.requestAnimationFrame(draw);
                break;
            default:
                break;
        }
    };

    const render = () => {

        pixelPerField = 16;

        playground = new Playground(10, 20);

        colorMap = {};
        colorMap[ColorEnums.BLUE] = "blue";
        colorMap[ColorEnums.RED] = "red";
        colorMap[ColorEnums.GREEN] = "green";
        colorMap[ColorEnums.ORANGE] = "orange";
        colorMap[ColorEnums.CYAN] = "cyan";
        colorMap[ColorEnums.PURBLE] = "#800080";
        colorMap[ColorEnums.YELLOW] = "yellow";

        state = StateEnums.NEWBLOCK;
        score = 0;

        controls.removeAllChildren(document.body);

        let all = controls.createDiv(document.body);
        renderTetris(all);

        window.setInterval(ontimer, 500);

        requestAnimationFrame(draw);

    };

    // --- public API

    return {
        draw: draw,
        render: render
    };
})();

window.onload = () => {
    tetris.render();
};
