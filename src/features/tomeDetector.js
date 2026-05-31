// Detects the player's Insatiable Power Tome level once per session (or first
// run after a fresh install) and caches it in localStorage. Tome level caps
// at 8 — once we've recorded that, we never hit the API again.
//
// Used by the estimator to model the tome's HP/s food drain on every skill
// (not just combat). Linear formula: level × 0.2 HP/s. T8 = 1.6, T1 = 0.2.
import { api } from '../core/api.js';
import { hasAuth } from '../core/auth.js';
import { data } from '../game/data.js';

const STORAGE_KEY = 'riftscript_insatiable_tome_v1';
const MAX_LEVEL = 8;
const NAME_PREFIX = 'Insatiable Power Tome';

let cachedLevel = null;
let attempted = false;

function loadCache() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (typeof parsed?.level === 'number') cachedLevel = parsed.level;
    } catch (e) { /* corrupt cache, ignore */ }
}

function saveCache(level) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ level, time: Date.now() }));
    } catch (e) { /* quota, ignore */ }
}

// Sync getter for the rest of the script. Returns 0 if unknown.
export function getInsatiableTomeLevel() {
    if (cachedLevel === null) loadCache();
    return cachedLevel || 0;
}

// Linear HP/s drain: T-N = N × 0.2 HP/s.
export function getInsatiableHps() {
    return getInsatiableTomeLevel() * 0.2;
}

export async function initTomeDetector() {
    loadCache();
    // Already at max — tome can't level up, never re-fetch.
    if (cachedLevel === MAX_LEVEL) return;
    if (attempted) return;
    attempted = true;
    if (!hasAuth() || !data.items) return;
    try {
        const resp = await api.getUser();
        const level = findInsatiableTomeLevel(resp);
        if (level > 0 && level !== cachedLevel) {
            cachedLevel = level;
            saveCache(level);
        }
    } catch (e) { /* swallow */ }
}

// Walk the getUser response recursively, collect every id-looking field,
// match against data.items by name prefix. We accept any item whose name
// starts with 'Insatiable Power Tome ' and parse the trailing tier number.
function findInsatiableTomeLevel(resp) {
    const ids = new Set();
    collectIds(resp, ids);
    let best = 0;
    for (const rawId of ids) {
        const id = +rawId;
        if (!id) continue;
        const item = data.items.byId[id];
        if (!item?.name?.startsWith(NAME_PREFIX)) continue;
        const m = item.name.match(/(\d+)\s*$/);
        const level = m ? +m[1] : 0;
        if (level > best) best = level;
    }
    return best;
}

function collectIds(node, out) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
        for (const v of node) collectIds(v, out);
        return;
    }
    for (const [k, v] of Object.entries(node)) {
        if (k === 'id' || k === 'itemId') {
            const n = +v;
            if (n) out.add(n);
        } else {
            collectIds(v, out);
        }
    }
}
