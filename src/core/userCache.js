// Shared getUser cache — every feature that needs the player's API data goes
// through here so we hit the endpoint at most once per TTL window.
//
// - 5 minute TTL: balance between freshness and respecting the API.
// - localStorage-backed: survives navigation between game pages.
// - In-flight dedup: parallel callers share one network request.
// - Stale-cache fallback: if the network call fails, callers still get
//   whatever was last cached (better than null).
import { api } from './api.js';
import { hasAuth } from './auth.js';

const STORAGE_KEY = 'riftscript_user_cache_v1';
const TTL_MS = 5 * 60 * 1000;
const MAX_STALE_MS = 24 * 60 * 60 * 1000;

let memCache = null;
let memTime = 0;
let inFlight = null;
let hydrated = false;

function hydrate() {
    if (hydrated) return;
    hydrated = true;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed?.data && typeof parsed.time === 'number') {
            // Drop ancient caches (>24h) to avoid serving badly stale data on
            // first load after a long break.
            if (Date.now() - parsed.time < MAX_STALE_MS) {
                memCache = parsed.data;
                memTime = parsed.time;
            }
        }
    } catch (e) { /* corrupt cache, ignore */ }
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: memCache, time: memTime }));
    } catch (e) { /* quota / serialization */ }
}

async function fetchFresh() {
    try {
        const resp = await api.getUser();
        memCache = resp;
        memTime = Date.now();
        save();
        return memCache;
    } catch (e) {
        console.warn('[RiftScript] getUser fetch failed:', e.message);
        return memCache; // serve stale on failure
    }
}

// Returns user data. Refetches when older than maxAgeMs (default TTL_MS).
// Pass { force: true } to bypass the cache entirely.
export async function getUser({ force = false, maxAgeMs = TTL_MS } = {}) {
    hydrate();
    const now = Date.now();
    if (!force && memCache && now - memTime < maxAgeMs) return memCache;
    if (inFlight) return inFlight;
    if (!hasAuth()) return memCache; // no token yet — return stale or null
    inFlight = fetchFresh().finally(() => { inFlight = null; });
    return inFlight;
}

// Synchronous read of whatever is currently cached. Never fetches.
export function getCachedUser() {
    hydrate();
    return memCache;
}

// Prime the cache once at startup. Waits briefly for auth so we don't bail
// before the token is read from IndexedDB. Best-effort — failures are logged.
export async function primeUserCache() {
    hydrate();
    for (let i = 0; i < 60; i++) {
        if (hasAuth()) break;
        await new Promise(r => setTimeout(r, 1000));
    }
    if (!hasAuth()) return memCache;
    return getUser();
}
