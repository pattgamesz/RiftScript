// Pure data layer for the player's open guild quests. UI lives in marketFilter
// as a tab. Cache + reset-time aware so refresh only happens at the daily reset.
import { api } from '../core/api.js';
import { hasAuth } from '../core/auth.js';
import { data } from '../game/data.js';
import { getMode } from '../game/mode.js';

const CACHE_TTL_MS = 5 * 60_000;
const BACKOFF_MS = 5 * 60_000;

let guildCache = null;
let guildCacheTime = 0;
let inFlight = null;
let backoffUntil = 0;
let resetTimer = null;

export function clearGuildCache() {
    guildCache = null;
    guildCacheTime = 0;
}

export async function getQuests({ force = false } = {}) {
    if (getMode() !== 'multiplayer') return null;
    const guild = await getGuildData(force);
    if (!guild) return null;
    const quests = extractOpenQuests(guild);
    const resetRaw = guild?.quests?.reset;
    const resetAt = resetRaw ? Date.parse(resetRaw) : null;
    return { quests, resetAt };
}

// Schedule a one-shot timer at the reset timestamp. Invokes the callback once
// the cache has been cleared so the caller can re-render with fresh data.
export function scheduleResetRefresh(resetAt, onReset) {
    if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
    if (!resetAt) return;
    const delay = Math.max(0, resetAt - Date.now()) + 5_000;
    resetTimer = setTimeout(() => {
        clearGuildCache();
        if (typeof onReset === 'function') onReset();
    }, delay);
}

// The server's reset is at a fixed time each day. If the API's resetAt is
// already in the past (because the server is slow to roll over), shift it
// forward by whole 24h windows until it's in the future.
export function nextDailyReset(templateResetAt) {
    if (!templateResetAt) return null;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    let next = templateResetAt;
    while (next <= now) next += DAY_MS;
    return next;
}

export function formatTimeRemaining(ms) {
    const sec = Math.floor(ms / 1000);
    if (sec <= 0) return 'Resetting…';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

async function getGuildData(force = false) {
    if (!hasAuth()) return null;
    const now = Date.now();
    if (!force && guildCache && now - guildCacheTime < CACHE_TTL_MS) return guildCache;
    if (!force && now < backoffUntil) return guildCache;
    if (inFlight) return inFlight;
    inFlight = (async () => {
        try {
            const resp = await api.getGuild();
            guildCache = resp?.guild || resp;
            guildCacheTime = now;
            return guildCache;
        } catch (e) {
            backoffUntil = Date.now() + BACKOFF_MS;
            return guildCache;
        } finally {
            inFlight = null;
        }
    })();
    return inFlight;
}

function extractOpenQuests(guild) {
    const actions = guild?.quests?.actions;
    if (!actions || typeof actions !== 'object') return [];
    const raw = Array.isArray(actions) ? actions : Object.values(actions);

    return raw.map(q => {
        const itemId = q.itemId ?? q.item ?? q.itemID;
        const amount = +(q.required ?? q.amount ?? q.target ?? q.total ?? 0);
        const contributed = +(q.current ?? q.contributed ?? q.collected ?? q.progress ?? 0);
        const item = data.items?.byId?.[itemId] || data.items?.byId?.[+itemId];
        const itemName = item?.name || q.itemName || q.name;
        return { itemId, itemName, amount, contributed };
    }).filter(q => q.itemName && q.amount > q.contributed);
}
