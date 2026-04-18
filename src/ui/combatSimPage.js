// Full Combat Simulator page for RiftScript
import * as events from '../core/events.js';
import * as storage from '../core/storage.js';
import { formatNumber, secondsToDuration, expToLevel, levelToExp } from '../core/util.js';
import { simulate, calculateResults } from '../features/combatCalc.js';
import { calculateEfficiency, calculateXpModifiers, calculateLootModifiers, calculateDamageBlock, calculateConsumableCosts, calculateGuildContribution } from '../features/modifiers.js';
import { api } from '../core/api.js';
import { hasAuth } from '../core/auth.js';
import { data } from '../game/data.js';
import { getMode } from '../game/mode.js';

let NAV_ID = "riftscript-combatsim-btn";
let PAGE_TAG = "combatsim-page";
let ASSET_BASE = "https://ironwoodrpg.com/assets";
let isOpen = false;
let selectedActionId = null;
let selectedRegion = "forest";
let selectedMonsterType = "normal";
let lastXpPerHour = 0;
let fetchedUserData = null;
let REGIONS = [
    { id: "forest", label: "Forest" },
    { id: "mountain", label: "Mountain" },
    { id: "ocean", label: "Ocean" }
  ];
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
    return xpNeeded / xpPerHour * 3600;
  }
let FOOD_TYPES = [
    { name: "None", hp: 0, cost: 0 },
    { name: "King Crab Pie", hp: 240, cost: 430 },
    { name: "Shark Pie", hp: 210, cost: 305 },
    { name: "Swordfish Pie", hp: 180, cost: 220 },
    { name: "Lobster Pie", hp: 150, cost: 185 },
    { name: "Bass Pie", hp: 120, cost: 150 },
    { name: "Salmon Pie", hp: 90, cost: 110 },
    { name: "Cod Pie", hp: 60, cost: 90 },
    { name: "Shrimp Pie", hp: 30, cost: 65 },
    { name: "Cooked King Crab", hp: 120, cost: 120 },
    { name: "Cooked Shark", hp: 105, cost: 82 },
    { name: "Cooked Swordfish", hp: 90, cost: 65 },
    { name: "Cooked Lobster", hp: 75, cost: 55 },
    { name: "Cooked Bass", hp: 60, cost: 40 },
    { name: "Cooked Salmon", hp: 45, cost: 32 },
    { name: "Cooked Cod", hp: 30, cost: 45 },
    { name: "Cooked Shrimp", hp: 15, cost: 25 }
  ];
let POTION_TYPES = [
    { name: "None", type: "none", cost: 0, effect: 0 },
    { name: "Divine XP Potion", type: "xp", cost: 8e3, effect: 60 },
    { name: "Super XP Potion", type: "xp", cost: 3500, effect: 40 },
    { name: "XP Potion", type: "xp", cost: 1200, effect: 20 },
    { name: "Divine Loot Potion", type: "loot", cost: 8e3, effect: 60 },
    { name: "Super Loot Potion", type: "loot", cost: 3500, effect: 40 },
    { name: "Loot Potion", type: "loot", cost: 1200, effect: 20 }
  ];
let BREW_TYPES = [
    { name: "None", type: "none", cost: 0, effect: 0 },
    { name: "Regular Brew", type: "xp", cost: 500, effect: 15 },
    { name: "Basic Brew", type: "xp", cost: 200, effect: 8 }
  ];
export function initCombatSimPage() {
    setInterval(injectNavButton, 1e3);
    events.on("page", (page) => {
      if (page.type !== "combatsim") {
        $(PAGE_TAG).remove();
        $(`#${NAV_ID}`).removeClass("rs-nav-active");
        if (isOpen) {
          $("header-component div.wrapper > div.image").show();
          let headerName = page.type;
          headerName = headerName.charAt(0).toUpperCase() + headerName.slice(1);
          $("header-component div.wrapper > div.title").text(headerName);
        }
        isOpen = false;
      }
    });
  }
export function openCombatSimPage() {
    openPage();
  }
function injectNavButton() {
    if ($(`#${NAV_ID}`).length) return;
    const rsBtn = $("#riftscript-menu-btn");
    if (!rsBtn.length) return;
    const btn = $(`
        <button id="${NAV_ID}" type="button" class="riftscript-nav-btn">
            <div class="riftscript-nav-logo" style="background:#e85d4a">CS</div>
            <div class="name">Combat Sim</div>
        </button>
    `);
    btn.on("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isOpen) {
        cleanupPage();
        window.history.pushState({}, "", "settings");
        window.history.pushState({}, "", "settings");
        window.history.back();
      } else {
        openPage();
      }
    });
    rsBtn.after(btn);
  }
function triggerNav(page) {
    window.history.pushState({}, "", page);
    window.history.pushState({}, "", page);
    window.history.back();
  }
async function openPage() {
    console.log('[CombatSim] openPage called');
    isOpen = true;
    if ($(PAGE_TAG).length) {
      $(PAGE_TAG).remove();
    } else {
      console.log('[CombatSim] navigating to merchant...');
      triggerNav("merchant");
      await waitFor("merchant-page", 3e3);
      console.log('[CombatSim] merchant found, navigating to settings...');
      triggerNav("settings");
      await waitFor("settings-page", 3e3);
      console.log('[CombatSim] settings found, removing...');
      $("settings-page").remove();
    }
    $("header-component div.wrapper > div.title").text("Combat Simulator");
    $("header-component div.wrapper > div.image").hide();
    $("nav-component button").removeClass("active-link");
    $(`#${NAV_ID}`).addClass("rs-nav-active");
    history.pushState({}, "", "combatsim");
    console.log('[CombatSim] calling renderPage...');
    try {
      renderPage();
      console.log('[CombatSim] renderPage done');
    } catch(e) {
      console.error('[CombatSim] renderPage error:', e);
    }
  }
function cleanupPage() {
    isOpen = false;
    selectedActionId = null;
    lastXpPerHour = 0;
    fetchedUserData = null;
    selectedEquipment = {};
    $(PAGE_TAG).remove();
    $(`#${NAV_ID}`).removeClass("rs-nav-active");
    $("header-component div.wrapper > div.image").show();
  }
function waitFor(selector, timeout = 3e3) {
    return new Promise((resolve) => {
      if ($(selector).length) return resolve();
      const interval = setInterval(() => {
        if ($(selector).length) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, timeout);
    });
  }
let EQUIPMENT_SLOTS = [
    { key: "weapon", label: "Weapon", apiSlot: "1" },
    { key: "shield", label: "Shield", apiSlot: "2" },
    { key: "helmet", label: "Helmet", apiSlot: "3" },
    { key: "body", label: "Body", apiSlot: "4" },
    { key: "gloves", label: "Gloves", apiSlot: "5" },
    { key: "boots", label: "Boots", apiSlot: "6" },
    { key: "amulet", label: "Amulet", apiSlot: "7" },
    { key: "ring", label: "Ring", apiSlot: "8" },
    { key: "bracelet", label: "Bracelet", apiSlot: "55" }
  ];
function getEquipmentCategory(item) {
    if (!item || !item.image) return null;
    const img = item.image.toLowerCase();
    if (/sword/.test(img) || /hammer/.test(img) || /spear/.test(img) || /scythe/.test(img) || /bow/.test(img) || /boomerang/.test(img)) return "weapon";
    if (/shield/.test(img)) return "shield";
    if (/helmet/.test(img)) return "helmet";
    if (/armor-.*-body/.test(img) || /body/.test(img)) return "body";
    if (/gloves/.test(img)) return "gloves";
    if (/boots/.test(img)) return "boots";
    if (/amulet/.test(img)) return "amulet";
    if (/ring/.test(img) && !item.skill && item.name && /ring/i.test(item.name)) return "ring";
    if (/bracelet/.test(img)) return "bracelet";
    return null;
  }
function getItemsByCategory(category) {
    if (!data.ready || !data.items?.list) return [];
    return data.items.list.filter((item) => getEquipmentCategory(item) === category).sort((a, b) => (b.tier || 0) - (a.tier || 0));
  }
let selectedEquipment = {};
function buildEquipmentDropdown(slotKey, currentItemId) {
    const items = getItemsByCategory(slotKey);
    if (!items.length) return `<select class="cs-equip-select" data-slot="${slotKey}"><option value="">None</option></select>`;
    const tiers = {};
    for (const item of items) {
      const tier = item.tier || 0;
      if (!tiers[tier]) tiers[tier] = [];
      tiers[tier].push(item);
    }
    const tierKeys = Object.keys(tiers).map(Number).sort((a, b) => b - a);
    let html = `<select class="cs-equip-select" data-slot="${slotKey}">`;
    html += `<option value="">None</option>`;
    for (const tier of tierKeys) {
      html += `<optgroup label="Tier ${tier}">`;
      for (const item of tiers[tier]) {
        const selected = item.id == currentItemId ? " selected" : "";
        html += `<option value="${item.id}"${selected}>${item.name}</option>`;
      }
      html += `</optgroup>`;
    }
    html += `</select>`;
    return html;
  }
function getEquipmentSummaryStats() {
    const totals = {};
    for (const slot of EQUIPMENT_SLOTS) {
      const itemId = selectedEquipment[slot.key];
      if (!itemId) continue;
      const item = data.items?.byId?.[itemId];
      if (!item?.stats) continue;
      if (item.stats.global) {
        for (const [key2, val] of Object.entries(item.stats.global)) {
          totals[key2] = (totals[key2] || 0) + val;
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
function renderEquipmentSummary(page) {
    const stats = getEquipmentSummaryStats();
    const container = page.find("#cs-equip-summary");
    if (!container.length) return;
    const STAT_LABELS = {
      DAMAGE: "Damage",
      ARMOUR: "Armour",
      HEALTH: "Health",
      ATTACK_SPEED: "Atk Speed",
      EFFICIENCY_CHANCE: "Efficiency",
      DOUBLE_LOOT_CHANCE: "Loot Chance",
      DOUBLE_EXP_CHANCE: "XP Chance",
      HEAL: "Heal",
      FOREST_DAMAGE_PERCENT: "Forest Dmg",
      MOUNTAIN_DAMAGE_PERCENT: "Mtn Dmg",
      OCEAN_DAMAGE_PERCENT: "Ocean Dmg",
      FOREST_BLOCK_PERCENT: "Forest Block",
      MOUNTAIN_BLOCK_PERCENT: "Mtn Block",
      OCEAN_BLOCK_PERCENT: "Ocean Block",
      ELITE_DAMAGE_PERCENT: "Elite Dmg",
      ELITE_BLOCK_PERCENT: "Elite Block",
      BONUS_ACCURACY: "Accuracy",
      BONUS_EVASION: "Evasion"
    };
    const entries = Object.entries(stats).filter(([, v]) => v !== 0);
    if (!entries.length) {
      container.html(`
            <div class="cs-equip-summary-title">Equipment Totals</div>
            <div style="font-size:0.8em;color:rgba(255,255,255,0.25);padding:4px 0">No equipment selected</div>
        `);
      return;
    }
    const priority = ["DAMAGE", "ARMOUR", "HEALTH", "ATTACK_SPEED", "EFFICIENCY_CHANCE", "DOUBLE_LOOT_CHANCE", "DOUBLE_EXP_CHANCE"];
    entries.sort((a, b) => {
      const ai = priority.indexOf(a[0]);
      const bi = priority.indexOf(b[0]);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    });
    let html = `<div class="cs-equip-summary-title">Equipment Totals</div><div class="cs-equip-summary-grid">`;
    for (const [key2, val] of entries) {
      const label = STAT_LABELS[key2] || key2.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
      const isPercent = key2.includes("PERCENT") || key2.includes("CHANCE");
      const display = isPercent ? `${formatNumber(val)}%` : formatNumber(val);
      html += `<div class="cs-equip-stat"><span class="cs-equip-stat-label">${label}</span><span class="cs-equip-stat-value">${display}</span></div>`;
    }
    html += `</div>`;
    container.html(html);
    const effVal = stats.EFFICIENCY_CHANCE || 0;
    const lootVal = stats.DOUBLE_LOOT_CHANCE || 0;
    const xpVal = stats.DOUBLE_EXP_CHANCE || 0;
    setFetched(page, "cs-eff", effVal);
    setFetched(page, "cs-loot", lootVal);
    setFetched(page, "cs-xp", xpVal);
  }
function renderEquipmentSlots(page) {
    const combatSlots = ["weapon", "shield", "helmet", "body", "gloves", "boots"];
    const accessorySlots = ["amulet", "ring", "bracelet"];
    function buildSlotHtml(slotKeys) {
      let html = '<div class="cs-equip-grid">';
      for (const slot of EQUIPMENT_SLOTS.filter((s) => slotKeys.includes(s.key))) {
        const itemId = selectedEquipment[slot.key];
        const item = itemId ? data.items?.byId?.[itemId] : null;
        const imgSrc = item ? getItemImage2(item) : "";
        const dropdown = buildEquipmentDropdown(slot.key, itemId);
        html += `
                <div class="cs-equip-slot" data-slot-key="${slot.key}">
                    ${imgSrc ? `<img class="cs-equip-slot-img" src="${imgSrc}" alt="">` : '<div class="cs-equip-slot-img"></div>'}
                    <span class="${item ? "cs-equip-slot-name" : "cs-equip-slot-empty"}">${item ? item.name : slot.label}</span>
                    ${dropdown}
                </div>
            `;
      }
      html += "</div>";
      return html;
    }
    page.find("#cs-equip-slots").html(buildSlotHtml(combatSlots));
    page.find("#cs-equip-accessory-slots").html(buildSlotHtml(accessorySlots));
    const container = page.find("#cs-tab-equipment");
    container.find(".cs-equip-select").on("change", function() {
      const slotKey = $(this).data("slot");
      const newItemId = $(this).val();
      selectedEquipment[slotKey] = newItemId ? parseInt(newItemId) : null;
      const slotEl = $(this).closest(".cs-equip-slot");
      const newItem = newItemId ? data.items?.byId?.[newItemId] : null;
      const newImg = newItem ? getItemImage2(newItem) : "";
      if (newImg) {
        slotEl.find(".cs-equip-slot-img").replaceWith(`<img class="cs-equip-slot-img" src="${newImg}" alt="">`);
      } else {
        slotEl.find(".cs-equip-slot-img, img.cs-equip-slot-img").replaceWith('<div class="cs-equip-slot-img"></div>');
      }
      if (newItem) {
        slotEl.find(".cs-equip-slot-name, .cs-equip-slot-empty").replaceWith(`<span class="cs-equip-slot-name">${newItem.name}</span>`);
      } else {
        slotEl.find(".cs-equip-slot-name, .cs-equip-slot-empty").replaceWith('<span class="cs-equip-slot-empty">Empty</span>');
      }
      renderEquipmentSummary(page);
      saveEquipmentConfig();
    });
    renderEquipmentSummary(page);
  }
function populateEquipmentFromUser(userData) {
    if (!userData?.user?.equipment) return;
    const equip = userData.user.equipment;
    for (const slot of EQUIPMENT_SLOTS) {
      const entry = equip[slot.apiSlot];
      if (entry && entry.id) {
        selectedEquipment[slot.key] = entry.id;
      }
    }
  }
function saveEquipmentConfig() {
    const c = storage.getData("combatsim-config") || {};
    c.equipment = { ...selectedEquipment };
    storage.save("combatsim-config", c);
  }
function loadEquipmentConfig() {
    const c = storage.getData("combatsim-config") || {};
    if (c.equipment) {
      selectedEquipment = { ...c.equipment };
    }
  }
function getCombatActions() {
    if (!data.ready || !data.actions?.list) return [];
    return data.actions.list.filter((a) => a.type === "MONSTER" || a.type === "ELITE");
  }
let MOUNTAIN_MONSTERS = /* @__PURE__ */ new Set([4, 5, 6, 7, 11, 15, 24, 26, 60, 61, 62, 63, 64, 65]);
let OCEAN_MONSTERS = /* @__PURE__ */ new Set([17, 18, 19, 20, 21, 22, 23, 27, 70, 71, 72, 73, 74, 75]);
function getMonsterRegion(monster) {
    if (!monster) return "forest";
    if (monster.forestDamagePercent || monster.forestBlockPercent) return "forest";
    if (monster.mountainDamagePercent || monster.mountainBlockPercent) return "mountain";
    if (monster.oceanDamagePercent || monster.oceanBlockPercent) return "ocean";
    const id = parseInt(monster.id);
    if (MOUNTAIN_MONSTERS.has(id)) return "mountain";
    if (OCEAN_MONSTERS.has(id)) return "ocean";
    return "forest";
  }
function getActionRegion(action) {
    if (!action?.monster) return "forest";
    const aid = parseInt(action.id);
    if (aid >= 420 && aid <= 425) return "mountain";
    if (aid >= 430 && aid <= 435) return "ocean";
    if (aid >= 410 && aid <= 415) return "forest";
    const monster = data.monsters?.byId?.[action.monster];
    return getMonsterRegion(monster);
  }
function getActionsByRegion(region) {
    const combatActions = getCombatActions();
    return combatActions.filter((a) => getActionRegion(a) === region).sort((a, b) => (a.level || 0) - (b.level || 0));
  }
function getMonsterImage(action, monster) {
    if (monster?.image) return `${ASSET_BASE}/${monster.image}`;
    if (action?.image) return `${ASSET_BASE}/${action.image}`;
    return "";
  }
function getItemImage2(item) {
    if (!item?.image) return "";
    if (item.image.startsWith("items/")) return `${ASSET_BASE}/${item.image}`;
    return `${ASSET_BASE}/items/${item.image}`;
  }
function getMonsterDamagePercent(monster) {
    if (!monster) return 0;
    return (monster.eliteDamagePercent || 0) + (monster.forestDamagePercent || 0) + (monster.mountainDamagePercent || 0) + (monster.oceanDamagePercent || 0);
  }
function getMonsterBlockPercent(monster) {
    if (!monster) return 0;
    return monster.armour || (monster.eliteBlockPercent || 0) + (monster.forestBlockPercent || 0) + (monster.mountainBlockPercent || 0) + (monster.oceanBlockPercent || 0);
  }
function getLootValuePerKill(actionId) {
    if (!actionId || !data.drops.byAction[actionId]) return 0;
    const drops = data.drops.byAction[actionId];
    const customPrices2 = storage.getData("custom-prices") || {};
    let total = 0;
    for (const drop of drops) {
      const item = data.items.byId[drop.item];
      if (!item) continue;
      const basePrice = getMode() === "multiplayer" ? item.attributes?.MIN_MARKET_PRICE || item.attributes?.SELL_PRICE || 0 : item.attributes?.SELL_PRICE || 0;
      const price = customPrices2[drop.item] ?? basePrice;
      const avgAmount = drop.amount ? (1 + drop.amount) / 2 : 1;
      const chance = drop.chance ?? 1;
      total += price * avgAmount * chance;
    }
    return total;
  }
function getLootBreakdown(actionId, killsPerHour) {
    if (!actionId || !data.drops.byAction[actionId]) return [];
    const drops = data.drops.byAction[actionId];
    const customPrices2 = storage.getData("custom-prices") || {};
    const breakdown = [];
    for (const drop of drops) {
      const item = data.items.byId[drop.item];
      if (!item) continue;
      const basePrice = getMode() === "multiplayer" ? item.attributes?.MIN_MARKET_PRICE || item.attributes?.SELL_PRICE || 0 : item.attributes?.SELL_PRICE || 0;
      const price = customPrices2[drop.item] ?? basePrice;
      const avgAmount = drop.amount ? (1 + drop.amount) / 2 : 1;
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
          goldPerHour
        });
      }
    }
    breakdown.sort((a, b) => b.goldPerHour - a.goldPerHour);
    return breakdown;
  }
function renderPage() {
    $(PAGE_TAG).remove();
    const c = storage.getData("combatsim-config") || {};
    const foodOptions = FOOD_TYPES.map(
      (f) => `<option value="${f.name}" ${(c.foodType || "None") === f.name ? "selected" : ""}>${f.name}${f.hp ? ` (${f.hp} HP)` : ""}</option>`
    ).join("");
    const regionTabs = REGIONS.map(
      (r) => `<button class="cs-region-tab${r.id === selectedRegion ? " active" : ""}" data-region="${r.id}">${r.label}</button>`
    ).join("");
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

                    <!-- Setup Tabs -->
                    <div class="cs-card">
                        <div class="cs-setup-tabs">
                            <button class="cs-setup-tab active" data-tab="equipment">Equipment</button>
                            <button class="cs-setup-tab" data-tab="modifiers">Modifiers</button>
                            <button class="cs-setup-tab" data-tab="consumables">Consumables</button>
                        </div>
                    </div>

                    <!-- Equipment Tab -->
                    <div class="cs-tab-content" id="cs-tab-equipment">
                        <div class="cs-card cs-equip-card" id="cs-equip-card">
                            <div class="cs-card-header"><span>Combat</span></div>
                            <div id="cs-equip-slots"></div>
                        </div>
                        <div class="cs-card">
                            <div class="cs-card-header"><span>Accessories</span></div>
                            <div id="cs-equip-accessory-slots"></div>
                        </div>
                        <div class="cs-card">
                            <div class="cs-card-header"><span>Runes</span></div>
                            <div class="cs-control-grid">
                                ${controlInput("Region Dmg Rune", "cs-regionDamageRune", c.regionDamageRune || 0, 1, "%")}
                                ${controlInput("Region Block Rune", "cs-regionBlockRune", c.regionBlockRune || 0, 1, "%")}
                                ${controlInput("Elite Dmg Rune", "cs-eliteDamageRune", c.eliteDamageRune || 0, 1, "%")}
                                ${controlInput("Elite Block Rune", "cs-eliteBlockRune", c.eliteBlockRune || 0, 1, "%")}
                            </div>
                        </div>
                        <div class="cs-card">
                            <div class="cs-card-header"><span>Tomes</span></div>
                            <div class="cs-control-grid">
                                <div class="cs-toggle-row">
                                    <span>Savage Tome</span>
                                    <label><input type="checkbox" id="cs-savageTomeActive" ${c.savageTomeEffect ? "checked" : ""}></label>
                                    <input class="cs-input-sm" id="cs-savageTomeEffect" type="number" value="${c.savageTomeEffect || 0}" min="0" placeholder="%">
                                </div>
                                <div class="cs-toggle-row">
                                    <span>Insatiable Tome</span>
                                    <label><input type="checkbox" id="cs-insatiableTomeActive" ${c.insatiableTomeEffect ? "checked" : ""}></label>
                                    <input class="cs-input-sm" id="cs-insatiableTomeEffect" type="number" value="${c.insatiableTomeEffect || 0}" min="0" placeholder="%">
                                </div>
                                <div class="cs-toggle-row">
                                    <span>Potent Tome</span>
                                    <label><input type="checkbox" id="cs-potentTomeActive" ${c.potentTomeEffect ? "checked" : ""}></label>
                                    <input class="cs-input-sm" id="cs-potentTomeEffect" type="number" value="${c.potentTomeEffect || 0}" min="0" placeholder="%">
                                </div>
                                <div class="cs-toggle-row">
                                    <span>Wisdom Tome</span>
                                    <label><input type="checkbox" id="cs-wisdomTomeActive" ${c.wisdomTomeEffect ? "checked" : ""}></label>
                                    <input class="cs-input-sm" id="cs-wisdomTomeEffect" type="number" value="${c.wisdomTomeEffect || 0}" min="0" placeholder="%">
                                </div>
                            </div>
                        </div>
                        <div class="cs-card" id="cs-equip-summary-card">
                            <div class="cs-card-header"><span>Stat Summary</span></div>
                            <div class="cs-equip-summary" id="cs-equip-summary"></div>
                        </div>
                    </div>

                    <!-- Modifiers Tab -->
                    <div class="cs-tab-content" id="cs-tab-modifiers" style="display:none">
                        <div class="cs-card">
                            <div class="cs-card-header"><span>Guild</span></div>
                            <div class="cs-guild-grid">
                                <div class="cs-guild-row"><span>Armory Lv.</span><input class="cs-input-sm" id="cs-guildArmory" type="number" value="${c.guildArmoryLevel || 0}" min="0" max="10"></div>
                                <div class="cs-guild-row"><span>Event Hall Lv.</span><input class="cs-input-sm" id="cs-guildEventHall" type="number" value="${c.guildEventHallLevel || 0}" min="0" max="10"></div>
                                <div class="cs-guild-row"><span>Library Lv.</span><input class="cs-input-sm" id="cs-guildLibrary" type="number" value="${c.guildLibraryLevel || 0}" min="0" max="10"></div>
                            </div>
                            <div class="cs-toggle-row">
                                <span>Guild Event Active</span>
                                <label><input type="checkbox" id="cs-guildEvent" ${c.guildEventActive ? "checked" : ""}> Active</label>
                            </div>
                        </div>
                        <div class="cs-card">
                            <div class="cs-card-header"><span>Relics</span></div>
                            <div class="cs-control-grid">
                                ${controlInput("Coin Drop", "cs-relicCoinDrop", c.relicCoinDrop || 0, 1, "%")}
                                ${controlInput("Efficiency", "cs-relicEfficiency", c.relicEfficiency || 0, 1, "%")}
                                ${controlInput("Double XP", "cs-relicDoubleXP", c.relicDoubleXP || 0, 1, "%")}
                                ${controlInput("Accuracy", "cs-relicAccuracy", c.relicAccuracy || 0, 1, "%")}
                                ${controlInput("Evasion", "cs-relicEvasion", c.relicEvasion || 0, 1, "%")}
                            </div>
                        </div>
                        <div class="cs-card">
                            <div class="cs-card-header"><span>Traits & Marks</span></div>
                            <div class="cs-control-grid">
                                ${controlInput("Trait Efficiency", "cs-traitEfficiency", c.traitEfficiency || 0, 1, "%")}
                                ${controlInput("Trait Loot", "cs-traitLoot", c.traitLoot || 0, 1, "%")}
                                ${controlInput("Trait XP", "cs-traitXP", c.traitXP || 0, 1, "%")}
                                ${controlInput("Mark Bonus", "cs-markBonus", c.markBonus || 0, 1, "%")}
                            </div>
                        </div>
                        <div class="cs-card">
                            <div class="cs-card-header"><span>Pets</span></div>
                            <div class="cs-control-grid">
                                ${controlInput("Pet Attack", "cs-petAttack", c.petAttack || 0, 1, "%")}
                                ${controlInput("Pet Defense", "cs-petDefense", c.petDefense || 0, 1, "%")}
                                ${controlInput("Pet Health", "cs-petHealth", c.petHealth || 0, 1, "%")}
                            </div>
                        </div>
                        <div class="cs-card">
                            <div class="cs-card-header"><span>Special Effects</span></div>
                            <div class="cs-control-grid">
                                ${controlInput("Potion Multi-Kill", "cs-potionMultiKill", c.potionMultiKill || 0, 1, "%")}
                                ${controlInput("Split Potion Use", "cs-splitPotionUse", c.splitPotionUse || 0, 1, "%")}
                                ${controlInput("Reduced Monster HP", "cs-reducedMonsterHealth", c.reducedMonsterHealth || 0, 1, "%")}
                                ${controlInput("Uncapped Accuracy", "cs-uncappedAccuracy", c.uncappedAccuracy || 0, 1, "%")}
                                ${controlInput("Uncapped Evasion", "cs-uncappedEvasion", c.uncappedEvasion || 0, 1, "%")}
                                ${controlInput("Region Rune Mastery", "cs-regionRuneMastery", c.regionRuneMastery || 0, 1, "%")}
                                ${controlInput("Extra Double Action", "cs-extraDoubleAction", c.extraDoubleAction || 0, 1, "%")}
                                ${controlInput("Skill XP Bonus", "cs-skillXpBonus", c.skillXpBonus || 0, 1, "%")}
                            </div>
                        </div>
                        <div class="cs-card">
                            <div class="cs-card-header"><span>Contracts</span></div>
                            <div class="cs-control-grid">
                                ${controlInput("Double Contract Trigger", "cs-doubleContractTrigger", c.doubleContractTrigger ?? 50, 1, "%")}
                                ${controlInput("Preserve Contract", "cs-preserveContract", c.preserveContract ?? 100, 1, "%")}
                                <div class="cs-toggle-row">
                                    <span>Contract Active</span>
                                    <label><input type="checkbox" id="cs-contractActive" ${c.contractActive ? "checked" : ""}> Active</label>
                                </div>
                            </div>
                        </div>
                        <div class="cs-card">
                            <div class="cs-card-header"><span>Adventure</span></div>
                            <div class="cs-control-grid">
                                <div class="cs-control-row">
                                    <span>Adventure Mode</span>
                                    <select class="cs-input cs-select" id="cs-adventureMode">
                                        <option value="disabled" ${(c.adventureMode || "disabled") === "disabled" ? "selected" : ""}>Disabled</option>
                                        <option value="t10xp" ${c.adventureMode === "t10xp" ? "selected" : ""}>T10 XP</option>
                                        <option value="t10loot" ${c.adventureMode === "t10loot" ? "selected" : ""}>T10 Loot</option>
                                    </select>
                                </div>
                                ${controlInput("Adventure Effect", "cs-adventureEffect", c.adventureEffect || 0, 1, "%")}
                            </div>
                        </div>
                    </div>

                    <!-- Consumables Tab -->
                    <div class="cs-tab-content" id="cs-tab-consumables" style="display:none">
                        <div class="cs-card">
                            <div class="cs-card-header"><span>Food & Potions</span></div>
                            <div class="cs-control-grid">
                                <div class="cs-control-row">
                                    <span>Food</span>
                                    <select class="cs-input cs-select" id="cs-food">${foodOptions}</select>
                                </div>
                                <div class="cs-consumable-select-row">
                                    <span>Potion</span>
                                    <select class="cs-input cs-select" id="cs-potionSelect">
                                        ${POTION_TYPES.map((p) => `<option value="${p.name}" ${(c.potionName || "None") === p.name ? "selected" : ""}>${p.name}${p.effect ? " (+" + p.effect + "%)" : ""}</option>`).join("")}
                                    </select>
                                </div>
                                <div class="cs-consumable-select-row">
                                    <span>Brew</span>
                                    <select class="cs-input cs-select" id="cs-brewSelect">
                                        ${BREW_TYPES.map((b) => `<option value="${b.name}" ${(c.brewName || "None") === b.name ? "selected" : ""}>${b.name}${b.effect ? " (+" + b.effect + "%)" : ""}</option>`).join("")}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="cs-card">
                            <div class="cs-card-header"><span>Costs</span></div>
                            <div class="cs-control-grid">
                                ${controlInput("Potion Cost", "cs-potionCost", c.potionCost || 0, 1, "g")}
                                ${controlInput("Brew Cost", "cs-brewCost", c.brewCost || 0, 1, "g")}
                                ${controlInput("Sigil Cost", "cs-sigilCost", c.sigilCost || 0, 1, "g")}
                                ${controlInput("Key Cost", "cs-keyCost", c.keyCost || 0, 1, "g")}
                            </div>
                        </div>
                        <div class="cs-card">
                            <div class="cs-card-header"><span>Preservation</span></div>
                            <div class="cs-control-grid">
                                ${controlInput("Preserve Food", "cs-preserveFood", c.preserveFood || 0, 1, "%")}
                                ${controlInput("Preserve Potion", "cs-preservePotion", c.preservePotion || 0, 1, "%")}
                                ${controlInput("Preserve Sigil", "cs-preserveSigil", c.preserveSigil || 0, 1, "%")}
                            </div>
                        </div>
                    </div>

                    <!-- Loot Breakdown Card (shown after sim) -->
                    <div class="cs-card" id="cs-loot-card" style="display:none">
                        <div class="cs-card-header"><span>Loot Breakdown</span></div>
                        <div id="cs-loot-body"></div>
                    </div>

                    <!-- Breakdown Cards (shown after sim) -->
                    <div class="cs-card" id="cs-eff-breakdown-card" style="display:none">
                        <div class="cs-card-header"><span>Efficiency Breakdown</span></div>
                        <div id="cs-eff-breakdown-body"></div>
                    </div>
                    <div class="cs-card" id="cs-xp-breakdown-card" style="display:none">
                        <div class="cs-card-header"><span>XP Modifiers</span></div>
                        <div id="cs-xp-breakdown-body"></div>
                    </div>
                    <div class="cs-card" id="cs-loot-mod-breakdown-card" style="display:none">
                        <div class="cs-card-header"><span>Loot Modifiers</span></div>
                        <div id="cs-loot-mod-breakdown-body"></div>
                    </div>
                    <div class="cs-card" id="cs-dmg-breakdown-card" style="display:none">
                        <div class="cs-card-header"><span>Damage / Block</span></div>
                        <div id="cs-dmg-breakdown-body"></div>
                    </div>
                    <div class="cs-card" id="cs-consumable-cost-card" style="display:none">
                        <div class="cs-card-header"><span>Consumable Costs</span></div>
                        <div id="cs-consumable-cost-body"></div>
                    </div>
                    <div class="cs-card" id="cs-guild-contrib-card" style="display:none">
                        <div class="cs-card-header"><span>Guild Contribution</span></div>
                        <div id="cs-guild-contrib-body"></div>
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

                    <!-- Content Settings -->
                    <div class="cs-card">
                        <div class="cs-card-header"><span>Content</span></div>
                        <div class="cs-control-grid">
                            ${controlInput("Primary Combat Lv.", "cs-primaryLevel", c.primaryLevel || 1, 1)}
                            ${controlInput("Defense Combat Lv.", "cs-defenseLevel", c.defenseLevel || 1, 1)}
                            <div class="cs-control-row">
                                <span>Content Type</span>
                                <select class="cs-input cs-select" id="cs-contentType">
                                    <option value="normal" ${(c.contentType || "normal") === "normal" ? "selected" : ""}>Normal</option>
                                    <option value="elite" ${c.contentType === "elite" ? "selected" : ""}>Elite</option>
                                    <option value="outskirts" ${c.contentType === "outskirts" ? "selected" : ""}>Outskirts</option>
                                </select>
                            </div>
                            <div class="cs-control-row">
                                <span>Content Level</span>
                                <input class="cs-input" id="cs-contentLevel" type="number" value="${c.contentLevel || 100}" min="1" max="100" step="1">
                            </div>
                            <div class="cs-control-row">
                                <span>Active Skill</span>
                                <select class="cs-input cs-select" id="cs-activeSkill">
                                    <option value="OneHanded" ${(c.activeSkill || "Defense") === "OneHanded" ? "selected" : ""}>One-handed</option>
                                    <option value="TwoHanded" ${c.activeSkill === "TwoHanded" ? "selected" : ""}>Two-handed</option>
                                    <option value="Ranged" ${c.activeSkill === "Ranged" ? "selected" : ""}>Ranged</option>
                                    <option value="Defense" ${c.activeSkill === "Defense" ? "selected" : ""}>Defense</option>
                                </select>
                            </div>
                            <div class="cs-control-row" id="cs-outskirtsDelayRow" style="display:${c.contentType === "outskirts" ? "flex" : "none"}">
                                <span>Outskirts Delay <span class="cs-suffix">sec</span></span>
                                <input class="cs-input" id="cs-outskirtsDelay" type="number" value="${c.outskirtsDelay || 1200}" min="0" step="1">
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
                            <button class="cs-type-tab${selectedMonsterType === "normal" ? " active" : ""}" data-type="normal">Normal</button>
                            <button class="cs-type-tab${selectedMonsterType === "elite" ? " active" : ""}" data-type="elite">Elite</button>
                        </div>
                        <div class="cs-monster-list" id="cs-monster-list">
                        </div>
                    </div>

                    <!-- Simulation Controls -->
                    <div class="cs-card">
                        <div class="cs-card-header"><span>Simulation</span></div>
                        <div class="cs-control-grid">
                            ${controlInput("Duration", "cs-simHours", c.simHours || 1, 1, "hours")}
                            ${controlInput("Efficiency", "cs-eff", c.efficiency || 0, 0.01, "%")}
                            ${controlInput("Loot Bonus", "cs-loot", c.lootBonus || 0, 0.01, "%")}
                            ${controlInput("XP Bonus", "cs-xp", c.xpBonus || 0, 0.01, "%")}
                            ${controlInput("Region Adv.", "cs-regionAdv", c.regionAdvantage || 1, 0.1, "x")}
                            ${controlInput("Revive Time", "cs-revive", c.reviveSpeed || 900, 1, "sec")}
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
                            ${controlInput("Current Level", "cs-ttl-start", c.ttlStart || 1, 1)}
                            ${controlInput("Target Level", "cs-ttl-end", c.ttlEnd || 100, 1)}
                        </div>
                        <div id="cs-ttl-result" class="cs-ttl-result"></div>
                    </div>

                </div>
            </div>
            <div class="cs-credit">Combat simulation based on <a href="https://docs.google.com/spreadsheets/d/19iQkvGIyW2f_a3vmF7vNnE2EIEKOOHTNlsKdgnsOtzQ/edit?gid=907392018#gid=907392018" target="_blank" style="color:#4a9eff;text-decoration:none">spreadsheet</a> by Rivea</div>
        </${PAGE_TAG}>
    `);
    page.find(".cs-setup-tab").on("click", function() {
      const tab = $(this).data("tab");
      page.find(".cs-setup-tab").removeClass("active");
      $(this).addClass("active");
      page.find(".cs-tab-content").hide();
      page.find(`#cs-tab-${tab}`).show();
    });
    page.find(".cs-region-tab").on("click", function() {
      selectedRegion = $(this).data("region");
      page.find(".cs-region-tab").removeClass("active");
      $(this).addClass("active");
      renderMonsterList(page);
    });
    page.find(".cs-type-tab").on("click", function() {
      selectedMonsterType = $(this).data("type");
      page.find(".cs-type-tab").removeClass("active");
      $(this).addClass("active");
      renderMonsterList(page);
    });
    page.find("#cs-potionSelect").on("change", function() {
      const selected = POTION_TYPES.find((p) => p.name === $(this).val());
      if (selected) {
        page.find("#cs-potionCost").val(selected.cost);
        page.find("#cs-potionEffect").val(selected.effect);
      }
    });
    page.find("#cs-brewSelect").on("change", function() {
      const selected = BREW_TYPES.find((b) => b.name === $(this).val());
      if (selected) {
        page.find("#cs-brewCost").val(selected.cost);
        page.find("#cs-brewEffect").val(selected.effect);
      }
    });
    page.find("#cs-contentType").on("change", function() {
      const val = $(this).val();
      if (val === "outskirts") {
        page.find("#cs-outskirtsDelayRow").show();
      } else {
        page.find("#cs-outskirtsDelayRow").hide();
      }
    });
    page.find("#cs-run").on("click", () => runSimulation(page));
    page.find("#cs-ttl-start, #cs-ttl-end").on("input", () => updateTTL(page));
    $("div.padding > div.wrapper > router-outlet").after(page);
    loadEquipmentConfig();
    renderEquipmentSlots(page);
    renderMonsterList(page);
    if (hasAuth()) {
      fetchStats(page);
    }
  }
function controlInput(label, id, value, step = 1, suffix = "") {
    return `
        <div class="cs-control-row">
            <span>${label}${suffix ? ` <span class="cs-suffix">${suffix}</span>` : ""}</span>
            <span style="display:flex;align-items:center;gap:6px">
                <span class="cs-fetched" id="${id}-fetched"></span>
                <input class="cs-input" id="${id}" type="number" value="${value}" step="${step}">
            </span>
        </div>
    `;
  }
function renderMonsterList(page) {
    const container = page.find("#cs-monster-list");
    container.empty();
    if (!data.ready) {
      container.html('<div style="padding:16px;text-align:center;opacity:0.4;font-size:0.85em">Loading game data...</div>');
      return;
    }
    const typeFilter = selectedMonsterType === "elite" ? "ELITE" : "MONSTER";
    const actions = getActionsByRegion(selectedRegion).filter((a) => a.type === typeFilter);
    if (!actions.length) {
      container.html('<div style="padding:16px;text-align:center;opacity:0.4;font-size:0.85em">No monsters found</div>');
      return;
    }
    for (const action of actions) {
      const monster = data.monsters?.byId?.[action.monster];
      const imgSrc = getMonsterImage(action, monster);
      const isActive = selectedActionId === action.id;
      const xpRaw = action.exp || 0;
      const xpPerAction = Math.round(xpRaw * 10) / 10;
      const entry = $(`
            <button class="cs-monster-entry${isActive ? " active" : ""}" data-action-id="${action.id}">
                ${imgSrc ? `<img class="cs-monster-entry-img" src="${imgSrc}" alt="">` : '<div style="width:32px;height:32px;background:rgba(255,255,255,0.06);border-radius:4px"></div>'}
                <span class="cs-monster-entry-name">${action.name}</span>
                <span class="cs-monster-entry-xp">${xpPerAction} XP/s</span>
                <span class="cs-monster-entry-level">Lv. ${action.level || "?"}</span>
            </button>
        `);
      entry.on("click", () => {
        selectedActionId = action.id;
        page.find("#cs-monster-list .cs-monster-entry").removeClass("active");
        entry.addClass("active");
        selectMonster(page, action.id);
      });
      container.append(entry);
    }
  }
function selectMonster(page, actionId) {
    const action = data.actions?.byId?.[actionId];
    if (!action) return;
    const monster = data.monsters?.byId?.[action.monster];
    if (!monster) return;
    const imgSrc = getMonsterImage(action, monster);
    const dmgPct = getMonsterDamagePercent(monster);
    const blkPct = getMonsterBlockPercent(monster);
    const isElite = action.type === "ELITE";
    const badges = [];
    badges.push(badgeHtml(`${formatNumber(monster.health || 0)} HP`, "neutral"));
    badges.push(badgeHtml(`${formatNumber(monster.attack || 0)} Damage`, "red"));
    badges.push(badgeHtml(`${monster.speed || 2}s Speed`, "neutral"));
    if (dmgPct) badges.push(badgeHtml(`+${formatNumber(dmgPct)}% Damage`, "red"));
    if (blkPct) badges.push(badgeHtml(`${formatNumber(blkPct)}% Block`, "green"));
    if (isElite) badges.push(badgeHtml("ELITE", "elite"));
    const detailHtml = `
        <div class="cs-monster-card">
            <div style="display:flex;gap:16px;padding:16px;align-items:flex-start">
                <div class="cs-monster-image">
                    ${imgSrc ? `<img src="${imgSrc}" alt="${action.name}" style="width:80px;height:80px;image-rendering:pixelated">` : '<div style="width:80px;height:80px;background:rgba(255,255,255,0.06);border-radius:6px"></div>'}
                </div>
                <div style="flex:1">
                    <div class="cs-monster-name" style="padding:0">${action.name}</div>
                    <div style="font-size:0.75em;color:rgba(255,255,255,0.35);margin-bottom:8px">Level ${action.level || "?"} ${isElite ? "- Elite" : ""}</div>
                    <div class="cs-stat-badges">
                        ${badges.join("")}
                    </div>
                </div>
            </div>
        </div>
        <div id="cs-drops-table"></div>
    `;
    page.find("#cs-monster-detail").html(detailHtml);
    page.find("#cs-selected-monster-name").text(action.name);
    renderDropsTable(page, actionId);
    const lootVal = getLootValuePerKill(actionId);
    page.find("#cs-loot-card").hide();
  }
function badgeHtml(text, variant) {
    return `<span class="cs-badge cs-badge-${variant}">${text}</span>`;
  }
function renderDropsTable(page, actionId) {
    const container = page.find("#cs-drops-table");
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
      const imgSrc = getItemImage2(item);
      const chance = drop.chance ?? 1;
      const amountMin = 1;
      const amountMax = drop.amount || 1;
      const amountStr = amountMin === amountMax ? `${amountMin}` : `${amountMin}-${amountMax}`;
      const rarityClass = getRarityClass(chance);
      const chanceStr = getRarityLabel(chance);
      html += `
            <div class="cs-drop-row">
                ${imgSrc ? `<img class="cs-drop-img" src="${imgSrc}" alt="">` : ""}
                <span class="cs-drop-name">${item.name}</span>
                <span class="cs-drop-amount">x${amountStr}</span>
                <span class="cs-drop-chance ${rarityClass}">${chanceStr}</span>
            </div>
        `;
    }
    html += "</div>";
    container.html(html);
  }
function getRarityClass(chance) {
    if (chance >= 1) return "cs-rarity-always";
    if (chance >= 0.5) return "cs-rarity-common";
    if (chance >= 0.01) return "cs-rarity-uncommon";
    if (chance >= 5e-3) return "cs-rarity-rare";
    return "cs-rarity-legendary";
  }
function getRarityLabel(chance) {
    if (chance >= 1) return "Always";
    if (chance >= 0.5) return "Common";
    if (chance >= 0.01) return "Uncommon";
    if (chance >= 5e-3) return "Rare";
    return "Legendary";
  }
async function fetchStats(page) {
    try {
      const userData = await api.getUser();
      fetchedUserData = userData;
      const history2 = userData?.user?.action?.history;
      populateEquipmentFromUser(userData);
      renderEquipmentSlots(page);
      const stats = getEquipmentSummaryStats();
      setFetched(page, "cs-eff", stats.EFFICIENCY_CHANCE || 0);
      setFetched(page, "cs-loot", stats.DOUBLE_LOOT_CHANCE || 0);
      setFetched(page, "cs-xp", stats.DOUBLE_EXP_CHANCE || 0);
      const foodSlot = userData?.user?.equipment?.["200"];
      if (foodSlot) {
        const foodItem = data.items.byId[foodSlot.id];
        if (foodItem) {
          const nameMatch = FOOD_TYPES.find((f) => f.name === foodItem.name);
          const healVal = foodItem.stats?.global?.HEAL || 0;
          const hpMatch = FOOD_TYPES.find((f) => f.hp === healVal && f.hp > 0);
          const match = nameMatch || hpMatch;
          if (match) page.find("#cs-food").val(match.name);
        }
      }
      const skills = userData?.user?.skills;
      if (skills) {
        let primaryLvl = 0;
        for (const sid of [6, 7, 14]) {
          const exp = skills[sid]?.exp;
          if (exp !== void 0) {
            const lvl = expToLevel(exp);
            if (lvl > primaryLvl) primaryLvl = lvl;
          }
        }
        if (primaryLvl > 0) setFetched(page, "cs-primaryLevel", primaryLvl);
        const defExp = skills[8]?.exp;
        if (defExp !== void 0) {
          const defLvl = expToLevel(defExp);
          if (defLvl > 0) setFetched(page, "cs-defenseLevel", defLvl);
        }
      }
      const actionId = userData?.user?.action?.actionId;
      const actionData = data.actions?.byId?.[actionId];
      if (actionData && (actionData.type === "MONSTER" || actionData.type === "ELITE")) {
        const actionRegion = getActionRegion(actionData);
        selectedRegion = actionRegion;
        selectedMonsterType = actionData.type === "ELITE" ? "elite" : "normal";
        page.find(".cs-region-tab").removeClass("active");
        page.find(`.cs-region-tab[data-region="${actionRegion}"]`).addClass("active");
        page.find(".cs-type-tab").removeClass("active");
        page.find(`.cs-type-tab[data-type="${selectedMonsterType}"]`).addClass("active");
        renderMonsterList(page);
        selectedActionId = actionId;
        page.find(`#cs-monster-list .cs-monster-entry[data-action-id="${actionId}"]`).addClass("active");
        selectMonster(page, actionId);
        const skillData = data.skills?.byId?.[actionData.skill];
        const skills2 = userData?.user?.skills;
        if (skillData && skills2) {
          const skillExp = skills2[actionData.skill]?.exp;
          if (skillExp !== void 0) {
            const level = expToLevel(skillExp);
            const xpForCurrent = levelToExp(level);
            const xpForNext = levelToExp(level + 1);
            const xpProgress = skillExp - xpForCurrent;
            const xpNeeded = xpForNext - xpForCurrent;
            const pct = xpNeeded > 0 ? Math.min(100, xpProgress / xpNeeded * 100) : 0;
            page.find("#cs-skill-name").text(skillData.displayName || skillData.technicalName || "Combat");
            page.find("#cs-skill-level").text(`Level ${level}`);
            page.find("#cs-xp-fill").css("width", `${pct}%`);
            page.find("#cs-xp-current").text(`${formatNumber(xpProgress)} XP`);
            page.find("#cs-xp-next").text(`${formatNumber(xpNeeded)} XP`);
            page.find("#cs-skill-card").show();
            page.find("#cs-ttl-start").val(level);
          }
        }
      }
      const activeEntry = page.find("#cs-monster-list .cs-monster-entry.active");
      if (activeEntry.length) {
        const listEl = page.find("#cs-monster-list")[0];
        const entryEl = activeEntry[0];
        if (listEl && entryEl) {
          const listRect = listEl.getBoundingClientRect();
          const entryRect = entryEl.getBoundingClientRect();
          if (entryRect.top < listRect.top || entryRect.bottom > listRect.bottom) {
            entryEl.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }
      }
    } catch (e) {
      page.find("#cs-alert").text("Could not fetch your game stats. Try refreshing the page.").show();
    }
  }
function setFetched(page, id, value) {
    page.find(`#${id}`).val(value);
    page.find(`#${id}-fetched`).text(value);
  }
function buildSimConfig(page) {
    const val = (id) => parseFloat(page.find(`#${id}`).val()) || 0;
    const foodName = page.find("#cs-food").val();
    const food = FOOD_TYPES.find((f) => f.name === foodName) || FOOD_TYPES[0];
    let playerAttack = 0, playerSpeed = 2.5, damagePercent = 0, blockPercent = 0;
    let accuracy = 90, evasion = 0, playerHealth = 100;
    let monsterHealth = 0, monsterAttack = 0, monsterSpeed = 2, monsterDamage = 0, monsterBlock = 0;
    let baseXpPerKill = 0;
    const history2 = fetchedUserData?.user?.action?.history;
    if (history2?.character) {
      const char = history2.character;
      playerAttack = char.damage || 0;
      playerSpeed = char.speed || 2.5;
      blockPercent = char.armour || 0;
      accuracy = char.bonusAccuracy || 90;
      evasion = char.bonusEvasion || 0;
      playerHealth = char.maxHealth || 100;
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
    if (history2?.monster && history2?.character && fetchedUserData?.user?.action?.actionId === selectedActionId) {
      const mon = history2.monster;
      const char = history2.character;
      playerAttack = char.damage || playerAttack;
      playerSpeed = char.speed || playerSpeed;
      blockPercent = char.armour || blockPercent;
      accuracy = char.bonusAccuracy || accuracy;
      evasion = char.bonusEvasion || evasion;
      playerHealth = char.maxHealth || playerHealth;
      monsterHealth = mon.maxHealth || monsterHealth;
      monsterAttack = mon.damage || monsterAttack;
      monsterSpeed = mon.speed || monsterSpeed;
      monsterDamage = (mon.eliteDamagePercent || 0) + (mon.forestDamagePercent || 0) + (mon.mountainDamagePercent || 0) + (mon.oceanDamagePercent || 0);
      monsterBlock = mon.armour || (mon.eliteBlockPercent || 0) + (mon.forestBlockPercent || 0) + (mon.mountainBlockPercent || 0) + (mon.oceanBlockPercent || 0);
      if (char.combatExp) baseXpPerKill = char.combatExp;
    }
    const lootVal = selectedActionId ? getLootValuePerKill(selectedActionId) : 0;
    const potionName = page.find("#cs-potionSelect").val() || "None";
    const potionEntry = POTION_TYPES.find((p) => p.name === potionName) || POTION_TYPES[0];
    const potionType = potionEntry.type;
    const potionCost = val("cs-potionCost");
    const potionEffect = val("cs-potionEffect");
    const brewName = page.find("#cs-brewSelect").val() || "None";
    const brewEntry = BREW_TYPES.find((b) => b.name === brewName) || BREW_TYPES[0];
    const brewType = brewEntry.type;
    const brewCost = val("cs-brewCost");
    const brewEffect = val("cs-brewEffect");
    const contentTypeDropdown = page.find("#cs-contentType").val() || "normal";
    const contentType = contentTypeDropdown;
    let monsterLevel = 0;
    if (selectedActionId) {
      const actionRef = data.actions?.byId?.[selectedActionId];
      monsterLevel = actionRef?.level || 0;
    }
    const primaryLevel = val("cs-primaryLevel") || 1;
    const defenseLevel = val("cs-defenseLevel") || 1;
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
      efficiency: val("cs-eff"),
      efficiencyChance: val("cs-eff"),
      lootBonus: val("cs-loot"),
      doubleLootChance: val("cs-loot"),
      xpBonus: val("cs-xp"),
      doubleExpChance: val("cs-xp"),
      baseXpPerKill,
      lootValuePerKill: lootVal,
      otherCostPerHour: 0,
      simHours: val("cs-simHours") || 1,
      regionAdvantage: val("cs-regionAdv") || 1,
      reviveSpeed: val("cs-revive") || 900,
      ttlStart: val("cs-ttl-start"),
      ttlEnd: val("cs-ttl-end"),
      // Guild settings
      guildArmoryLevel: val("cs-guildArmory"),
      guildEventHallLevel: val("cs-guildEventHall"),
      guildLibraryLevel: val("cs-guildLibrary"),
      guildEventActive: page.find("#cs-guildEvent").is(":checked"),
      // Potion & brew
      potionType,
      potionName,
      potionCost,
      potionEffect,
      brewType,
      brewName,
      brewCost,
      brewEffect,
      // Other costs
      sigilCost: val("cs-sigilCost"),
      keyCost: val("cs-keyCost"),
      // Preservation
      preserveFood: val("cs-preserveFood"),
      preservePotion: val("cs-preservePotion"),
      preserveSigil: val("cs-preserveSigil"),
      // Tomes
      savageTomeEffect: page.find("#cs-savageTomeActive").is(":checked") ? val("cs-savageTomeEffect") : 0,
      insatiableTomeEffect: page.find("#cs-insatiableTomeActive").is(":checked") ? val("cs-insatiableTomeEffect") : 0,
      potentTomeEffect: page.find("#cs-potentTomeActive").is(":checked") ? val("cs-potentTomeEffect") : 0,
      wisdomTomeEffect: page.find("#cs-wisdomTomeActive").is(":checked") ? val("cs-wisdomTomeEffect") : 0,
      // Relics
      relicCoinDrop: val("cs-relicCoinDrop"),
      relicEfficiency: val("cs-relicEfficiency"),
      relicDoubleXP: val("cs-relicDoubleXP"),
      relicAccuracy: val("cs-relicAccuracy"),
      relicEvasion: val("cs-relicEvasion"),
      // Runes
      regionDamageRune: val("cs-regionDamageRune"),
      regionBlockRune: val("cs-regionBlockRune"),
      eliteDamageRune: val("cs-eliteDamageRune"),
      eliteBlockRune: val("cs-eliteBlockRune"),
      // Traits & marks
      traitEfficiency: val("cs-traitEfficiency"),
      traitLoot: val("cs-traitLoot"),
      traitXP: val("cs-traitXP"),
      markBonus: val("cs-markBonus"),
      // Content info
      contentType,
      contentLevel: val("cs-contentLevel") || 100,
      activeSkill: page.find("#cs-activeSkill").val() || "Defense",
      contentRegion: selectedRegion,
      primaryLevel,
      defenseLevel,
      monsterLevel,
      weaponXpBonus: 0,
      isOutskirts: contentType === "outskirts",
      outskirtsDelay: val("cs-outskirtsDelay") || 1200,
      // Pets
      petAttack: val("cs-petAttack"),
      petDefense: val("cs-petDefense"),
      petHealth: val("cs-petHealth"),
      // Special Effects
      potionMultiKill: val("cs-potionMultiKill"),
      splitPotionUse: val("cs-splitPotionUse"),
      reducedMonsterHealth: val("cs-reducedMonsterHealth"),
      uncappedAccuracy: val("cs-uncappedAccuracy"),
      uncappedEvasion: val("cs-uncappedEvasion"),
      regionRuneMastery: val("cs-regionRuneMastery"),
      extraDoubleAction: val("cs-extraDoubleAction"),
      skillXpBonus: val("cs-skillXpBonus"),
      // Contracts
      doubleContractTrigger: val("cs-doubleContractTrigger"),
      preserveContract: val("cs-preserveContract"),
      contractActive: page.find("#cs-contractActive").is(":checked"),
      contractCost: 0,
      // Adventure
      adventureMode: page.find("#cs-adventureMode").val() || "disabled",
      adventureEffect: val("cs-adventureEffect")
    };
  }
function runSimulation(page) {
    if (!selectedActionId) {
      page.find("#cs-alert").text("Select a monster from the list first.").show();
      setTimeout(() => page.find("#cs-alert").fadeOut(), 3e3);
      return;
    }
    const config = buildSimConfig(page);
    if (config.monsterHealth <= 0) {
      page.find("#cs-alert").text("Monster has no health. Cannot simulate.").show();
      setTimeout(() => page.find("#cs-alert").fadeOut(), 3e3);
      return;
    }
    storage.save("combatsim-config", {
      equipment: { ...selectedEquipment },
      foodType: config.foodType,
      simHours: config.simHours,
      efficiency: config.efficiency,
      lootBonus: config.lootBonus,
      xpBonus: config.xpBonus,
      regionAdvantage: config.regionAdvantage,
      reviveSpeed: config.reviveSpeed,
      ttlStart: config.ttlStart,
      ttlEnd: config.ttlEnd,
      // Guild
      guildArmoryLevel: config.guildArmoryLevel,
      guildEventHallLevel: config.guildEventHallLevel,
      guildLibraryLevel: config.guildLibraryLevel,
      guildEventActive: config.guildEventActive,
      // Potions & brews
      potionName: config.potionName,
      potionCost: config.potionCost,
      potionEffect: config.potionEffect,
      brewName: config.brewName,
      brewCost: config.brewCost,
      brewEffect: config.brewEffect,
      sigilCost: config.sigilCost,
      keyCost: config.keyCost,
      preserveFood: config.preserveFood,
      preservePotion: config.preservePotion,
      preserveSigil: config.preserveSigil,
      // Tomes
      savageTomeEffect: config.savageTomeEffect,
      insatiableTomeEffect: config.insatiableTomeEffect,
      potentTomeEffect: config.potentTomeEffect,
      wisdomTomeEffect: config.wisdomTomeEffect,
      // Relics
      relicCoinDrop: config.relicCoinDrop,
      relicEfficiency: config.relicEfficiency,
      relicDoubleXP: config.relicDoubleXP,
      relicAccuracy: config.relicAccuracy,
      relicEvasion: config.relicEvasion,
      // Runes
      regionDamageRune: config.regionDamageRune,
      regionBlockRune: config.regionBlockRune,
      eliteDamageRune: config.eliteDamageRune,
      eliteBlockRune: config.eliteBlockRune,
      // Traits & marks
      traitEfficiency: config.traitEfficiency,
      traitLoot: config.traitLoot,
      traitXP: config.traitXP,
      markBonus: config.markBonus,
      // Content settings
      contentType: config.contentType,
      contentLevel: config.contentLevel,
      activeSkill: config.activeSkill,
      outskirtsDelay: config.outskirtsDelay,
      // Pets
      petAttack: config.petAttack,
      petDefense: config.petDefense,
      petHealth: config.petHealth,
      // Special Effects
      potionMultiKill: config.potionMultiKill,
      splitPotionUse: config.splitPotionUse,
      reducedMonsterHealth: config.reducedMonsterHealth,
      uncappedAccuracy: config.uncappedAccuracy,
      uncappedEvasion: config.uncappedEvasion,
      regionRuneMastery: config.regionRuneMastery,
      extraDoubleAction: config.extraDoubleAction,
      skillXpBonus: config.skillXpBonus,
      // Contracts
      doubleContractTrigger: config.doubleContractTrigger,
      preserveContract: config.preserveContract,
      contractActive: config.contractActive,
      // Adventure
      adventureMode: config.adventureMode,
      adventureEffect: config.adventureEffect
    });
    const btn = page.find("#cs-run");
    btn.text("Simulating...").prop("disabled", true);
    setTimeout(() => {
      const sim = simulate({
        ...config,
        isOutskirts: config.isOutskirts,
        outskirtsDelay: config.outskirtsDelay
      });
      const results = calculateResults(config, sim);
      const fmt = (n) => formatNumber(Math.round(n));
      const effBreakdown = calculateEfficiency(config);
      const xpBreakdown = calculateXpModifiers(config);
      const lootModBreakdown = calculateLootModifiers(config);
      const dmgBreakdown = calculateDamageBlock(config);
      const consumableCosts = calculateConsumableCosts(config, sim.finalKPH, sim.foodPerHour);
      const guildContrib = calculateGuildContribution(sim.finalKPH, config.simHours, config.guildEventActive);
      const fullProfit = results.lootPerHour - consumableCosts.total;
      page.find("#cs-result-hero").html(`
            <div class="cs-hero-number">${fmt(sim.finalKPH)}</div>
            <div class="cs-hero-label">kills / hour</div>
        `);
      const profitClass = fullProfit >= 0 ? "cs-positive" : "cs-negative";
      page.find("#cs-results-body").html(`
            <div class="cs-result-row"><span>Food/Hr</span><span>${fmt(sim.foodPerHour)}</span></div>
            ${sim.playerDefeats > 0 ? `<div class="cs-result-row"><span>Deaths</span><span class="cs-negative">${sim.playerDefeats}</span></div>` : ""}
            <div class="cs-result-row"><span>XP/Hr</span><span>${fmt(results.xpPerHour)}</span></div>
            <div class="cs-divider"></div>
            <div class="cs-result-row"><span>Loot/Hr</span><span>${fmt(results.lootPerHour)}</span></div>
            <div class="cs-result-row"><span>Total Cost/Hr</span><span class="cs-negative">-${fmt(consumableCosts.total)}</span></div>
            <div class="cs-divider"></div>
            <div class="cs-result-row cs-result-profit"><span>Profit/Hr</span><span class="${profitClass}">${fmt(fullProfit)}</span></div>
        `);
      page.find("#cs-results-card").show();
      if (selectedActionId) {
        const loot = getLootBreakdown(selectedActionId, sim.finalKPH * (1 + (config.lootBonus || 0) / 100));
        if (loot.length) {
          let lootHtml = "";
          for (const item of loot) {
            const imgSrc = item.image ? getItemImage2(item) : "";
            lootHtml += `
                        <div class="cs-loot-row">
                            ${imgSrc ? `<img class="cs-loot-img" src="${imgSrc}">` : ""}
                            <span class="cs-loot-name">${item.name}</span>
                            <span class="cs-loot-qty">${fmt(item.qtyPerHour)}/hr</span>
                            <span class="cs-loot-gold">${fmt(item.goldPerHour)}g</span>
                        </div>
                    `;
          }
          page.find("#cs-loot-body").html(lootHtml);
          page.find("#cs-loot-card").show();
        }
      }
      page.find("#cs-eff-breakdown-body").html(`
            <div class="cs-breakdown">
                <div class="cs-breakdown-total">Total Efficiency: ${formatNumber(effBreakdown.total)}%</div>
                <div class="cs-breakdown-row"><span>Level Advantage</span><span>${formatNumber(effBreakdown.level)}%</span></div>
                <div class="cs-breakdown-row"><span>Guild Library</span><span>${formatNumber(effBreakdown.guild)}%</span></div>
                <div class="cs-breakdown-row"><span>Ring / Equipment</span><span>${formatNumber(effBreakdown.ring)}%</span></div>
                <div class="cs-breakdown-row"><span>Efficiency Relic</span><span>${formatNumber(effBreakdown.effRune)}%</span></div>
                <div class="cs-breakdown-row"><span>Insatiable Tome</span><span>${formatNumber(effBreakdown.insatiable)}%</span></div>
                <div class="cs-breakdown-row"><span>Trait</span><span>${formatNumber(effBreakdown.trait)}%</span></div>
                <div class="cs-breakdown-row"><span>Marks</span><span>${formatNumber(effBreakdown.marks)}%</span></div>
                <div class="cs-breakdown-row"><span>Region Rune Mastery</span><span>${formatNumber(effBreakdown.regionRuneMastery)}%</span></div>
                <div class="cs-breakdown-row"><span>Extra Double Action</span><span>${formatNumber(effBreakdown.extraDoubleAction)}%</span></div>
                <div class="cs-breakdown-row"><span>Potion Multi-Kill</span><span>${formatNumber(effBreakdown.potionMultiKill)}%</span></div>
            </div>
        `);
      page.find("#cs-eff-breakdown-card").show();
      page.find("#cs-xp-breakdown-body").html(`
            <div class="cs-breakdown">
                <div class="cs-breakdown-total">Total XP Bonus: ${formatNumber(xpBreakdown.total)}%</div>
                <div class="cs-breakdown-row"><span>Potion</span><span>${formatNumber(xpBreakdown.potion)}%</span></div>
                <div class="cs-breakdown-row"><span>Brew</span><span>${formatNumber(xpBreakdown.brew)}%</span></div>
                <div class="cs-breakdown-row"><span>Double XP Relic</span><span>${formatNumber(xpBreakdown.relicDoubleXP)}%</span></div>
                <div class="cs-breakdown-row"><span>Trait</span><span>${formatNumber(xpBreakdown.trait)}%</span></div>
                <div class="cs-breakdown-row"><span>Mark</span><span>${formatNumber(xpBreakdown.mark)}%</span></div>
                <div class="cs-breakdown-row"><span>Savage Tome</span><span>${formatNumber(xpBreakdown.savageTome)}%</span></div>
                <div class="cs-breakdown-row"><span>Bracelet</span><span>${formatNumber(xpBreakdown.bracelet)}%</span></div>
                <div class="cs-breakdown-row"><span>Weapon</span><span>${formatNumber(xpBreakdown.weapon)}%</span></div>
                <div class="cs-breakdown-row"><span>Skill XP Bonus</span><span>${formatNumber(xpBreakdown.skillXpBonus)}%</span></div>
                <div class="cs-breakdown-row"><span>Adventure XP</span><span>${formatNumber(xpBreakdown.adventureXp)}%</span></div>
                <div class="cs-breakdown-row"><span>Contract XP</span><span>${formatNumber(xpBreakdown.contractXp)}%</span></div>
            </div>
        `);
      page.find("#cs-xp-breakdown-card").show();
      page.find("#cs-loot-mod-breakdown-body").html(`
            <div class="cs-breakdown">
                <div class="cs-breakdown-total">Total Loot Bonus: ${formatNumber(lootModBreakdown.total)}%</div>
                <div class="cs-breakdown-row"><span>Amulet / Equipment</span><span>${formatNumber(lootModBreakdown.amulet)}%</span></div>
                <div class="cs-breakdown-row"><span>Potion</span><span>${formatNumber(lootModBreakdown.potion)}%</span></div>
                <div class="cs-breakdown-row"><span>Trait</span><span>${formatNumber(lootModBreakdown.trait)}%</span></div>
                <div class="cs-breakdown-row"><span>Adventure Loot</span><span>${formatNumber(lootModBreakdown.adventureLoot)}%</span></div>
            </div>
        `);
      page.find("#cs-loot-mod-breakdown-card").show();
      page.find("#cs-dmg-breakdown-body").html(`
            <div class="cs-breakdown">
                <div class="cs-breakdown-total">Total Damage Bonus: ${formatNumber(dmgBreakdown.totalDamage)}%</div>
                <div class="cs-breakdown-row"><span>Weapon Attack</span><span>${formatNumber(dmgBreakdown.weaponAttack)}</span></div>
                <div class="cs-breakdown-row"><span>Weapon Damage %</span><span>${formatNumber(dmgBreakdown.weaponDamage)}%</span></div>
                <div class="cs-breakdown-row"><span>Region Damage Rune</span><span>${formatNumber(dmgBreakdown.regionDamageRune)}%</span></div>
                <div class="cs-breakdown-row"><span>Elite Damage Rune</span><span>${formatNumber(dmgBreakdown.eliteDamageRune)}%</span></div>
                <div class="cs-breakdown-row"><span>Pet Attack Bonus</span><span>${formatNumber(dmgBreakdown.petAttackBonus)}%</span></div>
                <div class="cs-breakdown-total" style="margin-top:8px">Total Block: ${formatNumber(dmgBreakdown.totalBlock)}%</div>
                <div class="cs-breakdown-row"><span>Base Armor</span><span>${formatNumber(dmgBreakdown.baseArmor)}%</span></div>
                <div class="cs-breakdown-row"><span>Region Block Rune</span><span>${formatNumber(dmgBreakdown.regionBlockRune)}%</span></div>
                <div class="cs-breakdown-row"><span>Elite Block Rune</span><span>${formatNumber(dmgBreakdown.eliteBlockRune)}%</span></div>
                <div class="cs-breakdown-row"><span>Pet Defense Bonus</span><span>${formatNumber(dmgBreakdown.petDefenseBonus)}%</span></div>
                ${dmgBreakdown.petHealthBonus ? `<div class="cs-breakdown-row"><span>Pet Health Bonus</span><span>${formatNumber(dmgBreakdown.petHealthBonus)}%</span></div>` : ""}
                ${dmgBreakdown.reducedMonsterHealth ? `<div class="cs-breakdown-row"><span>Reduced Monster HP</span><span>${formatNumber(dmgBreakdown.reducedMonsterHealth)}%</span></div>` : ""}
                ${dmgBreakdown.uncappedAccuracy ? `<div class="cs-breakdown-row"><span>Uncapped Accuracy</span><span>${formatNumber(dmgBreakdown.uncappedAccuracy)}%</span></div>` : ""}
                ${dmgBreakdown.uncappedEvasion ? `<div class="cs-breakdown-row"><span>Uncapped Evasion</span><span>${formatNumber(dmgBreakdown.uncappedEvasion)}%</span></div>` : ""}
            </div>
        `);
      page.find("#cs-dmg-breakdown-card").show();
      page.find("#cs-consumable-cost-body").html(`
            <div class="cs-breakdown">
                <div class="cs-cost-total">Total Cost/Hr: ${formatNumber(Math.round(consumableCosts.total))}g</div>
                <div class="cs-cost-row"><span>Food</span><span>${formatNumber(Math.round(consumableCosts.food))}g</span></div>
                <div class="cs-cost-row"><span>Potion</span><span>${formatNumber(Math.round(consumableCosts.potion))}g</span></div>
                <div class="cs-cost-row"><span>Brew</span><span>${formatNumber(Math.round(consumableCosts.brew))}g</span></div>
                <div class="cs-cost-row"><span>Sigil</span><span>${formatNumber(Math.round(consumableCosts.sigil))}g</span></div>
                <div class="cs-cost-row"><span>Key</span><span>${formatNumber(Math.round(consumableCosts.key))}g</span></div>
                ${consumableCosts.contract ? `<div class="cs-cost-row"><span>Contract</span><span>${formatNumber(Math.round(consumableCosts.contract))}g</span></div>` : ""}
            </div>
        `);
      page.find("#cs-consumable-cost-card").show();
      if (config.guildEventActive && guildContrib > 0) {
        page.find("#cs-guild-contrib-body").html(`
                <div class="cs-breakdown">
                    <div class="cs-breakdown-total">Est. Contribution: ${formatNumber(guildContrib)} pts</div>
                    <div class="cs-info-text">Over ${config.simHours} hour${config.simHours !== 1 ? "s" : ""} at ${fmt(sim.finalKPH)} kills/hr</div>
                </div>
            `);
        page.find("#cs-guild-contrib-card").show();
      } else {
        page.find("#cs-guild-contrib-card").hide();
      }
      page.find("#cs-ttl-card").show();
      updateTTL(page, results.xpPerHour);
      btn.text("SIMULATE").prop("disabled", false);
    }, 50);
  }
function updateTTL(page, xpPerHour) {
    if (xpPerHour !== void 0) lastXpPerHour = xpPerHour;
    const startLevel = parseFloat(page.find("#cs-ttl-start").val()) || 1;
    const endLevel = parseFloat(page.find("#cs-ttl-end").val()) || 100;
    if (lastXpPerHour <= 0) {
      page.find("#cs-ttl-result").html('<span style="opacity:0.4">Run simulation first</span>');
      return;
    }
    const seconds = timeToLevel(startLevel, endLevel, lastXpPerHour);
    if (seconds === null) {
      page.find("#cs-ttl-result").html('<span style="opacity:0.4">Invalid levels</span>');
      return;
    }
    page.find("#cs-ttl-result").html(`
        <div class="cs-ttl-time">${secondsToDuration(seconds)}</div>
        <div class="cs-ttl-label">at ${formatNumber(Math.round(lastXpPerHour))} XP/hr</div>
    `);
  }

