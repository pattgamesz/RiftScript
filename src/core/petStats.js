// Persistent cache of pet stats keyed by (name | species | level | groupIndex).
// Pet names aren't unique — two same-species pets default to the same name,
// so we add species + level + groupIndex to disambiguate. Populated when the
// user opens a pet's modal.
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
    // Prefer the stable apiId key — survives renames + level-ups. Falls
    // back to the legacy name|species|level|groupIndex key when apiId
    // isn't known yet (cold scrape before getUser enrichment) or when
    // the entry was written under the legacy key only.
    const idKey = apiKey(pet);
    if (idKey && c[idKey]) return c[idKey];
    return c[legacyKey(pet)] || null;
}

export function setPetStats(pet, stats) {
    if (!pet?.name || !stats) return;
    load();
    const lkey = legacyKey(pet);
    const entry = { ...cache[lkey], ...stats, updatedAt: Date.now() };
    // Write under the legacy key so the next session can still find this
    // entry while apiId isn't yet hydrated.
    cache[lkey] = entry;
    // Also write under the stable apiId key when we have one — this is what
    // lets the lookup survive renames + level-ups. Both keys point at the
    // same object; subsequent setPetStats updates both.
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
