// Fetches Rift guild member names from rift-guild.com's Firestore.
// Public read — no auth needed. Stale-while-revalidate: use cached data
// immediately even if expired, refresh in background, emit when updated.
import { gmFetch } from './request.js';
import * as events from './events.js';

const FIRESTORE_URL = 'https://firestore.googleapis.com/v1/projects/iw-gettopguilds/databases/(default)/documents/guildMembers';
const CACHE_KEY = 'riftscript_rift_members_v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h "fresh" — older data is still used, just refreshed in background

// guildKey -> { names: string[], guildName: string }
let memberData = { rift: null, riftacademy: null, riftchill: null };
let memberSet = new Set();      // case-insensitive, all 3 guilds combined
let memberByName = new Map();   // lowercased name -> { name, guildKey, guildName }

function readCacheAny() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed.time || !parsed.data) return null;
        return { data: parsed.data, age: Date.now() - parsed.time };
    } catch (e) {
        return null;
    }
}

function writeCache(data) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data }));
    } catch (e) { /* quota */ }
}

function rebuildIndexes() {
    memberSet = new Set();
    memberByName = new Map();
    for (const guildKey of Object.keys(memberData)) {
        const entry = memberData[guildKey];
        if (!entry?.names) continue;
        for (const name of entry.names) {
            const key = name.toLowerCase();
            memberSet.add(key);
            memberByName.set(key, { name, guildKey, guildName: entry.guildName });
        }
    }
}

async function fetchGuild(guildKey) {
    const doc = await gmFetch(`${FIRESTORE_URL}/${guildKey}`, { retries: 1 });
    const fields = doc?.fields || {};
    const names = (fields.names?.arrayValue?.values || [])
        .map(v => v.stringValue)
        .filter(Boolean);
    const guildName = fields.guildName?.stringValue || guildKey;
    return { names, guildName };
}

async function fetchAllAndPersist() {
    const guilds = ['rift', 'riftacademy', 'riftchill'];
    const results = await Promise.allSettled(guilds.map(fetchGuild));
    for (let i = 0; i < guilds.length; i++) {
        if (results[i].status === 'fulfilled') {
            memberData[guilds[i]] = results[i].value;
        }
    }
    rebuildIndexes();
    writeCache(memberData);
    events.emit('rift-members-loaded', { count: memberSet.size });
    return memberData;
}

export async function loadRiftMembers({ force = false } = {}) {
    const cached = readCacheAny();

    // Use any existing cache immediately so highlights work right away,
    // even if we're about to refresh.
    if (cached && !force) {
        memberData = cached.data;
        rebuildIndexes();
        if (cached.age < CACHE_TTL_MS) {
            return memberData; // fresh enough, no refresh needed
        }
        // Stale — refresh in background, don't block callers
        fetchAllAndPersist().catch(e => console.warn('[RiftScript] background member refresh failed:', e.message));
        return memberData;
    }

    // No cache at all (or forced refresh) — fetch synchronously
    return fetchAllAndPersist();
}

export function isRiftMember(name) {
    if (!name) return false;
    return memberSet.has(String(name).toLowerCase());
}

export function getMemberInfo(name) {
    if (!name) return null;
    return memberByName.get(String(name).toLowerCase()) || null;
}

export function getMemberCount() {
    return memberSet.size;
}

export function getGuildData() {
    return memberData;
}
