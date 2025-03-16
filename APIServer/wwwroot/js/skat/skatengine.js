var skatengine = (() => {

    "use strict";

    let computerPlayedCards;
    let computerStitches;

    const getRandom = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const isTrump = (game, card) => {
        return game.type != "Null" &&
            (card.value == "Jack" ||
                (game.type != "Grand" && card.color == game.color));
    };

    const getNextPlayer = (m, player) => {
        if (player) {
            for (let idx = 0; idx < m.skatTable.players.length; idx++) {
                if (player.name == m.skatTable.players[idx].name) {
                    player = m.skatTable.players[(idx + 1) % m.skatTable.players.length];
                    if (m.skatTable.inactivePlayer && player.name == m.skatTable.inactivePlayer.name) {
                        player = m.skatTable.players[(idx + 2) % m.skatTable.players.length];
                    }
                    return player;
                }
            }
        }
        return undefined;
    };

    const initComputerPlayModel = (currentUsername) => {
        computerPlayedCards = [];
        computerStitches = new Map();
        computerStitches.set(currentUsername, []);
        computerStitches.set(_T("TEXT_COMPUTER_1"), []);
        computerStitches.set(_T("TEXT_COMPUTER_2"), []);
    };

    const collectComputerPlayStitch = (playerName) => {
        const stitches = computerStitches.get(playerName);
        const n = computerPlayedCards.length;
        stitches.push(computerPlayedCards[n - 3]);
        stitches.push(computerPlayedCards[n - 2]);
        stitches.push(computerPlayedCards[n - 1]);
    };

    const storeComputerPlayCard = (m, playerName, card) => {
        if (m && m.skatTable && m.skatTable.gameStarted) {
            if (m.skatTable.stitch.length === 3) {
                collectComputerPlayStitch(playerName);
            }
            computerPlayedCards.push({ player: playerName, card: card });
        }
    };

    const chooseComputerPlayCard = (m) => {
        const am = analyseMyCards(m);
        let bestCards;
        if (am.gamePlayerName != am.myPlayerName) {
            let bestScore = -1;
            m.skatTable.playableCards.forEach(c => {
                const score = getComputerPlayScore(am, c);
                if (score >= bestScore) {
                    if (score > bestScore) {
                        bestCards = [];
                    }
                    bestCards.push(c);
                    bestScore = score;
                }
                if (utils.is_debug()) utils.debug(`card:${getCardDescription(c)}, score:${score}, best score:${bestScore}`);
            });
        }
        if (!bestCards) {
            bestCards = m.skatTable.playableCards;
        }
        return bestCards[getRandom(0, bestCards.length - 1)];
    };

    const getComputerPlayScore = (am, card) => {
        switch (am.myPosition) {
            case 0:
                return getComputerPlayScoreVorhand(am, card);
            case 1:
                return getComputerPlayScoreMittelhand(am, card);
            case 2:
                return getComputerPlayScoreHinterhand(am, card);
            default:
                break;
        }
        return -2;
    };

    const getComputerPlayScoreVorhand = (am, card) => {
        let score = 0;
        const cardScore = getCardScore(card);
        const game = am.game;
        const noTrumps = am.cardInfo.Trump.playerNamesWithoutCards.includes(am.gamePlayerName);
        if (!isTrump(game, card)) {
            const hit = am.cardInfo[card.color].playerNamesWithoutCards.includes(am.gamePlayerName);
            score += 50;
            const remaingColorCards = addCards(am.cardInfo[card.color].remainingCards, am.cardInfo[card.color].myCards);
            const highestColorCard = getHighestCard(remaingColorCards);
            if (isSameCard(highestColorCard, card)) {
                score += 20;
                if (!hit) {
                    score += 20;
                }
                score += cardScore;
                score += remaingColorCards.length;
            }
            else {
                if (noTrumps) {
                    score += 20 + cardScore;
                }
                else {
                    if (hit) {
                        score += 5;
                    }
                    score += 10 + (11 - cardScore);
                    score -= remaingColorCards.length;
                }
            }
        }
        else {
            const remainingOtherTrumpCards = am.cardInfo.Trump.remainingCards;
            const myTrumpCards = am.cardInfo.Trump.myCards;
            const remainingTrumpCards = addCards(remainingOtherTrumpCards, myTrumpCards);
            if (!noTrumps && myTrumpCards.length > remainingOtherTrumpCards.length) {
                score += 70;
            }
            const highestTrumpCard = getHighestCard(remainingTrumpCards);
            if (isSameCard(highestTrumpCard, card)) {
                score += 20;
                score += cardScore;
            }
            else {
                score = 11 - cardScore;
            }
        }
        return score;
    };

    const getComputerPlayScoreMittelhand = (am, card) => {
        const game = am.game;
        const firstCard = am.firstCard;
        const firstCardOrder = getCardOrder(firstCard);
        const key = isTrump(game, firstCard) ? "Trump" : firstCard.color;
        const forced = isForcedCard(game, firstCard, card);
        const gamePlayerHitColor = !isTrump(game, firstCard) && am.cardInfo[key].playerNamesWithoutCards.includes(am.gamePlayerName);
        const trump = isTrump(game, card);
        const cardOrder = getCardOrder(card);
        const cardScore = getCardScore(card);
        const canTakeOver = forced && cardOrder > firstCardOrder || !forced && trump;
        const highestCardOrder = getHighestCardOrder(am.cardInfo[key].remainingCards);
        let score = 0;
        if (am.gamePlayerPosition == 0) {
            if (canTakeOver) {
                score += 50;
                if (card.value != "Jack") {
                    score += cardScore + 1;
                }
            }
            else if (!forced || card.value != "Jack") {
                score += 12 - cardScore;
            }
        }
        else {
            if (canTakeOver) {
                if (forced) {
                    if (!gamePlayerHitColor && cardOrder > highestCardOrder) {
                        score += 50 + cardScore;
                    }
                    else if (cardScore < 10) {
                        score += 30 + cardScore;
                    }
                }
                else if (trump) {
                    if (!gamePlayerHitColor) {
                        score += 20 + cardScore;
                    }
                    else if (cardScore < 10) {
                        score += 10 + cardOrder;
                    }
                }
                else {
                    score += 11 - cardScore;
                }
            }
            else {
                if (!trump) {
                    if (!gamePlayerHitColor) {
                        const remaingCards = addCards(am.cardInfo[key].remainingCards, [firstCard]);
                        const highestCard = getHighestCard(remaingCards);
                        if (isSameCard(firstCard, highestCard)) {
                            score += 41 + (cardScore != 10 ? cardScore : -1);
                        }
                        else {
                            score += 11 - cardScore;
                        }
                    }
                    else {
                        score += 11 - cardScore;
                    }
                }
                else if (!forced || card.value != "Jack") {
                    score += 12 - cardScore;
                }
            }
        }
        return score;
    };

    const getComputerPlayScoreHinterhand = (am, card) => {
        const game = am.game;
        const forced = isForcedCard(game, am.firstCard, card);
        const cardOrder = getCardOrder(card);
        const cardScore = getCardScore(card);
        const trump = isTrump(game, card);
        const highestCardOrder = getHighestCardOrder([am.firstCard, am.secondCard]);
        const canTakeOver = forced && cardOrder > highestCardOrder && (isTrump(game, am.firstCard) || !isTrump(game, am.secondCard)) ||
            !forced && trump && (!isTrump(game, am.secondCard) || cardOrder > getCardOrder(am.secondCard));
        let score = 0;
        if (am.stitchOwnerPosition != am.gamePlayerPosition) {
            score += (trump && !forced) ? 20 : 50;
            if (card.value != "Jack") {
                score += cardScore + 1;
            }
        }
        else if (canTakeOver) {
            score += 30;
            if (card.value != "Jack") {
                score += cardScore + 1;
            }
        }
        else if (!forced || card.value != "Jack") {
            score += 12 - cardScore;
        }
        return score;
    };

    const analyseMyCards = (m) => {
        const ret = {
            game: undefined,
            myPlayerName: undefined,
            gamePlayerName: undefined,
            partnerPlayerName: undefined,
            myPosition: undefined,
            gamePlayerPosition: undefined,
            stitchOwnerPosition: undefined,
            myCards: [],
            firstCard: undefined,
            secondCard: undefined,
            cardInfo: {
                "Trump": {
                    remainingCards: [],
                    myCards: [],
                    playerNamesWithoutCards: []
                },
                "Diamonds": {
                    remainingCards: [],
                    myCards: [],
                    playerNamesWithoutCards: []
                },
                "Hearts": {
                    remainingCards: [],
                    myCards: [],
                    playerNamesWithoutCards: []
                },
                "Spades": {
                    remainingCards: [],
                    myCards: [],
                    playerNamesWithoutCards: []
                },
                "Clubs": {
                    remainingCards: [],
                    myCards: [],
                    playerNamesWithoutCards: []
                }
            }
        };
        ret.game = m.skatTable.gamePlayer.game;
        let colors = getAllColors();
        if (ret.game.type != "Grand") {
            colors = colors.filter(color => color != ret.game.color);
        }
        ret.myCards = m.skatTable.cards;
        ret.myPosition = getCurrentPlayerPosition(m);
        ret.gamePlayerPosition = getGamePlayerPosition(m);
        ret.stitchOwnerPosition = getStitchOwnerPosition(m);
        const cards = [];
        ret.myCards.forEach(c => cards.push(c));
        if (m.skatTable.stitch.length > 0) {
            ret.firstCard = m.skatTable.stitch[0];
            cards.push(ret.firstCard);
            if (m.skatTable.stitch.length > 1) {
                ret.secondCard = m.skatTable.stitch[1];
                cards.push(ret.secondCard);
            }
        }
        ret.gamePlayerName = m.skatTable.gamePlayer.name;
        ret.myPlayerName = m.skatTable.currentPlayer.name;
        m.skatTable.players.forEach(playerInfo => {
            if (playerInfo.name != ret.gamePlayerName && playerInfo.name != ret.myPlayerName) {
                ret.partnerPlayerName = playerInfo.name;
            }
        });
        const cardInfoKeys = ["Trump"];
        const cardInfoPlayerNames = m.skatTable.players.map(playerInfo => playerInfo.name);
        colors.forEach(color => cardInfoKeys.push(color));
        cardInfoKeys.forEach(key => {
            if (key == "Trump") {
                ret.cardInfo[key].myCards = ret.myCards.filter(c => isTrump(ret.game, c));
                ret.cardInfo[key].remainingCards = getRemainingCards(ret.game, true, undefined, cards);
                cardInfoPlayerNames.forEach(playerName => {
                    if (hasPlayerNoTrumpOrNoColor(m, playerName)) {
                        ret.cardInfo[key].playerNamesWithoutCards.push(playerName);
                    }
                });
            }
            else {
                ret.cardInfo[key].myCards = ret.myCards.filter(c => c.color == key);
                ret.cardInfo[key].remainingCards = getRemainingCards(ret.game, false, key, cards);
                cardInfoPlayerNames.forEach(playerName => {
                    if (hasPlayerNoTrumpOrNoColor(m, playerName, key)) {
                        ret.cardInfo[key].playerNamesWithoutCards.push(playerName);
                    }
                });
            }
        });
        console.log(ret);
        return ret;
    };

    const isForcedCard = (game, first, c) => {
        return isTrump(game, first) && isTrump(game, c) ||
            !isTrump(game, first) && !isTrump(game, c) && first.color == c.color;
    };

    const getCurrentPlayerPosition = m => m.skatTable.stitch.length;

    const getGamePlayerPosition = (m) => {
        let pos = (m.skatTable.stitch.length + 1) % 3;
        if (m.skatTable.gamePlayer.name != getNextPlayer(m, m.skatTable.currentPlayer).name) {
            pos = (pos + 1) % 3;
        }
        return pos;
    };

    const getStitchOwnerPosition = (m) => {
        if (m.skatTable.stitch.length == 1) {
            return 0;
        }
        if (m.skatTable.stitch.length == 2) {
            const game = m.skatTable.gamePlayer.game;
            const firstCard = m.skatTable.stitch[0];
            const secondCard = m.skatTable.stitch[1];
            const forced = isForcedCard(game, firstCard, secondCard);
            if (forced && getCardOrder(secondCard) > getCardOrder(firstCard) || !forced && isTrump(game, secondCard)) {
                return 1;
            }
            return 0;
        }
        return undefined;
    };

    const hasPlayerNoTrumpOrNoColor = (m, player, color) => {
        const game = m.skatTable.gamePlayer.game;
        for (let idx = 0; idx < computerPlayedCards.length; idx += 3) {
            const pc = computerPlayedCards[idx];
            if (pc && pc.player != player && (color && !isTrump(game, pc.card) && pc.card.color == color || !color && isTrump(game, pc.card))) {
                for (let j = 1; j <= 2; j++) {
                    const next = computerPlayedCards[idx + j];
                    if (next && next.player == player && (color && (isTrump(game, next) || next.card.color != color) || !color && !isTrump(game, next.card))) {
                        return true;
                    }
                }
            }
        }
        return false;
    };

    const getHighestCard = (cards) => {
        return getHighestCardDetails(cards).card;
    };

    const getHighestCardOrder = (cards) => {
        return getHighestCardDetails(cards).order;
    };

    const getHighestCardDetails = (cards) => {
        let highestCard;
        let highestCardOrder = -1;
        cards.forEach(c => {
            const cardOrder = getCardOrder(c);
            if (cardOrder > highestCardOrder) {
                highestCard = c;
                highestCardOrder = cardOrder;
            }
        });
        return { card: highestCard, order: highestCardOrder };
    };

    const addCards = (set1, set2) => {
        const cards = [];
        set1.forEach(c => cards.push(c));
        set2.forEach(c => cards.push(c));
        return cards;
    };

    const isSameCard = (c1, c2) => c1 != undefined && c2 != undefined && c1.value == c2.value && c1.color == c2.color;

    const getAllColors = () => ["Diamonds", "Hearts", "Spades", "Clubs"];

    const getAllValues = () => ["Digit7", "Digit8", "Digit9", "Digit10", "Jack", "Queen", "King", "Ace"];

    const getAllCards = () => {
        const cards = [];
        getAllColors().forEach(color => getAllValues().forEach(value => cards.push({ color: color, value: value })));
        return cards;
    };

    const containsCard = (cards, card) => cards.some(c => c.value == card.value && c.color == card.color);

    const getRemainingCards = (game, trump, color, myCards) => {
        const knownCards = [];
        if (myCards) {
            myCards.forEach(c => knownCards.push(c));
        }
        computerPlayedCards.forEach(pc => knownCards.push(pc.card));
        let cards;
        if (trump) {
            cards = getAllCards().filter(c => isTrump(game, c));
        }
        else if (color == undefined) {
            cards = getAllCards().filter(c => !isTrump(game, c));
        }
        else {
            cards = getAllCards().filter(c => c.color == color && c.value != "Jack");
        }
        return cards.filter(c => !containsCard(knownCards, c));
    };

    const getCardOrder = (card) => {
        if (card.value == "Jack") {
            const cardOrderJack = { "Diamonds": 7, "Hearts": 8, "Spades": 9, "Clubs": 10 };
            return cardOrderJack[card.color];
        }
        const cardOrder = { "Digit7": 0, "Digit8": 1, "Digit9": 2, "Queen": 3, "King": 4, "Digit10": 5, "Ace": 6 };
        return cardOrder[card.value];
    };

    const getCardScore = (card) => {
        const scoreMap = { "Digit7": 0, "Digit8": 0, "Digit9": 0, "Jack": 2, "Queen": 3, "King": 4, "Digit10": 10, "Ace": 11 };
        return scoreMap[card.value];
    };

    // --- public API

    return {
        initComputerPlayModel: initComputerPlayModel,
        chooseComputerPlayCard: chooseComputerPlayCard,
        collectComputerPlayStitch: collectComputerPlayStitch,
        storeComputerPlayCard: storeComputerPlayCard,
        getRandom: getRandom,
        getNextPlayer: getNextPlayer,
        isTrump: isTrump
    };
})();