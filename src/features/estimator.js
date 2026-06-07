// Estimator — turns the active skill page into a single { drops, materials,
// consumables, bottleneck, profit, level-up, … } estimation object that the
// panel UI renders.
//
// Data sources, in order of trust:
//   1. The game's own Estimates tab (DOM) — authoritative for actions/hr,
//      XP/hr, damage/hr, food/hr because it already includes every buff,
//      potion, sigil and tome effect the player has stacked.
//   2. main.js item / action / drop catalog (rift-guild API) — base prices,
//      drop chances (normalised 0–1 in the adapter), recipe inputs.
//   3. getUser inventory + equipment — total stored counts per item, with
//      both the equipment slot's own stack and the bag bag tallied.
//   4. Action base speed from main.js — fallback when the Estimates tab
//      hasn't rendered yet.
//
// Profit = drop gold/hr − material gold/hr − consumable gold/hr.
// Bottleneck = whichever material or consumable runs out first.
import * as events from '../core/events.js';
import * as settings from '../core/settings.js';
import { data } from '../game/data.js';
import * as util from '../core/util.js';
import { getInsatiableHps } from './tomeDetector.js';
import { getEquippedConsumables } from './consumables.js';

export function initEstimator() {
    events.on('page', () => { lastSig = null; update(); });
    events.on('action-exp', update);
    events.on('action-inventory', update);
    events.on('action-loot', update);
    events.on('action-consumables', update);
    events.on('action-active', update);
    events.on('game-estimates', update);
    events.on('action-set-amount', update);
    events.on('levels', update);
    events.on('user-data', update);
}

// Dedup signature — the readers poll once per second and each of the eight
// emit events triggers update(). Without this, the panel rebuilds its Items
// tab HTML up to eight times per visible second even when nothing changed,
// which the user reads as values "constantly refreshing." We only re-emit
// when the rounded display would actually look different.
let lastSig = null;

function update() {
    const page = events.last('page');
    if (!page || page.type !== 'action' || !data.ready) return;
    // Route segments can be numeric IDs or technicalNames — resolve each via
    // both indexes. data.skills.byTechnicalName has been around; we added
    // data.actions.byTechnicalName in the same edit so Pine Tree style URLs
    // (where rift-guild ships id: null and the URL might use "PineTree")
    // still find the action.
    const action = data.actions.byId[page.action]
                || data.actions.byTechnicalName?.[page.actionRaw];
    const skill = data.skills.byId[page.skill]
               || data.skills.byTechnicalName?.[page.skillRaw];
    if (!action || !skill) return;
    const est = calculate(skill, action);
    if (!est) return;
    const sig = signatureOf(est);
    if (sig === lastSig) return;
    lastSig = sig;
    events.emit('estimation', est);
}

function calculate(skill, action) {
    const skillId = skill.id;
    const actionId = action.id;

    // Game's own per-hour numbers from the DOM Estimates tab.
    const gameEst = events.last('game-estimates');
    const hasGame = gameEst && gameEst.skill === skillId;
    const actionsPerHour = (hasGame && gameEst.actionsPerHour > 0)
        ? gameEst.actionsPerHour
        : (action.speed > 0 ? 3600 / action.speed : 0);
    if (!actionsPerHour) return null;
    const xpPerHour = (hasGame && gameEst.xpPerHour > 0)
        ? gameEst.xpPerHour
        : actionsPerHour * (action.exp || 0);

    // Drops, materials, consumables — three independent buckets that all
    // contribute to bottleneck + profit.
    const drops = computeDrops(actionId, actionsPerHour);
    const materials = computeMaterials(actionId, actionsPerHour);
    const consumables = computeConsumables(skill, actionsPerHour, gameEst, hasGame);

    // Profit
    const dropGoldPerHour = sumGold(drops);
    const materialGoldPerHour = sumGold(materials);
    const consumableGoldPerHour = sumGold(consumables);
    const profitPerHour = dropGoldPerHour - materialGoldPerHour - consumableGoldPerHour;

    // Bottleneck = shortest runway across materials + consumables, with the
    // set-amount remaining quota considered too. We only emit a bottleneck
    // for actual items so the panel can label "X runs out first"; the set-
    // amount case is signalled by finishedSeconds < Infinity + bottleneck=null.
    const setAmount = events.last('action-set-amount');
    let finishedSeconds = Infinity;
    let bottleneck = null;
    if (setAmount && setAmount.skill === skillId && setAmount.remaining > 0) {
        finishedSeconds = (setAmount.remaining / actionsPerHour) * 3600;
    }
    for (const row of [...materials, ...consumables]) {
        if (row.stored > 0 && row.secondsLeft < finishedSeconds) {
            finishedSeconds = row.secondsLeft;
            bottleneck = { itemId: row.itemId, secondsLeft: row.secondsLeft };
        }
    }

    // Skill exp state for level / tier countdowns.
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
    const levelUpExp = util.expToNextLevel(currentExp);
    const tierUpExp = currentLevel >= 100 ? 0 : util.expToNextTier(currentExp);
    const levelUpSeconds = xpPerHour > 0 ? (levelUpExp / xpPerHour) * 3600 : Infinity;
    const tierUpSeconds = tierUpExp > 0 && xpPerHour > 0 ? (tierUpExp / xpPerHour) * 3600 : 0;

    return {
        skillId, actionId,
        skillName: skill.displayName,
        actionName: action.name,
        actionsPerHour, xpPerHour,
        currentExp, currentLevel,
        levelUpSeconds,
        levelUpActions: Math.ceil(levelUpSeconds / 3600 * actionsPerHour),
        tierUpSeconds,
        tierUpActions: tierUpSeconds > 0 ? Math.ceil(tierUpSeconds / 3600 * actionsPerHour) : 0,
        isActive: !!events.last('action-active'),
        finishedSeconds,
        bottleneck,
        drops,
        // The panel renders both materials and consumables out of `ingredients`
        // — combining them here keeps the existing UI working unchanged.
        ingredients: [...materials, ...consumables],
        loot: events.last('action-loot') || {},
        dropGoldPerHour,
        ingredientGoldPerHour: materialGoldPerHour + consumableGoldPerHour,
        profitPerHour,
    };
}

// Produced loot. Chance is already in [0,1] (adapter normalised the rift-
// guild 0–1000 raw); amount is exact yield per success. So per-hour is
// amount × chance × actions/hr. FAILED/MONSTER drops are skipped — they're
// not produced output, just downstream tags.
function computeDrops(actionId, actionsPerHour) {
    const list = data.drops.byAction[actionId] || [];
    const out = [];
    for (const d of list) {
        if (d.type === 'FAILED' || d.type === 'MONSTER') continue;
        if (d.item == null) continue;
        const item = data.items.byId[d.item];
        if (!item) continue;
        const perHour = (d.amount || 1) * (d.chance || 0) * actionsPerHour;
        const sellPrice = priceOf(item);
        out.push({
            itemId: d.item, perHour, sellPrice,
            goldPerHour: perHour * sellPrice,
        });
    }
    return out;
}

// Recipe inputs — what the action consumes from the player's bag. Counted
// against the bag stock the DOM Materials card surfaces.
function computeMaterials(actionId, actionsPerHour) {
    const ings = data.ingredients.byAction[actionId] || [];
    const inv = events.last('action-inventory') || {};
    const out = [];
    for (const ing of ings) {
        const item = data.items.byId[ing.item];
        if (!item) continue;
        const perHour = (ing.amount || 1) * actionsPerHour;
        const stored = +(inv[ing.item] || 0);
        const sellPrice = priceOf(item);
        out.push({
            itemId: ing.item, stored, perHour, sellPrice,
            secondsLeft: perHour > 0 ? (stored / perHour) * 3600 : Infinity,
            goldPerHour: perHour * sellPrice,
        });
    }
    return out;
}

// Equipped consumables — food, sigil, potion, brew. Mastery Contract is
// intentionally excluded by consumables.js (see file header).
function computeConsumables(skill, actionsPerHour, gameEst, hasGame) {
    const damagePerHour = hasGame ? (gameEst.damagePerHour || 0) : 0;
    const foodPerHour = hasGame ? (gameEst.foodPerHour || 0) : 0;
    const insatiableHps = settings.getOnDefault('insatiable-tome-active') ? getInsatiableHps() : 0;
    const isCombat = skill.type === 'Combat';
    // Combat takes monster damage + insatiable drain, gathering/crafting just
    // the insatiable drain (and only when the player has it active).
    const effectiveHpPerHour = (isCombat ? damagePerHour : 0) + insatiableHps * 3600;

    const out = [];
    for (const c of getEquippedConsumables()) {
        const { itemId, item, role, count } = c;
        const sellPrice = priceOf(item);
        let perHour = 0;
        if (role === 'buff') {
            // Sigils, potions, brews tick on a 180s window → 20/hr.
            const duration = item.attributes?.DURATION || 180;
            perHour = 3600 / duration;
        } else if (role === 'food') {
            // Game's foodPerHour wins when reported (matches the in-game UI);
            // otherwise derive from HP drain ÷ heal value. Result is 0 when
            // nothing is draining HP — food never runs out on a non-combat
            // skill without the Insatiable tome, which is correct.
            const heal = item.attributes?.HEAL || 0;
            perHour = foodPerHour > 0
                ? foodPerHour
                : (effectiveHpPerHour > 0 && heal > 0 ? effectiveHpPerHour / heal : 0);
        }
        const secondsLeft = perHour > 0 && count > 0 ? (count / perHour) * 3600 : Infinity;
        out.push({
            itemId, stored: count, perHour, sellPrice, secondsLeft,
            goldPerHour: perHour * sellPrice,
        });
    }
    return out;
}

function priceOf(item) {
    return item?.attributes?.MIN_MARKET_PRICE
        || item?.attributes?.SELL_PRICE
        || 0;
}

function sumGold(rows) {
    let s = 0;
    for (const r of rows) s += r.goldPerHour || 0;
    return s;
}

function signatureOf(est) {
    return [
        Math.round(est.xpPerHour),
        Math.round(est.actionsPerHour),
        Math.round(est.profitPerHour),
        Math.round(est.dropGoldPerHour),
        Math.round(est.ingredientGoldPerHour),
        Number.isFinite(est.finishedSeconds) ? Math.floor(est.finishedSeconds / 60) : 'inf',
        Number.isFinite(est.levelUpSeconds) ? Math.floor(est.levelUpSeconds / 60) : 'inf',
        est.currentExp,
        est.currentLevel,
        est.isActive ? 1 : 0,
        est.bottleneck?.itemId ?? '',
        est.drops.map(d => `${d.itemId}:${Math.round(d.perHour)}:${Math.round(d.goldPerHour)}`).join('|'),
        est.ingredients.map(i =>
            `${i.itemId}:${Math.round(i.perHour)}:${i.stored}:${Math.round(i.goldPerHour)}`
        ).join('|'),
        Object.entries(est.loot).map(([k, v]) => `${k}:${v}`).join('|'),
    ].join('#');
}

export function calcGoalTime(goalLevel) {
    const est = events.last('estimation');
    if (!est || !est.xpPerHour) return null;
    const goalExp = util.expToGoalLevel(est.currentExp, goalLevel);
    if (goalExp <= 0) return { seconds: 0, actions: 0 };
    const seconds = (goalExp / est.xpPerHour) * 3600;
    return { seconds, actions: Math.ceil(seconds / 3600 * est.actionsPerHour) };
}
