// Full Combat Simulator page for RiftScript
import * as events from '../core/events.js';
import * as storage from '../core/storage.js';
import { formatNumber, secondsToDuration, expToLevel, levelToExp } from '../core/util.js';
import { simulate, calculateResults } from '../features/combatCalc.js';
import { api } from '../core/api.js';
import { hasAuth } from '../core/auth.js';
import { data } from '../game/data.js';
import { getMode } from '../game/mode.js';

const NAV_ID = 'riftscript-combatsim-btn';
const PAGE_TAG = 'combatsim-page';
const ASSET_BASE = 'https://ironwoodrpg.com/assets';

let isOpen = false;
let selectedActionId = null;
let selectedRegion = 'forest';
let selectedMonsterType = 'normal';
let lastXpPerHour = 0;
let fetchedUserData = null;

// Combat skill IDs by region in Ironwood RPG
// Skills: OneHanded=6, TwoHanded=7, Ranged=8 are combat skills
// Actions with type MONSTER or ELITE are combat actions
// Region is determined by looking at monster damage percent fields

const REGIONS = [
    { id: 'forest', label: 'Forest' },
    { id: 'mountain', label: 'Mountain' },
    { id: 'ocean', label: 'Ocean' },
];

// ─── Time to Level ───────────────────────────────────────────

function totalXpToLevelInt(level) {
    if (level < 101) return Math.floor(1.2 * Math.pow(level, 3.5));
    return Math.floor(12e6 * Math.pow(Math.pow(3500, 0.01), level - 100));
}

function totalXpToLevel(level) {
    const floorL = Math.floor(level);
    const ceilL = Math.ceil(level);
    if (floorL === ceilL) return totalXpToLevelInt(level);
    const xpFloor = totalXpToLevelInt(floorL);
    const xpCeil = totalXpToLevelInt(ceilL);
    return xpFloor + (level - floorL) * (xpCeil - xpFloor);
}

function timeToLevel(startLevel, endLevel, xpPerHour) {
    if (xpPerHour <= 0 || startLevel < 1 || endLevel <= startLevel) return null;
    const xpNeeded = totalXpToLevel(endLevel) - totalXpToLevel(startLevel);
    return (xpNeeded / xpPerHour) * 3600;
}

// ─── Food Types ──────────────────────────────────────────────

const FOOD_TYPES = [
    { name: 'None', hp: 0, cost: 0 },
    { name: 'King Crab Pie', hp: 240, cost: 430 },
    { name: 'Shark Pie', hp: 210, cost: 305 },
    { name: 'Swordfish Pie', hp: 180, cost: 220 },
    { name: 'Lobster Pie', hp: 150, cost: 185 },
    { name: 'Bass Pie', hp: 120, cost: 150 },
    { name: 'Salmon Pie', hp: 90, cost: 110 },
    { name: 'Cod Pie', hp: 60, cost: 90 },
    { name: 'Shrimp Pie', hp: 30, cost: 65 },
    { name: 'Cooked King Crab', hp: 120, cost: 120 },
    { name: 'Cooked Shark', hp: 105, cost: 82 },
    { name: 'Cooked Swordfish', hp: 90, cost: 65 },
    { name: 'Cooked Lobster', hp: 75, cost: 55 },
    { name: 'Cooked Bass', hp: 60, cost: 40 },
    { name: 'Cooked Salmon', hp: 45, cost: 32 },
    { name: 'Cooked Cod', hp: 30, cost: 45 },
    { name: 'Cooked Shrimp', hp: 15, cost: 25 },
];

// ─── Init ────────────────────────────────────────────────────

export function initCombatSimPage() {
    setInterval(injectNavButton, 1000);

    events.on('page', (page) => {
        // Always remove our page when navigating away
        if (page.type !== 'combatsim') {
            $(PAGE_TAG).remove();
            $(`#${NAV_ID}`).removeClass('rs-nav-active');
            if (isOpen) {
                $('header-component div.wrapper > div.image').show();
                let headerName = page.type;
                headerName = headerName.charAt(0).toUpperCase() + headerName.slice(1);
                $('header-component div.wrapper > div.title').text(headerName);
            }
            isOpen = false;
        }
    });
}

export function openCombatSimPage() {
    openPage();
}

// ─── Nav Button ──────────────────────────────────────────────

function injectNavButton() {
    if ($(`#${NAV_ID}`).length) return;
    const rsBtn = $('#riftscript-menu-btn');
    if (!rsBtn.length) return;

    const btn = $(`
        <button id="${NAV_ID}" type="button" class="riftscript-nav-btn">
            <div class="riftscript-nav-logo" style="background:#e85d4a">CS</div>
            <div class="name">Combat Sim</div>
        </button>
    `);

    btn.on('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen) {
            cleanupPage();
            // Navigate to settings
            window.history.pushState({}, '', 'settings');
            window.history.pushState({}, '', 'settings');
            window.history.back();
        } else {
            openPage();
        }
    });

    rsBtn.after(btn);
}

// ─── Page Lifecycle ──────────────────────────────────────────

function triggerNav(page) {
    window.history.pushState({}, '', page);
    window.history.pushState({}, '', page);
    window.history.back();
}

async function openPage() {
    isOpen = true;

    if ($(PAGE_TAG).length) {
        $(PAGE_TAG).remove();
    } else {
        // Navigate to merchant first, then settings, then remove settings
        triggerNav('merchant');
        await waitFor('merchant-page', 3000);
        triggerNav('settings');
        await waitFor('settings-page', 3000);
        $('settings-page').remove();
    }

    $('header-component div.wrapper > div.title').text('Combat Simulator');
    $('header-component div.wrapper > div.image').hide();
    $('nav-component button').removeClass('active-link');
    $(`#${NAV_ID}`).addClass('rs-nav-active');

    history.pushState({}, '', 'combatsim');
    renderPage();
}

function cleanupPage() {
    isOpen = false;
    selectedActionId = null;
    lastXpPerHour = 0;
    fetchedUserData = null;
    $(PAGE_TAG).remove();
    $(`#${NAV_ID}`).removeClass('rs-nav-active');
    $('header-component div.wrapper > div.image').show();
}

function waitFor(selector, timeout = 3000) {
    return new Promise((resolve) => {
        if ($(selector).length) return resolve();
        const interval = setInterval(() => {
            if ($(selector).length) { clearInterval(interval); resolve(); }
        }, 50);
        setTimeout(() => { clearInterval(interval); resolve(); }, timeout);
    });
}

// ─── Equipment Stats ─────────────────────────────────────────

function sumEquipmentStats(equipment) {
    const totals = {};
    if (!equipment || !data.ready) return totals;
    for (const [slot, entry] of Object.entries(equipment)) {
        if (!entry) continue;
        const item = data.items.byId[entry.id];
        if (!item?.stats) continue;
        if (item.stats.global) {
            for (const [key, val] of Object.entries(item.stats.global)) {
                totals[key] = (totals[key] || 0) + val;
            }
        }
        if (item.stats.bySkill) {
            for (const [statKey, skillMap] of Object.entries(item.stats.bySkill)) {
                for (const val of Object.values(skillMap)) {
                    totals[statKey] = (totals[statKey] || 0) + val;
                }
            }
        }
    }
    return totals;
}

// ─── Data Helpers ────────────────────────────────────────────

function getCombatActions() {
    if (!data.ready || !data.actions?.list) return [];
    return data.actions.list.filter(a => a.type === 'MONSTER' || a.type === 'ELITE');
}

// Region mapping based on action ID ranges
// Normal: Forest 300-312, Mountain 304/307/306/311/315/324/325, Ocean 317-323
// Elite: Forest 410-415, Mountain 420-425, Ocean 430-435
// Monster IDs: Forest 1-12 + 25, Mountain 4/7/6/11/15/24/26, Ocean 17-23 + 27
const FOREST_MONSTERS = new Set([1, 2, 3, 8, 9, 10, 12, 25, 50, 51, 52, 53, 54, 55]);
const MOUNTAIN_MONSTERS = new Set([4, 5, 6, 7, 11, 15, 24, 26, 60, 61, 62, 63, 64, 65]);
const OCEAN_MONSTERS = new Set([17, 18, 19, 20, 21, 22, 23, 27, 70, 71, 72, 73, 74, 75]);

function getMonsterRegion(monster) {
    if (!monster) return 'forest';
    // Check live combat data fields first (from getUser)
    if (monster.forestDamagePercent || monster.forestBlockPercent) return 'forest';
    if (monster.mountainDamagePercent || monster.mountainBlockPercent) return 'mountain';
    if (monster.oceanDamagePercent || monster.oceanBlockPercent) return 'ocean';
    // Static data: use monster ID mapping
    const id = parseInt(monster.id);
    if (MOUNTAIN_MONSTERS.has(id)) return 'mountain';
    if (OCEAN_MONSTERS.has(id)) return 'ocean';
    return 'forest';
}

function getActionRegion(action) {
    if (!action?.monster) return 'forest';
    // Elite action IDs directly indicate region
    const aid = parseInt(action.id);
    if (aid >= 420 && aid <= 425) return 'mountain';
    if (aid >= 430 && aid <= 435) return 'ocean';
    if (aid >= 410 && aid <= 415) return 'forest';
    // Normal: use monster ID
    const monster = data.monsters?.byId?.[action.monster];
    return getMonsterRegion(monster);
}

function getActionsByRegion(region) {
    const combatActions = getCombatActions();
    return combatActions.filter(a => getActionRegion(a) === region)
        .sort((a, b) => (a.level || 0) - (b.level || 0));
}

function getMonsterImage(action, monster) {
    // Image field already contains path like "monsters/red-frog.png"
    if (monster?.image) return `${ASSET_BASE}/${monster.image}`;
    if (action?.image) return `${ASSET_BASE}/${action.image}`;
    return '';
}

function getItemImage(item) {
    if (!item?.image) return '';
    // Item image may or may not include the path prefix
    if (item.image.startsWith('items/')) return `${ASSET_BASE}/${item.image}`;
    return `${ASSET_BASE}/items/${item.image}`;
}

function getMonsterDamagePercent(monster) {
    if (!monster) return 0;
    return (monster.eliteDamagePercent || 0)
         + (monster.forestDamagePercent || 0)
         + (monster.mountainDamagePercent || 0)
         + (monster.oceanDamagePercent || 0);
}

function getMonsterBlockPercent(monster) {
    if (!monster) return 0;
    return monster.armour
        || ((monster.eliteBlockPercent || 0)
          + (monster.forestBlockPercent || 0)
          + (monster.mountainBlockPercent || 0)
          + (monster.oceanBlockPercent || 0));
}

// ─── Loot Calculation ────────────────────────────────────────

function getLootValuePerKill(actionId) {
    if (!actionId || !data.drops.byAction[actionId]) return 0;
    const drops = data.drops.byAction[actionId];
    const customPrices = storage.getData('custom-prices') || {};
    let total = 0;
    for (const drop of drops) {
        const item = data.items.byId[drop.item];
        if (!item) continue;
        const basePrice = getMode() === 'multiplayer'
            ? (item.attributes?.MIN_MARKET_PRICE || item.attributes?.SELL_PRICE || 0)
            : (item.attributes?.SELL_PRICE || 0);
        const price = customPrices[drop.item] ?? basePrice;
        const avgAmount = drop.amount ? ((1 + drop.amount) / 2) : 1;
        const chance = drop.chance ?? 1;
        total += price * avgAmount * chance;
    }
    return total;
}

function getLootBreakdown(actionId, killsPerHour) {
    if (!actionId || !data.drops.byAction[actionId]) return [];
    const drops = data.drops.byAction[actionId];
    const customPrices = storage.getData('custom-prices') || {};
    const breakdown = [];
    for (const drop of drops) {
        const item = data.items.byId[drop.item];
        if (!item) continue;
        const basePrice = getMode() === 'multiplayer'
            ? (item.attributes?.MIN_MARKET_PRICE || item.attributes?.SELL_PRICE || 0)
            : (item.attributes?.SELL_PRICE || 0);
        const price = customPrices[drop.item] ?? basePrice;
        const avgAmount = drop.amount ? ((1 + drop.amount) / 2) : 1;
        const chance = drop.chance ?? 1;
        const qtyPerHour = avgAmount * chance * killsPerHour;
        const goldPerHour = qtyPerHour * price;
        if (chance > 0) {
            breakdown.push({
                itemId: drop.item,
                name: item.name,
                image: item.image,
                chance,
                avgAmount,
                amount: drop.amount,
                qtyPerHour,
                price,
                goldPerHour,
            });
        }
    }
    breakdown.sort((a, b) => b.goldPerHour - a.goldPerHour);
    return breakdown;
}

// ─── Render Page ─────────────────────────────────────────────

function renderPage() {
    $(PAGE_TAG).remove();

    const c = storage.getData('combatsim-config') || {};

    const foodOptions = FOOD_TYPES.map(f =>
        `<option value="${f.name}" ${(c.foodType || 'None') === f.name ? 'selected' : ''}>${f.name}${f.hp ? ` (${f.hp} HP)` : ''}</option>`
    ).join('');

    const regionTabs = REGIONS.map(r =>
        `<button class="cs-region-tab${r.id === selectedRegion ? ' active' : ''}" data-region="${r.id}">${r.label}</button>`
    ).join('');

    const page = $(`
        <${PAGE_TAG}>
            <div class="cs-alert" id="cs-alert" style="display:none"></div>
            <div class="cs-layout">

                <!-- LEFT COLUMN: Monster Card + Consumables -->
                <div class="cs-col-main">

                    <!-- Monster Card -->
                    <div class="cs-card" id="cs-monster-card">
                        <div class="cs-card-header">
                            <span>Monster</span>
                            <span id="cs-selected-monster-name"></span>
                        </div>
                        <div id="cs-monster-detail">
                            <div style="opacity:0.4;font-size:0.85em;padding:32px 16px;text-align:center">Select a monster from the list</div>
                        </div>
                    </div>

                    <!-- Consumables Card -->
                    <div class="cs-card">
                        <div class="cs-card-header"><span>Consumables</span></div>
                        <div class="cs-control-grid">
                            <div class="cs-control-row">
                                <span>Food</span>
                                <select class="cs-input cs-select" id="cs-food">${foodOptions}</select>
                            </div>
                            <div class="cs-control-row" style="opacity:0.4">
                                <span>Combat Potion</span>
                                <span style="font-size:0.8em">Coming soon</span>
                            </div>
                            <div class="cs-control-row" style="opacity:0.4">
                                <span>Sigil</span>
                                <span style="font-size:0.8em">Coming soon</span>
                            </div>
                        </div>
                    </div>

                    <!-- Loot Breakdown Card (shown after sim) -->
                    <div class="cs-card" id="cs-loot-card" style="display:none">
                        <div class="cs-card-header"><span>Loot Breakdown</span></div>
                        <div id="cs-loot-body"></div>
                    </div>
                </div>

                <!-- RIGHT COLUMN: Skill, Monster List, Sim Controls, Results -->
                <div class="cs-col-side">

                    <!-- Skill Header Card -->
                    <div class="cs-card" id="cs-skill-card" style="display:none">
                        <div class="cs-skill-header">
                            <span class="cs-skill-level" id="cs-skill-name">Combat</span>
                            <span class="cs-skill-xp" id="cs-skill-level"></span>
                        </div>
                        <div id="cs-skill-xp-bar" style="padding:0 16px 12px">
                            <div class="cs-xp-bar" style="margin-top:8px">
                                <div class="cs-xp-fill" id="cs-xp-fill" style="width:0%"></div>
                            </div>
                            <div style="display:flex;justify-content:space-between;font-size:0.7em;color:rgba(255,255,255,0.35);margin-top:4px">
                                <span id="cs-xp-current">0 XP</span>
                                <span id="cs-xp-next">0 XP</span>
                            </div>
                        </div>
                    </div>

                    <!-- Region Tabs -->
                    <div class="cs-card">
                        <div class="cs-region-tabs">
                            ${regionTabs}
                        </div>
                    </div>

                    <!-- Monster List -->
                    <div class="cs-card">
                        <div class="cs-card-header"><span>Actions</span></div>
                        <div class="cs-type-tabs">
                            <button class="cs-type-tab${selectedMonsterType === 'normal' ? ' active' : ''}" data-type="normal">Normal</button>
                            <button class="cs-type-tab${selectedMonsterType === 'elite' ? ' active' : ''}" data-type="elite">Elite</button>
                        </div>
                        <div class="cs-monster-list" id="cs-monster-list">
                        </div>
                    </div>

                    <!-- Simulation Controls -->
                    <div class="cs-card">
                        <div class="cs-card-header"><span>Simulation</span></div>
                        <div class="cs-control-grid">
                            ${controlInput('Duration', 'cs-simHours', c.simHours || 1, 1, 'hours')}
                            ${controlInput('Efficiency', 'cs-eff', c.efficiency || 0, 0.01, '%')}
                            ${controlInput('Loot Bonus', 'cs-loot', c.lootBonus || 0, 0.01, '%')}
                            ${controlInput('XP Bonus', 'cs-xp', c.xpBonus || 0, 0.01, '%')}
                            ${controlInput('Region Adv.', 'cs-regionAdv', c.regionAdvantage || 1, 0.1, 'x')}
                            ${controlInput('Revive Time', 'cs-revive', c.reviveSpeed || 900, 1, 'sec')}
                        </div>
                        <div style="padding:12px 16px">
                            <button class="cs-simulate-btn" id="cs-run">SIMULATE</button>
                        </div>
                    </div>

                    <!-- Results Card -->
                    <div class="cs-card" id="cs-results-card" style="display:none">
                        <div class="cs-card-header"><span>Results</span></div>
                        <div id="cs-result-hero" class="cs-result-hero"></div>
                        <div id="cs-results-body"></div>
                    </div>

                    <!-- Time to Level Card -->
                    <div class="cs-card" id="cs-ttl-card" style="display:none">
                        <div class="cs-card-header"><span>Time to Level</span></div>
                        <div class="cs-control-grid">
                            ${controlInput('Current Level', 'cs-ttl-start', c.ttlStart || 1, 1)}
                            ${controlInput('Target Level', 'cs-ttl-end', c.ttlEnd || 100, 1)}
                        </div>
                        <div id="cs-ttl-result" class="cs-ttl-result"></div>
                    </div>

                </div>
            </div>
        </${PAGE_TAG}>
    `);

    // Bind region tab clicks
    page.find('.cs-region-tab').on('click', function () {
        selectedRegion = $(this).data('region');
        page.find('.cs-region-tab').removeClass('active');
        $(this).addClass('active');
        renderMonsterList(page);
    });

    // Bind type tab clicks (Normal/Elite)
    page.find('.cs-type-tab').on('click', function () {
        selectedMonsterType = $(this).data('type');
        page.find('.cs-type-tab').removeClass('active');
        $(this).addClass('active');
        renderMonsterList(page);
    });

    // Bind simulate button
    page.find('#cs-run').on('click', () => runSimulation(page));

    // Bind TTL inputs
    page.find('#cs-ttl-start, #cs-ttl-end').on('input', () => updateTTL(page));

    // Insert into game
    $('div.padding > div.wrapper > router-outlet').after(page);

    // Render initial monster list
    renderMonsterList(page);

    // Auto-fetch stats
    if (hasAuth()) {
        fetchStats(page);
    }
}

// ─── Input Helpers ───────────────────────────────────────────

function controlInput(label, id, value, step = 1, suffix = '') {
    return `
        <div class="cs-control-row">
            <span>${label}${suffix ? ` <span class="cs-suffix">${suffix}</span>` : ''}</span>
            <span style="display:flex;align-items:center;gap:6px">
                <span class="cs-fetched" id="${id}-fetched"></span>
                <input class="cs-input" id="${id}" type="number" value="${value}" step="${step}">
            </span>
        </div>
    `;
}

// ─── Monster List ────────────────────────────────────────────

function renderMonsterList(page) {
    const container = page.find('#cs-monster-list');
    container.empty();

    if (!data.ready) {
        container.html('<div style="padding:16px;text-align:center;opacity:0.4;font-size:0.85em">Loading game data...</div>');
        return;
    }

    const typeFilter = selectedMonsterType === 'elite' ? 'ELITE' : 'MONSTER';
    const actions = getActionsByRegion(selectedRegion).filter(a => a.type === typeFilter);

    if (!actions.length) {
        container.html('<div style="padding:16px;text-align:center;opacity:0.4;font-size:0.85em">No monsters found</div>');
        return;
    }

    for (const action of actions) {
        const monster = data.monsters?.byId?.[action.monster];
        const imgSrc = getMonsterImage(action, monster);
        const isActive = selectedActionId === action.id;
        const xpPerAction = action.exp || 0;

        const entry = $(`
            <button class="cs-monster-entry${isActive ? ' active' : ''}" data-action-id="${action.id}">
                ${imgSrc ? `<img class="cs-monster-entry-img" src="${imgSrc}" alt="">` : '<div style="width:32px;height:32px;background:rgba(255,255,255,0.06);border-radius:4px"></div>'}
                <span class="cs-monster-entry-name">${action.name}</span>
                <span class="cs-monster-entry-xp">${xpPerAction} XP/s</span>
                <span class="cs-monster-entry-level">Lv. ${action.level || '?'}</span>
            </button>
        `);

        entry.on('click', () => {
            selectedActionId = action.id;
            page.find('#cs-monster-list .cs-monster-entry').removeClass('active');
            entry.addClass('active');
            selectMonster(page, action.id);
        });

        container.append(entry);
    }
}

// ─── Select Monster ──────────────────────────────────────────

function selectMonster(page, actionId) {
    const action = data.actions?.byId?.[actionId];
    if (!action) return;

    const monster = data.monsters?.byId?.[action.monster];
    if (!monster) return;

    const imgSrc = getMonsterImage(action, monster);
    const dmgPct = getMonsterDamagePercent(monster);
    const blkPct = getMonsterBlockPercent(monster);
    const isElite = action.type === 'ELITE';

    // Build stat badges
    const badges = [];
    badges.push(badgeHtml(`${formatNumber(monster.health || 0)} HP`, 'neutral'));
    badges.push(badgeHtml(`${formatNumber(monster.attack || 0)} Damage`, 'red'));
    badges.push(badgeHtml(`${monster.speed || 2}s Speed`, 'neutral'));
    if (dmgPct) badges.push(badgeHtml(`+${formatNumber(dmgPct)}% Damage`, 'red'));
    if (blkPct) badges.push(badgeHtml(`${formatNumber(blkPct)}% Block`, 'green'));
    if (isElite) badges.push(badgeHtml('ELITE', 'elite'));

    const detailHtml = `
        <div class="cs-monster-card">
            <div style="display:flex;gap:16px;padding:16px;align-items:flex-start">
                <div class="cs-monster-image">
                    ${imgSrc ? `<img src="${imgSrc}" alt="${action.name}" style="width:80px;height:80px;image-rendering:pixelated">` : '<div style="width:80px;height:80px;background:rgba(255,255,255,0.06);border-radius:6px"></div>'}
                </div>
                <div style="flex:1">
                    <div class="cs-monster-name" style="padding:0">${action.name}</div>
                    <div style="font-size:0.75em;color:rgba(255,255,255,0.35);margin-bottom:8px">Level ${action.level || '?'} ${isElite ? '- Elite' : ''}</div>
                    <div class="cs-stat-badges">
                        ${badges.join('')}
                    </div>
                </div>
            </div>
        </div>
        <div id="cs-drops-table"></div>
    `;

    page.find('#cs-monster-detail').html(detailHtml);
    page.find('#cs-selected-monster-name').text(action.name);

    // Render drops table
    renderDropsTable(page, actionId);

    // Update loot value per kill
    const lootVal = getLootValuePerKill(actionId);
    page.find('#cs-loot-card').hide();
}

function badgeHtml(text, variant) {
    return `<span class="cs-badge cs-badge-${variant}">${text}</span>`;
}

// ─── Drops Table ─────────────────────────────────────────────

function renderDropsTable(page, actionId) {
    const container = page.find('#cs-drops-table');
    container.empty();

    if (!actionId || !data.drops?.byAction?.[actionId]) {
        container.html('<div style="padding:12px 16px;font-size:0.8em;opacity:0.4">No drop data available</div>');
        return;
    }

    const drops = data.drops.byAction[actionId];
    if (!drops.length) {
        container.html('<div style="padding:12px 16px;font-size:0.8em;opacity:0.4">No drops</div>');
        return;
    }

    let html = '<div class="cs-drops-table">';

    for (const drop of drops) {
        const item = data.items.byId[drop.item];
        if (!item) continue;
        const imgSrc = getItemImage(item);
        const chance = drop.chance ?? 1;
        const amountMin = 1;
        const amountMax = drop.amount || 1;
        const amountStr = amountMin === amountMax ? `${amountMin}` : `${amountMin}-${amountMax}`;
        const chancePct = (chance * 100);
        const chanceStr = chancePct >= 100 ? '100%' : chancePct >= 1 ? `${formatNumber(chancePct)}%` : `${formatNumber(chancePct)}%`;
        const rarityClass = getRarityClass(chance);

        html += `
            <div class="cs-drop-row">
                ${imgSrc ? `<img class="cs-drop-img" src="${imgSrc}" alt="">` : ''}
                <span class="cs-drop-name">${item.name}</span>
                <span class="cs-drop-amount">x${amountStr}</span>
                <span class="cs-drop-chance ${rarityClass}">${chanceStr}</span>
            </div>
        `;
    }

    html += '</div>';
    container.html(html);
}

function getRarityClass(chance) {
    if (chance >= 1) return 'cs-rarity-always';
    if (chance >= 0.5) return 'cs-rarity-common';
    if (chance >= 0.1) return 'cs-rarity-uncommon';
    if (chance >= 0.01) return 'cs-rarity-rare';
    return 'cs-rarity-legendary';
}

// ─── Fetch Player Stats ──────────────────────────────────────

async function fetchStats(page) {
    try {
        const userData = await api.getUser();
        fetchedUserData = userData;
        const history = userData?.user?.action?.history;

        // Equipment bonuses
        const stats = sumEquipmentStats(userData?.user?.equipment);
        setFetched(page, 'cs-eff', stats.EFFICIENCY_CHANCE || 0);
        setFetched(page, 'cs-loot', stats.DOUBLE_LOOT_CHANCE || 0);
        setFetched(page, 'cs-xp', stats.DOUBLE_EXP_CHANCE || 0);

        // Auto-detect food
        const foodSlot = userData?.user?.equipment?.['200'];
        if (foodSlot) {
            const foodItem = data.items.byId[foodSlot.id];
            if (foodItem) {
                const nameMatch = FOOD_TYPES.find(f => f.name === foodItem.name);
                const healVal = foodItem.stats?.global?.HEAL || 0;
                const hpMatch = FOOD_TYPES.find(f => f.hp === healVal && f.hp > 0);
                const match = nameMatch || hpMatch;
                if (match) page.find('#cs-food').val(match.name);
            }
        }

        // Show skill info if actively fighting
        const actionId = userData?.user?.action?.actionId;
        const actionData = data.actions?.byId?.[actionId];
        if (actionData && (actionData.type === 'MONSTER' || actionData.type === 'ELITE')) {
            // Pre-select the current combat action's region, type, and monster
            const actionRegion = getActionRegion(actionData);
            selectedRegion = actionRegion;
            selectedMonsterType = actionData.type === 'ELITE' ? 'elite' : 'normal';
            page.find('.cs-region-tab').removeClass('active');
            page.find(`.cs-region-tab[data-region="${actionRegion}"]`).addClass('active');
            page.find('.cs-type-tab').removeClass('active');
            page.find(`.cs-type-tab[data-type="${selectedMonsterType}"]`).addClass('active');
            renderMonsterList(page);

            // Auto-select the monster
            selectedActionId = actionId;
            page.find(`#cs-monster-list .cs-monster-entry[data-action-id="${actionId}"]`).addClass('active');
            selectMonster(page, actionId);

            // Show skill card
            const skillData = data.skills?.byId?.[actionData.skill];
            const skills = userData?.user?.skills;
            if (skillData && skills) {
                const skillExp = skills[actionData.skill]?.exp;
                if (skillExp !== undefined) {
                    const level = expToLevel(skillExp);
                    const xpForCurrent = levelToExp(level);
                    const xpForNext = levelToExp(level + 1);
                    const xpProgress = skillExp - xpForCurrent;
                    const xpNeeded = xpForNext - xpForCurrent;
                    const pct = xpNeeded > 0 ? Math.min(100, (xpProgress / xpNeeded) * 100) : 0;

                    page.find('#cs-skill-name').text(skillData.displayName || skillData.technicalName || 'Combat');
                    page.find('#cs-skill-level').text(`Level ${level}`);
                    page.find('#cs-xp-fill').css('width', `${pct}%`);
                    page.find('#cs-xp-current').text(`${formatNumber(xpProgress)} XP`);
                    page.find('#cs-xp-next').text(`${formatNumber(xpNeeded)} XP`);
                    page.find('#cs-skill-card').show();

                    // Set TTL start level
                    page.find('#cs-ttl-start').val(level);
                }
            }
        }

        // Scroll the selected monster into view
        const activeEntry = page.find('#cs-monster-list .cs-monster-entry.active');
        if (activeEntry.length) {
            const listEl = page.find('#cs-monster-list')[0];
            const entryEl = activeEntry[0];
            if (listEl && entryEl) {
                const listRect = listEl.getBoundingClientRect();
                const entryRect = entryEl.getBoundingClientRect();
                if (entryRect.top < listRect.top || entryRect.bottom > listRect.bottom) {
                    entryEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            }
        }

    } catch (e) {
        page.find('#cs-alert')
            .text('Could not fetch your game stats. Try refreshing the page.')
            .show();
    }
}

function setFetched(page, id, value) {
    page.find(`#${id}`).val(value);
    page.find(`#${id}-fetched`).text(value);
}

// ─── Build Sim Config from Selected Monster + Controls ───────

function buildSimConfig(page) {
    const val = (id) => parseFloat(page.find(`#${id}`).val()) || 0;
    const foodName = page.find('#cs-food').val();
    const food = FOOD_TYPES.find(f => f.name === foodName) || FOOD_TYPES[0];

    // Get player and monster stats from fetched user data or from the monster data
    let playerAttack = 0, playerSpeed = 2.5, damagePercent = 0, blockPercent = 0;
    let accuracy = 90, evasion = 0, playerHealth = 100;
    let monsterHealth = 0, monsterAttack = 0, monsterSpeed = 2, monsterDamage = 0, monsterBlock = 0;
    let baseXpPerKill = 0;

    const history = fetchedUserData?.user?.action?.history;
    if (history?.character) {
        const char = history.character;
        playerAttack = char.damage || 0;
        playerSpeed = char.speed || 2.5;
        blockPercent = char.armour || 0;
        accuracy = char.bonusAccuracy || 90;
        evasion = char.bonusEvasion || 0;
        playerHealth = char.maxHealth || 100;

        // Region damage from character
        if (selectedActionId) {
            const action = data.actions?.byId?.[selectedActionId];
            const monster = action?.monster ? data.monsters?.byId?.[action.monster] : null;
            if (monster) {
                let regionDmg = 0;
                if (monster.forestDamagePercent) regionDmg = char.forestDamagePercent || 0;
                else if (monster.mountainDamagePercent) regionDmg = char.mountainDamagePercent || 0;
                else if (monster.oceanDamagePercent) regionDmg = char.oceanDamagePercent || 0;
                damagePercent = (char.eliteDamagePercent || 0) + regionDmg;
            } else {
                damagePercent = char.eliteDamagePercent || 0;
            }
        }

        if (char.combatExp) baseXpPerKill = char.combatExp;
    }

    // Monster stats from selected monster
    if (selectedActionId) {
        const action = data.actions?.byId?.[selectedActionId];
        const monster = action?.monster ? data.monsters?.byId?.[action.monster] : null;
        if (monster) {
            monsterHealth = monster.health || 0;
            monsterAttack = monster.attack || 0;
            monsterSpeed = monster.speed || 2;
            monsterDamage = getMonsterDamagePercent(monster);
            monsterBlock = getMonsterBlockPercent(monster);
        }
        if (action?.exp) baseXpPerKill = action.exp;
    }

    // If we have fetched history for this specific monster, use those stats instead
    // (they include all buffs, equipment, structures, etc.)
    if (history?.monster && history?.character && fetchedUserData?.user?.action?.actionId === selectedActionId) {
        const mon = history.monster;
        const char = history.character;
        playerAttack = char.damage || playerAttack;
        playerSpeed = char.speed || playerSpeed;
        blockPercent = char.armour || blockPercent;
        accuracy = char.bonusAccuracy || accuracy;
        evasion = char.bonusEvasion || evasion;
        playerHealth = char.maxHealth || playerHealth;
        monsterHealth = mon.maxHealth || monsterHealth;
        monsterAttack = mon.damage || monsterAttack;
        monsterSpeed = mon.speed || monsterSpeed;
        monsterDamage = (mon.eliteDamagePercent || 0)
                      + (mon.forestDamagePercent || 0)
                      + (mon.mountainDamagePercent || 0)
                      + (mon.oceanDamagePercent || 0);
        monsterBlock = mon.armour
                     || ((mon.eliteBlockPercent || 0)
                       + (mon.forestBlockPercent || 0)
                       + (mon.mountainBlockPercent || 0)
                       + (mon.oceanBlockPercent || 0));

        if (char.combatExp) baseXpPerKill = char.combatExp;
    }

    const lootVal = selectedActionId ? getLootValuePerKill(selectedActionId) : 0;

    return {
        playerAttack,
        playerSpeed,
        damagePercent,
        blockPercent,
        accuracy,
        evasion,
        playerHealth,
        foodHp: food.hp,
        foodCost: food.cost,
        foodType: foodName,
        monsterHealth,
        monsterAttack,
        monsterSpeed,
        monsterDamage,
        monsterBlock,
        efficiency: val('cs-eff'),
        lootBonus: val('cs-loot'),
        xpBonus: val('cs-xp'),
        baseXpPerKill,
        lootValuePerKill: lootVal,
        otherCostPerHour: 0,
        simHours: val('cs-simHours') || 1,
        regionAdvantage: val('cs-regionAdv') || 1,
        reviveSpeed: val('cs-revive') || 900,
        ttlStart: val('cs-ttl-start'),
        ttlEnd: val('cs-ttl-end'),
    };
}

// ─── Run Simulation ──────────────────────────────────────────

function runSimulation(page) {
    if (!selectedActionId) {
        page.find('#cs-alert')
            .text('Select a monster from the list first.')
            .show();
        setTimeout(() => page.find('#cs-alert').fadeOut(), 3000);
        return;
    }

    const config = buildSimConfig(page);

    // Validate
    if (config.monsterHealth <= 0) {
        page.find('#cs-alert')
            .text('Monster has no health. Cannot simulate.')
            .show();
        setTimeout(() => page.find('#cs-alert').fadeOut(), 3000);
        return;
    }

    // Save config
    storage.save('combatsim-config', {
        foodType: config.foodType,
        simHours: config.simHours,
        efficiency: config.efficiency,
        lootBonus: config.lootBonus,
        xpBonus: config.xpBonus,
        regionAdvantage: config.regionAdvantage,
        reviveSpeed: config.reviveSpeed,
        ttlStart: config.ttlStart,
        ttlEnd: config.ttlEnd,
    });

    // Button feedback
    const btn = page.find('#cs-run');
    btn.text('Simulating...').prop('disabled', true);

    setTimeout(() => {
        const sim = simulate(config);
        const results = calculateResults(config, sim);
        const fmt = (n) => formatNumber(Math.round(n));

        // Hero result
        page.find('#cs-result-hero').html(`
            <div class="cs-hero-number">${fmt(sim.finalKPH)}</div>
            <div class="cs-hero-label">kills / hour</div>
        `);

        // Results body
        const profitClass = results.profitPerHour >= 0 ? 'cs-positive' : 'cs-negative';
        page.find('#cs-results-body').html(`
            <div class="cs-result-row"><span>Food/Hr</span><span>${fmt(sim.foodPerHour)}</span></div>
            ${sim.playerDefeats > 0 ? `<div class="cs-result-row"><span>Deaths</span><span class="cs-negative">${sim.playerDefeats}</span></div>` : ''}
            <div class="cs-result-row"><span>XP/Hr</span><span>${fmt(results.xpPerHour)}</span></div>
            <div class="cs-divider"></div>
            <div class="cs-result-row"><span>Loot/Hr</span><span>${fmt(results.lootPerHour)}</span></div>
            <div class="cs-result-row"><span>Food Cost/Hr</span><span class="cs-negative">-${fmt(results.foodCostPerHour)}</span></div>
            ${results.totalCostPerHour - results.foodCostPerHour > 0 ? `
                <div class="cs-result-row"><span>Other Cost/Hr</span><span class="cs-negative">-${fmt(results.totalCostPerHour - results.foodCostPerHour)}</span></div>
            ` : ''}
            <div class="cs-divider"></div>
            <div class="cs-result-row cs-result-profit"><span>Profit/Hr</span><span class="${profitClass}">${fmt(results.profitPerHour)}</span></div>
        `);

        page.find('#cs-results-card').show();

        // Loot breakdown
        if (selectedActionId) {
            const loot = getLootBreakdown(selectedActionId, sim.finalKPH * (1 + (config.lootBonus || 0) / 100));
            if (loot.length) {
                let lootHtml = '';
                for (const item of loot) {
                    const imgSrc = item.image ? getItemImage(item) : '';
                    lootHtml += `
                        <div class="cs-loot-row">
                            ${imgSrc ? `<img class="cs-loot-img" src="${imgSrc}">` : ''}
                            <span class="cs-loot-name">${item.name}</span>
                            <span class="cs-loot-qty">${fmt(item.qtyPerHour)}/hr</span>
                            <span class="cs-loot-gold">${fmt(item.goldPerHour)}g</span>
                        </div>
                    `;
                }
                page.find('#cs-loot-body').html(lootHtml);
                page.find('#cs-loot-card').show();
            }
        }

        // Time to Level
        page.find('#cs-ttl-card').show();
        updateTTL(page, results.xpPerHour);

        btn.text('SIMULATE').prop('disabled', false);
    }, 50);
}

// ─── Time to Level ───────────────────────────────────────────

function updateTTL(page, xpPerHour) {
    if (xpPerHour !== undefined) lastXpPerHour = xpPerHour;
    const startLevel = parseFloat(page.find('#cs-ttl-start').val()) || 1;
    const endLevel = parseFloat(page.find('#cs-ttl-end').val()) || 100;

    if (lastXpPerHour <= 0) {
        page.find('#cs-ttl-result').html('<span style="opacity:0.4">Run simulation first</span>');
        return;
    }

    const seconds = timeToLevel(startLevel, endLevel, lastXpPerHour);
    if (seconds === null) {
        page.find('#cs-ttl-result').html('<span style="opacity:0.4">Invalid levels</span>');
        return;
    }

    page.find('#cs-ttl-result').html(`
        <div class="cs-ttl-time">${secondsToDuration(seconds)}</div>
        <div class="cs-ttl-label">at ${formatNumber(Math.round(lastXpPerHour))} XP/hr</div>
    `);
}
