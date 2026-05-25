// Combat modifier calculations for RiftScript
// Ported from Rivea's Ironwood RPG Combat Calc v5.4 spreadsheet.
//
// Unit convention: every modifier returned here is a PERCENTAGE (0-100),
// because combatCalc.js does `xpMod = (config.xpBonus || 0) / 100` etc.
// Internally we work in fractions (0-1) and multiply by 100 at the boundary.

// ─── Lookup data ────────────────────────────────────────────

// Tiers table (sheet Lookups M3:N34). T1-T8 are the canonical names; the sheet
// also uses material names (Moonstone=T7, Diamond=T6, etc.) and quality names
// (Supreme=T7, Grand=T6, etc.) but the value mapping is identical.
const TIER_VALUES = {
    'T8': 0.08, 'T7': 0.07, 'T6': 0.06, 'T5': 0.05,
    'T4': 0.04, 'T3': 0.03, 'T2': 0.02, 'T1': 0.01,
    'None': 0,
};
export function tierMod(tier) {
    return TIER_VALUES[tier] ?? 0;
}
export const TIER_OPTIONS = ['None', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'];

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

// Potions — base mod BEFORE sPotentMod scaling (sheet BH/BG columns).
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

export const BREW_DATA = {
    'Regular Brew': { type: 'xp', baseMod: 0.12, cost: 66.50 },
    'Basic Brew':   { type: 'xp', baseMod: 0.06, cost: 33.25 },
    'None':         { type: 'none', baseMod: 0, cost: 0 },
};

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

// Adventure_Profit table (sheet BC35:BK50). Each item is gatherable / craftable
// at a fixed gold profit margin per kill if the user supplies a rate per hour.
// Same-tier and off-tier values are pre-computed sheet constants.
export const ADVENTURE_PROFIT_DATA = {
    'Bone':    { type: 'Loot',   cost: 0,       sameTierValue: 62,  offTierValue: 112.375 },
    'Log':     { type: 'Gather', cost: 0,       sameTierValue: 100, offTierValue: 54.125 },
    'Ore':     { type: 'Gather', cost: 0,       sameTierValue: 80,  offTierValue: 46.875 },
    'Flower':  { type: 'Gather', cost: 4.836,   sameTierValue: 90,  offTierValue: 53 },
    'Vege':    { type: 'Gather', cost: 4.836,   sameTierValue: 145, offTierValue: 49.875 },
    'Fish':    { type: 'Gather', cost: 1.86,    sameTierValue: 120, offTierValue: 58 },
    'Crystal': { type: 'Gather', cost: 0,       sameTierValue: 60,  offTierValue: 42 },
    'Logbook': { type: 'Gather', cost: 0,       sameTierValue: 95,  offTierValue: 67.125 },
    'Potion':  { type: 'Craft',  cost: 143.22,  sameTierValue: 0,   offTierValue: 0 },
    'Pie':     { type: 'Craft',  cost: 307.086, sameTierValue: 410, offTierValue: 0 },
    'Key':     { type: 'Craft',  cost: 1501.02, sameTierValue: 800, offTierValue: 0 },
    'Sigil':   { type: 'Craft',  cost: 230.64,  sameTierValue: 0,   offTierValue: 0 },
    'Essence': { type: 'Craft',  cost: 75.516,  sameTierValue: 350, offTierValue: 0 },
    'Bar':     { type: 'Craft',  cost: 135.036, sameTierValue: 210, offTierValue: 0 },
    'Sword':   { type: 'Craft',  cost: 195.3,   sameTierValue: 365, offTierValue: 0 },
};
export const ADVENTURE_PROFIT_ITEMS = Object.keys(ADVENTURE_PROFIT_DATA);

// ─── Mastery scaling ────────────────────────────────────────

// Mirrors AY70-AY76 cells. Sheet's pattern: tierMod × per-mastery coefficient
// × (1 + IF(WisdomTomeActive, 1, 0) + IF(MatchingRelicActive, 1, 0)).
// Both Wisdom and the matching relic add +100% each.
export function calculateMasteryMods(config) {
    const wisdomBoost = config.wisdomTomeActive ? 1 : 0;
    const potentRelic     = config.potentRelicActive     ? 1 : 0;
    const savageRelic     = config.savageRelicActive     ? 1 : 0;
    const insatiableRelic = config.insatiableRelicActive ? 1 : 0;
    const runicRelic      = config.runicRelicActive      ? 1 : 0;

    const potent     = tierMod(config.potentTier)     * 6  * (1 + wisdomBoost + potentRelic);
    const savage     = tierMod(config.savageTier)     * 2  * (1 + wisdomBoost + savageRelic);
    const insatiable = tierMod(config.insatiableTier) * 20 * (1 + wisdomBoost + insatiableRelic);
    // Runic mastery (sheet AY73 = tierMod × 6 × (1 + RunicMastery + RunicRelic)).
    // The Y24 'Wisdom for Runic' toggle here is named runicMasteryActive in our config.
    const runic      = tierMod(config.runicTomeTier)  * 6  * (1 + (config.runicMasteryActive ? 1 : 0) + runicRelic);
    const coin       = tierMod(config.coinTier)       + (config.vendorGems ? 0.02 : 0);
    const doubleXP   = tierMod(config.doubleXPTier)   + (config.vendorGems ? 0.02 : 0);
    const lantern    = tierMod(config.lanternTier);
    return { potent, savage, insatiable, runic, coin, doubleXP, lantern };
}

// ─── Efficiency (sheet BE103 / AY105) ───────────────────────

export function calculateEfficiency(config) {
    const mastery = calculateMasteryMods(config);

    // AY98 = primary level × 0.0025 → 0.25% per level.
    const primaryLvl = config.primaryLevel || 0;
    const level = primaryLvl * 0.25;

    // AY99 = (guildLibrary + guildEventHallIfActive) / 100 (in %), so add directly.
    const lib = config.guildLibraryLevel || 0;
    const hall = config.guildEventActive ? (config.guildEventHallLevel || 0) : 0;
    const guild = lib + hall;

    // Ring + relic + flat trait/multi-kill from existing UI inputs.
    const ring = config.efficiencyChance || 0;
    const effRune = config.relicEfficiency || 0;
    const trait = config.traitEfficiency || 0;
    const regionRuneMastery = config.regionRuneMastery || 0;
    const extraDoubleAction = config.extraDoubleAction || 0;
    const potionMultiKill = config.potionMultiKill || 0;

    // Mark sets — sheet AY104: COUNTIF(U7:V8, TRUE) / 50, doubled by Mark Relic.
    // Each TRUE = +2% efficiency. We expose two toggles (FullSet, RegionSet)
    // and the Mark Relic doubles the contribution.
    const markCount = (config.markFullSetActive ? 1 : 0) + (config.markRegionSetActive ? 1 : 0);
    const markRelicMult = 1 + (config.markRelicActive ? 1 : 0);
    const markSets = (markCount / 50) * markRelicMult * 100;

    // Trait set bonuses — sheet AY103 last term: SUM(Y9, Y10) / 100.
    // Each TRUE = +1% efficiency.
    const traitSets = ((config.traitAllSetActive ? 1 : 0) + (config.traitRegionSetActive ? 1 : 0)) * 1;

    // Insatiable mastery's efficiency contribution (sheet AY101 sub-term).
    // Only active when Insatiable Tome is on; mastery × 12.5.
    const insatiable = config.insatiableTomeActive ? mastery.insatiable * 12.5 * 100 : 0;

    // Sigil-driven efficiency (sheet AY103 base + AY73 multiplier on trait).
    // (0.01 + 0.0003 × runicLvl) × (1 + traitEffect × (1 + runicMod)) × traitRelic
    const sigil = SIGIL_DATA[config.sigilName] || SIGIL_DATA['None'];
    const runicLvl = config.runicLvl || 0;
    const traitRelicMult = 1 + (config.traitEffectRelicActive ? 0.12 : 0);
    const sigilEff = (0.01 + 0.0003 * runicLvl)
                   * (1 + sigil.traitEffect * (1 + mastery.runic))
                   * traitRelicMult * 100;

    // Skill Rune efficiency (sheet AY101). Tier-mod × insatiable scaling × relic.
    // Doubled by Skill Rune Effect Relic (L103).
    const skillRuneRelic = 1 + (config.skillRuneRelicActive ? 1 : 0);
    const insatiableMastery = mastery.insatiable;
    const effSkillRune = tierMod(config.effSkillRuneTier)
                       * (1 + insatiableMastery * 12.5)
                       * skillRuneRelic * 100;

    const total = level + guild + ring + effRune + insatiable + trait
                + regionRuneMastery + extraDoubleAction + potionMultiKill
                + markSets + traitSets + sigilEff + effSkillRune;

    return {
        level, guild, ring, effRune, insatiable, trait,
        regionRuneMastery, extraDoubleAction, potionMultiKill,
        markSets, traitSets, sigilEff, effSkillRune,
        total,
    };
}

// ─── XP modifiers (sheet BE74-BE80 + BE84 / BH76) ───────────

export function calculateXpModifiers(config) {
    const mastery = calculateMasteryMods(config);

    // Potions: base × (1 + sPotentMod). Sheet BH20-BH27.
    // Split Potion Use (L111/J111) reduces XP-potion contribution and gives
    // the loot variant the other half — modeled here as a damping factor.
    const potionData = POTION_DATA[config.potionName] || POTION_DATA['None'];
    const splitPotionMult = config.splitPotionRelicActive ? (1 - 0.11) : 1;
    const potion = potionData.type === 'xp'
        ? potionData.baseMod * (1 + mastery.potent) * splitPotionMult * 100
        : 0;

    // Brews: base, no Potent scaling.
    const brewData = BREW_DATA[config.brewName] || BREW_DATA['None'];
    const brew = brewData.type === 'xp' ? brewData.baseMod * 100 : 0;

    // Sigils: trait effect drives XP (sheet BE77). Same Runic multiplier
    // structure as the efficiency component, plus Trait-Effect-Relic +12%.
    const sigil = SIGIL_DATA[config.sigilName] || SIGIL_DATA['None'];
    const runicLvl = config.runicLvl || 0;
    const traitRelicMult = 1 + (config.traitEffectRelicActive ? 0.12 : 0);
    const sigilXp = (0.02 + 0.0006 * runicLvl)
                  * (1 + sigil.traitEffect * (1 + mastery.runic))
                  * traitRelicMult * 100;

    // Savage mastery contributes half its bonus to XP (BE76 = AY72/2).
    const savage = mastery.savage / 2 * 100;

    // Mark XP (sheet BE78). Skill-aware: Primary skill → Mark Primary toggle;
    // Defense skill → Mark Defense toggle. Each TRUE adds +4% XP, doubled
    // by Mark Relic (L97/J97).
    const isDefense = config.activeSkill === 'Defense';
    const markActive = isDefense
        ? !!config.markDefenseActive
        : !!config.markPrimaryActive;
    const markXpBase = markActive ? 4 : 0;
    const markXp = markXpBase * (1 + (config.markRelicActive ? 1 : 0));

    // Bracelet = equipment double-XP chance (cs-xp).
    const bracelet = config.doubleExpChance || 0;

    // Map XP (sheet BE84).
    const mapType = config.mapModType || 'None';
    const mapTier = parseInt(String(config.mapTier || '0').replace(/[^0-9]/g, ''), 10) || 0;
    const mapState = config.mapState || 'Enabled';
    const mapTimingFactor = mapState === 'Average' ? 24 / 168 : (mapState === 'Disabled' ? 0 : 1);
    const mapData = MAP_MOD_DATA[mapType] || MAP_MOD_DATA['None'];
    const mapXP = mapData.xp * mapTier * mapTimingFactor * 100;

    // Other flat modifiers from existing UI fields.
    const relicDoubleXP = config.relicDoubleXP || 0;
    const trait = config.traitXP || 0;
    const weapon = config.weaponXpBonus || 0;
    const skillXpBonus = config.skillXpBonus || 0;
    const adventureXp = config.adventureMode === 't10xp' ? (config.adventureEffect || 0) : 0;
    const contractXp = config.contractActive ? (config.doubleContractTrigger || 0) : 0;

    // Outskirts XP relic (sheet L92/J92): +24% XP when active in Outskirts.
    const outskirtsXp = config.outskirtsXpActive && config.isOutskirts ? 24 : 0;

    // Insatiable XP procs (sheet BH74): +50% XP per kill.
    const insatiableXp = config.insatiableXpActive ? 50 : 0;

    // Double XP mastery (sheet sDoubleXPMod = BE79).
    const doubleXPMastery = mastery.doubleXP * 100;

    const total = potion + brew + sigilXp + savage + markXp + bracelet
                + mapXP + relicDoubleXP + trait + weapon + skillXpBonus
                + adventureXp + contractXp + outskirtsXp + insatiableXp
                + doubleXPMastery;

    return {
        potion, brew, sigilXp, savage, markXp, bracelet, mapXP,
        relicDoubleXP, trait, weapon, skillXpBonus,
        adventureXp, contractXp, outskirtsXp, insatiableXp,
        doubleXPMastery,
        total,
    };
}

// ─── Loot modifiers (sheet AY80) ────────────────────────────

export function calculateLootModifiers(config) {
    const mastery = calculateMasteryMods(config);

    // Loot potion: base × (1 + sPotentMod). Sheet's filter: zeroed when a
    // Health-line food is selected (AY80 multiplier). Split Potion Use boosts
    // the loot side (the +11% the XP side gave up).
    const potionData = POTION_DATA[config.potionName] || POTION_DATA['None'];
    const usingHealthFood = /Health/i.test(config.foodType || '');
    const splitPotionLootMult = config.splitPotionRelicActive ? (1 + 0.11) : 1;
    const potion = potionData.type === 'loot' && !usingHealthFood
        ? potionData.baseMod * (1 + mastery.potent) * splitPotionLootMult * 100
        : 0;

    const brew = 0;

    const mapType = config.mapModType || 'None';
    const mapTier = parseInt(String(config.mapTier || '0').replace(/[^0-9]/g, ''), 10) || 0;
    const mapState = config.mapState || 'Enabled';
    const mapTimingFactor = mapState === 'Average' ? 24 / 168 : (mapState === 'Disabled' ? 0 : 1);
    const mapData = MAP_MOD_DATA[mapType] || MAP_MOD_DATA['None'];
    const mapLoot = mapData.item * mapTier * mapTimingFactor * 100;

    const amulet = config.doubleLootChance || 0;
    const trait = config.traitLoot || 0;
    const adventureLoot = config.adventureMode === 't10loot' ? (config.adventureEffect || 0) : 0;
    const coinMastery = mastery.coin * 100;

    // Region Rune Mastery (sheet L110/J110 = +75% when active). The sheet uses
    // it in the KPH multiplier but we apply it as a loot rate boost here.
    const regionRuneMastery = config.regionRuneMasteryRelicActive ? 75 : 0;

    const total = potion + brew + mapLoot + amulet + trait + adventureLoot
                + coinMastery + regionRuneMastery;
    return {
        amulet, potion, brew, mapLoot, trait, adventureLoot, coinMastery,
        regionRuneMastery,
        total,
    };
}

// ─── Damage / block ─────────────────────────────────────────

export function calculateDamageBlock(config) {
    const weaponAttack = config.playerAttack || 0;
    const weaponDamage = config.damagePercent || 0;
    const regionDamageRune = config.regionDamageRune || 0;
    // Elite Rune Effect Relic (L106/J106 = +48%) boosts elite damage/block runes.
    const eliteMult = 1 + (config.eliteRuneRelicActive ? 0.48 : 0);
    const eliteDamageRune = config.contentType === 'elite' ? (config.eliteDamageRune || 0) * eliteMult : 0;
    const petAttackBonus = config.petAttack || 0;
    const totalDamage = weaponDamage + regionDamageRune + eliteDamageRune;
    const baseArmor = config.blockPercent || 0;
    const regionBlockRune = config.regionBlockRune || 0;
    const eliteBlockRune = config.contentType === 'elite' ? (config.eliteBlockRune || 0) * eliteMult : 0;
    const petDefenseBonus = config.petDefense || 0;
    const petHealthBonus = config.petHealth || 0;
    // Reduced Monster Health relic (L105/J105 = -8% monster HP).
    const reducedMonsterHealth = (config.reducedMonsterHealth || 0)
                               + (config.reducedMonsterHealthRelicActive ? 8 : 0);
    // Uncapped Accuracy / Evasion relics (L107/L108 = +8% each).
    const uncappedAccuracy = (config.uncappedAccuracy || 0)
                           + (config.uncappedAccuracyRelicActive ? 8 : 0);
    const uncappedEvasion = (config.uncappedEvasion || 0)
                          + (config.uncappedEvasionRelicActive ? 8 : 0);
    const totalBlock = baseArmor + regionBlockRune + eliteBlockRune + petDefenseBonus;
    return {
        weaponAttack, weaponDamage, regionDamageRune, eliteDamageRune, petAttackBonus,
        petDefenseBonus, petHealthBonus, reducedMonsterHealth,
        uncappedAccuracy, uncappedEvasion,
        totalDamage, baseArmor, regionBlockRune, eliteBlockRune, totalBlock,
    };
}

// ─── Consumable costs ───────────────────────────────────────

export function calculateConsumableCosts(config, killsPerHour, foodPerHour) {
    const mastery = calculateMasteryMods(config);

    // Preserve Food relic (L104/J104 = +8% preservation) stacks with the
    // existing preserveFood % input.
    const preserveFoodPct = (config.preserveFood || 0) + (config.preserveFoodRelicActive ? 8 : 0);
    const preserveFoodMult = 1 - preserveFoodPct / 100;
    const food = foodPerHour * (config.foodCost || 0) * preserveFoodMult;

    const potionsPerHour = config.potionCost ? 4 : 0;
    const preservePotionPct = (config.preservePotion || 0) + (config.preservePotionRelicActive ? 8 : 0);
    const preservePotionMult = 1 - preservePotionPct / 100;
    const potion = potionsPerHour * (config.potionCost || 0) * preservePotionMult;

    const brewsPerHour = config.brewCost ? 6 : 0;
    const brew = brewsPerHour * (config.brewCost || 0);

    const sigilsPerHour = config.sigilCost ? 2 : 0;
    const preserveSigilPct = (config.preserveSigil || 0) + (config.preserveSigilRelicActive ? 8 : 0);
    const preserveSigilMult = 1 - preserveSigilPct / 100;
    const sigil = sigilsPerHour * (config.sigilCost || 0) * preserveSigilMult;

    // Lantern mastery reduces key cost (sheet sKeyCost factor = 1 - sLanternMod).
    const lanternReduction = mastery.lantern;
    const key2 = config.contentType === 'elite'
        ? killsPerHour * (config.keyCost || 0) * (1 - lanternReduction)
        : 0;

    // Preserve Contract relic (L101 / J101 = +100% preservation when active).
    const preserveContractPct = (config.preserveContract || 0) + (config.preserveContractRelicActive ? 100 : 0);
    const preserveContractMult = Math.max(0, 1 - preserveContractPct / 100);
    const contract = config.contractActive ? killsPerHour * (config.contractCost || 0) * preserveContractMult : 0;

    const total = food + potion + brew + sigil + key2 + contract;
    return {
        food, potion, brew, sigil, key: key2, contract,
        lanternReduction, preserveFoodPct, preservePotionPct, preserveSigilPct, preserveContractPct,
        total,
    };
}

export function calculateGuildContribution(killsPerHour, simHours, isGuildEventActive) {
    if (!isGuildEventActive) return 0;
    return Math.floor(killsPerHour * simHours);
}

// ─── Adventure profit (sheet BK36:BK50) ─────────────────────

// Per-item profit per hour formula (sheet):
//   IF(SUM(rates) > 0,
//      ((sameTierValue - cost) × sameTierRate
//       + (sameTierValue - cost) × sameTierXpRate
//       + offTierValue × offTierRate) × KPH,
//      0
//   ) × timing × enabled
//
// `rates` is a map of itemName → { sameTier, sameTierXp, offTier } (per kill).
// Defaults to 0 for items the user hasn't filled in.
export function calculateAdventureProfit(config, killsPerHour) {
    const rates = config.adventureRates || {};
    const state = config.mapState || 'Enabled';
    const timing = state === 'Average' ? 24 / 168 : (state === 'Disabled' ? 0 : 1);
    if (timing === 0) return { items: [], total: 0 };

    const items = [];
    let total = 0;
    for (const [name, data] of Object.entries(ADVENTURE_PROFIT_DATA)) {
        const r = rates[name] || {};
        const sameTier = +r.sameTier || 0;
        const sameTierXp = +r.sameTierXp || 0;
        const offTier = +r.offTier || 0;
        if (sameTier + sameTierXp + offTier === 0) continue;
        const profit = (
            (data.sameTierValue - data.cost) * sameTier
            + (data.sameTierValue - data.cost) * sameTierXp
            + data.offTierValue * offTier
        ) * killsPerHour * timing;
        items.push({ name, profit });
        total += profit;
    }
    return { items, total };
}
