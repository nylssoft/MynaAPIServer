
const LineEnums = Object.freeze({
    "RACKETLEFT": 0,
    "RACKETRIGHT": 1,
    "RACKETTOP": 2,
    "BORDERLEFT": 3,
    "BORDERRIGHT": 4,
    "BORDERTOP": 5,
    "BORDERBUTTOM": 6,
    "BLOCKLEFT": 7,
    "BLOCKRIGHT": 8,
    "BLOCKTOP": 9,
    "BLOCKBUTTOM": 10
});

const BrickEnums = Object.freeze({
    "WHITE": 0,
    "ORANGE": 1,
    "CYAN": 2,
    "GREEN": 3,
    "RED": 4,
    "BLUE": 5,
    "PURBLE": 6,
    "YELLOW": 7,
    "SILVER": 8,
    "GOLD": 9
});

const PowerUpEnums = Object.freeze({
    "LASER": 0,
    "ENLARGE": 1,
    "CATCH": 2,
    "SLOW": 3,
    "DISRUPTION": 4,
    "BREAK": 5,
    "PLAYER": 6
});

var arkanoid = (() => {

    "use strict";

    // -- UI elements

    let canvas;

    // --- state

    let stage;
    let score;
    let ballSpeedIncrease;
    let powerUpMaxRandom;
    let startSpeed;

    let balls;
    let laserShots;
    let borderLines;
    let brickLines;
    let bricks;

    let gameOver;
    let gameWon;
    let gameStarted;

    let keyPreferLeft;
    let keyLeftPressed;
    let keyRightPressed;
    let keySpeed1Pressed;
    let keySpeed2Pressed;

    let lastTouchX;
    let lastTouchId;

    let powerUp;
    let nextPowerUps;

    // dimensions

    let innerWidth;
    let innerHeight;

    let racket;
    let racketWidth;

    let brickWidth;
    let brickHeight;

    let borderWidth;
    let borderHeight;

    let blueW = 3;
    let redW = 15;
    let racketNormalWidth;
    let racketEnlargeWidth;
    let racketHeight;
    let racketYGap;

    let ballRadius;

    let laserShotDiff;
    let laserShotWidth;
    let laserShotHeight;

    let touchActionRect;
    let touchMoveRect;

    let backgroundPictures;
    let currentBackgroundPicture;

    // --- constants

    const powerUps = [PowerUpEnums.LASER, PowerUpEnums.CATCH, PowerUpEnums.DISRUPTION, PowerUpEnums.ENLARGE, PowerUpEnums.SLOW];

    const bricksPerRow = 13;
    const bricksMaxRows = 28;

    // --- background

    const setBackgroundPicture = () => {
        if (backgroundPictures && currentBackgroundPicture < backgroundPictures.length) {
            const pic = backgroundPictures[currentBackgroundPicture];
            const wrapBody = document.getElementById("wrap-body-id");
            wrapBody.style.setProperty("--bgimg", `url('${pic.url}')`);
            currentBackgroundPicture = (currentBackgroundPicture + 1) % backgroundPictures.length;
        }
    };

    const initBackgroundPictures = (pictures) => {
        currentBackgroundPicture = 0;
        backgroundPictures = pictures;
        utils.shuffle_array(backgroundPictures);
    };

    // --- utilities

    const getRandom = (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    const isTouchDevice = () => {
        return (('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0));
    };

    const isInRect = (p, rect) => p.x >= rect.x && p.y >= rect.y && p.x < rect.x + rect.w && p.y < rect.y + rect.h;

    const getBallAngle = (ball) => {
        const c = Math.sqrt(ball.dirX * ball.dirX + ball.dirY * ball.dirY);
        const asin = Math.asin(ball.dirY / c);
        return Math.round(asin * 360 / Math.PI);
    };

    // --- create structures

    const createPoint = (x, y) => {
        return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) };
    };

    const createLine = (x1, y1, x2, y2, lineType, state) => {
        return [createPoint(x1, y1), createPoint(x2, y2), lineType, state];
    };

    const createBrickLines = (row, column, brick) => {
        const w = brickWidth;
        const h = brickHeight;
        const gap = 0;
        const x = column * w + borderWidth;
        const y = row * h + borderWidth;
        const lines = [];
        lines.push(createLine(x, y + h - gap, x + w - gap, y + h - gap, LineEnums.BLOCKBUTTOM, brick));
        lines.push(createLine(x, y, x + w - gap, y, LineEnums.BLOCKTOP, brick));
        lines.push(createLine(x, y, x, y + h - gap, LineEnums.BLOCKLEFT, brick));
        lines.push(createLine(x + w - gap, y, x + w - gap, y + h - gap, LineEnums.BLOCKRIGHT, brick));
        return lines;
    };

    const initBorderLines = () => {
        borderLines = [];
        borderLines.push(createLine(borderWidth, borderHeight, borderWidth + innerWidth, borderHeight, LineEnums.BORDERTOP));
        borderLines.push(createLine(borderWidth + innerWidth, borderHeight, borderWidth + innerWidth, innerHeight, LineEnums.BORDERRIGHT));
        borderLines.push(createLine(borderWidth + innerWidth, innerHeight, borderWidth, innerHeight, LineEnums.BORDERBUTTOM));
        borderLines.push(createLine(borderWidth, innerHeight, borderWidth, borderHeight, LineEnums.BORDERLEFT));
    };

    const addBorderLines = (lines) => {
        borderLines.forEach(line => lines.push(line));
    };

    const addBrickLines = (lines) => {
        const filtered = brickLines.filter(line => line[3].hit > 0);
        filtered.forEach(line => lines.push(line));
        if (!filtered.some(line => line[3].type != BrickEnums.GOLD)) {
            gameWon = true;
            updateGameEnded();
        }
    };

    const addRacketLines = (lines) => {
        lines.push(createLine(racket.x, racket.y, racket.x + racketWidth, racket.y, LineEnums.RACKETTOP));
        lines.push(createLine(racket.x, racket.y, racket.x, racket.y + racketHeight, LineEnums.RACKETLEFT));
        lines.push(createLine(racket.x + racketWidth, racket.y, racket.x + racketWidth, racket.y + racketHeight, LineEnums.RACKETRIGHT));
    };

    const filterLines = (lines, p1, p2) => {
        const minx = Math.min(p1.x, p2.x);
        const maxx = Math.max(p1.x, p2.x);
        const miny = Math.min(p1.y, p2.y);
        const maxy = Math.max(p1.y, p2.y);
        return lines.filter(line => {
            const lminx = Math.min(line[0].x, line[1].x);
            const lmaxx = Math.max(line[0].x, line[1].x);
            const lminy = Math.min(line[0].y, line[1].y);
            const lmaxy = Math.max(line[0].y, line[1].y);
            return !(lmaxx < minx || lmaxy < miny || lminx > maxx || lminy > maxy);
        });
    };

    const createBall = (v, angle) => {
        const x = racket.x + racketWidth / 2 - ballRadius / 2;
        const y = racket.y - ballRadius;
        const ball = {
            x: x,
            y: y,
            dirX: 1,
            dirY: -1,
            v: v
        };
        if (!angle) {
            angle = getRandom(30, 170);
        }
        const rad = (Math.PI / 360) * angle;
        const c = Math.sqrt(ball.dirX * ball.dirX + ball.dirY * ball.dirY);
        const dx = Math.cos(rad) * c;
        const dy = Math.sin(rad) * c;
        ball.dirX = Math.abs(dx) * Math.sign(ball.dirX);
        ball.dirY = Math.abs(dy) * Math.sign(ball.dirY);
        if (angle % 2 === 0) {
            ball.dirX *= -1;
        }
        return ball;
    };

    const createPowerUp = (x, y, w, h, type) => {
        return {
            x: x,
            y: y,
            w: w,
            h: h,
            type: type
        };
    };

    const createRacket = () => {
        return {
            x: innerWidth / 2 - racketWidth / 2,
            y: innerHeight - racketHeight - racketYGap,
            powerUp: undefined
        };
    };

    const createLaserShot = () => {
        const diff = Math.floor(racketWidth / 2) + laserShotDiff;
        const shot = {
            x1: racket.x + diff,
            x2: racket.x + racketWidth - diff,
            y: racket.y + 1,
            w: laserShotWidth,
            h: laserShotHeight,
        };
        return shot;
    };

    // --- math

    const geradenGleichung = (p1, p2) => {
        // Geradengleichung in Normalform y = m * x + n
        const x1 = p1.x;
        const y1 = p1.y;
        const x2 = p2.x;
        const y2 = p2.y;
        if (x2 == x1) return undefined; // kann nicht als Funktion dargestellt werden
        // Steigung
        const m = (y2 - y1) / (x2 - x1);
        // Y-Achsenabschnitt
        const n = (y1 * x2 - y2 * x1) / (x2 - x1);
        return { m: m, n: n };
    };

    const schnittpunkt = (g1, g2) => {
        // Schnittpunkt zweier Geraden in Normalform
        const m1 = g1.m;
        const n1 = g1.n;
        const m2 = g2.m;
        const n2 = g2.n;
        // y = n1 + x * m1;
        // y = n2 + x * m2;
        // => n1 + x * m1 = n2 + x * m2
        // => x * (m1 - m2) = n2 - n1
        // => x = (n2 - n1) / (m1 - m2);
        if (m1 == m2) return undefined; // parallel
        return (n2 - n1) / (m1 - m2);
    };

    const streckeSchneidetStrecke = (p1, p2, q1, q2) => {
        // Schnittpunkt
        let xs;
        let ys;
        // Strecke P1P2 kann als Gerade in Normalform dargestelt werden
        if (p1.x != p2.x) {
            const gp = geradenGleichung(p1, p2);
            // Strecke Q1Q2 kann als Gerade in Normalform dargestellt werden
            if (q1.x != q2.x) {
                const gq = geradenGleichung(q1, q2);
                // Berechne Schnittpunkt beider Geraden. Wenn die Steigung gleich ist, sind sie parallel und
                // es gibt keinen Schnittpunkt 
                xs = schnittpunkt(gp, gq);
                if (xs) {
                    ys = gp.n + gp.m * xs;
                }
            }
            // q1.x == q2.x
            // Q1Q2 bildet eine Gerade auf der X - Achse
            else {
                xs = q1.x;
                ys = gp.n + gp.m * xs;
            }
        }
        // Strecke Q1Q2 kann als Gerade in Normalform dargestellt werden
        else if (q1.x != q2.x) {
            const gq = geradenGleichung(q1, q2);
            xs = p1.x;
            ys = gq.n + gq.m * xs;
        }
        // beiden Strecke sind Geraden auf der X - Achse
        else if (p1.x == q1.x) {
            /* ignoriert, hat unendlich viele oder keinen Schnittpunkt */
            return undefined;
        }
        if (xs && ys) {
            xs = Math.round(xs);
            ys = Math.round(ys);
            // liegt der X-Schnittpunkt auf der Strecke P1P2 bzw. P2P1?
            if (p1.x <= p2.x && (xs < p1.x || xs > p2.x) ||
                p1.x > p2.x && (xs < p2.x || xs > p1.x)) {
                xs = undefined; // X ausserhalb P1P2 bzw. P2P1
            }
            // liegt der Y-Schnittpunkt auf der Strecke P1P2 bzw. P2P1?
            if (xs && ys) {
                if (p1.y <= p2.y && (ys < p1.y || ys > p2.y) ||
                    p1.y > p2.y && (ys < p2.y || ys > p1.y)) {
                    ys = undefined; // Y ausserhalb P1P2 bzw. P2P1
                }
            }
            if (xs && ys) {
                // liegt der X-Schnittpunkt auf der Strecke Q1Q2 bzw. Q2Q1?
                if (q1.x <= q2.x && (xs < q1.x || xs > q2.x) ||
                    q1.x > q2.x && (xs < q2.x || xs > q1.x)) {
                    xs = undefined; // X ausserhalb Q1Q2 bzw. Q2Q1
                }
            }
            if (xs && ys) {
                // liegt der Y-Schnittpunkt auf der Strecke Q1Q2 bzw. Q2Q1?
                if (q1.y <= q2.y && (ys < q1.y || ys > q2.y) ||
                    q1.y > q2.y && (ys < q2.y || ys > q1.y)) {
                    ys = undefined; // Y ausserhalb Q1Q2 bzw. Q2Q1
                }
            }
            if (xs && ys) {
                return { x: xs, y: ys };
            }
        }
        return undefined;
    };

    // --- ball handling, border, brick and racket reflection, powerup collection

    const handleBalls = (lines) => {
        if (racket.powerUp && racket.powerUp.type === PowerUpEnums.CATCH && racket.powerUp.catched) return;
        const removeBalls = [];
        let idx = 0;
        balls.forEach(ball => {
            ball.hasHits = false;
            const hit = handleBallHits(lines, ball);
            if (hit.removeBall) {
                removeBalls.push(ball);
            }
            else if (hit.hasHits) {
                ball.hasHits = true;
                if (idx === 0) {
                    increaseBallSpeed();
                }
            }
            idx++;
        });
        if (removeBalls.length > 0) {
            balls = balls.filter(ball => !removeBalls.includes(ball));
        }
    };

    const handleBallHits = (lines, ball) => {
        let hasHits = false;
        let removeBall = false;
        const p1 = createPoint(ball.x, ball.y);
        const p2 = createPoint(ball.x + ball.dirX * ball.v, ball.y + ball.dirY * ball.v);
        const filtered = filterLines(lines, p1, p2);
        for (let idx = 0; idx < filtered.length; idx++) {
            const line = filtered[idx];
            const pi = streckeSchneidetStrecke(p1, p2, line[0], line[1]);
            if (pi) {
                hasHits = handleBallRacketHit(line, pi, ball);
                if (!hasHits) {
                    const borderHit = handleBallBorderHit(line, ball);
                    hasHits = borderHit.hasHits;
                    removeBall = borderHit.removeBall;
                }
                if (!hasHits) {
                    hasHits = handleBallBricketHit(line, ball);
                }
                break; // only one hit per evaluation
            }
        }
        return { hasHits: hasHits, removeBall: removeBall };
    };

    const handleBallRacketHit = (line, pi, ball) => {
        if (ball.dirY < 0) return false;
        const figureType = line[2];
        if (figureType != LineEnums.RACKETLEFT && figureType != LineEnums.RACKETRIGHT && figureType != LineEnums.RACKETTOP) return false;
        if (racket.powerUp && racket.powerUp.type === PowerUpEnums.CATCH) {
            racket.powerUp.catched = true;
            racket.powerUp.ballRelX = Math.floor(ball.x) - racket.x;
            racket.powerUp.hold = 100;
            ball.y = racket.y;
        }
        ball.dirY = -1 * Math.abs(ball.dirY); // always up
        const w2 = Math.floor(racketWidth / 2);
        const midpoint = racket.x + w2;
        // difference to midpoint, smaller means greater angle
        const delta = (pi.x > midpoint) ? pi.x - midpoint : midpoint - pi.x;
        // reflection angle depends on hit position and returns between 30 and 170 degree
        const angle = ((w2 - delta) / w2) * 140 + 30;
        const rad = (Math.PI / 360) * angle;
        const c = Math.sqrt(ball.dirX * ball.dirX + ball.dirY * ball.dirY);
        const dx = Math.cos(rad) * c;
        const dy = Math.sin(rad) * c;
        ball.dirX = Math.abs(dx) * Math.sign(ball.dirX);
        ball.dirY = Math.abs(dy) * Math.sign(ball.dirY);
        if (figureType === LineEnums.RACKETLEFT) {
            ball.dirX = -1 * Math.abs(ball.dirX); // left
            ball.x -= 1;
        }
        else if (figureType === LineEnums.RACKETRIGHT) {
            ball.dirX = Math.abs(ball.dirX); // right
            ball.x += 1;
        }
        else {
            if (pi.x >= midpoint && ball.dirX < 0 || pi.x < midpoint && ball.dirX > 0) {
                ball.dirX *= -1;
            }
            ball.y -= 1;
        }
        return true;
    };

    const handleBallBorderHit = (line, ball) => {
        let hasHits = false;
        let removeBall = false;
        const figureType = line[2];
        if (figureType === LineEnums.BORDERLEFT ||
            figureType === LineEnums.BORDERRIGHT ||
            figureType === LineEnums.BORDERTOP) {
            hasHits = true;
            if (line[0].y == line[1].y) {
                ball.dirY *= -1;
            }
            else {
                ball.dirX *= -1;
            }
        }
        else if (figureType === LineEnums.BORDERBUTTOM) {
            hasHits = true;
            if (balls.length === 1) {
                gameOver = true;
                updateGameEnded();
            }
            else {
                removeBall = true;
            }
        }
        return { hasHits: hasHits, removeBall: removeBall };
    };

    const handleBallBricketHit = (line, ball) => {
        const figureType = line[2];
        if (figureType != LineEnums.BLOCKBUTTOM && figureType != LineEnums.BLOCKTOP && figureType != LineEnums.BLOCKLEFT && figureType != LineEnums.BLOCKRIGHT) return false;
        let hit = false;
        if (figureType === LineEnums.BLOCKLEFT) {
            hit = true;
            ball.dirX = -1 * Math.abs(ball.dirX); // left
            ball.x -= 1;
        }
        else if (figureType === LineEnums.BLOCKRIGHT) {
            hit = true;
            ball.dirX = Math.abs(ball.dirX); // right
            ball.x += 1;
        }
        else if (figureType === LineEnums.BLOCKBUTTOM) {
            hit = true;
            ball.dirY = Math.abs(ball.dirY); // down
            ball.y -= 1;
        }
        else if (figureType === LineEnums.BLOCKTOP) {
            hit = true;
            ball.dirY = -1 * Math.abs(ball.dirY); // up
            ball.y += 1;
        }
        if (hit) {
            hitBrickLine(line);
            return true;
        }
        return false;
    };

    const hitBrickLine = (line) => {
        const brick = line[3];
        if (brick.type === BrickEnums.GOLD) return;
        brick.hit -= 1;
        if (brick.hit <= 0) {
            score += getBrickScore(brick.type);
            updateScore();
            const random = getRandom(1, powerUpMaxRandom);
            if (random ===1 && !powerUp && balls.length === 1 && (!racket.powerUp || racket.powerUp.type != PowerUpEnums.DISRUPTION)) {
                if (!nextPowerUps || nextPowerUps.length === 0) {
                    nextPowerUps = [];
                    powerUps.forEach(p => nextPowerUps.push(p));
                    utils.shuffle_array(nextPowerUps);
                }
                const powerUpType = nextPowerUps.splice(0, 1)[0];
                powerUp = createPowerUp(line[0].x + 2, line[0].y - brickHeight + 2, brickWidth - 4, brickHeight - 2, powerUpType);
            }
        }
    };

    // --- move of racket, laser shots, balls and powerups

    const moveRacketRelative = (movementX) => {
        if (movementX == 0) return;
        const x = racket.x + movementX;
        for (let idx = 0; idx < balls.length; idx++) {
            const ball = balls[idx];
            // move ball outside racket if neccessary
            if (ball.y > racket.y && ball.y < racket.y + racketHeight &&
                ball.x > x && ball.x < x + racketWidth) {
                ball.y = racket.y;
                ball.dirY = -1 * Math.abs(ball.dirY); // up
                break;
            }
        }
        racket.x = x;
        racket.x = Math.max(borderWidth, racket.x);
        racket.x = Math.min(borderWidth + innerWidth - racketWidth, racket.x);
    };

    const moveRacketWithKeyboard = () => {
        let speed;
        if (keySpeed2Pressed) {
            speed = 10;
        }
        else if (keySpeed1Pressed) {
            speed = 5;
        }
        else {
            speed = 2;
        }
        let moveLeft = false;
        let moveRight = false;
        if (keyLeftPressed && keyRightPressed && keyPreferLeft) {
            moveLeft = true;
        }
        else if (keyRightPressed) {
            moveRight = true;
        }
        else if (keyLeftPressed) {
            moveLeft = true;
        }
        if (moveLeft || moveRight) {
            if (moveLeft) {
                racket.x = Math.max(borderWidth, racket.x - speed);
            }
            else if (moveRight) {
                racket.x = Math.min(borderWidth + innerWidth - racketWidth, racket.x + speed);
            }
        }
    };

    const moveLaserShots = () => {
        const activeShots = [];
        laserShots.forEach(laserShot => {
            if (moveLaserShot(laserShot)) {
                activeShots.push(laserShot);
            }
        });
        laserShots = activeShots;
    };

    const moveLaserShot = (laserShot) => {
        const nextY = laserShot.y - 5;
        if (nextY - laserShot.h < borderHeight) {
            return false;
        }
        for (let idx = 0; idx < brickLines.length; idx++) {
            const line = brickLines[idx];
            const figureType = line[2];
            const brick = line[3];
            if (figureType === LineEnums.BLOCKBUTTOM && brick.hit > 0) {
                if (nextY - laserShot.h >= line[0].y - brickHeight && nextY - laserShot.h <= line[0].y &&
                    (laserShot.x1 + laserShot.w >= line[0].x && laserShot.x1 + laserShot.w <= line[1].x ||
                    laserShot.x2 + laserShot.w >= line[0].x && laserShot.x2 + laserShot.w <= line[1].x)) {
                    hitBrickLine(line);
                    return false;
                }
            }
        }
        laserShot.y = nextY;
        return true;
    };

    const moveBalls = () => {
        if (racket.powerUp && racket.powerUp.type === PowerUpEnums.CATCH && racket.powerUp.catched) {
            balls.forEach(ball => {
                ball.x = racket.x + racket.powerUp.ballRelX;
            });
            racket.powerUp.hold -= 1;
            if (racket.powerUp.hold <= 0) {
                racket.powerUp.catched = false;
            }
        }
        else {
            balls.forEach(ball => {
                if (!ball.hasHits) {
                    ball.x = ball.x + ball.dirX * ball.v;
                    ball.y = ball.y + ball.dirY * ball.v;
                }
            });
        }
    };

    const movePowerUp = () => {
        if (!powerUp) return;
        powerUp.y += 1;
        if (powerUp.y + powerUp.h >= racket.y && powerUp.y <= racket.y + racketHeight &&
            powerUp.x + powerUp.w >= racket.x && powerUp.x <= racket.x + racketWidth) {
            // disable power up
            if (racket.powerUp && powerUp.type != racket.powerUp.type) {
                if (racket.powerUp.type === PowerUpEnums.DISRUPTION) {
                    balls = [balls[0]];
                }
                else if (racket.powerUp.type === PowerUpEnums.ENLARGE) {
                    racketWidth = racketNormalWidth;
                    racket.x += Math.floor((racketEnlargeWidth - racketNormalWidth) / 2);
                    if (racket.x + racketWidth > innerWidth) {
                        racket.x = innerWidth - racketWidth;
                    }
                }
                else if (racket.powerUp.type === PowerUpEnums.LASER) {
                    laserShots = [];
                }
                racket.powerUp = undefined;
            }
            if (!racket.powerUp) {
                // enable power up
                if (powerUp.type === PowerUpEnums.SLOW) {
                    balls.forEach(ball => ball.v = Math.max(startSpeed, ball.v - 1));
                }
                else if (powerUp.type === PowerUpEnums.CATCH) {
                    racket.powerUp = { type: powerUp.type, hold: 0, catched: false, ballRelX: 0 };
                }
                else if (powerUp.type === PowerUpEnums.DISRUPTION) {
                    const ball1 = balls[0];
                    const angle1 = getBallAngle(ball1);
                    const ball2 = createBall(ball1.v, Math.sign(angle1) * (((Math.abs(angle1) + 30) % 140) + 30));
                    const ball3 = createBall(ball1.v, Math.sign(angle1) * (((Math.abs(angle1) + 60) % 140) + 30));
                    ball2.x = ball1.x;
                    ball2.y = ball1.y;
                    ball3.x = ball1.x;
                    ball3.y = ball1.y;
                    balls.push(ball2);
                    balls.push(ball3);
                }
                else if (powerUp.type === PowerUpEnums.LASER) {
                    racket.powerUp = { type: powerUp.type };
                }
                else if (powerUp.type === PowerUpEnums.ENLARGE) {
                    racket.powerUp = { type: powerUp.type };
                    racketWidth = racketEnlargeWidth;
                    racket.x -= Math.floor((racketEnlargeWidth - racketNormalWidth) / 2);
                    if (racket.x + racketWidth > innerWidth) {
                        racket.x = innerWidth - racketWidth;
                    }
                    else if (racket.x < borderWidth) {
                        racket.x = borderWidth;
                    }
                }
            }
            powerUp = undefined;
        }
        else if (powerUp.y >= innerHeight) {
            powerUp = undefined;
        }
    };

    // --- stage handling

    const startNewGame = () => {
        stage = 1;
        score = 0;
        powerUp = undefined;
        borderLines = [];
        bricks = [];
        brickLines = [];
        laserShots = [];
        balls = [];
        racketWidth = racketNormalWidth;
        setBackgroundPicture();
        racket = createRacket();
        initBorderLines();
        initStage1();
        balls.push(createBall(startSpeed));
        gameOver = false;
        gameWon = false;
        gameStarted = true;
        updateGameEnded();
        updateScore();
    };

    const initStage1 = () => {
        // stage 1
        startSpeed = 2;
        ballSpeedIncrease = 0.025;
        powerUpMaxRandom = 3; // every 3th brick hit will return a power up in average
        brickLines = [];
        bricks = [];
        let row = 4;
        const brickTypes = [BrickEnums.SILVER, BrickEnums.RED, BrickEnums.YELLOW, BrickEnums.BLUE, BrickEnums.PURBLE, BrickEnums.GREEN];
        brickTypes.forEach(brickType => {
            for (let col = 0; col < bricksPerRow; col++) {
                const brick = { row: row, col: col, type: brickType, hit: getBrickHitsPerType(brickType) };
                bricks.push(brick);
                const lines = createBrickLines(row, col, brick);
                /* jshint -W083 */
                lines.forEach(line => brickLines.push(line));
                /* jshint +W083 */
            }
            row++;
        });
    };

    const increaseBallSpeed = () => {
        balls.forEach(ball => ball.v = Math.min(10, ball.v + ballSpeedIncrease));
    };

    const getBrickHitsPerType = (brickType) => {
        if (brickType === BrickEnums.SILVER) {
            return Math.floor(stage / 8) + 2;
        }
        if (brickType === BrickEnums.GOLD) {
            return Number.MAX_SAFE_INTEGER;
        }
        return 1;
    };

    const getBrickScore = (brickType) => {
        switch (brickType) {
            case BrickEnums.WHITE:
                return 50;
            case BrickEnums.ORANGE:
                return 60;
            case BrickEnums.CYAN:
                return 70;
            case BrickEnums.GREEN:
                return 80;
            case BrickEnums.RED:
                return 90;
            case BrickEnums.BLUE:
                return 100;
            case BrickEnums.PURBLE:
                return 110;
            case BrickEnums.YELLOW:
                return 120;
            case BrickEnums.SILVER:
                return 50 * stage;
            default:
                return 0;
        }
    };

    const getBrickColor = (brickType) => {
        switch (brickType) {
            case BrickEnums.WHITE:
                return "white";
            case BrickEnums.ORANGE:
                return "orange";
            case BrickEnums.CYAN:
                return "cyan";
            case BrickEnums.GREEN:
                return "green";
            case BrickEnums.RED:
                return "red";
            case BrickEnums.BLUE:
                return "blue";
            case BrickEnums.PURBLE:
                return "#a020f0";
            case BrickEnums.YELLOW:
                return "yellow";
            case BrickEnums.SILVER:
                return "silver";
            default:
                return "";
        }
    };

    const getPowerUpLetter = (powerUpType) => {
        switch (powerUpType) {
            case PowerUpEnums.LASER:
                return "L";
            case PowerUpEnums.ENLARGE:
                return "E";
            case PowerUpEnums.CATCH:
                return "C";
            case PowerUpEnums.SLOW:
                return "S";
            case PowerUpEnums.BREAK:
                return "B";
            case PowerUpEnums.DISRUPTION:
                return "D";
            case PowerUpEnums.PLAYER:
                return "P";
            default:
                return "";
        }
    };

    const getPowerUpColor = (powerUpType) => {
        switch (powerUpType) {
            case PowerUpEnums.LASER:
                return "red";
            case PowerUpEnums.ENLARGE:
                return "blue";
            case PowerUpEnums.CATCH:
                return "green";
            case PowerUpEnums.SLOW:
                return "orange";
            case PowerUpEnums.BREAK:
                return "rosa";
            case PowerUpEnums.DISRUPTION:
                return "cyan";
            case PowerUpEnums.PLAYER:
                return "gray";
            default:
                return "";
        }
    };

    const updateScore = () => {
        const infoElem = document.getElementById("info-id");
        infoElem.textContent = `Score ${score}`;
    };

    const updateGameEnded = () => {
        let txt = "";
        if (gameOver) {
            txt = "GAME OVER!";
        }
        else if (gameWon) {
            txt = "GAME WON!";
        }
        const infoGameOverElem = document.getElementById("info-gameover-id");
        infoGameOverElem.textContent = txt;
    };

    // --- drawing

    const drawBorder = (ctx) => {
        ctx.fillStyle = "#555555";
        ctx.fillRect(0, 0, 2 * borderWidth + innerWidth, borderHeight);
        ctx.fillRect(0, borderHeight, borderWidth, innerHeight - borderHeight);
        ctx.fillRect(innerWidth + borderWidth, borderHeight, borderWidth, innerHeight - borderHeight);
    };

    const drawBricks = (ctx) => {
        const w = brickWidth;
        const h = brickHeight;
        const filtered = bricks.filter(brick => brick.hit > 0);
        filtered.forEach(brick => {
            const x = brick.col * w + borderWidth;
            const y = brick.row * h + borderWidth;
            ctx.fillStyle = getBrickColor(brick.type);
            ctx.fillRect(x, y, w - 2, h - 2);
        });
    };

    const drawRacket = (ctx) => {
        let colorBlue = "cyan";
        let colorRed = "red";
        let colorGray = "gray";
        if (racket.powerUp && racket.powerUp.type === PowerUpEnums.LASER) {
            colorBlue = "#990000";
            colorRed = "#880000";
            colorGray = "#770000";
        }
        ctx.fillStyle = colorBlue;
        ctx.fillRect(racket.x, racket.y, blueW, racketHeight);
        ctx.fillStyle = colorRed;
        ctx.fillRect(racket.x + blueW, racket.y, redW, racketHeight);
        ctx.fillStyle = colorGray;
        ctx.fillRect(racket.x + blueW + redW, racket.y, racketWidth - blueW * 2 - redW * 2, racketHeight);
        ctx.fillStyle = colorRed;
        ctx.fillRect(racket.x + racketWidth - redW - blueW, racket.y, redW, racketHeight);
        ctx.fillStyle = colorBlue;
        ctx.fillRect(racket.x + racketWidth - blueW, racket.y, blueW, racketHeight);
    };

    const drawPowerUp = (ctx) => {
        if (!powerUp) return;
        ctx.fillStyle = getPowerUpColor(powerUp.type);
        ctx.fillRect(powerUp.x, powerUp.y, powerUp.w, powerUp.h);
        ctx.fillStyle = "white";
        ctx.font = "bold 13px serif";
        ctx.fillText(getPowerUpLetter(powerUp.type), powerUp.x + powerUp.w / 2 - 4, powerUp.y + powerUp.h / 2 + 3);
    };

    const drawBalls = (ctx) => {
        balls.forEach(ball => drawBall(ctx, ball));
    };

    const drawBall = (ctx, ball) => {
        const x = Math.floor(ball.x);
        const y = Math.floor(ball.y);
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(x, y, ballRadius, 0, 2 * Math.PI);
        ctx.fill();
    };

    const drawLaserShots = (ctx) => {
        laserShots.forEach(laserShot => drawLaserShot(ctx, laserShot));
    };

    const drawLaserShot = (ctx, laserShot) => {
        const x1 = Math.floor(laserShot.x1);
        const x2 = Math.floor(laserShot.x2);
        const y = Math.floor(laserShot.y);
        ctx.fillStyle = "white";
        ctx.fillRect(x1, y - laserShot.h, laserShot.w, laserShot.h);
        ctx.fillRect(x2, y - laserShot.h, laserShot.w, laserShot.h);
    };

    const drawTouchArea = (ctx) => {
        if (touchActionRect) {
            ctx.fillStyle = "red";
            ctx.beginPath();
            ctx.arc(touchActionRect.x + touchActionRect.w / 2, touchActionRect.y + touchActionRect.h / 2, touchActionRect.w / 4, 0, 2 * Math.PI);
            ctx.fill();
        }
    };

    const draw = () => {
        if (gameStarted && !gameOver && !gameWon) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.shadowBlur = 2;
            ctx.shadowColor = "black";
            drawBricks(ctx);
            drawBorder(ctx);
            drawRacket(ctx);
            drawLaserShots(ctx);
            drawBalls(ctx);
            drawPowerUp(ctx);
            drawTouchArea(ctx);
            // handle ball hits
            const lines = [];
            addBorderLines(lines);
            addRacketLines(lines);
            addBrickLines(lines);
            handleBalls(lines);
            // move items
            movePowerUp();
            moveLaserShots();
            moveBalls();
            moveRacketWithKeyboard();
        }
        // schedule redraw after 50ms
        window.requestAnimationFrame(draw);
    };

    // --- callbacks for user interaction

    const getTouchPoint = (touch) => {
        const rect = canvas.getBoundingClientRect();
        return { x: touch.clientX - rect.x, y: touch.clientY - rect.y };
    };

    const isTouchInRect = (e, rect) => {
        const touches = e.changedTouches;
        for (let idx = 0; idx < touches.length; idx++) {
            const touch = touches[idx];
            const p = getTouchPoint(touch);
            if (isInRect(p, rect)) {
                return { p: p, id: touch.identifier };
            }
            return undefined;
        }
    };

    const isMoveRectTouched = (e) => {
        return isTouchInRect(e, touchMoveRect);
    };

    const isActionRectTouched = (e) => {
        return isTouchInRect(e, touchActionRect);
    };

    const onActionButtonPressed = () => {
        if (gameOver || gameWon) {
            startNewGame();
        }
        else if (racket.powerUp && racket.powerUp.type === PowerUpEnums.LASER && laserShots.length < 3) {
            laserShots.push(createLaserShot());
        }
        else if (racket.powerUp && racket.powerUp.type === PowerUpEnums.CATCH && racket.powerUp.catched) {
            racket.powerUp.catched = false;
        }
    };

    // --- mouse, key and touch events

    const onMouseDown = (e) => {
        e.preventDefault();
        onActionButtonPressed();
    };

    const onMouseMove = (e) => {
        e.preventDefault();
        moveRacketRelative(e.movementX);
    };

    const onKeyDown = (e) => {
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            keyLeftPressed = true;
            keyPreferLeft = true;
        }
        if (e.key === "ArrowRight") {
            e.preventDefault();
            keyRightPressed = true;
            keyPreferLeft = false;
        }
        else if (e.key === "x") {
            e.preventDefault();
            keySpeed1Pressed = true;
        }
        else if (e.key === "y") {
            e.preventDefault();
            keySpeed2Pressed = true;
        }
        else if (e.code === "Space") {
            e.preventDefault();
            onActionButtonPressed();
        }
    };

    const onKeyUp = (e) => {
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            keyLeftPressed = false;
        }
        if (e.key === "ArrowRight") {
            e.preventDefault();
            keyRightPressed = false;
        }
        else if (e.key === "x") {
            e.preventDefault();
            keySpeed1Pressed = false;
        }
        else if (e.key === "y") {
            e.preventDefault();
            keySpeed2Pressed = false;
        }
    };

    const onTouchStart = (e) => {
        e.preventDefault();
        let touch = isActionRectTouched(e);
        if (touch) {
            onActionButtonPressed();
            return;
        }
        touch = isMoveRectTouched(e);
        if (touch) {
            lastTouchId = touch.id;
            lastTouchX = touch.p.x;
        }
    };

    const onTouchEnd = (e) => {
        e.preventDefault();
        let touch = isMoveRectTouched(e);
        if (touch && touch.id == lastTouchId && lastTouchX) {
            moveRacketRelative(touch.p.x - lastTouchX);
            lastTouchX = undefined;
            lastTouchId = undefined;
        }
    };

    const onTouchMove = (e) => {
        e.preventDefault();
        let touch = isMoveRectTouched(e);
        if (touch && touch.id == lastTouchId && lastTouchX) {
            moveRacketRelative(touch.p.x - lastTouchX);
            lastTouchX = touch.p.x;
        }
    };

    // --- rendering HTML elements

    const renderArkanoid = (parent) => {
        brickWidth = 45;
        brickHeight = 22;
        borderWidth = 20;
        borderHeight = 20;
        blueW = 3;
        redW = 15;
        racketNormalWidth = 90;
        racketEnlargeWidth = 140;
        racketHeight = 22;
        racketYGap = 38;
        ballRadius = 5;
        laserShotWidth = 5;
        laserShotHeight = 20;
        if (utils.is_mobile()) {
            const mobilew = 20;
            const mobileh = 5;
            brickWidth -= mobilew;
            brickHeight -= mobileh;
            borderWidth = 1;
            borderHeight = 1;
            blueW = 2;
            redW = 13;
            racketNormalWidth = 60;
            racketEnlargeWidth = 88;
            racketHeight -= mobileh;
            racketYGap -= mobileh;
            ballRadius = 4;
            laserShotWidth = 3;
            laserShotDiff -= mobilew;
        }
        laserShotDiff = racketNormalWidth / 10;
        innerWidth = brickWidth * bricksPerRow;
        innerHeight = brickHeight * bricksMaxRows;
        touchActionRect = undefined;
        touchMoveRect = undefined;
        if (isTouchDevice()) {
            touchActionRect = { x: 2 * borderWidth, y: innerHeight - borderHeight, w: 3 * brickWidth - 2 * borderWidth, h: 3 * brickHeight - 1};
            touchMoveRect = { x: touchActionRect.x, y: touchActionRect.y - touchActionRect.h * 5, w: innerWidth - borderWidth, h: touchActionRect.h * 6};
        }
        canvas = controls.create(parent, "canvas", "playground");
        canvas.width = innerWidth + 2 * borderWidth;
        canvas.height = innerHeight + borderHeight + 48;
        controls.createDiv(parent).id = "info-id";
        controls.createDiv(parent).id = "info-gameover-id";
        startNewGame();
        window.requestAnimationFrame(draw);
    };

    const render = () => {
        controls.removeAllChildren(document.body);
        const wrapBody = controls.createDiv(document.body, "wrap-body");
        wrapBody.id = "wrap-body-id";
        utils.create_cookies_banner(wrapBody);
        const all = controls.createDiv(wrapBody);
        renderArkanoid(all);
        document.addEventListener("mousedown", onMouseDown);
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("keyup", onKeyUp);
        if (isTouchDevice()) {
            document.addEventListener("touchstart", onTouchStart, { passive: false });
            document.addEventListener("touchend", onTouchEnd, { passive: false });
            document.addEventListener("touchcancel", onTouchEnd, { passive: false });
            document.addEventListener("touchmove", onTouchMove, { passive: false });
        }
    };

    const init = (sm) => {
        initBackgroundPictures(sm.pictures);
        render();
    };

    // --- public API

    return {
        init: init
    };
})();

// --- window loaded event

window.onload = () => {
    utils.set_locale(() => {
        utils.auth_lltoken(() => {
            const token = utils.get_authentication_token();
            utils.fetch_api_call("api/pwdman/slideshow", { headers: { "token": token } },
                (model) => arkanoid.init(model),
                (errMsg) => console.error(errMsg));
        });
    });
};