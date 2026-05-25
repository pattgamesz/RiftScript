// Combat modifier calculations for RiftScript
// Ported from Rivea's Ironwood RPG Combat Calc v5.4 spreadsheet.
//
// Unit convention: every modifier returned here is a PERCENTAGE (0-100),
// because combatCalc.js does `xpMod = (config.xpBonus || 0) / 100` etc.
// Internally we work in fractions (0-1) and multiply by 100 at the boundary.

// ─── Lookup data ────────────────────────────────────────────

// Tiers table: mastery / sigil / mark tier → mod fraction.
// Sheet uses three naming conventions (T1-T8, Tier 1-Tier 8, materials, qualities).
// We expose the canonical T1-T8 form; the UI builds dropdowns with this set.
const TIER_VALUES = {
    'T8': 0.08, 'T7': 0.07, 'T6': 0.06, 'T5': 0.05,
    'T4': 0.04, 'T3': 0.03, 'T2': 0.02, 'T1': 0.01,
    'None': 0,
};
export function tierMod(tier) {
    return TIER_VALUES[tier] ?? 0;
}
export const TIER_OPTIONS = ['None', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'];

// Sigils — name → { value (statValue), traitEffect, costPer }.
// Sheet's Sigils[] table (CombatCalc AX30:BA43).
export const SIGIL_DATA = {
    'Divine Wisdom':     { value: 820, traitEffect: 1.0,  costPer: 71.25 },
    'Divine Discovery':  { value: 900, traitEffect: 0.0,  costPer: 78.21 },
    'Divine Power':      { value: 800, traitEffect: 1.0,  costPer: 69.52 },
    'Super Wisdom':      { value: 400, traitEffect: 0.75, costPer: 34.76 },
    'Super Discovery':   { value: 400, traitEffect: 0.0,  costPer: 34.76 },
    'Super Power':       { value: 350, traitEffect: 0.75, costPer: 30.41 },
    'Regular Wisdom':    { value: 255, traitEffect: 0.5,  costPer: 22.16 },
    'Regular Discovery': { value: 220, traitEffect: 0.0,  costPer: 19.12 },
    'Regular Power':     { value: 175, traitEffect: 0.5,  costPer: 15.21 },
    'Basic Wisdom':      { value: 128, traitEffect: 0.25, costPer: 11.12 },
    'Basic Discovery':   { value: 115, traitEffect: 0.0,  costPer: 9.99 },
    'Basic Power':       { value: 65,  traitEffect: 0.25, costPer: 5.65 },
    'None':              { value: 0,   traitEffect: 0,    costPer: 0 },
};
export const SIGIL_OPTIONS = Object.keys(SIGIL_DATA);

// Potions — base mod BEFORE sPotentMod scaling.
// Reverse-engineered from Potions[] table where e.g. Divine XP XPMod cell is
// 0.24 * (1 + sPotentMod). Stored bases match the per-tier 0.24/0.18/0.12/0.06 step.
export const POTION_DATA = {
    'Divine XP Potion':    { type: 'xp',   baseMod: 0.24, cost: 73.86 },
    'Super XP Potion':     { type: 'xp',   baseMod: 0.18, cost: 34.76 },
    'XP Potion':           { type: 'xp',   baseMod: 0.12, cost: 17.81 },
    'Basic XP Potion':     { type: 'xp',   baseMod: 0.06, cost: 17.38 },
    'Divine Loot Potion':  { type: 'loot', baseMod: 0.24, cost: 73.86 },
    'Super Loot Potion':   { type: 'loot', baseMod: 0.18, cost: 31.28 },
    'Loot Potion':         { type: 'loot', baseMod: 0.12, cost: 14.77 },
    'Basic Loot Potion':   { type: 'loot', baseMod: 0.06, cost: 12.60 },
    'None':                { type: 'none', baseMod: 0,    cost: 0 },
};

// Brews — base mod (no Potent scaling per BE80).
export const BREW_DATA = {
    'Regular Brew': { type: 'xp', baseMod: 0.12, cost: 66.50 },
    'Basic Brew':   { type: 'xp', baseMod: 0.06, cost: 33.25 },
    'None':         { type: 'none', baseMod: 0, cost: 0 },
};

// Map mods (MapMods table). Each entry has XP, NegativeXP, Item fractions
// per tier; final contribution scales linearly with tier number (T1-T10).
// Tier is parsed from "T<n>" string in the UI.
export const MAP_MOD_DATA = {
    'None':                                    { xp: 0,    negativeXp: 0,    item: 0 },
    'Gain additional XP in skill':             { xp: 0.04, negativeXp: 0,    item: 0 },
    'Transfer XP gained to skill':             { xp: 0,    negativeXp: 0.06, item: 0 },
    'Gather same tier item':                   { xp: 0,    negativeXp: 0,    item: 0.04 },
    'Gather same tier item, gain XP':          { xp: 0.02, negativeXp: 0,    item: 0.02 },
    'Gather equal or lower tier item':         { xp: 0,    negativeXp: 0,    item: 0.06 },
    'Loot same tier Bone':                     { xp: 0,    negativeXp: 0,    item: 0.04 },
    'Loot same tier Bone, gain XP':            { xp: 0.02, negativeXp: 0,    item: 0.02 },
    'Loot equal or lower tier Bone':           { xp: 0,    negativeXp: 0,    item: 0.06 },
};
export const MAP_MOD_OPTIONS = Object.keys(MAP_MOD_DATA);

// ─── Mastery scaling ────────────────────────────────────────

// Mirrors AY70-AY76 cells. Multipliers come from Tiers lookup, scaled per
// mastery's per-tier coefficient (Potent ×6, Savage ×2, Insatiable ×20, etc.).
// Wisdom Tome and the corresponding relics double the contribution.
//
// Returns each mastery as a fraction (0-1). Display code may format as %.
export function calculateMasteryMods(config) {
    const wisdomBoost = config.wisdomTomeActive ? 1 : 0;
    const potent     = tierMod(config.potentTier)     * 6  * (1 + wisdomBoost);
    const savage     = tierMod(config.savageTier)     * 2  * (1 + wisdomBoost);
    const insatiable = tierMod(config.insatiableTier) * 20 * (1 + wisdomBoost);
    const coin       = tierMod(config.coinTier)       + (config.vendorGems ? 0.02 : 0);
    const doubleXP   = tierMod(config.doubleXPTier)   + (config.vendorGems ? 0.02 : 0);
    const lantern    = tierMod(config.lanternTier);
    return { potent, savage, insatiable, coin, doubleXP, lantern };
}

// ─── Efficiency (sheet BE103 / AY105) ───────────────────────

// Sheet AY98-AY104 components, summed to AY105.
// Returns percentages (0-100). The total is what simulate() multiplies KPH by.
export function calculateEfficiency(config) {
    const mastery = calculateMasteryMods(config);

    // AY98 = primary level × 0.0025 → 0.25% per level (so a level 100 toon gets 25% raw).
    // Old code did (lvlDiff × 0.5) which is sheet-incorrect.
    const primaryLvl = config.primaryLevel || 0;
    const level = primaryLvl * 0.0025 * 100;

    // AY99 = (guildLibrary + guildEventHallIfActive) / 100. Game stores these as
    // integer levels (0-10), so direct conversion is fine.
    const lib = config.guildLibraryLevel || 0;
    const hall = config.guildEventActive ? (config.guildEventHallLevel || 0) : 0;
    const guild = (lib + hall);

    // Ring + relic + insatiable + trait + marks + region rune + extra-double + multi-kill.
    // These are flat percentages on the UI already.
    const ring = config.efficiencyChance || 0;
    const effRune = config.relicEfficiency || 0;
    const trait = config.traitEfficiency || 0;
    const marks = config.markBonus || 0;
    const regionRuneMastery = config.regionRuneMastery || 0;
    const extraDoubleAction = config.extraDoubleAction || 0;
    const potionMultiKill = config.potionMultiKill || 0;

    // Insatiable bonus surface: when the Insatiable Tome is active, extra
    // efficiency contribution = insatiable mastery × 12.5 (sheet AY101 sub-term).
    const insatiable = config.insatiableTomeActive ? mastery.insatiable * 12.5 * 100 : 0;

    // Sigil-driven efficiency (sheet AY103 simplified).
    // Power sigils provide both efficiency and XP bumps via trait effect.
    const sigil = SIGIL_DATA[config.sigilName] || SIGIL_DATA['None'];
    const runicLvl = config.runicLvl || 0;
    const sigilEff = (0.01 + 0.0003 * runicLvl) * (1 + sigil.traitEffect) * 100;

    const total = level + guild + ring + effRune + insatiable + trait + marks
                + regionRuneMastery + extraDoubleAction + potionMultiKill + sigilEff;

    return {
        level, guild, ring, effRune, insatiable, trait, marks,
        regionRuneMastery, extraDoubleAction, potionMultiKill,
        sigilEff,
        total,
    };
}

// ─── XP modifiers (sheet BE74-BE80 + BE84 / BH76) ───────────

export function calculateXpModifiers(config) {
    const mastery = calculateMasteryMods(config);

    // Potions: base XPMod × (1 + sPotentMod). Sheet pre-applies this in BH20-BH27.
    const potionData = POTION_DATA[config.potionName] || POTION_DATA['None'];
    const potion = potionData.type === 'xp'
        ? potionData.baseMod * (1 + mastery.potent) * 100
        : 0;

    // Brews: base XPMod, no Potent scaling (sheet BE80 = direct XLOOKUP).
    const brewData = BREW_DATA[config.brewName] || BREW_DATA['None'];
    const brew = brewData.type === 'xp' ? brewData.baseMod * 100 : 0;

    // Sigils: trait effect drives XP (sheet BE77 simplified). Power/Wisdom sigils
    // both contribute via their traitEffect field.
    const sigil = SIGIL_DATA[config.sigilName] || SIGIL_DATA['None'];
    const runicLvl = config.runicLvl || 0;
    const sigilXp = (0.02 + 0.0006 * runicLvl) * (1 + sigil.traitEffect) * 100;

    // Savage mastery contributes half its bonus to XP (BE76 = AY72/2).
    const savage = mastery.savage / 2 * 100;

    // Active-skill bonus: in Defense mode, the U6 toggle adds 4% XP; in Primary
    // mode, U5 toggle adds 4%. Sheet BE78. Surfaced via config.activeSkillXpBonus.
    const activeSkill = config.activeSkillXpBonus ? 4 : 0;

    // Bracelet = equipment double-XP chance (cs-xp).
    const bracelet = config.doubleExpChance || 0;

    // Map XP bonus. Sheet BE84 = MapMods[XP] × tier × BE82, where the timing
    // factor depends on map state ("Average" → 24/168 ≈ 14.3%, otherwise 100%).
    const mapType = config.mapModType || 'None';
    const mapTier = parseInt(String(config.mapTier || '0').replace(/[^0-9]/g, ''), 10) || 0;
    const mapState = config.mapState || 'Enabled'; // 'Enabled' | 'Average' | 'Disabled'
    const mapTimingFactor = mapState === 'Average' ? 24 / 168 : (mapState === 'Disabled' ? 0 : 1);
    const mapData = MAP_MOD_DATA[mapType] || MAP_MOD_DATA['None'];
    const mapXP = mapData.xp * mapTier * mapTimingFactor * 100;

    // Other flat modifiers (already percentages on UI).
    const relicDoubleXP = config.relicDoubleXP || 0;
    const trait = config.traitXP || 0;
    const mark = config.markBonus || 0;
    const weapon = config.weaponXpBonus || 0;
    const skillXpBonus = config.skillXpBonus || 0;
    const adventureXp = config.adventureMode === 't10xp' ? (config.adventureEffect || 0) : 0;
    const contractXp = config.contractActive ? (config.doubleContractTrigger || 0) : 0;

    const total = potion + brew + sigilXp + savage + activeSkill + bracelet
                + mapXP + relicDoubleXP + trait + mark + weapon + skillXpBonus
                + adventureXp + contractXp;

    return {
        potion, brew, sigilXp, savage, activeSkill, bracelet, mapXP,
        relicDoubleXP, trait, mark, weapon, skillXpBonus,
        adventureXp, contractXp,
        total,
    };
}

// ─── Loot modifiers (sheet AY80) ────────────────────────────

export function calculateLootModifiers(config) {
    const mastery = calculateMasteryMods(config);

    // Loot potion: base × (1 + sPotentMod), zeroed if Health-line food is active.
    const potionData = POTION_DATA[config.potionName] || POTION_DATA['None'];
    const usingHealthFood = /Health/i.test(config.foodType || '');
    const potion = potionData.type === 'loot' && !usingHealthFood
        ? potionData.baseMod * (1 + mastery.potent) * 100
        : 0;

    // Brews don't have loot mod in sheet (always 0 for BL/BN columns).
    const brew = 0;

    // Map item bonus.
    const mapType = config.mapModType || 'None';
    const mapTier = parseInt(String(config.mapTier || '0').replace(/[^0-9]/g, ''), 10) || 0;
    const mapState = config.mapState || 'Enabled';
    const mapTimingFactor = mapState === 'Average' ? 24 / 168 : (mapState === 'Disabled' ? 0 : 1);
    const mapData = MAP_MOD_DATA[mapType] || MAP_MOD_DATA['None'];
    const mapLoot = mapData.item * mapTier * mapTimingFactor * 100;

    // Equipment amulet (cs-loot).
    const amulet = config.doubleLootChance || 0;

    const trait = config.traitLoot || 0;
    const adventureLoot = config.adventureMode === 't10loot' ? (config.adventureEffect || 0) : 0;

    const total = potion + brew + mapLoot + amulet + trait + adventureLoot;
    return { amulet, potion, brew, mapLoot, trait, adventureLoot, total };
}

// ─── Damage / block (unchanged from Phase 1) ───────────────

export function calculateDamageBlock(config) {
    const weaponAttack = config.playerAttack || 0;
    const weaponDamage = config.damagePercent || 0;
    const regionDamageRune = config.regionDamageRune || 0;
    const eliteDamageRune = config.contentType === 'elite' ? (config.eliteDamageRune || 0) : 0;
    const petAttackBonus = config.petAttack || 0;
    const totalDamage = weaponDamage + regionDamageRune + eliteDamageRune;
    const baseArmor = config.blockPercent || 0;
    const regionBlockRune = config.regionBlockRune || 0;
    const eliteBlockRune = config.contentType === 'elite' ? (config.eliteBlockRune || 0) : 0;
    const petDefenseBonus = config.petDefense || 0;
    const petHealthBonus = config.petHealth || 0;
    const reducedMonsterHealth = config.reducedMonsterHealth || 0;
    const uncappedAccuracy = config.uncappedAccuracy || 0;
    const uncappedEvasion = config.uncappedEvasion || 0;
    const totalBlock = baseArmor + regionBlockRune + eliteBlockRune + petDefenseBonus;
    return {
        weaponAttack, weaponDamage, regionDamageRune, eliteDamageRune, petAttackBonus,
        petDefenseBonus, petHealthBonus, reducedMonsterHealth,
        uncappedAccuracy, uncappedEvasion,
        totalDamage, baseArmor, regionBlockRune, eliteBlockRune, totalBlock,
    };
}

// ─── Consumable costs (unchanged from Phase 1) ─────────────

export function calculateConsumableCosts(config, killsPerHour, foodPerHour) {
    const preserveFoodMult = 1 - (config.preserveFood || 0) / 100;
    const food = foodPerHour * (config.foodCost || 0) * preserveFoodMult;
    const potionsPerHour = config.potionCost ? 4 : 0;
    const preservePotionMult = 1 - (config.preservePotion || 0) / 100;
    const potion = potionsPerHour * (config.potionCost || 0) * preservePotionMult;
    const brewsPerHour = config.brewCost ? 6 : 0;
    const brew = brewsPerHour * (config.brewCost || 0);
    const sigilsPerHour = config.sigilCost ? 2 : 0;
    const preserveSigilMult = 1 - (config.preserveSigil || 0) / 100;
    const sigil = sigilsPerHour * (config.sigilCost || 0) * preserveSigilMult;
    const key2 = config.contentType === 'elite' ? killsPerHour * (config.keyCost || 0) : 0;
    const preserveContractMult = 1 - (config.preserveContract || 0) / 100;
    const contract = config.contractActive ? killsPerHour * (config.contractCost || 0) * preserveContractMult : 0;
    const total = food + potion + brew + sigil + key2 + contract;
    return { food, potion, brew, sigil, key: key2, contract, total };
}

export function calculateGuildContribution(killsPerHour, simHours, isGuildEventActive) {
    if (!isGuildEventActive) return 0;
    return Math.floor(killsPerHour * simHours);
}
