// Estimator — reads game estimates, calculates time to level, profit, etc.
import * as events from '../core/events.js';
import { data } from '../game/data.js';
import * as util from '../core/util.js';

export function initEstimator() {
    events.on('page', update);
    events.on('action-exp', update);
    events.on('action-inventory', update);
    events.on('action-active', update);
    events.on('game-estimates', update);
    events.on('levels', update);
}

function update() {
    const page = events.last('page');
    if (!page || page.type !== 'action' || !data.ready) return;

    const action = data.actions.byId[page.action];
    const skill = data.skills.byId[page.skill];
    if (!action || !skill) return;

    const estimation = calculate(page.skill, page.action);
    if (estimation) {
        events.emit('estimation', estimation);
    }
}

function calculate(skillId, actionId) {
    const action = data.actions.byId[actionId];
    const skill = data.skills.byId[skillId];
    const inventory = events.last('action-inventory') || {};
    const ingredients = data.ingredients.byAction[actionId] || [];
    const drops = data.drops.byAction[actionId] || [];

    // --- Read game's own estimates ---
    const gameEst = events.last('game-estimates');
    const hasGameData = gameEst && gameEst.skill === skillId;

    const actionsPerHour = hasGameData && gameEst.actionsPerHour > 0
        ? gameEst.actionsPerHour
        : (action.speed > 0 ? 3600 / action.speed : 0);

    const xpPerHour = hasGameData && gameEst.xpPerHour > 0
        ? gameEst.xpPerHour
        : actionsPerHour * action.exp;

    if (!xpPerHour) return null;

    // --- Drop calculations ---
    const dropDetails = [];
    let dropGoldPerHour = 0;
    for (const drop of drops) {
        if (drop.type === 'FAILED' || drop.type === 'MONSTER') continue;
        const perHour = ((1 + drop.amount) / 2) * drop.chance * actionsPerHour;
        const item = data.items.byId[drop.item];
        const sellPrice = item?.attributes?.MIN_MARKET_PRICE || item?.attributes?.SELL_PRICE || 0;
        const goldPerHour = perHour * sellPrice;
        dropGoldPerHour += goldPerHour;
        dropDetails.push({ itemId: drop.item, perHour, sellPrice, goldPerHour });
    }

    // --- Ingredient calculations ---
    const ingredientDetails = [];
    let finishedSeconds = Infinity;
    let ingredientGoldPerHour = 0;
    for (const ing of ingredients) {
        const perHour = ing.amount * actionsPerHour;
        const stored = inventory[ing.item] || 0;
        const secondsLeft = perHour > 0 ? (stored / perHour) * 3600 : Infinity;
        const item = data.items.byId[ing.item];
        const sellPrice = item?.attributes?.MIN_MARKET_PRICE || item?.attributes?.SELL_PRICE || 0;
        const goldPerHour = perHour * sellPrice;
        ingredientGoldPerHour += goldPerHour;
        ingredientDetails.push({ itemId: ing.item, stored, perHour, secondsLeft, sellPrice, goldPerHour });
        if (secondsLeft < finishedSeconds) finishedSeconds = secondsLeft;
    }

    // --- Profit ---
    const profitPerHour = dropGoldPerHour - ingredientGoldPerHour;

    // --- Exp state for level/tier/goal ---
    const actionExp = events.last('action-exp');
    const levels = events.last('levels');
    let currentExp = 0;
    let currentLevel = 1;
    if (actionExp && actionExp.id === skillId) {
        currentExp = actionExp.exp;
        currentLevel = actionExp.level;
    } else if (levels && levels[skillId]) {
        currentLevel = levels[skillId].level;
        currentExp = util.levelToExp(currentLevel);
    }

    // --- Time to level / tier ---
    const levelUpExp = util.expToNextLevel(currentExp);
    const tierUpExp = currentLevel >= 100 ? 0 : util.expToNextTier(currentExp);
    const levelUpSeconds = xpPerHour > 0 ? (levelUpExp / xpPerHour) * 3600 : Infinity;
    const tierUpSeconds = tierUpExp > 0 && xpPerHour > 0 ? (tierUpExp / xpPerHour) * 3600 : 0;

    return {
        skillId,
        actionId,
        skillName: skill.displayName,
        actionName: action.name,
        actionsPerHour,
        xpPerHour,
        currentExp,
        currentLevel,
        levelUpSeconds,
        levelUpActions: actionsPerHour > 0 ? Math.ceil(levelUpSeconds / 3600 * actionsPerHour) : 0,
        tierUpSeconds,
        tierUpActions: actionsPerHour > 0 ? Math.ceil(tierUpSeconds / 3600 * actionsPerHour) : 0,
        isActive: !!events.last('action-active'),
        finishedSeconds,
        ingredients: ingredientDetails,
        drops: dropDetails,
        dropGoldPerHour,
        ingredientGoldPerHour,
        profitPerHour,
    };
}

// Compute goal level time
export function calcGoalTime(goalLevel) {
    const est = events.last('estimation');
    if (!est || !est.xpPerHour) return null;
    const goalExp = util.expToGoalLevel(est.currentExp, goalLevel);
    if (goalExp <= 0) return { seconds: 0, actions: 0 };
    const seconds = (goalExp / est.xpPerHour) * 3600;
    return {
        seconds,
        actions: Math.ceil(seconds / 3600 * est.actionsPerHour),
    };
}
