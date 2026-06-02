// Persistent cache of pet stats keyed by the getUser apiId when available,
// falling back to name|species|level|groupIndex for entries written before
// apiId became known. The apiId is stable across levelling — keying by
// (name|species|level|...) used to invalidate every cache entry the moment
// a pet levelled up, forcing the user to re-open the modal.
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

function legacyKey(pet) {
    // groupIndex disambiguates same-name+species+level pets (breeders),
    // assuming the game shows them in stable order.
    return `${pet?.name || ''}|${pet?.species ?? ''}|${pet?.level ?? ''}|${pet?.groupIndex ?? 0}`;
}

function apiKey(pet) {
    return pet?.apiId ? `id:${pet.apiId}` : null;
}

export function getPetStats(pet) {
    if (!pet?.name) return null;
    const c = load();
    const idKey = apiKey(pet);
    if (idKey && c[idKey]) return c[idKey];
    // Legacy fallback. When we also know the apiId, migrate the entry
    // forward so subsequent level-ups stay valid.
    const lkey = legacyKey(pet);
    const legacy = c[lkey];
    if (legacy && idKey) {
        c[idKey] = legacy;
        delete c[lkey];
        persist();
        return legacy;
    }
    return legacy || null;
}

export function setPetStats(pet, stats) {
    if (!pet?.name || !stats) return;
    load();
    // Prefer stable apiId; fall back to legacy key when the apiId isn't
    // available yet (rare: getUser hasn't responded on a cold load).
    const k = apiKey(pet) || legacyKey(pet);
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
