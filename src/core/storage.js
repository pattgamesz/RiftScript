// Simple localStorage persistence for synced game data — scoped per game mode
import { getMode } from '../game/mode.js';

const PREFIX = 'riftscript_';

function key(name) {
    return `${PREFIX}${getMode()}_${name}`;
}

export function save(name, data) {
    try {
        localStorage.setItem(key(name), JSON.stringify({
            time: Date.now(),
            data,
        }));
    } catch (e) {
        console.warn('[RiftScript] Failed to save', name, e);
    }
}

export function load(name) {
    try {
        const raw = localStorage.getItem(key(name));
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

export function getAge(name) {
    const entry = load(name);
    if (!entry || !entry.time) return Infinity;
    return (Date.now() - entry.time) / 1000;
}

export function getData(name) {
    const entry = load(name);
    return entry?.data || null;
}
