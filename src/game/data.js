// Game data cache — stale-while-revalidate. On startup we use cached data
// immediately (instant feature activation) and refresh in the background.
// Cache key includes script version so new builds invalidate stale shapes.
import { api } from '../core/api.js';

const CACHE_KEY = `riftscript-gamedata-cache-v${typeof RIFTSCRIPT_VERSION !== 'undefined' ? RIFTSCRIPT_VERSION : '0'}`;

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

function index(arr, ...keys) {
    const result = {};
    for (const key of keys) result[key] = {};
    for (const item of arr) {
        for (const key of keys) {
            if (item[key] !== undefined) result[key][item[key]] = item;
        }
    }
    return result;
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

function processRawData(raw) {
    const { skills, actions, items, drops, ingredients, structures, monsters, pets, petPassives, expeditions, expeditionDrops } = raw;

    data.skills = {
        list: skills,
        byId: index(skills, 'id').id,
        byName: index(skills, 'displayName').displayName,
        byTechnicalName: index(skills, 'technicalName').technicalName,
    };

    data.actions = {
        list: actions,
        byId: index(actions, 'id').id,
        byName: index(actions, 'name').name,
    };

    // Items API returns {item: {id, name, image, ...}, stats: {...}}
    // Flatten to {id, name, image, stats, attributes, ...}
    const flatItems = items.map(entry =>
        entry.item ? { ...entry.item, stats: entry.stats || { global: {}, bySkill: {} } } : entry
    );

    const itemsByImage = {};
    for (const item of flatItems) {
        if (item.image) {
            itemsByImage[item.image] = item;
            const filename = item.image.split('/').pop();
            if (filename) itemsByImage[filename] = item;
        }
    }

    data.items = {
        list: flatItems,
        byId: index(flatItems, 'id').id,
        byName: index(flatItems, 'name').name,
        byImage: itemsByImage,
    };

    const dropsByAction = {};
    for (const drop of drops) {
        if (!dropsByAction[drop.action]) dropsByAction[drop.action] = [];
        dropsByAction[drop.action].push(drop);
    }
    data.drops = { list: drops, byAction: dropsByAction };

    const ingredientsByAction = {};
    for (const ing of ingredients) {
        if (!ingredientsByAction[ing.action]) ingredientsByAction[ing.action] = [];
        ingredientsByAction[ing.action].push(ing);
    }
    data.ingredients = { list: ingredients, byAction: ingredientsByAction };

    data.structures = {
        list: structures,
        byId: index(structures, 'id').id,
        byName: index(structures, 'name').name,
    };

    data.monsters = {
        list: monsters,
        byId: index(monsters, 'id').id,
    };

    if (pets) {
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
            byId: index(pets, 'id').id,
            byImage: petsByImage,
        };
    }
    if (petPassives) {
        data.petPassives = {
            list: petPassives,
            byId: index(petPassives, 'id').id,
        };
    }
    if (expeditions) {
        data.expeditions = {
            list: expeditions,
            byId: index(expeditions, 'id').id,
            byTier: index(expeditions, 'tier').tier,
        };
    }
    if (expeditionDrops) {
        const byExpedition = {};
        for (const d of expeditionDrops) {
            if (!byExpedition[d.expedition]) byExpedition[d.expedition] = [];
            byExpedition[d.expedition].push(d);
        }
        data.expeditionDrops = {
            list: expeditionDrops,
            byExpedition,
        };
    }

    data.ready = true;
}

async function fetchFresh() {
    const [skills, actions, items, drops, ingredients, structures, monsters, pets, petPassives, expeditions, expeditionDrops] = await Promise.all([
        api.listSkills(),
        api.listActions(),
        api.listItems(),
        api.listDrops(),
        api.listIngredients(),
        api.listStructures(),
        api.listMonsters(),
        api.listPets().catch(() => null),
        api.listPetPassives().catch(() => null),
        api.listExpeditions().catch(() => null),
        api.listExpeditionDrops().catch(() => null),
    ]);
    return { skills, actions, items, drops, ingredients, structures, monsters, pets, petPassives, expeditions, expeditionDrops };
}

export async function loadGameData() {
    pruneOldCaches();
    const cached = loadCache();

    if (cached) {
        // Stale-while-revalidate: use cache immediately so features activate
        // instantly, then refresh in the background.
        processRawData(cached);
        data.cached = true;
        console.log('[RiftScript] Loaded from cache, refreshing in background…');

        // Fire-and-forget background refresh
        fetchFresh().then(raw => {
            try {
                processRawData(raw);
                data.cached = false;
                saveCache(raw);
                console.log('[RiftScript] Background refresh complete');
            } catch (e) {
                console.warn('[RiftScript] Background refresh process failed:', e);
            }
        }).catch(e => {
            console.warn('[RiftScript] Background refresh failed (cache still good):', e.message);
        });
        return;
    }

    // No cache — fetch synchronously (first ever load or version bump)
    try {
        const raw = await fetchFresh();
        processRawData(raw);
        data.cached = false;
        saveCache(raw);
        console.log('[RiftScript] Game data loaded fresh');
    } catch (e) {
        console.error('[RiftScript] Initial fetch failed and no cache — features limited:', e.message);
    }
}
