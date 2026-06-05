// Pure calculation module for expedition success chances. UI lives in
// petFilter as a tab. Mirrors Pancake's formulas: petToStats + getSuccessChance.
import { data } from '../game/data.js';
import { getPetStats } from '../core/petStats.js';

const ROTATION_NAMES = ['melee', 'ranged', 'magic'];
// tier -> 'melee' | 'ranged' | 'magic', scraped from the expeditions sub-tab
// when the player visits it. Trusted over the formula.
const scrapedRotations = {};

// Call from anywhere that sees the taming-page DOM. Reads visible expedition
// rows and extracts the rotation per tier. Cached for the session.
export function scrapeRotationsFromDOM() {
    if (!data.expeditions?.list) return;
    $('taming-page button.row').each((_, el) => {
        const text = $(el).text();
        let rotation = null;
        if (/\bMelee\b/i.test(text)) rotation = 'melee';
        else if (/\bRanged\b/i.test(text)) rotation = 'ranged';
        else if (/\bMagic\b/i.test(text)) rotation = 'magic';
        if (!rotation) return;
        for (const exp of data.expeditions.list) {
            if (text.includes(exp.name)) {
                scrapedRotations[exp.tier] = rotation;
                break;
            }
        }
    });
}

// Returns { ready, totalStats, tiers, teamPets, teamWithStats }
// ready=false when team is empty or stats not cached yet.
// weekOffset shifts the rotation forward by N weeks (0 = this week).
export function getExpeditionResults(pets, weekOffset = 0) {
    const teamPets = (pets || []).filter(p => p.location === 'team');
    const teamWithStats = teamPets
        .map(p => ({ pet: p, stats: petToStats(p) }))
        .filter(x => x.stats);

    if (teamPets.length === 0) {
        return { ready: false, reason: 'empty', teamPets, teamWithStats: [] };
    }
    if (teamWithStats.length < teamPets.length) {
        return { ready: false, reason: 'cache', teamPets, teamWithStats };
    }

    const totalStats = sumStats(teamWithStats.map(x => x.stats));
    const tiers = (data.expeditions?.list || [])
        .slice()
        .sort((a, b) => a.tier - b.tier)
        .map(exp => {
            const rotation = currentRotation(exp.tier, weekOffset);
            const chance = successChance(totalStats, exp, rotation);
            // Raw chance for drop/egg calc — capped chance hides overpowered yield
            const rawChance = rawSuccessChance(totalStats, exp, rotation);
            const drops = computeDrops(exp, totalStats, rawChance);
            const egg = computeEgg(exp, totalStats);
            const food = computeFood(exp, totalStats);
            const exp_per_run = exp.exp * Math.min(rawChance, 100) / 100;
            return { tier: exp.tier, name: exp.name, rotation, chance, drops, egg, food, exp: exp_per_run };
        });

    return { ready: true, totalStats, tiers, teamPets, teamWithStats };
}

// Tier → egg item name (Pancake's mapping)
const EGG_BY_TIER = {
    1: 'Small Egg', 2: 'Small Egg', 3: 'Small Egg',
    4: 'Medium Egg', 5: 'Medium Egg',
    6: 'Large Egg', 7: 'Large Egg', 8: 'Large Egg',
};

function computeDrops(expedition, team, rawChance) {
    const list = data.expeditionDrops?.byExpedition?.[expedition.id] || [];
    const itemFindMul = 1 + (team.itemFind || 0) / 100;
    const cappedChance = Math.min(rawChance, 100);
    const out = [];
    for (const drop of list) {
        const teamStat = team[drop.type] || 0;
        if (!teamStat) continue;
        const amount = drop.amount * teamStat * cappedChance * itemFindMul / 100;
        if (amount <= 0) continue;
        const item = data.items?.byId?.[drop.item];
        out.push({ itemId: drop.item, name: item?.name || `#${drop.item}`, amount, type: drop.type });
    }
    out.sort((a, b) => b.amount - a.amount);
    return out;
}

function computeEgg(expedition, team) {
    const name = EGG_BY_TIER[expedition.tier];
    const item = name ? data.items?.byName?.[name] : null;
    if (!item) return null;
    // 1/8 base + eggFind% scaled (Pancake formula)
    const chance = (1 / 8) + (team.eggFind || 0) / 400;
    return { itemId: item.id, name: item.name, chance };
}

function computeFood(expedition, team) {
    const baseFood = expedition.food || 0;
    if (!baseFood) return null;
    // Hunger increases consumption
    const amount = Math.floor(baseFood / 4 * (1 + (team.hunger || 0) / 100)) * 4;
    const item = data.items?.byName?.['Pet Snacks'];
    return { itemId: item?.id, name: 'Pet Snacks', amount };
}

function rawSuccessChance(team, expedition, rotation) {
    let teamValue = (team.health || 0) + (team.attack || 0) + (team.defense || 0);
    const expValue = expedition.power * 3;
    if (expValue <= 0) return 0;
    const rotDef = team[rotation + 'Defense'] || 0;
    teamValue *= 1 + rotDef / 100;
    return 100 * teamValue / expValue;
}

// Map passive name prefix → stat key on the team-stats object.
const STAT_KEY_BY_PREFIX = {
    'melee block': 'meleeDefense',
    'ranged evade': 'rangedDefense',
    'magic resist': 'magicDefense',
    'hunger': 'hunger',
    'egg find': 'eggFind',
    'loot find': 'itemFind',
};

function passiveStatKey(passive) {
    if (!passive?.name) return null;
    const lower = passive.name.toLowerCase();
    for (const prefix of Object.keys(STAT_KEY_BY_PREFIX)) {
        if (lower.startsWith(prefix)) return STAT_KEY_BY_PREFIX[prefix];
    }
    return null;
}

function passiveValue(passive) {
    if (passive?.effect != null) return +passive.effect || 0;
    // Fallback: look up canonical statValue by full name (with level)
    const full = `${passive?.name || ''} ${passive?.level || ''}`.trim();
    const found = data.petPassives?.list?.find(x => x.name === full);
    return found?.statValue || 0;
}

// getUser's pet.species could be a numeric species id, the species name,
// or the technicalName depending on the upstream shape. Old code only
// checked byId, which now misses the rift-guild adapter's null-id pets and
// any name-based references. Try every index we maintain on data.pets.
function lookupSpecies(pet) {
    if (pet?.species == null) return null;
    const idx = data.pets;
    if (!idx) return null;
    return idx.byId?.[pet.species]
        || idx.bySpecies?.[pet.species]
        || idx.byTechnicalName?.[pet.species]
        || idx.byName?.[pet.species]
        || null;
}

function petToStats(pet) {
    // Cache is the source of truth — every field below comes from it.
    // Prefer the modal-scraped petStats entry (stats stored as roll
    // percentages, which the formula expects) over the getUser apiStats
    // (which exposes the actual numeric HP/ATK/DEF and would feed wildly
    // wrong numbers into the percentage-based formula).
    // Species template is optional: when the rift-guild API doesn't expose
    // an id for a pet (some tier-1 species are id:null and aren't in the
    // SI enum), the lookup misses and we fall back to what the cache and
    // pet.tier give us directly.
    const cached = getPetStats(pet) || pet.apiStats;
    if (!cached || cached.health == null) return null;
    const species = lookupSpecies(pet);

    const lvl = pet.level || cached.level || 1;
    const tier = pet.tier || cached.tier || species?.tier || 1;
    // Pet power scales linearly with tier: 100 / 150 / 200 / …
    const power = species?.power ?? (50 + 50 * tier);

    const out = {};
    for (const k of ['health', 'attack', 'defense']) {
        const raw = +(cached[k] || 0);
        out[k] = (power + raw / 2 - 10) / 100 * lvl + 10;
    }
    for (const k of ['meleeDefense', 'rangedDefense', 'magicDefense', 'meleeAttack', 'rangedAttack', 'magicAttack', 'hunger', 'itemFind', 'eggFind']) {
        out[k] = 0;
    }
    // Species abilities (bones / fish / flowers / ore / veges / wood /
    // crystals / logbooks) drive expedition drop amounts. Pull them from
    // the species template if we have one, otherwise the cached entry has
    // them too (saved at modal-scrape time as either a dict or an array).
    for (const k of ['bones', 'fish', 'flowers', 'ore', 'veges', 'wood', 'crystals', 'logbooks']) {
        out[k] = 0;
    }
    const applyAbility = (name, value) => {
        if (name && name in out) out[name] = (out[name] || 0) + (+value || 0);
    };
    let appliedFromSpecies = false;
    if (species?.abilityName1) { applyAbility(species.abilityName1, species.abilityValue1); appliedFromSpecies = true; }
    if (species?.abilityName2) { applyAbility(species.abilityName2, species.abilityValue2); appliedFromSpecies = true; }
    if (!appliedFromSpecies && cached.abilities) {
        if (Array.isArray(cached.abilities)) {
            for (const a of cached.abilities) applyAbility(a?.name, a?.value);
        } else if (typeof cached.abilities === 'object') {
            for (const [k, v] of Object.entries(cached.abilities)) applyAbility(k, v);
        }
    }
    if (Array.isArray(cached.passives)) {
        for (const p of cached.passives) {
            const key = passiveStatKey(p);
            if (!key || !(key in out)) continue;
            out[key] += passiveValue(p);
        }
    }
    return out;
}

function sumStats(list) {
    const out = {};
    for (const s of list) {
        for (const k of Object.keys(s)) out[k] = (out[k] || 0) + s[k];
    }
    return out;
}

function successChance(team, expedition, rotation) {
    let teamValue = (team.health || 0) + (team.attack || 0) + (team.defense || 0);
    const expValue = expedition.power * 3;
    if (expValue <= 0) return 0;
    const rotDef = team[rotation + 'Defense'] || 0;
    teamValue *= 1 + rotDef / 100;
    const chance = 100 * teamValue / expValue;
    if (chance < 1) return 0;
    return Math.min(chance, 100);
}

function currentRotation(tierOffset, weekOffset = 0) {
    // Prefer DOM-scraped rotation (always correct) over the formula.
    // For future weeks, advance from the scraped base.
    if (scrapedRotations[tierOffset]) {
        const base = ROTATION_NAMES.indexOf(scrapedRotations[tierOffset]);
        return ROTATION_NAMES[(base + weekOffset) % ROTATION_NAMES.length];
    }
    // Formula fallback — +1 shift calibrated from live game data on 2026-05-25
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const adjusted = new Date(now.getTime() + 60_000 * now.getTimezoneOffset());
    const sowNow = startOfWeek(adjusted);
    const sowYear = startOfWeek(startOfYear(adjusted));
    const weeks = Math.round((sowNow - sowYear) / MS_WEEK);
    let idx = (tierOffset + weeks + 1 + weekOffset) % ROTATION_NAMES.length;
    if (idx < 0) idx += ROTATION_NAMES.length;
    return ROTATION_NAMES[idx];
}
function startOfWeek(d) {
    const x = new Date(d);
    const day = (x.getUTCDay() + 6) % 7;
    x.setUTCDate(x.getUTCDate() - day);
    x.setUTCHours(0, 0, 0, 0);
    return x.getTime();
}
function startOfYear(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}
