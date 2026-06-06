// Persistent cache of pet stats. Indexed under two keys: the legacy
// (name|species|level|groupIndex) tuple AND a stable apiId-derived key
// when known. Both keys point at the same entry object, and every entry
// also carries its apiId in the value — that's what lets a rename or
// level-up still resolve back to the cached stats (we scan stored values
// for the matching apiId when both keys miss).
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
    return `${pet?.name || ''}|${pet?.species ?? ''}|${pet?.level ?? ''}|${pet?.groupIndex ?? 0}`;
}

function apiKey(pet) {
    return pet?.apiId ? `id:${pet.apiId}` : null;
}

export function getPetStats(pet) {
    if (!pet?.name) return null;
    const c = load();

    // 1) Stable apiId key — fastest path, survives rename + level-up.
    const idKey = apiKey(pet);
    if (idKey && c[idKey]) return c[idKey];

    // 2) Legacy name|species|level|groupIndex key. When this hits and the
    //    pet now has an apiId, migrate the entry forward so the apiId key
    //    is populated for next time. We also stamp the apiId into the
    //    entry value itself so case (3) below can find it after a rename.
    const lkey = legacyKey(pet);
    const legacy = c[lkey];
    if (legacy) {
        if (pet.apiId && !legacy.apiId) legacy.apiId = pet.apiId;
        if (idKey && !c[idKey]) {
            c[idKey] = legacy;
            persist();
        } else if (pet.apiId && !legacy.apiId) {
            persist();
        }
        return legacy;
    }

    // 3) Last resort — the pet has an apiId but no key in the cache matches
    //    (typical after a rename: new name → legacy key shifted, apiId key
    //    not yet populated because the modal hasn't been scraped on this
    //    build). Scan the cache for an entry whose stored apiId matches,
    //    then re-key it under both the current legacy + apiId keys.
    if (pet.apiId) {
        for (const entry of Object.values(c)) {
            if (entry?.apiId === pet.apiId) {
                c[lkey] = entry;
                if (idKey) c[idKey] = entry;
                persist();
                return entry;
            }
        }
    }
    return null;
}

export function setPetStats(pet, stats) {
    if (!pet?.name || !stats) return;
    load();
    const lkey = legacyKey(pet);
    const entry = {
        ...cache[lkey],
        ...stats,
        // Stamp apiId in the value so subsequent renames can still find
        // this entry via the scan in getPetStats() case 3.
        apiId: pet.apiId ?? cache[lkey]?.apiId,
        updatedAt: Date.now(),
    };
    cache[lkey] = entry;
    const idKey = apiKey(pet);
    if (idKey) cache[idKey] = entry;
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
