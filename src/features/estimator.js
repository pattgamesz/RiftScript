// Estimator — reads game estimates, calculates time to level, profit, etc.
import * as events from '../core/events.js';
import { data } from '../game/data.js';
import * as util from '../core/util.js';
import { api } from '../core/api.js';
import { hasAuth } from '../core/auth.js';

// Cached getUser response for equipped-consumable detection. Refreshed in the
// background on every action page entry so we always have a recent view of
// what's equipped + how many spares the player carries.
let userData = null;
let userDataTime = 0;
const USER_TTL = 60_000;

async function refreshUserData() {
    if (!hasAuth()) return;
    if (Date.now() - userDataTime < USER_TTL) return; // still fresh
    try {
        userData = await api.getUser();
        userDataTime = Date.now();
        update(); // re-emit estimation with the new equipment data
    } catch (e) { /* keep stale cache */ }
}

// Looks up the player's stored count for an item id from the cached getUser
// response. The API shape varies across versions (array vs dict, id vs itemId,
// nested under user / items / inventory), so we try a few common forms.
function getInventoryAmount(resp, itemId) {
    if (!resp) return 0;
    const candidates = [resp.user?.inventory, resp.user?.items, resp.inventory, resp.items];
    for (const inv of candidates) {
        if (!inv) continue;
        if (Array.isArray(inv)) {
            const entry = inv.find(x => +(x?.id ?? x?.itemId) === +itemId);
            if (entry) return +(entry.amount ?? entry.count ?? 0) || 0;
        } else if (typeof inv === 'object') {
            const v = inv[itemId] ?? inv[String(itemId)];
            if (v != null) return +v || 0;
        }
    }
    return 0;
}

export function initEstimator() {
    events.on('page', () => { update(); refreshUserData(); });
    events.on('action-exp', update);
    events.on('action-inventory', update);
    events.on('action-loot', update);
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

    // --- Equipped consumables (sigil / potion / brew) ---
    // Anything with a DURATION attribute is a time-based consumable; 1 use
    // every DURATION seconds → 3600/DURATION uses per hour (typically 20/hr
    // at the standard 3-minute duration). Pulled from the cached getUser
    // response so we know exactly what's equipped on the current loadout.
    const consumablesAdded = new Set();
    if (userData) {
        const userObj = userData.user || userData;
        const equipment = userObj.equipment || {};
        for (const slot of Object.values(equipment)) {
            const id = +(slot?.id ?? slot?.itemId ?? 0);
            if (!id) continue;
            const item = data.items.byId[id];
            const duration = item?.attributes?.DURATION;
            if (!duration) continue;
            const stored = getInventoryAmount(userData, id);
            const perHour = 3600 / duration;
            const secondsLeft = stored * duration;
            const sellPrice = item.attributes?.MIN_MARKET_PRICE || item.attributes?.SELL_PRICE || 0;
            ingredientDetails.push({
                itemId: id, stored, perHour, secondsLeft, sellPrice,
                goldPerHour: perHour * sellPrice,
            });
            consumablesAdded.add(id);
            if (secondsLeft < finishedSeconds && stored > 0) {
                finishedSeconds = secondsLeft;
                bottleneck = { itemId: id, secondsLeft };
            }
        }
    }

    // --- Combat food bottleneck ---
    // Combat actions don't list ingredients, but they consume food when HP
    // drops. Find every HEAL-attribute item in inventory and estimate how
    // long that buffer lasts at the current damage-taken rate. Treat it as
    // a synthetic ingredient for the bottleneck calc + UI.
    if (skill.type === 'Combat') {
        const damagePerHour = hasGameData ? gameEst.damagePerHour : 0;
        const foodPerHour = hasGameData ? gameEst.foodPerHour : 0;
        for (const [itemIdStr, count] of Object.entries(inventory)) {
            const itemId = +itemIdStr;
            if (consumablesAdded.has(itemId)) continue;
            const item = data.items.byId[itemId];
            const heal = item?.attributes?.HEAL;
            if (!heal || !count) continue;
            // Prefer game's reported food/hour; fall back to derived
            // damagePerHour / heal if the game shows damage but not food.
            const perHour = foodPerHour > 0
                ? foodPerHour
                : (damagePerHour > 0 ? damagePerHour / heal : 0);
            if (!perHour) continue;
            const secondsLeft = (count / perHour) * 3600;
            const sellPrice = item.attributes?.MIN_MARKET_PRICE || item.attributes?.SELL_PRICE || 0;
            ingredientDetails.push({
                itemId, stored: count, perHour, secondsLeft, sellPrice,
                goldPerHour: perHour * sellPrice,
            });
            if (secondsLeft < finishedSeconds) {
                finishedSeconds = secondsLeft;
                bottleneck = { itemId, secondsLeft };
            }
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
