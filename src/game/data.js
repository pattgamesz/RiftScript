// Game data cache — stale-while-revalidate. On startup we use cached data
// immediately (instant feature activation) and refresh in the background.
// Cache key includes script version so new builds invalidate stale shapes.
//
// Source is the rift-guild gameData API (see core/api.js). The raw shape it
// returns differs from what the rest of the script consumes, so this module
// owns the adapter — every consumer (estimator, market filter, pet reader,
// combat sim, …) reads from the indexed `data.*` structure built below.
import { api } from '../core/api.js';

const CACHE_KEY = `riftscript-gamedata-cache-v${typeof RIFTSCRIPT_VERSION !== 'undefined' ? RIFTSCRIPT_VERSION : '0'}`;

// Old-data action ids were integers; the new API uses string ids ("63",
// "conv-60"). Numeric-looking ids get coerced for backward compat with code
// that does `byId[+url_segment]`; string ids like "conv-60" stay as strings.
function parseId(v) {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    const n = +v;
    return Number.isFinite(n) && String(n) === String(v).trim() ? n : v;
}

// The rift-guild extraction sets some IDs to null because they weren't
// reachable from the enum tables in main.js. The game itself still uses
// numeric IDs in routes — `/skill/1/action/1` for Pine Tree on Woodcutting —
// so without a backfill, cold-refresh on those pages can't resolve the
// skill or action. Mapping is by technicalName.
const ID_BACKFILL = {
    skill:  { Woodcutting: 1 },
    // Pine Tree's real game action ID is 10 (matches its primary drop's item
    // ID — every Woodcutting action follows that pattern: Spruce Tree = 11
    // drops Spruce Log = 11, Birch Tree = 12 drops Birch Log = 12, etc.).
    action: { PineTree: 10 },
};

function pruneOldCaches() {
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith('riftscript-gamedata-cache') && k !== CACHE_KEY) {
                localStorage.removeItem(k);
            }
        }
    } catch (e) { /* noop */ }
}

function indexBy(arr, key) {
    const out = {};
    for (const item of arr) {
        const v = item?.[key];
        if (v !== undefined && v !== null) out[v] = item;
    }
    return out;
}

export const data = {
    skills: null,
    actions: null,
    items: null,
    drops: null,
    ingredients: null,
    structures: null,
    monsters: null,
    pets: null,
    petPassives: null,
    expeditions: null,
    expeditionDrops: null,
    ready: false,
    cached: false,
};

function saveCache(raw) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
    } catch (e) { /* quota exceeded — ignore */ }
}

function loadCache() {
    try {
        const stored = localStorage.getItem(CACHE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (e) { return null; }
}

// ─── Adapters ─────────────────────────────────────────────

// Items in the new API have gameplay attributes as top-level fields (price,
// minMarketPrice, stats.heal, …). The rest of the script reads them as
// item.attributes.SCREAMING_SNAKE_CASE, so we build that nested object.
function adaptItem(raw) {
    const attributes = {};
    if (raw.price != null) attributes.SELL_PRICE = raw.price;
    if (raw.minMarketPrice != null) attributes.MIN_MARKET_PRICE = raw.minMarketPrice;
    if (raw.untradeable) attributes.UNTRADEABLE = true;
    if (raw.tier != null) attributes.TIER = raw.tier;

    const stats = raw.stats || {};
    if (stats.heal != null) attributes.HEAL = stats.heal;
    // Sigil / potion / brew slot durations are all 180s in-game. The API
    // exposes an enum string (e.g. "B" / "G" / "Y") whose mapping isn't
    // documented; treat any non-empty duration field as the standard 180s.
    if (stats.duration) attributes.DURATION = 180;
    if (stats.traitEffect != null) attributes.TRAIT_EFFECT_PERCENT = stats.traitEffect;
    if (stats.traitExpGain != null) attributes.TRAIT_EXP_GAIN_PERCENT = stats.traitExpGain;
    if (stats.traitPointGain != null) attributes.TRAIT_POINT_GAIN_PERCENT = stats.traitPointGain;
    // Pass any remaining stats through as upper-snake-case so combat-sim style
    // lookups (efficiency, double-loot, etc.) keep working.
    for (const [k, v] of Object.entries(stats)) {
        if (k === 'heal' || k === 'duration' || k.startsWith('trait')) continue;
        // Convert camelCase → SCREAMING_SNAKE_CASE
        const key = k.replace(/([A-Z])/g, '_$1').toUpperCase();
        if (attributes[key] == null) attributes[key] = v;
    }

    return {
        id: parseId(raw.id),
        name: raw.displayName || raw.technicalName || '',
        technicalName: raw.technicalName,
        displayName: raw.displayName,
        image: raw.image,
        tier: raw.tier,
        skill: raw.skill != null ? parseId(raw.skill) : null,
        attributes,
        stats: { global: stats, bySkill: {} },
    };
}

function adaptSkill(raw, index) {
    const backfill = ID_BACKFILL.skill[raw.technicalName];
    return {
        id: raw.id != null ? parseId(raw.id)
          : backfill != null ? backfill
          : -(index + 1),
        displayName: raw.displayName || raw.technicalName || `Skill ${index}`,
        technicalName: raw.technicalName,
        type: raw.type || 'Other',
        color: raw.color || '#999',
        image: raw.image,
        actions: raw.actions,
        actionGroups: raw.actionGroups,
    };
}

// Skill-page action — gather/craft visible on a skill's action list. May
// embed materials (inputs) and drops (outputs) which we flatten out so the
// estimator can read them via `data.drops.byAction` / `data.ingredients
// .byAction` exactly like before.
function adaptSkillAction(raw) {
    const backfill = ID_BACKFILL.action[raw.technicalName];
    return {
        id: raw.id != null ? parseId(raw.id)
          : backfill != null ? backfill
          : null,
        name: raw.displayName || raw.technicalName || '',
        technicalName: raw.technicalName,
        displayName: raw.displayName,
        type: 'ACTIVITY',
        level: raw.level,
        exp: raw.exp,
        speed: raw.speed,
        tier: raw.tier,
        image: raw.image,
        monsterId: raw.monsterId ? parseId(raw.monsterId.id ?? raw.monsterId) : null,
    };
}

// Conversion action — burner, composter, arcane crafter, pet feeder, etc.
// IDs are strings like "conv-60"; kept as-is for byId lookups.
function adaptConversionAction(raw) {
    return {
        id: raw.id,
        name: raw.displayName || raw.technicalName || '',
        technicalName: raw.technicalName,
        displayName: raw.displayName,
        type: 'CONVERSION',
        level: raw.level,
        exp: raw.exp,
        speed: raw.speed,
        speedManual: raw.speedManual,
        speedAutomation: raw.speedAutomation,
        skill: raw.skill != null ? parseId(raw.skill) : null,
        recipeId: raw.recipeId,
    };
}

function adaptMonster(raw) {
    const speedEnumValues = { Slow: 3, Normal: 2.5, Fast: 2, VeryFast: 1.5 };
    let speedNum = raw.speed;
    if (typeof raw.speed === 'object' && raw.speed?.name) {
        speedNum = speedEnumValues[raw.speed.name] ?? 2.5;
    }
    let attackStyle = raw.attackStyle;
    if (typeof raw.attackStyle === 'object') attackStyle = raw.attackStyle?.name || 'TwoHanded';
    return {
        id: parseId(raw.id),
        name: raw.displayName || raw.name || raw.technicalName || '',
        technicalName: raw.technicalName,
        image: raw.image,
        level: raw.level,
        health: raw.health,
        attack: raw.damage ?? raw.attack,
        armour: raw.armour,
        attackStyle,
        speed: speedNum,
    };
}

function adaptStructure(raw, index) {
    return {
        id: raw.id != null ? parseId(raw.id) : -(index + 1),
        name: raw.displayName || raw.name || raw.technicalName || '',
        technicalName: raw.technicalName,
        image: raw.image,
        description: raw.description,
        skill: typeof raw.skill === 'object' ? parseId(raw.skill?.id) : raw.skill,
    };
}

function adaptPet(raw, index) {
    // The expedition calc reads abilityName1/Value1/Name2/Value2 (legacy
    // Pancake shape). Flatten the new API's abilities dict back to that
    // pair so the calc keeps working without touching its module.
    const abilityEntries = Object.entries(raw.abilities || {});
    return {
        id: raw.id != null ? parseId(raw.id) : -(index + 1),
        name: raw.displayName || raw.technicalName || '',
        technicalName: raw.technicalName,
        displayName: raw.displayName,
        species: raw.species,
        family: deriveFamily(raw),
        image: raw.image,
        tier: raw.tier,
        stats: raw.stats,
        abilities: raw.abilities,
        evolve: raw.evolve,
        // Legacy fields the expedition calc reads.
        // Pet power scales linearly with tier: 100/150/200/…
        power: raw.stats?.health ?? (50 + 50 * (raw.tier || 1)),
        abilityName1: abilityEntries[0]?.[0] || null,
        abilityValue1: abilityEntries[0]?.[1] || 0,
        abilityName2: abilityEntries[1]?.[0] || null,
        abilityValue2: abilityEntries[1]?.[1] || 0,
    };
}

function deriveFamily(rawPet) {
    const abilities = rawPet.abilities || {};
    const keys = Object.keys(abilities);
    if (keys.length === 1) return capitalize(keys[0]);
    if (keys.length >= 2) return capitalize(keys[0]) + '/' + capitalize(keys[1]);
    return rawPet.species || rawPet.technicalName || 'Unknown';
}

function capitalize(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : '';
}

function adaptPetPassive(raw, index) {
    return {
        id: raw.id != null ? parseId(raw.id) : -(index + 1),
        name: raw.displayName || raw.technicalName || '',
        technicalName: raw.technicalName,
        group: raw.group,
        tier: raw.tier,
        stats: raw.stats || {},
    };
}

// Expedition game-constants the rift-guild API doesn't expose yet (name,
// power, exp, food). Keyed by level (1, 10, 25, …) to match the technicalName
// suffix. Stable across game patches; bump when the in-game numbers change.
const EXPEDITION_META = {
    1:   { name: 'Mistwood Grove',     power: 30,  exp: 957,  food: 50  },
    10:  { name: 'Silverfall Canyon',  power: 66,  exp: 1231, food: 75  },
    25:  { name: 'Thunderpeak Summit', power: 122, exp: 1504, food: 100 },
    40:  { name: 'Darkwater Marsh',    power: 262, exp: 1821, food: 112 },
    55:  { name: 'Sunfire Plateau',    power: 356, exp: 2160, food: 124 },
    70:  { name: 'Frostfang Vale',     power: 605, exp: 2515, food: 136 },
    85:  { name: 'Starlight Grotto',   power: 743, exp: 2880, food: 148 },
    100: { name: 'Shadowmist Hollow',  power: 930, exp: 3297, food: 160 },
};

function adaptExpedition(raw, index) {
    // technicalName like "Expedition10" — strip prefix to get the level (10).
    const m = (raw.technicalName || '').match(/Expedition(\d+)/);
    const level = m ? +m[1] : (index + 1);
    const meta = EXPEDITION_META[level] || {};
    return {
        // id = the level number (1, 10, 25…) so it matches the expeditionDrop
        // lookup AND the rotation/tier indexing the calc does (tier 1..8).
        id: level,
        name: meta.name || raw.displayName || raw.technicalName || '',
        technicalName: raw.technicalName,
        tier: index + 1,
        power: meta.power || 0,
        exp: meta.exp || 0,
        food: meta.food || 0,
        // Each category (wood/ore/flowers/…) is an array of {id, ratio}; pass
        // through so consumers can read them as-is.
        categories: {
            wood: raw.wood, ore: raw.ore, flowers: raw.flowers, veges: raw.veges,
            fish: raw.fish, bones: raw.bones, crystals: raw.crystals, logbooks: raw.logbooks,
        },
    };
}

function adaptExpeditionDrop(raw) {
    // expeditionTechnicalName like "Expedition10" — same level extraction as
    // adaptExpedition so byExpedition[10] = drops from Expedition10.
    const m = (raw.expeditionTechnicalName || '').match(/Expedition(\d+)/);
    const expId = m ? +m[1]
        : (raw.expeditionId != null ? parseId(raw.expeditionId) : null);
    return {
        expedition: expId,
        // Alias category → type so the legacy expeditionCalc lookups keep
        // working (it reads drop.type).
        type: raw.category,
        category: raw.category,
        item: parseId(raw.itemId),
        // Same alias for ratio → amount.
        amount: raw.ratio,
        ratio: raw.ratio,
    };
}

// ─── processRawData ───────────────────────────────────────

function processRawData(raw) {
    const items = (raw.items || []).map(adaptItem);
    const skills = (raw.skills || []).map(adaptSkill);
    const skillActions = (raw.actions || []).map(adaptSkillAction);
    const conversionActions = (raw.conversionActions || []).map(adaptConversionAction);
    const allActions = [...skillActions, ...conversionActions];
    const monsters = (raw.monsters || []).map(adaptMonster);
    const structures = (raw.structures || []).map(adaptStructure);
    // Pets / petPassives / expeditions / expeditionDrops come from the
    // self-hosted Pancake JSON already in the expected shape — pass them
    // through unchanged so expeditionCalc + petReader read the same fields
    // they always have.
    const pets = raw.pets || [];
    const petPassives = raw.petPassives || [];
    const expeditions = raw.expeditions || [];
    const expeditionDrops = raw.expeditionDrops || [];

    // Drops + ingredients are reconstructed from the embedded materials/drops
    // arrays on actions + conversionActions. The /drops endpoint covers
    // skill-action drops (gather-style); /actions has them embedded too and
    // is what we use here for completeness with ingredients/conversions.
    //
    // rift-guild chance values are 0–1000 (1000 = 100%). The estimator and
    // every other consumer assumes 0–1, so we normalise once at the source.
    const allDrops = [];
    const allIngredients = [];
    const toFrac = c => (c == null ? 0 : c / 1000);

    function actionIdOf(a) {
        if (a.id != null) return parseId(a.id);
        const bf = ID_BACKFILL.action[a.technicalName];
        return bf != null ? bf : null;
    }

    for (const a of (raw.actions || [])) {
        const aid = actionIdOf(a);
        for (const dd of (a.drops || [])) {
            allDrops.push({
                action: aid, item: parseId(dd.id),
                chance: toFrac(dd.chance), amount: dd.amount ?? 1,
                type: null,
            });
        }
        for (const dd of (a.rareDrops || [])) {
            allDrops.push({
                action: aid, item: parseId(dd.id),
                chance: toFrac(dd.chance), amount: dd.amount ?? 1,
                type: 'RARE',
            });
        }
        for (const dd of (a.failDrops || [])) {
            allDrops.push({
                action: aid, item: parseId(dd.id),
                chance: toFrac(dd.chance), amount: dd.amount ?? 1,
                type: 'FAILED',
            });
        }
        for (const dd of (a.monsterDrops || [])) {
            allDrops.push({
                action: aid, item: parseId(dd.id),
                chance: toFrac(dd.chance), amount: dd.amount ?? 1,
                type: 'MONSTER',
            });
        }
        for (const m of (a.materials || [])) {
            allIngredients.push({ action: aid, item: parseId(m.id), amount: m.amount });
        }
    }

    for (const ca of (raw.conversionActions || [])) {
        const aid = ca.id;
        for (const dd of (ca.drops || [])) {
            // For market-filter conversions (Pine Log → Charcoal etc) the
            // gold-per-yield calc needs the manual yield, not automation.
            // The API exposes both; we store manual under `amount` so the
            // existing valuator code reads the right value.
            allDrops.push({
                action: aid, item: parseId(dd.id),
                chance: toFrac(dd.chance),
                amount: dd.amountManual ?? dd.amount ?? 1,
                amountAutomation: dd.amountAutomation,
                amountManual: dd.amountManual,
                type: 'CONVERSION',
            });
        }
        for (const m of (ca.materials || [])) {
            allIngredients.push({ action: aid, item: parseId(m.id), amount: m.amount });
        }
    }

    // ─── Index ─────────────────────────────────────────────

    const itemsByImage = {};
    for (const item of items) {
        if (item.image) {
            itemsByImage[item.image] = item;
            const filename = String(item.image).split('/').pop();
            if (filename) itemsByImage[filename] = item;
        }
    }
    data.items = {
        list: items,
        byId: indexBy(items, 'id'),
        byName: indexBy(items, 'name'),
        byImage: itemsByImage,
    };

    data.skills = {
        list: skills,
        byId: indexBy(skills, 'id'),
        byName: indexBy(skills, 'displayName'),
        byTechnicalName: indexBy(skills, 'technicalName'),
    };

    data.actions = {
        list: allActions,
        byId: indexBy(allActions, 'id'),
        byName: indexBy(allActions, 'name'),
        byTechnicalName: indexBy(allActions, 'technicalName'),
    };

    const dropsByAction = {};
    for (const d of allDrops) {
        if (!dropsByAction[d.action]) dropsByAction[d.action] = [];
        dropsByAction[d.action].push(d);
    }
    data.drops = { list: allDrops, byAction: dropsByAction };

    const ingredientsByAction = {};
    for (const i of allIngredients) {
        if (!ingredientsByAction[i.action]) ingredientsByAction[i.action] = [];
        ingredientsByAction[i.action].push(i);
    }
    data.ingredients = { list: allIngredients, byAction: ingredientsByAction };

    data.monsters = {
        list: monsters,
        byId: indexBy(monsters, 'id'),
    };

    data.structures = {
        list: structures,
        byId: indexBy(structures, 'id'),
        byName: indexBy(structures, 'name'),
    };

    const petsByImage = {};
    for (const p of pets) {
        if (p.image) {
            petsByImage[p.image] = p;
            const filename = String(p.image).split('/').pop();
            if (filename) petsByImage[filename] = p;
        }
    }
    data.pets = {
        list: pets,
        byId: indexBy(pets, 'id'),
        byName: indexBy(pets, 'name'),
        byTechnicalName: indexBy(pets, 'technicalName'),
        bySpecies: indexBy(pets, 'species'),
        byImage: petsByImage,
    };

    data.petPassives = {
        list: petPassives,
        byId: indexBy(petPassives, 'id'),
    };

    data.expeditions = {
        list: expeditions,
        byId: indexBy(expeditions, 'id'),
        byTier: indexBy(expeditions, 'tier'),
    };

    const expDropsByExpedition = {};
    for (const d of expeditionDrops) {
        if (!expDropsByExpedition[d.expedition]) expDropsByExpedition[d.expedition] = [];
        expDropsByExpedition[d.expedition].push(d);
    }
    data.expeditionDrops = {
        list: expeditionDrops,
        byExpedition: expDropsByExpedition,
    };

    data.ready = true;
}

async function fetchFresh() {
    // /all bundles items/actions/conversions/drops/ingredients/monsters/
    // skills/structures from the rift-guild API. Pets + expeditions are
    // still self-hosted because the rift-guild extraction doesn't carry
    // power / exp / food / abilityName1/2 — see api.js fetchHosted note.
    const [bundle, pets, petPassives, expeditions, expeditionDrops] = await Promise.all([
        api.fetchAllGameData(),
        api.listPets().catch(() => []),
        api.listPetPassives().catch(() => []),
        api.listExpeditions().catch(() => []),
        api.listExpeditionDrops().catch(() => []),
    ]);
    return { ...bundle, pets, petPassives, expeditions, expeditionDrops };
}

export async function loadGameData() {
    pruneOldCaches();
    const cached = loadCache();

    if (cached) {
        // Stale-while-revalidate: use cache immediately so features activate
        // instantly, then refresh in the background.
        processRawData(cached);
        data.cached = true;

        // Fire-and-forget background refresh
        fetchFresh().then(raw => {
            try {
                processRawData(raw);
                data.cached = false;
                saveCache(raw);
            } catch (e) { /* keep cache */ }
        }).catch(() => { /* keep cache */ });
        return;
    }

    // No cache — fetch synchronously (first ever load or version bump)
    try {
        const raw = await fetchFresh();
        processRawData(raw);
        data.cached = false;
        saveCache(raw);
    } catch (e) {
        console.error('[RiftScript] Initial fetch failed and no cache — features limited:', e.message);
    }
}
