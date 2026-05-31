// Estimator — reads game estimates, calculates time to level, profit, etc.
import * as events from '../core/events.js';
import * as settings from '../core/settings.js';
import { data } from '../game/data.js';
import * as util from '../core/util.js';
import { getInsatiableHps } from './tomeDetector.js';

export function initEstimator() {
    events.on('page', update);
    events.on('action-exp', update);
    events.on('action-inventory', update);
    events.on('action-loot', update);
    events.on('action-consumables', update);
    events.on('action-active', update);
    events.on('game-estimates', update);
    events.on('action-set-amount', update);
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
    let bottleneck = null;
    for (const ing of ingredients) {
        const perHour = ing.amount * actionsPerHour;
        const stored = inventory[ing.item] || 0;
        const secondsLeft = perHour > 0 ? (stored / perHour) * 3600 : Infinity;
        const item = data.items.byId[ing.item];
        const sellPrice = item?.attributes?.MIN_MARKET_PRICE || item?.attributes?.SELL_PRICE || 0;
        const goldPerHour = perHour * sellPrice;
        ingredientGoldPerHour += goldPerHour;
        ingredientDetails.push({ itemId: ing.item, stored, perHour, secondsLeft, sellPrice, goldPerHour });
        if (secondsLeft < finishedSeconds) {
            finishedSeconds = secondsLeft;
            // Track which ingredient is the bottleneck — first to run out.
            // Only meaningful when secondsLeft is finite (i.e. stored > 0 OR
            // we actually use this ingredient at all).
            if (Number.isFinite(secondsLeft)) {
                bottleneck = { itemId: ing.item, secondsLeft };
            }
        }
    }

    // --- Set amount limit ---
    const setAmountData = events.last('action-set-amount');
    if (setAmountData && setAmountData.skill === skillId && setAmountData.remaining != null && actionsPerHour > 0) {
        const setAmountSeconds = (setAmountData.remaining / actionsPerHour) * 3600;
        if (setAmountSeconds < finishedSeconds) {
            finishedSeconds = setAmountSeconds;
            bottleneck = null; // set-amount, not an ingredient
        }
    }

    // --- Consumables card (sigil / potion / brew / food) ---
    // Read straight from the in-game Consumables card on the skill page.
    // Items split by attribute:
    //   - DURATION (sigil / potion / brew, typically 180s = 20/hr)
    //   - HEAL = food. Combat: consumed at damage rate. With Insatiable
    //     Power Tome equipped, an extra HP/s is drained on every action
    //     regardless of skill — config'd as 'insatiable-hps' (default 0,
    //     user enters their tome's rate, e.g. 1.6 for T8).
    // The shortest-lasting one wins the bottleneck tag.
    const consumables = events.last('action-consumables') || {};
    const damagePerHour = hasGameData ? (gameEst.damagePerHour || 0) : 0;
    const foodPerHour = hasGameData ? (gameEst.foodPerHour || 0) : 0;
    // Insatiable Power Tome HP/s drain. Auto-detected level × 0.2 (linear),
    // only applied when the user has flipped the toggle on.
    const insatiableHps = settings.get('insatiable-tome-active') ? getInsatiableHps() : 0;
    // Combat takes monster damage + insatiable; other skills only insatiable.
    const insatiableHpPerHour = insatiableHps * 3600;
    const effectiveHpPerHour = (skill.type === 'Combat' ? damagePerHour : 0) + insatiableHpPerHour;
    // Find the main produced drop (used for the Mastery Contract cost calc).
    const producedDrops = drops.filter(d => d.type !== 'FAILED' && d.type !== 'MONSTER');
    const mainDrop = producedDrops.length
        ? producedDrops.reduce((best, d) =>
            (d.chance * (1 + d.amount)) > (best.chance * (1 + best.amount)) ? d : best
        )
        : null;
    const mainDropItem = mainDrop ? data.items.byId[mainDrop.item] : null;
    const mainDropPrice = mainDropItem
        ? (mainDropItem.attributes?.MIN_MARKET_PRICE || mainDropItem.attributes?.SELL_PRICE || 0)
        : 0;

    for (const [key, raw] of Object.entries(consumables)) {
        // Unpack — values can be a plain number (count) or an object with
        // extra metadata (Mastery Contract emits { count, active }).
        const count = typeof raw === 'object' ? raw.count : raw;
        const meta  = typeof raw === 'object' ? raw : {};

        // Resolve the item. 'brew' is synthetic — we treat it as a 180s
        // sigil-class item with its own image, since it isn't in the DB.
        const isBrew = key === 'brew';
        const item = isBrew
            ? { id: 'brew', name: 'Brew', image: 'misc/brew.png', attributes: { DURATION: 180 } }
            : data.items.byId[+key];
        if (!item) continue;

        const duration = item.attributes?.DURATION;
        const heal = item.attributes?.HEAL;
        const isContract = item.id === 1041;
        if (!duration && !heal && !isContract) continue;

        let perHour = 0;
        let secondsLeft = Infinity;
        let sellPrice = item.attributes?.MIN_MARKET_PRICE || item.attributes?.SELL_PRICE || 0;
        let goldPerHour = 0;

        if (count > 0) {
            if (isContract) {
                if (meta.active && actionsPerHour > 0) {
                    perHour = actionsPerHour;
                    secondsLeft = (count / actionsPerHour) * 3600;
                    // Cost = market price of the main produced item (the
                    // contract creates + contributes one to mastery per
                    // action, so the displayed loss equals that item's
                    // market value, not the contract's own price).
                    sellPrice = mainDropPrice;
                    goldPerHour = perHour * sellPrice;
                }
            } else if (duration) {
                perHour = 3600 / duration;
                secondsLeft = count * duration;
                goldPerHour = perHour * sellPrice;
            } else if (heal) {
                // Prefer the game's own Food/hr if it's reporting one.
                // Otherwise derive from effective HP drain (monster damage on
                // combat + Insatiable tome on every skill) divided by the
                // food's heal value. Non-combat with no tome → 0 → no lasts.
                perHour = foodPerHour > 0
                    ? foodPerHour
                    : (effectiveHpPerHour > 0 ? effectiveHpPerHour / heal : 0);
                secondsLeft = perHour > 0 ? (count / perHour) * 3600 : Infinity;
                goldPerHour = perHour * sellPrice;
            }
        }

        ingredientDetails.push({
            itemId: isBrew ? 'brew' : item.id,
            stored: count,
            perHour, secondsLeft, sellPrice, goldPerHour,
            synthetic: isBrew ? { name: 'Brew', image: 'misc/brew.png' } : null,
            contract: isContract ? { active: !!meta.active } : null,
        });
        // Only consider as bottleneck when there's actually stock to run out.
        if (count > 0 && secondsLeft < finishedSeconds) {
            finishedSeconds = secondsLeft;
            bottleneck = { itemId: isBrew ? 'brew' : item.id, secondsLeft };
        }
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

    const loot = events.last('action-loot') || {};

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
        bottleneck,
        ingredients: ingredientDetails,
        drops: dropDetails,
        loot,
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
