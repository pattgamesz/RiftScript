// Combat Calculator panel for RiftScript menu
import * as storage from '../core/storage.js';
import { formatNumber } from '../core/util.js';
import { simulate, calculateResults } from '../features/combatCalc.js';
import { api } from '../core/api.js';
import { hasAuth } from '../core/auth.js';
import { data } from '../game/data.js';
import { getMode } from '../game/mode.js';

const FOOD_TYPES = [
    { name: 'None', hp: 0, cost: 0 },
    // Pies
    { name: 'King Crab Pie', hp: 240, cost: 430 },
    { name: 'Shark Pie', hp: 210, cost: 305 },
    { name: 'Swordfish Pie', hp: 180, cost: 220 },
    { name: 'Lobster Pie', hp: 150, cost: 185 },
    { name: 'Bass Pie', hp: 120, cost: 150 },
    { name: 'Salmon Pie', hp: 90, cost: 110 },
    { name: 'Cod Pie', hp: 60, cost: 90 },
    { name: 'Shrimp Pie', hp: 30, cost: 65 },
    // Cooked food
    { name: 'Cooked King Crab', hp: 120, cost: 120 },
    { name: 'Cooked Shark', hp: 105, cost: 82 },
    { name: 'Cooked Swordfish', hp: 90, cost: 65 },
    { name: 'Cooked Lobster', hp: 75, cost: 55 },
    { name: 'Cooked Bass', hp: 60, cost: 40 },
    { name: 'Cooked Salmon', hp: 45, cost: 32 },
    { name: 'Cooked Cod', hp: 30, cost: 45 },
    { name: 'Cooked Shrimp', hp: 15, cost: 25 },
];

const DEFAULT_CONFIG = {
    playerAttack: 312,
    playerSpeed: 2.5,
    damagePercent: 36,
    blockPercent: 80.25,
    accuracy: 90,
    evasion: 40,
    playerHealth: 478,
    foodType: 'King Crab Pie',
    monsterHealth: 1900,
    monsterAttack: 210,
    monsterSpeed: 2.0,
    monsterDamage: 0,
    monsterBlock: 0,
    efficiency: 112,
    lootBonus: 35.48,
    xpBonus: 140,
    baseXpPerKill: 2.6,
    lootValuePerKill: 730,
    otherCostPerHour: 0,
    simHours: 1,
    regionAdvantage: 1,
    reviveSpeed: 900,
};

function loadConfig() {
    return storage.getData('combat-config') || DEFAULT_CONFIG;
}

function saveConfig(config) {
    storage.save('combat-config', config);
}

function getConfig(page) {
    const val = (id) => parseFloat(page.find(`#${id}`).val()) || 0;
    const foodName = page.find('#rs-cb-food').val();
    const food = FOOD_TYPES.find(f => f.name === foodName) || FOOD_TYPES[0];
    return {
        playerAttack: val('rs-cb-pAtk'),
        playerSpeed: val('rs-cb-pSpd'),
        damagePercent: val('rs-cb-dmg'),
        blockPercent: val('rs-cb-blk'),
        accuracy: val('rs-cb-acc'),
        evasion: val('rs-cb-eva'),
        playerHealth: val('rs-cb-pHp'),
        foodType: foodName,
        foodHp: food.hp,
        foodCost: food.cost,
        monsterHealth: val('rs-cb-mHp'),
        monsterAttack: val('rs-cb-mAtk'),
        monsterSpeed: val('rs-cb-mSpd'),
        monsterDamage: val('rs-cb-mDmg'),
        monsterBlock: val('rs-cb-mBlk'),
        efficiency: val('rs-cb-eff'),
        lootBonus: val('rs-cb-loot'),
        xpBonus: val('rs-cb-xp'),
        baseXpPerKill: val('rs-cb-baseXp'),
        lootValuePerKill: val('rs-cb-lootVal'),
        otherCostPerHour: val('rs-cb-otherCost'),
        simHours: val('rs-cb-simHours') || 1,
        regionAdvantage: val('rs-cb-regionAdv') || 1,
        reviveSpeed: val('rs-cb-revive') || 900,
    };
}

function recalculate(page) {
    const config = getConfig(page);
    saveConfig(config);

    const sim = simulate(config);
    const results = calculateResults(config, sim);

    if (!sim.canSurvive) {
        page.find('#rs-cb-results').html(`
            <div class="rs-row"><span style="color:#f87171">Cannot survive — you die before killing the monster. Increase Block/Evasion/Health or use better food.</span></div>
        `);
        return;
    }

    if (sim.finalKPH === 0) {
        page.find('#rs-cb-results').html(`
            <div class="rs-row"><span style="opacity:0.4">No damage dealt. Check your stats.</span></div>
        `);
        return;
    }

    const fmt = (n) => formatNumber(Math.round(n));
    const profitClass = results.profitPerHour >= 0 ? 'rs-profit-positive' : 'rs-profit-negative';

    page.find('#rs-cb-results').html(`
        <div class="rs-row"><span>Base Kills/Hr</span><span>${fmt(sim.baseKPH)}</span></div>
        <div class="rs-row"><span>Final Kills/Hr</span><span style="color:#4a9eff;font-weight:600">${fmt(sim.finalKPH)}</span></div>
        <div class="rs-row"><span>Food/Hr</span><span>${fmt(sim.foodPerHour)}</span></div>
        ${sim.playerDefeats > 0 ? `
            <div class="rs-row"><span>Deaths</span><span style="color:#f87171">${sim.playerDefeats}</span></div>
        ` : ''}
        <div class="rs-row"><span>XP/Hr</span><span>${fmt(results.xpPerHour)}</span></div>
        <div class="rs-divider"></div>
        <div class="rs-row"><span>Loot/Hr</span><span>${fmt(results.lootPerHour)}</span></div>
        <div class="rs-row"><span>Food Cost/Hr</span><span style="color:#f87171">-${fmt(results.foodCostPerHour)}</span></div>
        ${results.totalCostPerHour - results.foodCostPerHour > 0 ? `
            <div class="rs-row"><span>Other Cost/Hr</span><span style="color:#f87171">-${fmt(results.totalCostPerHour - results.foodCostPerHour)}</span></div>
        ` : ''}
        <div class="rs-divider"></div>
        <div class="rs-row"><span>Profit/Hr</span><span class="${profitClass}" style="font-weight:600">${fmt(results.profitPerHour)}</span></div>
    `);
}

function inputRow(label, id, value, step = 1, suffix = '') {
    return `
        <div class="rs-row">
            <span>${label}${suffix ? ` <span style="opacity:0.4;font-size:11px">${suffix}</span>` : ''}</span>
            <span style="display:flex;align-items:center;gap:8px">
                <span class="rs-cb-fetched" id="${id}-fetched"></span>
                <input class="rs-combat-input" id="${id}" type="number" value="${value}" step="${step}">
            </span>
        </div>
    `;
}

export function renderCombatCard() {
    const c = loadConfig();
    const foodOptions = FOOD_TYPES.map(f =>
        `<option value="${f.name}" ${c.foodType === f.name ? 'selected' : ''}>${f.name}${f.hp ? ` (${f.hp} HP)` : ''}</option>`
    ).join('');

    return `
        <div class="rs-cb-alert" id="rs-cb-alert" style="display:none"></div>
        <div class="rs-card">
            <div class="rs-card-header">Player Stats</div>
            ${inputRow('Attack', 'rs-cb-pAtk', c.playerAttack)}
            ${inputRow('Speed', 'rs-cb-pSpd', c.playerSpeed, 0.1, 'sec')}
            ${inputRow('Damage', 'rs-cb-dmg', c.damagePercent, 0.1, '%')}
            ${inputRow('Block', 'rs-cb-blk', c.blockPercent, 0.01, '%')}
            ${inputRow('Accuracy', 'rs-cb-acc', c.accuracy, 1, '%')}
            ${inputRow('Evasion', 'rs-cb-eva', c.evasion, 1, '%')}
            ${inputRow('Health', 'rs-cb-pHp', c.playerHealth)}
        </div>

        <div class="rs-card">
            <div class="rs-card-header">Monster Stats</div>
            ${inputRow('Health', 'rs-cb-mHp', c.monsterHealth)}
            ${inputRow('Attack', 'rs-cb-mAtk', c.monsterAttack)}
            ${inputRow('Speed', 'rs-cb-mSpd', c.monsterSpeed, 0.1, 'sec')}
            ${inputRow('Damage', 'rs-cb-mDmg', c.monsterDamage || 0, 0.1, '%')}
            ${inputRow('Block', 'rs-cb-mBlk', c.monsterBlock || 0, 0.1, '%')}
        </div>

        <div class="rs-card">
            <div class="rs-card-header">Bonuses</div>
            ${inputRow('Efficiency', 'rs-cb-eff', c.efficiency, 0.01, '%')}
            ${inputRow('Loot Bonus', 'rs-cb-loot', c.lootBonus, 0.01, '%')}
            ${inputRow('XP Bonus', 'rs-cb-xp', c.xpBonus, 0.01, '%')}
        </div>

        <div class="rs-card">
            <div class="rs-card-header">Consumables</div>
            <div class="rs-row">
                <span>Food</span>
                <select class="rs-combat-input rs-combat-select" id="rs-cb-food">${foodOptions}</select>
            </div>
            ${inputRow('Other Cost/Hr', 'rs-cb-otherCost', c.otherCostPerHour, 1, 'gold')}
        </div>

        <div class="rs-card">
            <div class="rs-card-header">XP & Loot</div>
            ${inputRow('Base XP/Kill', 'rs-cb-baseXp', c.baseXpPerKill, 0.1)}
            ${inputRow('Loot Value/Kill', 'rs-cb-lootVal', c.lootValuePerKill, 1, 'gold')}
        </div>

        <div class="rs-card">
            <div class="rs-card-header">Simulation</div>
            ${inputRow('Sim Duration', 'rs-cb-simHours', c.simHours || 1, 1, 'hours')}
            ${inputRow('Region Advantage', 'rs-cb-regionAdv', c.regionAdvantage || 1, 0.1, 'x')}
            ${inputRow('Revive Time', 'rs-cb-revive', c.reviveSpeed || 900, 1, 'sec')}
        </div>

        <div class="rs-card">
            <div class="rs-card-header">Results</div>
            <div id="rs-cb-results">
                <div class="rs-row"><span style="opacity:0.4">Enter your stats above.</span></div>
            </div>
        </div>
    `;
}

function sumEquipmentStats(equipment) {
    const totals = {};
    if (!equipment || !data.ready) return totals;

    for (const [slot, entry] of Object.entries(equipment)) {
        if (!entry) continue;
        const item = data.items.byId[entry.id];
        if (!item?.stats) continue;

        // Sum global stats
        if (item.stats.global) {
            for (const [key, val] of Object.entries(item.stats.global)) {
                totals[key] = (totals[key] || 0) + val;
            }
        }
        // Sum bySkill stats (all skills, since combat benefits from general bonuses)
        if (item.stats.bySkill) {
            for (const [statKey, skillMap] of Object.entries(item.stats.bySkill)) {
                for (const [skill, val] of Object.entries(skillMap)) {
                    const fullKey = `${statKey}`;
                    totals[fullKey] = (totals[fullKey] || 0) + val;
                }
            }
        }
    }
    return totals;
}

function setField(page, id, value) {
    page.find(`#${id}`).val(value);
    page.find(`#${id}-fetched`).text(value);
}

function applyUserStats(page, userData) {
    const history = userData?.user?.action?.history;
    if (!history?.character || !history?.monster) return false;

    const char = history.character;
    const mon = history.monster;

    // Determine which region's damage/block to use based on the monster's non-zero values
    let regionDmg = 0;
    let regionBlk = 0;
    if (mon.forestDamagePercent || mon.forestBlockPercent) {
        regionDmg = char.forestDamagePercent || 0;
        regionBlk = char.forestBlockPercent || 0;
    } else if (mon.mountainDamagePercent || mon.mountainBlockPercent) {
        regionDmg = char.mountainDamagePercent || 0;
        regionBlk = char.mountainBlockPercent || 0;
    } else if (mon.oceanDamagePercent || mon.oceanBlockPercent) {
        regionDmg = char.oceanDamagePercent || 0;
        regionBlk = char.oceanBlockPercent || 0;
    }

    // Player combat stats
    setField(page, 'rs-cb-pAtk', char.damage || 0);
    setField(page, 'rs-cb-pSpd', char.speed || 2.5);
    setField(page, 'rs-cb-dmg', (char.eliteDamagePercent || 0) + regionDmg);
    setField(page, 'rs-cb-blk', char.armour || 0);
    setField(page, 'rs-cb-acc', char.bonusAccuracy || 0);
    setField(page, 'rs-cb-eva', char.bonusEvasion || 0);
    setField(page, 'rs-cb-pHp', char.maxHealth || 0);

    // Monster stats
    setField(page, 'rs-cb-mHp', mon.maxHealth || 0);
    setField(page, 'rs-cb-mAtk', mon.damage || 0);
    setField(page, 'rs-cb-mSpd', mon.speed || 2);
    setField(page, 'rs-cb-mDmg', (mon.eliteDamagePercent || 0) + (mon.forestDamagePercent || 0) + (mon.mountainDamagePercent || 0) + (mon.oceanDamagePercent || 0));
    setField(page, 'rs-cb-mBlk', mon.armour || (mon.eliteBlockPercent || 0) + (mon.forestBlockPercent || 0) + (mon.mountainBlockPercent || 0) + (mon.oceanBlockPercent || 0));

    // Bonuses from equipped items
    const stats = sumEquipmentStats(userData?.user?.equipment);
    setField(page, 'rs-cb-eff', stats.EFFICIENCY_CHANCE || 0);
    setField(page, 'rs-cb-loot', stats.DOUBLE_LOOT_CHANCE || 0);
    setField(page, 'rs-cb-xp', stats.DOUBLE_EXP_CHANCE || 0);

    // XP per kill from character's combat exp
    if (char.combatExp) {
        setField(page, 'rs-cb-baseXp', char.combatExp);
    }

    // Loot value per kill from drop table
    const actionId = userData?.user?.action?.actionId;
    if (actionId && data.drops.byAction[actionId]) {
        const drops = data.drops.byAction[actionId];
        let avgLootValue = 0;
        for (const drop of drops) {
            const item = data.items.byId[drop.item];
            if (!item) continue;
            // Custom price > market minimum (multiplayer) > merchant sell price
            const customPrices = storage.getData('custom-prices') || {};
            const basePrice = getMode() === 'multiplayer'
                ? (item.attributes?.MIN_MARKET_PRICE || item.attributes?.SELL_PRICE || 0)
                : (item.attributes?.SELL_PRICE || 0);
            const price = customPrices[drop.item] ?? basePrice;
            const avgAmount = drop.amount ? ((1 + drop.amount) / 2) : 1;
            const chance = drop.chance ?? 1;
            avgLootValue += price * avgAmount * chance;
        }
        if (avgLootValue > 0) {
            setField(page, 'rs-cb-lootVal', Math.round(avgLootValue * 100) / 100);
        }
    }

    // Auto-detect food from equipped consumable
    const foodSlot = userData?.user?.equipment?.['200'];
    if (foodSlot) {
        const foodItem = data.items.byId[foodSlot.id];
        if (foodItem) {
            // Match by name first, then by HP
            const nameMatch = FOOD_TYPES.find(f => f.name === foodItem.name);
            const healVal = foodItem.stats?.global?.HEAL || 0;
            const hpMatch = FOOD_TYPES.find(f => f.hp === healVal && f.hp > 0);
            const match = nameMatch || hpMatch;
            if (match) {
                page.find('#rs-cb-food').val(match.name);
            }
        }
    }

    return true;
}

export function bindCombatEvents(page) {
    // Recalculate on any input change
    page.find('.rs-combat-input').on('input change', () => recalculate(page));

    // Auto-fetch stats when opening the tab
    if (hasAuth()) {
        (async () => {
            try {
                const userData = await api.getUser();
                if (applyUserStats(page, userData)) {
                    saveConfig(getConfig(page));
                    recalculate(page);
                }
            } catch (e) {
                page.find('#rs-cb-alert')
                    .text('Could not fetch your game stats. Try refreshing the page.')
                    .show();
            }
        })();
    }

    // Initial calculation
    recalculate(page);
}
