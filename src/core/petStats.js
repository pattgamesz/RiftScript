// Persistent cache of pet stats keyed by (name | species | level).
// Pet names aren't unique — two same-species pets default to the same name.
// Combining with species + level prevents one pet overwriting another's stats.
// Populated when the user opens a pet's modal.
const KEY = 'riftscript_pet_stats_v2';

let cache = null;

function load() {
    if (cache) return cache;
    try {
        const raw = localStorage.getItem(KEY);
        cache = raw ? JSON.parse(raw) : {};
    } catch (e) { cache = {}; }
    return cache;
}

function persist() {
    try {
        localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (e) { /* quota */ }
}

function buildKey(pet) {
    // groupIndex disambiguates same-name+species+level pets (breeders),
    // assuming the game shows them in stable order.
    return `${pet?.name || ''}|${pet?.species ?? ''}|${pet?.level ?? ''}|${pet?.groupIndex ?? 0}`;
}

export function getPetStats(pet) {
    if (!pet?.name) return null;
    return load()[buildKey(pet)] || null;
}

export function setPetStats(pet, stats) {
    if (!pet?.name || !stats) return;
    load();
    const k = buildKey(pet);
    cache[k] = { ...cache[k], ...stats, updatedAt: Date.now() };
    persist();
}

export function getAllPetStats() {
    return { ...load() };
}

export function getCachedCount() {
    return Object.keys(load()).length;
}

export function clearAll() {
    cache = {};
    persist();
}
