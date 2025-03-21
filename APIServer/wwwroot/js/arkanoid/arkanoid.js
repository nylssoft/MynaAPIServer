﻿
const AngleEnums = Object.freeze({
    "STEEP": 135,
    "NORMAL": 90,
    "FLAT": 40
});

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
    "BLOCKBUTTOM": 10,
    "MONSTER": 11
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
    let highScoreDiv;
    let addHighScoreDiv;
    let inputUserName;
    let startGameButton;
    let continueGameButton;
    let helpDiv;

    // --- state

    let embedded;

    let currentLevel;
    let levels;
    let score;
    let lives;
    let continueLevelId;

    let balls;
    let laserShots;
    let borderLines;
    let brickLines;
    let bricks;
    let brickMatrix;
    let monsters;

    let gameOver;
    let gameStarted;
    let isPaused;
    let isSoundEnabled;
    let isLevelSkipped;

    let keyPreferLeft;
    let keyLeftPressed;
    let keyRightPressed;
    let keySpeedYPressed;

    let lastTouchX;
    let lastTouchId;

    let powerUp;
    let nextPowerUps;

    let highScores;

    let nextExtraLive;
    let hasBreakPowerUp;

    let lastHit;

    let lastActionTime;
    let lastActionElapsed;

    // dimensions

    let innerWidth;
    let innerHeight;

    let racket;
    let racketWidth;

    let brickWidth;
    let brickHeight;

    let borderWidth;
    let borderHeight;

    let blueW;
    let redW;
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
    let touchDebugRect;

    let backgroundPictures;
    let currentBackgroundPicture;
    let currentUser;

    let fadeCount;
    let monsterNextCount;
    let switchNewLevel;

    let debugStatistics;

    let audioInfos;
    let audioCtx;
    let audioBuffer;

    // --- constants

    const version = "1.2.6";

    const powerUps = [PowerUpEnums.LASER, PowerUpEnums.CATCH, PowerUpEnums.DISRUPTION, PowerUpEnums.ENLARGE, PowerUpEnums.SLOW];

    const bricksPerRow = 13;
    const bricksMaxRows = 30;

    const maxFadeCount = 100;

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

    const filterLines = (lines, p1, p2) => {
        const minx = Math.min(p1.x, p2.x);
        const maxx = Math.max(p1.x, p2.x);
        const miny = Math.min(p1.y, p2.y);
        const maxy = Math.max(p1.y, p2.y);
        return lines.filter(line => {
            const lminx = Math.min(line[0].x, line[1].x) - brickWidth;
            const lmaxx = Math.max(line[0].x, line[1].x) + brickWidth;
            const lminy = Math.min(line[0].y, line[1].y) - brickHeight;
            const lmaxy = Math.max(line[0].y, line[1].y) + brickHeight;
            return !(lmaxx < minx || lmaxy < miny || lminx > maxx || lminy > maxy);
        });
    };

    const setBallDirection = (ball, angle) => {
        ball.angle = angle;
        const rad = (Math.PI / 360) * ball.angle;
        const c = Math.sqrt(ball.dirX * ball.dirX + ball.dirY * ball.dirY);
        const dx = Math.cos(rad) * c;
        const dy = Math.sin(rad) * c;
        ball.dirX = Math.abs(dx) * Math.sign(ball.dirX);
        ball.dirY = Math.abs(dy) * Math.sign(ball.dirY);
    };

    const createBall = () => {
        const x = racket.x + racketWidth / 2;
        const y = racket.y - ballRadius;
        const ball = {
            x: x,
            y: y,
            dirX: 1,
            dirY: -1,
            v: currentLevel.startSpeed
        };
        setBallDirection(ball, AngleEnums.STEEP);
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

    const createMonster = () => {
        const w = brickWidth - Math.round(brickWidth / 4);
        const h = w;
        const x = getRandom(1, innerWidth - 2 * borderWidth - w / 2);
        const y = borderHeight + w / 2;
        return { x: x, y: y, w: w, h: h, dirX: 0, dirY: 1, moveX: 0, moveY: borderHeight, angle: 0 };
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

    const handleBalls = () => {
        if (racket.powerUp && racket.powerUp.type === PowerUpEnums.CATCH && racket.powerUp.catched) return;
        const removeBalls = [];

        const blockTopLines = brickLines.filter(l => l[2] == LineEnums.BLOCKTOP && l[3].hit > 0);
        const blockButtomLines = brickLines.filter(l => l[2] == LineEnums.BLOCKBUTTOM && l[3].hit > 0);
        const blockButtomLeft = brickLines.filter(l => l[2] == LineEnums.BLOCKLEFT && l[3].hit > 0);
        const blockButtomRight = brickLines.filter(l => l[2] == LineEnums.BLOCKRIGHT && l[3].hit > 0);
        const otherLines = [];
        borderLines.forEach(line => otherLines.push(line));
        otherLines.push(createLine(racket.x, racket.y, racket.x + racketWidth, racket.y, LineEnums.RACKETTOP));
        otherLines.push(createLine(racket.x, racket.y, racket.x, racket.y + racketHeight, LineEnums.RACKETLEFT));
        otherLines.push(createLine(racket.x + racketWidth, racket.y, racket.x + racketWidth, racket.y + racketHeight, LineEnums.RACKETRIGHT));
        monsters.forEach(monster => {
            otherLines.push(createLine(monster.x, monster.y + monster.h, monster.x + monster.w, monster.y + monster.h, LineEnums.MONSTER, monster));
            otherLines.push(createLine(monster.x, monster.y, monster.x + monster.w, monster.y, LineEnums.MONSTER, monster));
            otherLines.push(createLine(monster.x, monster.y, monster.x, monster.y + monster.h, LineEnums.MONSTER, monster));
            otherLines.push(createLine(monster.x + monster.w, monster.y, monster.x + monster.w, monster.y + monster.h, LineEnums.MONSTER, monster));
        });

        balls.forEach(ball => {
            // avoid endless loop if ball leaves the canvas...
            if (ball.y < 0 || ball.y > ballRadius + innerHeight + 2 * borderHeight ||
                ball.x < 0 || ball.x > ballRadius + innerWidth + 2 * borderWidth) {
                removeBalls.push(ball);
            }
            else {
                ball.hasHits = false;
                let hit = handleBallHits(blockTopLines, ball);
                if (!hit.removeBall && !hit.hasHits) {
                    hit = handleBallHits(blockButtomLines, ball);
                }
                if (!hit.removeBall && !hit.hasHits) {
                    hit = handleBallHits(blockButtomRight, ball);
                }
                if (!hit.removeBall && !hit.hasHits) {
                    hit = handleBallHits(blockButtomLeft, ball);
                }
                if (!hit.removeBall && !hit.hasHits) {
                    hit = handleBallHits(otherLines, ball);
                }
                if (hit.removeBall) {
                    removeBalls.push(ball);
                    playAudioRemoveBall();
                }
                else if (hit.hasHits) {
                    ball.hasHits = true;
                }
            }
        });
        if (removeBalls.length > 0) {
            balls = balls.filter(ball => !removeBalls.includes(ball));
        }

        if (balls.length == 0) {
            lives -= 1;            
            if (lives <= 0) {
                gameOver = true;
                if (document.exitPointerLock) {
                    document.exitPointerLock();
                }
                updateGameInfo();
            }
            else {
                fadeCount = 0;
                powerUp = undefined;
                nextPowerUps = [];
                lastHit = undefined;
                disableRacketPowerUp();
                monsterNextCount = undefined;
                monsters = [];
                balls = [createBall()];
                currentLevel.delayStart = 60; // 3 sec
            }
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
                if (!hasHits) {
                    hasHits = handleBallMonsterHit(line, ball);
                }
                if (hasHits) {
                    const lineType = line[2];
                    if (lineType === LineEnums.RACKETLEFT ||
                        lineType === LineEnums.RACKETRIGHT ||
                        lineType === LineEnums.RACKETTOP) {
                        lastHit = Date.now();
                        playAudioBallRacketHit();
                    }
                    else if (lineType === LineEnums.BORDERLEFT ||
                        lineType === LineEnums.BORDERRIGHT ||
                        lineType === LineEnums.BORDERTOP) {
                        playAudioBallBorderHit();
                    }
                    else if (lineType === LineEnums.MONSTER) {
                        lastHit = Date.now();
                        playAudioBallMonsterHit();
                    }
                    else if (lineType === LineEnums.BLOCKBUTTOM ||
                        lineType === LineEnums.BLOCKTOP ||
                        lineType === LineEnums.BLOCKLEFT ||
                        lineType === LineEnums.BLOCKRIGHT) {
                        const brick = line[3];
                        if (brick.type != BrickEnums.GOLD) {
                            lastHit = Date.now();
                        }
                        if (brick.hit > 0) {
                            playAudioBallBorderHit();
                        }
                        else {
                            increaseBallSpeed();
                            if (lineType === LineEnums.BLOCKBUTTOM || lineType === LineEnums.BLOCKTOP) {
                                playAudioBallVerticalBrickHit();
                            }
                            else {
                                playAudioBallHorizontalBrickHit();
                            }
                        }
                    }
                }
                break; // only one hit per evaluation
            }
        }
        return { hasHits: hasHits, removeBall: removeBall };
    };

    const handleBallMonsterHit = (line, ball) => {
        const figureType = line[2];
        if (figureType != LineEnums.MONSTER) return false;
        const monster = line[3];
        ball.dirY = Math.abs(ball.dirY);
        ball.dirX = getRandom(1, 2) === 1 ? Math.abs(ball.dirX) : -1 * Math.abs(ball.dirX);
        const angles = [AngleEnums.FLAT, AngleEnums.NORMAL, AngleEnums.STEEP];
        const r = getRandom(1, angles.length);
        setBallDirection(ball, angles[r - 1]);
        monster.hit = true;
        increaseBallSpeed();
        return true;
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
        // difference to midpoint
        const delta = (pi.x > midpoint) ? pi.x - midpoint : midpoint - pi.x;
        // reflection angle depends on hit position and returns between 30 and 170 degree
        if (delta >= w2 - redW - blueW && delta < w2 - blueW) {
            setBallDirection(ball, AngleEnums.NORMAL);
        }
        else if (delta >= w2 - redW) {
            setBallDirection(ball, AngleEnums.FLAT);
        }
        else {
            setBallDirection(ball, AngleEnums.STEEP);
        }
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
        if (figureType === LineEnums.BORDERLEFT) {
            hasHits = true;
            ball.dirX = Math.abs(ball.dirX); // right
            ball.x += 1;
        }
        else if (figureType === LineEnums.BORDERRIGHT) {
            hasHits = true;
            ball.dirX = -1 * Math.abs(ball.dirX); // left
            ball.x -= 1;
        }
        else if (figureType === LineEnums.BORDERTOP) {
            hasHits = true;
            ball.dirY = Math.abs(ball.dirY); // down
            ball.y += 1;
        }
        else if (figureType === LineEnums.BORDERBUTTOM) {
            hasHits = true;
            removeBall = true;
        }
        return { hasHits: hasHits, removeBall: removeBall };
    };

    const hasBrick = (row, col) => col >= 0 && col < bricksPerRow && row >= 0 && row < bricksMaxRows && brickMatrix[row][col];

    const handleBallBricketHit = (line, ball) => {
        const figureType = line[2];
        if (figureType != LineEnums.BLOCKBUTTOM && figureType != LineEnums.BLOCKTOP && figureType != LineEnums.BLOCKLEFT && figureType != LineEnums.BLOCKRIGHT) return false;
        let hit = false;
        const brick = line[3];
        const row = brick.row;
        const col = brick.col;
        if (figureType === LineEnums.BLOCKLEFT && (ball.dirX < 0 || !hasBrick(row, col - 1))) {
            hit = true;
            ball.dirX = -1 * Math.abs(ball.dirX); // left
            ball.x -= 1;
        }
        else if (figureType === LineEnums.BLOCKRIGHT && (ball.dirX > 0 || !hasBrick(row, col + 1))) {
            hit = true;
            ball.dirX = Math.abs(ball.dirX); // right
            ball.x += 1;
        }
        else if (figureType === LineEnums.BLOCKBUTTOM && (ball.dirY > 0 || !hasBrick(row + 1, col))) {
            hit = true;
            ball.dirY = Math.abs(ball.dirY); // down
            ball.y += 1;
        }
        else if (figureType === LineEnums.BLOCKTOP && (ball.dirY < 0 || !hasBrick(row - 1, col))) {
            hit = true;
            ball.dirY = -1 * Math.abs(ball.dirY); // up
            ball.y -= 1;
        }        
        if (hit) {
            hitBrickLine(line);
            if (lastHit && line[3].type === BrickEnums.GOLD) {
                const millis = Date.now() - lastHit;
                if (millis > 1000 * 10) {
                    // avoid endless loop: change angle after 10 seconds without any non gold brick or border hit
                    const angles = [AngleEnums.FLAT, AngleEnums.NORMAL, AngleEnums.STEEP];
                    const idx = angles.findIndex(a => a == ball.angle);
                    setBallDirection(ball, angles[(idx + 1) % 3]);
                    lastHit = Date.now();
                }
            }
            return true;
        }
        return false;
    };

    const hitBrickLine = (line) => {
        const brick = line[3];
        if (brick.type === BrickEnums.GOLD) return;
        brick.hit -= 1;
        if (brick.hit <= 0) {
            brickMatrix[brick.row][brick.col] = undefined;
            updateScore(getBrickScore(brick.type));
            if (brick.type != BrickEnums.SILVER) {
                const random = getRandom(1, currentLevel.powerUpAverage);
                if (random === 1 && !powerUp && balls.length === 1 && (!racket.powerUp || racket.powerUp.type != PowerUpEnums.DISRUPTION)) {
                    if (!nextPowerUps || nextPowerUps.length === 0) {
                        nextPowerUps = [];
                        powerUps.forEach(p => nextPowerUps.push(p));
                        if (score >= nextExtraLive) {
                            nextPowerUps.push(PowerUpEnums.PLAYER);
                        }
                        if (hasBreakPowerUp) {
                            nextPowerUps.push(PowerUpEnums.BREAK);
                            hasBreakPowerUp = false;
                        }
                        utils.shuffle_array(nextPowerUps);
                    }
                    const powerUpType = nextPowerUps.splice(0, 1)[0];
                    powerUp = createPowerUp(line[0].x + 2, line[0].y - brickHeight + 2, brickWidth - 4, brickHeight - 2, powerUpType);
                    playAudioPowerUpAppear();
                }
            }
        }
    };

    // --- move of racket, laser shots, balls and powerups

    const moveRacketRelative = (movementX) => {
        if (movementX == 0 || switchNewLevel) return;
        let x = racket.x + movementX;
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
        x = Math.max(borderWidth, x);
        if (racket.powerUp && racket.powerUp.type === PowerUpEnums.BREAK) {
            if (x > innerWidth) {
                fadeCount = 0;
                switchNewLevel = true;
                updateScore(10000);
            }
        }
        else {
            x = Math.min(borderWidth + innerWidth - racketWidth, x);
        }
        racket.x = x;
    };

    const moveRacketWithKeyboard = () => {
        let speed = 10;
        if (keySpeedYPressed) {
            speed += 9;
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
                moveRacketRelative(-speed);
            }
            else if (moveRight) {
                moveRacketRelative(speed);
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
        for (let idx = 0; idx < monsters.length; idx++) {
            const monster = monsters[idx];
            if (nextY - laserShot.h >= monster.y && nextY - laserShot.h <= monster.y + monster.h &&
                (laserShot.x1 + laserShot.w >= monster.x && laserShot.x2 - laserShot.w <= monster.x + monster.w)) {
                monster.hit = true;
                playAudioLaserMonsterHit();
                return false;
            }
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
                    if (brick.hit > 0) {
                        playAudioBallBorderHit();
                    }
                    else {
                        increaseBallSpeed();
                        playAudioLaserBrickHit();
                    }
                    return false;
                }
            }
        }
        laserShot.y = nextY;
        return true;
    };

    const moveBalls = () => {
        if (currentLevel.delayStart > 0 || fadeCount < maxFadeCount) {
            if (currentLevel.delayStart > 0) {
                currentLevel.delayStart -= 1;
            }
            if (!switchNewLevel) {
                balls[0].x = racket.x + racketWidth / 2 - ballRadius / 2;
            }
            return;
        }
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

    const disableRacketPowerUp = () => {
        if (!racket.powerUp) return;
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
    };

    const movePowerUp = () => {
        if (!powerUp) return;
        powerUp.y += 1;
        if (powerUp.y + powerUp.h >= racket.y && powerUp.y <= racket.y + racketHeight &&
            powerUp.x + powerUp.w >= racket.x && powerUp.x <= racket.x + racketWidth) {
            // disable power up
            if (racket.powerUp && powerUp.type != racket.powerUp.type) {
                disableRacketPowerUp();
            }
            if (!racket.powerUp) {
                // enable power up
                if (powerUp.type === PowerUpEnums.SLOW) {
                    balls.forEach(ball => ball.v = Math.max(currentLevel.startSpeed, ball.v - 1));
                }
                else if (powerUp.type === PowerUpEnums.PLAYER) {
                    lives += 1;
                    if (nextExtraLive === 20000) {
                        nextExtraLive += 40000;
                    }
                    else {
                        nextExtraLive += 60000;
                    }
                }
                else if (powerUp.type === PowerUpEnums.BREAK) {
                    racket.powerUp = { type: powerUp.type };
                }
                else if (powerUp.type === PowerUpEnums.CATCH) {
                    racket.powerUp = { type: powerUp.type, hold: 0, catched: false, ballRelX: 0 };
                }
                else if (powerUp.type === PowerUpEnums.DISRUPTION) {
                    const ball1 = balls[0];
                    const angles = [AngleEnums.FLAT, AngleEnums.NORMAL, AngleEnums.STEEP];
                    const idx = angles.findIndex(a => a == ball1.angle);
                    const ball2 = Object.assign({}, ball1);
                    setBallDirection(ball2, angles[(idx + 1) % 3]);
                    balls.push(ball2);
                    const ball3 = Object.assign({}, ball1);
                    setBallDirection(ball3, angles[(idx + 2) % 3]);
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
            playAudioPowerUpCollect();
            powerUp = undefined;
        }
        else if (powerUp.y >= innerHeight) {
            powerUp = undefined;
        }
    };

    const moveMonsters = () => {
        const avg = currentLevel.monsterAverage || 20;
        const max = currentLevel.monsterMax || 3;
        if (avg && monsters.length < max) {
            if (!monsterNextCount || monsterNextCount <= 0) {
                if (monsterNextCount <= 0) {
                    monsters.push(createMonster());
                }
                monsterNextCount = getRandom(1, avg) * 50;
            }
            else {
                monsterNextCount -= 1;
            }
        }
        const removeMonsters = [];
        monsters.forEach(monster => {
            if (!moveMonster(monster)) {
                removeMonsters.push(monster);
            }
        });
        if (removeMonsters.length > 0) {
            monsters = monsters.filter(monster => !removeMonsters.includes(monster));
        }
    };

    const moveMonster = (monster) => {
        if (monster.hit ||
            monster.y + monster.h >= racket.y && monster.y <= racket.y + racketHeight &&
            monster.x + monster.w >= racket.x && monster.x <= racket.x + racketWidth) {
            playAudioRacketMonsterHit();
            return false;
        }
        const moveCount = currentLevel.monsterMoveCount || 300;
        const speed = currentLevel.monsterSpeed || 0.5;
        const r = monster.w / 2;
        const maxMove = Math.max(r, speed);
        const x = monster.x + (monster.moveX > 0 ? Math.sign(monster.dirX) * maxMove : 0);
        const y = monster.y + (monster.moveY > 0 ? Math.sign(monster.dirY) * maxMove : 0);
        if (isValidMonsterPosition(x, y)) {
            if (monster.moveX > 0) {
                monster.x += Math.sign(monster.dirX) * speed;
                monster.moveX -= 1;
            }
            if (monster.moveY > 0) {
                monster.y += Math.sign(monster.dirY) * speed;
                monster.moveY -= 1;
            }
        }
        else {
            monster.moveX = 0;
            monster.moveY = 0;
        }
        if (monster.moveX <= 0) {
            monster.dirX = getRandom(1, 2) === 1 ? -1 : 1;
            monster.moveX = getRandom(1, moveCount);
        }
        if (monster.moveY <= 0) {
            monster.dirY = getRandom(1, 4) === 1 ? -1 : 1; // more likely to move down
            monster.moveY = getRandom(1, moveCount);
        }
        return true;
    };

    const isValidMonsterPosition = (x, y) => {
        const col = Math.round((x - borderWidth) / brickWidth);
        const row = Math.round((y - borderWidth + brickHeight) / brickHeight);
        return col >= 0 && col < bricksPerRow && row >= 0 && row <= bricksMaxRows &&
            !bricks.some(brick => brick.hit > 0 && brick.col == col && brick.row == row);
    };

    // --- level handling

    const initAudio = async () => {
        if (audioCtx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        const response = await fetch(`/js/arkanoid/effects.mp3?v=${version}`);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioInfos = [];
        audioInfos.push({ start: 0, stop: 2 }); // start game
        audioInfos.push({ start: 4, stop: 4.5 }); // ball hit racket
        audioInfos.push({ start: 6, stop: 6.5 }); // ball hit brick vertical
        audioInfos.push({ start: 8, stop: 8.5 }); // ball hit brick horizontal
        audioInfos.push({ start: 10, stop: 10.5 }); // ball hit border
        audioInfos.push({ start: 12, stop: 12.8 }); // power up appears
        audioInfos.push({ start: 14, stop: 14.5 }); // power up caught
        audioInfos.push({ start: 16, stop: 16.35 }); // laser fired
        audioInfos.push({ start: 18, stop: 19 }); // ball lost
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
    };

    const startNewGame = async (start, cont) => {
        score = 0;
        lives = 3;
        nextExtraLive = 20000;
        borderLines = [];
        initBorderLines();
        powerUp = undefined;    
        racketWidth = racketNormalWidth;
        racket = createRacket();
        isPaused = false;
        isLevelSkipped = false;
        gameOver = false;
        gameStarted = start;
        updateGameInfo();
        continueLevelId = undefined;
        let levelId = 1;
        if (cont && currentLevel) {
            levelId = currentLevel.id;
            continueLevelId = levelId;
        }
        initLevel(levelId);
        inputUserName.value = "";
        if (start) {
            await initAudio();
            playAudioStartNewGame();
            if (canvas.requestPointerLock) {
                await canvas.requestPointerLock();
            }
        }
    };

    const initLevel = (id) => {
        debugStatistics = { drawCnt: 0, drawSum: 0, actionCnt: 0, actionSum: 0 };
        monsterNextCount = undefined;
        fadeCount = 0;
        switchNewLevel = false;
        lastHit = undefined;
        powerUp = undefined;
        nextPowerUps = [];
        hasBreakPowerUp = getRandom(1, 10) === 1;
        bricks = [];
        brickLines = [];
        laserShots = [];
        balls = [];
        monsters = [];
        racketWidth = racketNormalWidth;
        racket = createRacket();
        currentLevel = prepareLevel(id);
        createLevelBricks(currentLevel);
        balls.push(createBall());
        setBackgroundPicture();
        updateScore();
    };

    const prepareLevel = (id) => {
        let level;
        let fac;
        let lv = levels.find(l => l.id === id);
        if (!lv) {
            fac = Math.floor((id - 1) / levels.length);
            lv = levels[(id - 1) % levels.length];
        }
        level = Object.assign({}, lv);
        level.id = id;
        level.initSpeed = level.initSpeed || 3;
        level.increaseSpeed = level.increaseSpeed || 0.025;
        level.powerUpAverage = level.powerUpAverage || 5;
        level.monsterMax = level.monsterMax || 3;
        level.monsterAverage = level.monsterAverage || 20;
        level.monsterMoveCount = level.monsterMoveCount || 300;
        level.monsterSpeed = level.monsterSpeed || 0.5;
        if (fac) {
            level.initSpeed = Math.min(8, level.initSpeed + fac);
            level.increaseSpeed = Math.min(0.1, level.increaseSpeed * 2 * fac);
            level.monsterMax = Math.min(10, level.monsterMax * 2 * fac);
            level.monsterSpeed = Math.min(5, level.monsterSpeed * 2 * fac);
            level.monsterAverage = Math.max(1, Math.floor(level.monsterAverage / (2 * fac)));            
        }
        if (!utils.is_mobile()) {
            level.initSpeed += 1;
        }
        level.delayStart = 60; // 3 sec
        level.startSpeed = level.initSpeed;
        return level;
    };

    const createLevelBrick = (levelnr, row, col, color) => {
        let hit = 1;
        const brickType = getBrickTypeByColor(color);
        if (brickType === BrickEnums.SILVER) {
            hit = Math.floor(levelnr / 8) + 2;
        }
        else if (brickType === BrickEnums.GOLD) {
            hit = Number.MAX_SAFE_INTEGER;
        }
        const brick = { row: row, col: col, type: brickType, hit: hit };
        bricks.push(brick);
        brickMatrix[row][col] = brick;
        const lines = createBrickLines(row, col, brick);
        /* jshint -W083 */
        lines.forEach(line => brickLines.push(line));
        /* jshint +W083 */
    };

    const createLevelBricks = (level) => {
        bricks = [];
        brickMatrix = Array(bricksMaxRows);
        for (let row = 0; row < bricksMaxRows; row++) {
            const arr = Array(bricksPerRow);
            for (let col = 0; col < bricksPerRow; col++) {
                arr[col] = undefined;
            }
            brickMatrix[row] = arr;
        }
        brickLines = [];
        level.bricks.forEach(arr => {
            const cmd = arr[0];
            const row = arr[1];
            const col = arr[2];
            if (cmd === "lx" || cmd === "ly" || cmd === "ld" || cmd === "ldd" || cmd === "ldd2") {
                const cnt = arr[3];
                const color = arr[4];
                const color2 = arr.length === 6 ? arr[5] : undefined;
                for (let idx = 0; idx < cnt; idx++) {
                    if (cmd === "lx") {
                        createLevelBrick(level.id, row, col + idx, color);
                    }
                    else if (cmd === "ly") {
                        createLevelBrick(level.id, row + idx, col, color);
                    }
                    else if (cmd === "ld") {
                        createLevelBrick(level.id, row - idx, col + idx, color);
                    }
                    else if (cmd === "ldd") {
                        createLevelBrick(level.id, row + idx, col + idx, color);
                    }
                    else if (cmd === "ldd2") {
                        const c = color2 && (idx % 2 === 1) ? color2 : color;
                        createLevelBrick(level.id, row + 2 * idx, col + idx, c);
                    }
                }
            }
            else if (cmd === "p") {
                const color = arr[3];
                createLevelBrick(level.id, row, col, color);
            }
        });
    };

    const increaseBallSpeed = () => {
        balls.forEach(ball => ball.v = Math.min(10, ball.v + currentLevel.increaseSpeed));
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
                if (continueLevelId) {
                    return 50 * (currentLevel.id - continueLevelId + 1);
                }
                return 50 * currentLevel.id;
            default:
                return 0;
        }
    };

    const getBrickColor = (brickType) => {
        switch (brickType) {
            case BrickEnums.WHITE:
                return "#F1F1F1";
            case BrickEnums.ORANGE:
                return "#FF8F00";
            case BrickEnums.CYAN:
                return "#00FFFF";
            case BrickEnums.GREEN:
                return "#00FF00";
            case BrickEnums.RED:
                return "#FF0000";
            case BrickEnums.BLUE:
                return "#0070FF";
            case BrickEnums.PURBLE:
                return "#FF00FF";
            case BrickEnums.YELLOW:
                return "#FFFF00";
            case BrickEnums.SILVER:
                return "#9D9D9D";
            case BrickEnums.GOLD:
                return "#BCAE00";
            default:
                return "";
        }
    };

    const getBrickTypeByColor = (t) => {
        const map = {
            "white": BrickEnums.WHITE,
            "orange": BrickEnums.ORANGE,
            "cyan": BrickEnums.CYAN,
            "green": BrickEnums.GREEN,
            "red": BrickEnums.RED,
            "blue": BrickEnums.BLUE,
            "purble": BrickEnums.PURBLE,
            "yellow": BrickEnums.YELLOW,
            "silver": BrickEnums.SILVER,
            "gold": BrickEnums.GOLD
        };
        return map[t];
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
                return "magenta";
            case PowerUpEnums.DISRUPTION:
                return "cyan";
            case PowerUpEnums.PLAYER:
                return "gray";
            default:
                return "";
        }
    };

    const updateScore = (add) => {
        if (add && !isLevelSkipped) {
            score += add;
        }
        const infoElem = document.getElementById("info-id");
        infoElem.textContent = `${_T("INFO_LEVEL_1", currentLevel.id)} ${_T("INFO_SCORE_1", score)}`;
    };

    const updateGameInfo = () => {
        const visibilty = gameStarted && !gameOver ? "hidden" : "visible";
        const elems = [];
        elems.push(document.getElementById("div-dropdown-id"));
        elems.push(document.getElementById("copyright-id"));
        elems.push(document.getElementById("header-id"));
        elems.push(document.getElementById("cookie-banner-id"));
        elems.push(document.getElementById("help-button-id"));
        elems.forEach(elem => {
            if (elem) {
                elem.style.visibility = visibilty;
            }
        });
        document.getElementById("sound-button-id").style.visibility = gameStarted && !gameOver ? "hidden" : "visible";
        let txt = "";
        if (gameOver) {
            txt = _T("INFO_GAME_OVER");
        }
        const infoGameOverElem = document.getElementById("info-gameover-id");
        infoGameOverElem.textContent = txt;
        if (gameStarted && !gameOver) {
            startGameButton.style.visibility = "hidden";
            continueGameButton.style.visibility = "hidden";
            addHighScoreDiv.style.visibility = "hidden";
            highScoreDiv.style.visibility = "hidden";
        }
        else {
            startGameButton.style.visibility = "visible";
            continueGameButton.style.visibility = gameOver && currentLevel.id > 1 && !isLevelSkipped ? "visible" : "hidden";
            fetch("api/arkanoid/highscore")
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

    const addHighScore = () => {
        const name = inputUserName.value.trim();
        if (name.length > 0) {
            addHighScoreDiv.style.visibility = "hidden";
            fetch("api/arkanoid/highscore", {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ "Name": name, "Score": score, "Level": currentLevel.id })
            })
            .then(() => renderHighScoreEntries())
            .catch((err) => console.error(err));
        }
    };

    // --- drawing

    const drawShadows = (ctx) => {
        const b = brickHeight;
        const alpha = ctx.globalAlpha;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#000000";
        // visible bricks
        const filtered = bricks.filter(brick => brick.hit > 0);
        filtered.forEach(brick => {
            ctx.fillRect(brick.col * brickWidth + borderWidth + b, brick.row * brickHeight + borderWidth + b, brickWidth, brickHeight);
        });
        // borders
        ctx.fillRect(b, b, 2 * borderWidth + innerWidth, borderHeight);
        ctx.fillRect(b, borderHeight + b, borderWidth, innerHeight - borderHeight);
        ctx.fillRect(innerWidth + borderWidth + b, borderHeight + b, borderWidth, innerHeight - borderHeight);
        // balls
        balls.forEach(ball => {
            ctx.beginPath();
            ctx.arc(ball.x + b, ball.y + b, ballRadius, 0, 2 * Math.PI);
            ctx.fill();
        });
        // racket
        ctx.fillRect(racket.x + b, racket.y + b, racketWidth, racketHeight);
        // power up
        if (powerUp) {
            ctx.fillRect(powerUp.x + b, powerUp.y + b, powerUp.w, powerUp.h);
        }
        // laser shots
        laserShots.forEach(laserShot => {
            ctx.fillRect(laserShot.x1 + b, laserShot.y - laserShot.h + b, laserShot.w, laserShot.h);
            ctx.fillRect(laserShot.x2 + b, laserShot.y - laserShot.h + b, laserShot.w, laserShot.h);
        });
        // lives
        if (lives > 0) {
            let w = 30;
            let h = 10;
            let gap = 10;
            if (utils.is_mobile()) {
                w -= 10;
                gap -= 3;
            }
            for (let idx = 0; idx < lives - 1; idx++) {
                ctx.fillRect(borderWidth + gap * idx + idx * w + b, racket.y + racketHeight + gap + b, w, h);
            }
        }
        // monsters
        monsters.forEach(monster => {
            const r = monster.w / 2;
            ctx.translate(monster.x + r + b, monster.y + r + b);
            ctx.rotate((monster.angle * Math.PI) / 180);
            ctx.beginPath();
            ctx.moveTo(-r, -r);
            ctx.lineTo(r, -r);
            ctx.lineTo(0, r);
            ctx.lineTo(0, r);
            ctx.lineTo(-r, -r);
            ctx.fill();
            ctx.resetTransform();
            monster.angle = (monster.angle + 1) % 360;
        });
        // touch area
        if (touchActionRect) {
            ctx.beginPath();
            ctx.arc(touchActionRect.x + touchActionRect.w / 2 + b, touchActionRect.y + touchActionRect.h / 2 + b, touchActionRect.w / 4, 0, 2 * Math.PI);
            ctx.fill();
        }
        // reset alpha
        ctx.globalAlpha = alpha;
    };

    const drawBorder = (ctx) => {
        ctx.fillStyle = "#555555";
        ctx.fillRect(0, 0, 2 * borderWidth + innerWidth, borderHeight);
        ctx.fillRect(0, borderHeight, borderWidth, innerHeight - borderHeight);
        if (racket.powerUp && racket.powerUp.type == PowerUpEnums.BREAK) {
            ctx.fillRect(innerWidth + borderWidth, borderHeight, borderWidth, racket.y - racketHeight - borderHeight);
            ctx.fillRect(innerWidth + borderWidth, racket.y + racketHeight, borderWidth, innerHeight - racket.y - racketHeight);
        }
        else {
            ctx.fillRect(innerWidth + borderWidth, borderHeight, borderWidth, innerHeight - borderHeight);
        }
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
            if (brick.type === BrickEnums.SILVER || brick.type === BrickEnums.GOLD) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = brick.type === BrickEnums.SILVER ? "#d2d2d2" : "#e0d200";
                ctx.beginPath();
                ctx.moveTo(x + 1, y + h - 4);
                ctx.lineTo(x + 1, y + 1);
                ctx.lineTo(x + 1 + w - 4, y + 1);
                ctx.stroke();
                ctx.strokeStyle = brick.type === BrickEnums.SILVER ? "#8f8f8f" : "#9d8f00";
                ctx.beginPath();
                ctx.moveTo(x + 1, y + h - 4);
                ctx.lineTo(x + 1 + w - 4, y + h - 4);
                ctx.lineTo(x + 1 + w - 4, y + 1);
                ctx.stroke();
            }
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

    const drawLives = (ctx) => {
        if (lives > 0) {
            let w = 30;
            let h = 10;
            let gap = 10;
            let bw = 2;
            let rw = 5;
            if (utils.is_mobile()) {
                w -= 10;
                h -= 3;
                gap -= 3;
                bw = 1;
                rw = 3;
            }
            const gw = w - 2 * rw - 2 * bw;
            for (let idx = 0; idx < lives - 1; idx++) {
                drawLive(ctx, idx, gap, w, h, bw, rw, gw);
            }
        }
    };

    const drawLive = (ctx, idx, gap, w, h, bw, rw, gw) => {
        ctx.fillStyle = "cyan";
        ctx.fillRect(borderWidth + gap * idx + idx * w, racket.y + racketHeight + gap, bw, h);
        ctx.fillStyle = "red";
        ctx.fillRect(borderWidth + gap * idx + bw + idx * w, racket.y + racketHeight + gap, rw, h);
        ctx.fillStyle = "gray";
        ctx.fillRect(borderWidth + gap * idx + idx * w + bw + rw, racket.y + racketHeight + gap, gw, h);
        ctx.fillStyle = "red";
        ctx.fillRect(borderWidth + gap * idx + idx * w + bw + rw + gw, racket.y + racketHeight + gap, rw, h);
        ctx.fillStyle = "cyan";
        ctx.fillRect(borderWidth + gap * idx + idx * w + bw + rw + gw + rw, racket.y + racketHeight + gap, bw, h);
    };

    const drawMonsters = (ctx) => {
        monsters.forEach(monster => drawMonster(ctx, monster));
    };

    const drawMonster = (ctx, monster) => {
        const r = monster.w / 2;
        ctx.translate(monster.x + r, monster.y + r);
        const g = ctx.createLinearGradient(-r, -r, r, r);
        g.addColorStop(0, "#ff0000");
        g.addColorStop(1, "#440000");
        ctx.fillStyle = g;
        ctx.rotate((monster.angle * Math.PI) / 180);
        ctx.beginPath();
        ctx.moveTo(-r, -r);
        ctx.lineTo(r, -r);
        ctx.lineTo(0, r);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, -r);
        ctx.fill();
        ctx.resetTransform();
        monster.angle = (monster.angle + 1) % 360;
    };

    const drawDebugStatistics = (ctx) => {
        if (!utils.is_debug()) return;
        ctx.fillStyle = "yellow";
        ctx.font = "13px serif";
        if (touchDebugRect) {
            ctx.fillText("Skip", touchDebugRect.x + 20, touchDebugRect.y + 20);
        }
        const x = utils.is_mobile() ? 70 : 120;
        const y = utils.is_mobile() ? 550 : 670;
        let txt = "";
        if (debugStatistics.drawCnt > 0) {
            const drawAvg = debugStatistics.drawSum / debugStatistics.drawCnt;
            txt = `Draw: ${drawAvg.toFixed(2)} ms`;
        }
        if (debugStatistics.actionCnt > 0) {
            const actionAvg = debugStatistics.actionSum / debugStatistics.actionCnt;
            txt += ` Action: ${actionAvg.toFixed(2)} ms`;
        }
        ctx.fillText(txt, x, y);
    };

    const draw = () => {
        window.requestAnimationFrame(draw);
        const now = performance.now();
        if (lastActionTime == undefined) {
            lastActionTime = now;
            lastActionElapsed = 0;
            return;
        }
        lastActionElapsed += now - lastActionTime;
        lastActionTime = now;
        while (lastActionElapsed > 16.66) {
            drawAndAction();
            lastActionElapsed -= 16.66;
        }
    };

    const drawAndAction = () => {
        let start = performance.now();
        const ctx = canvas.getContext("2d");
        if (fadeCount < maxFadeCount) {
            fadeCount += 1;
            if (switchNewLevel) {
                ctx.globalAlpha = 1 - fadeCount / maxFadeCount;
                if (fadeCount === maxFadeCount) {
                    initLevel(currentLevel.id + 1);
                }
            }
            else {
                ctx.globalAlpha = fadeCount / maxFadeCount;
            }
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawShadows(ctx);
        drawTouchArea(ctx);
        drawLives(ctx);
        drawBorder(ctx);
        drawBricks(ctx);
        drawPowerUp(ctx);
        drawMonsters(ctx);
        drawLaserShots(ctx);
        drawRacket(ctx);
        drawBalls(ctx);
        debugStatistics.drawCnt += 1;
        debugStatistics.drawSum += (performance.now() - start);
        if (!isPaused && gameStarted && !gameOver) {
            start = performance.now();
            if (!switchNewLevel && !bricks.some(brick => brick.hit > 0 && brick.type != BrickEnums.GOLD)) {
                fadeCount = 0;
                switchNewLevel = true;
            }
            handleBalls();
            moveLaserShots();
            moveBalls();
            moveRacketWithKeyboard();
            movePowerUp();
            moveMonsters();
            debugStatistics.actionCnt += 1;
            debugStatistics.actionSum += (performance.now() - start);
        }
        drawDebugStatistics(ctx);
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
        if (racket.powerUp && racket.powerUp.type === PowerUpEnums.LASER && laserShots.length < 3) {
            laserShots.push(createLaserShot());
            playAudioLaserShot();
        }
        else if (racket.powerUp && racket.powerUp.type === PowerUpEnums.CATCH && racket.powerUp.catched) {
            racket.powerUp.catched = false;
        }
    };

    const toggleSoundButton = async () => {
        isSoundEnabled = !isSoundEnabled;
        const imgSound = document.getElementById("sound-button-id");
        imgSound.src = isSoundEnabled ? "/images/buttons/kmix.png" : "/images/buttons/kmixdocked_mute.png";
        imgSound.title = isSoundEnabled ? _T("BUTTON_DISABLE_SOUND") : _T("BUTTON_ENABLE_SOUND");
        if (isSoundEnabled) {
            await initAudio();
            playAudioBallBorderHit();
        }
    };

    // --- mouse, key and touch events

    const onMouseDown = (e) => {
        if (isPaused || gameOver || !gameStarted) return;
        if (e.clientY < 40) return;
        e.preventDefault();
        onActionButtonPressed();
    };

    const onMouseMove = (e) => {
        if (isPaused || gameOver || !gameStarted) return;
        e.preventDefault();
        moveRacketRelative(e.movementX);
    };

    const onKeyDown = (e) => {
        if (isPaused || gameOver || !gameStarted) return;
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
        else if (e.key === "y") {
            e.preventDefault();
            keySpeedYPressed = true;
        }
        else if (e.code === "Space") {
            e.preventDefault();
            onActionButtonPressed();
        }
        else if (e.key === "l" && utils.is_debug()) {
            isLevelSkipped = true;
            score = 0;
            updateScore();
            switchNewLevel = true;
            fadeCount = 0;
        }
    };

    const onKeyUp = (e) => {
        if (e.key === "m") {
            toggleSoundButton();
        }
        if (e.key === "p" && gameStarted && !gameOver) {
            isPaused = !isPaused;
        }
        if (isPaused || gameOver || !gameStarted) return;
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            keyLeftPressed = false;
        }
        if (e.key === "ArrowRight") {
            e.preventDefault();
            keyRightPressed = false;
        }
        else if (e.key === "y") {
            e.preventDefault();
            keySpeedYPressed = false;
        }
    };

    const onTouchStart = (e) => {
        if (isPaused || gameOver || !gameStarted) return;
        const touches = e.changedTouches;
        for (let idx = 0; idx < touches.length; idx++) {
            if (touches[idx].clientY < 40) {
                return;
            }
        }
        e.preventDefault();
        let touch = isActionRectTouched(e);
        if (touch) {
            onActionButtonPressed();
            return;
        }
        if (utils.is_debug() && isTouchInRect(e, touchDebugRect)) {
            isLevelSkipped = true;
            score = 0;
            updateScore();
            switchNewLevel = true;
            fadeCount = 0;
            return;
        }
        touch = isMoveRectTouched(e);
        if (touch) {
            lastTouchId = touch.id;
            lastTouchX = touch.p.x;
        }
    };

    const onTouchEnd = (e) => {
        if (isPaused || gameOver || !gameStarted) return;
        const touches = e.changedTouches;
        for (let idx = 0; idx < touches.length; idx++) {
            if (touches[idx].clientY < 40) {
                return;
            }
        }
        e.preventDefault();
        // does not occurs if touch is moved outside the touch area!
        let touch = isMoveRectTouched(e);
        if (touch && touch.id == lastTouchId && lastTouchX) {
            const diff = touch.p.x - lastTouchX;
            if (Math.abs(diff) <= racketWidth) {
                moveRacketRelative(diff);
            }
            lastTouchX = undefined;
            lastTouchId = undefined;
        }
    };

    const onTouchMove = (e) => {
        if (isPaused || gameOver || !gameStarted) return;
        e.preventDefault();
        const touch = isMoveRectTouched(e);
        if (touch && touch.id == lastTouchId && lastTouchX) {
            const diff = touch.p.x - lastTouchX;
            if (Math.abs(diff) <= racketWidth) {
                moveRacketRelative(diff);
            }
            lastTouchX = touch.p.x;
        }
    };

    // --- audio handling

    const playAudio = (idx) => {
        if (!audioCtx || !audioBuffer || !audioInfos) return;
        if (isSoundEnabled && idx != undefined && idx >= 0 && idx < audioInfos.length) {
            const audioInfo = audioInfos[idx];
            const trackSource = audioCtx.createBufferSource();
            trackSource.buffer = audioBuffer;
            trackSource.connect(audioCtx.destination);
            trackSource.start(0, audioInfo.start, audioInfo.stop - audioInfo.start);
        }
    };

    const playAudioStartNewGame = () => playAudio(0);

    const playAudioRacketMonsterHit = () => playAudioLaserShot();

    const playAudioLaserShot = () => playAudio(7);
    const playAudioLaserMonsterHit = () => playAudioBallBorderHit();
    const playAudioLaserBrickHit = () => playAudioBallVerticalBrickHit();

    const playAudioPowerUpAppear = () => playAudio(5);
    const playAudioPowerUpCollect = () => playAudio(6);

    const playAudioBallRacketHit = () => playAudio(1);
    const playAudioBallBorderHit = () => playAudio(4);
    const playAudioBallVerticalBrickHit = () => playAudio(2);
    const playAudioBallHorizontalBrickHit = () => playAudio(3);
    const playAudioBallMonsterHit = () => playAudio(4);

    const playAudioRemoveBall = () => playAudio(8);

    // --- rendering HTML elements

    const renderHeader = (parent) => {
        const title = currentUser ? `${currentUser.name} - ${_T("HEADER_ARKANOID")}` : _T("HEADER_ARKANOID");
        const headerElem = controls.create(parent, "h1", "header", title);
        headerElem.id = "header-id";
    };

    const renderCopyright = (parent) => {
        const div = controls.createDiv(parent, "copyright");
        div.id = "copyright-id";
        controls.create(div, "span", undefined, `${_T("HEADER_ARKANOID")} ${version}. ${_T("TEXT_COPYRIGHT_YEAR")} `);
        controls.createA(div, undefined, "/view?page=copyright", _T("COPYRIGHT"));
        controls.create(div, "span", undefined, ".");
    };

    const renderHighScoreEntries = () => {
        controls.removeAllChildren(highScoreDiv);
        highScoreDiv.style.visibility = "hidden";
        fetch("api/arkanoid/highscore")
            .then(response => response.json())
            .then(h => {
                highScores = h;
                let pos = 1;
                highScores.forEach(hs => {
                    const e = controls.createDiv(highScoreDiv, "highscore");
                    e.textContent = `${pos}. ${hs.name} - ${hs.score}`;
                    const dstr = utils.format_date_string(hs.created);
                    e.title = _T("INFO_HIGHSCORE_1_2_3", hs.score, hs.level, dstr);
                    pos++;
                });
                if (highScores.length > 0 && (!gameStarted || gameOver)) {
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
        const msg = controls.createDiv(addHighScoreDiv, undefined);
        msg.textContent = _T("INFO_CONGRAT_HIGHSCORE");
        inputUserName = controls.createInputField(addHighScoreDiv, _T("TEXT_NAME"), () => addHighScore(), "username-input", 10, 10);
        inputUserName.placeholder = _T("TEXT_NAME");
        const div = controls.createDiv(addHighScoreDiv);
        controls.createButton(div, _T("BUTTON_OK"), () => addHighScore());
        renderHighScoreEntries();
    };

    const renderArkanoid = async (parent) => {
        isSoundEnabled = false;
        brickWidth = 45;
        brickHeight = 22;
        borderWidth = 20;
        borderHeight = 20;
        blueW = 4;
        redW = 18;
        racketNormalWidth = 90;
        racketEnlargeWidth = 140;
        racketHeight = 22;
        racketYGap = 38;
        ballRadius = 5;
        laserShotDiff = 13;
        laserShotWidth = 5;
        laserShotHeight = 20;
        if (utils.is_mobile()) {
            const mobilew = 20;
            const mobileh = 5;
            brickWidth -= mobilew;
            brickHeight -= mobileh;
            borderWidth = 1;
            borderHeight = 1;
            blueW = 3;
            redW = 13;
            racketNormalWidth = 60;
            racketEnlargeWidth = 88;
            racketHeight -= mobileh;
            racketYGap -= mobileh;
            ballRadius = 4;
            laserShotWidth = 3;
            laserShotDiff = 8;
        }
        innerWidth = brickWidth * bricksPerRow;
        innerHeight = brickHeight * bricksMaxRows;
        touchActionRect = undefined;
        touchMoveRect = undefined;
        touchDebugRect = undefined;
        if (isTouchDevice()) {
            touchActionRect = { x: 2 * borderWidth, y: innerHeight - borderHeight, w: 3 * brickWidth - 2 * borderWidth, h: 3 * brickHeight - 1 };
            touchMoveRect = { x: touchActionRect.x, y: touchActionRect.y - touchActionRect.h * 5, w: innerWidth - borderWidth, h: touchActionRect.h * 6 };
            if (utils.is_debug()) {
                touchDebugRect = { x: 10 * brickWidth, y: innerHeight, w: 3 * brickWidth - 2 * borderWidth, h: 2 * brickHeight };
            }
        }
        canvas = controls.create(parent, "canvas", "playground");
        canvas.width = innerWidth + 2 * borderWidth + brickHeight;
        canvas.height = innerHeight + borderHeight + 48 + brickHeight;
        controls.createDiv(parent).id = "info-id";
        controls.createDiv(parent).id = "info-gameover-id";
        await startNewGame(false);
        window.requestAnimationFrame(draw);
    };

    const renderSoundButton = (parent) => {
        const imgSound = controls.createImg(parent, undefined, 32, 32, "/images/buttons/kmixdocked_mute.png", _T("BUTTON_ENABLE_SOUND"));
        imgSound.id = "sound-button-id";
        imgSound.addEventListener("click", async () => await toggleSoundButton());
    };

    const onUpdateHelp = (show) => {
        if (helpDiv) {
            helpDiv.className = show ? "help-div" : "invisible-div";
            controls.removeAllChildren(helpDiv);
            if (show) {
                const contentDiv = controls.createDiv(helpDiv, "help-content");
                const mdDiv = controls.createDiv(contentDiv, "help-item");
                utils.fetch_api_call(`/api/pwdman/markdown/help-arkanoid?locale=${utils.get_locale()}`, undefined, (html) => mdDiv.innerHTML = html);
                controls.createButton(contentDiv, _T("BUTTON_OK"), () => onUpdateHelp(false), undefined, "help-ok").focus();
            }
        }
    };

    const renderHelp = (parent) => {
        const helpImg = controls.createImg(parent, "help-button", 24, 24, "/images/buttons/help.png", _T("BUTTON_HELP"));
        helpImg.addEventListener("click", () => onUpdateHelp(true));
        helpImg.id = "help-button-id";
        helpDiv = controls.createDiv(parent, "invisible-div");
    };

    const render = async () => {
        controls.removeAllChildren(document.body);
        const wrapBody = controls.createDiv(document.body, "wrap-body");
        wrapBody.id = "wrap-body-id";
        if (!embedded) {
            utils.create_cookies_banner(wrapBody);
        }
        const all = controls.createDiv(wrapBody);
        if (!embedded) {
            utils.create_menu(all);
            renderHeader(all);
        }
        renderSoundButton(all);
        renderHelp(all);
        renderHighScores(all);
        if (!embedded) {
            renderCopyright(all);
        }
        startGameButton = controls.createButton(all, _T("BUTTON_START_GAME"), async () => await startNewGame(true), "newgame", "newgame");
        continueGameButton = controls.createButton(all, _T("BUTTON_CONTINUE_GAME"), async () => await startNewGame(true, true), "continuegame", "continuegame");
        await renderArkanoid(all);
        if (!embedded) {
            utils.set_menu_items(currentUser);
        }
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

    const renderInit = () => {
        currentUser = undefined;
        let token = utils.get_authentication_token();
        if (!token) {
            render();
            return;
        }
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            (user) => {
                currentUser = user;
                render();
            },
            (errmsg) => {
                console.error(errmsg);
                utils.logout();
                render();
            });
    };

    const init = async (pictures) => {
        debugStatistics = { drawCnt: 0, drawSum: 0, actionCnt: 0, actionSum: 0 };
        const params = new URLSearchParams(window.location.search);
        if (params.has("debug")) {
            utils.enable_debug(true);
            utils.debug("DEBUG enabled.");
        }
        embedded = params.has("embedded");
        fetch(`/js/arkanoid/levels.json?v=${version}`)
            .then(resp => {
                resp.json()
                    .then(json => {
                        levels = json;
                        initBackgroundPictures(pictures);
                        renderInit();
                    })
                    .catch(err => console.log(err));
            })
            .catch(err => console.log(err));
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
            const params = new URLSearchParams(window.location.search);
            if (params.has("embedded")) {
                arkanoid.init([]);
            }
            else {
                utils.fetch_api_call("api/pwdman/slideshow", { headers: { "token": token } },
                    (model) => arkanoid.init(model.pictures),
                    (errMsg) => console.error(errMsg));
            }
        });
    });
};