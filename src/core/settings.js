// Global (not mode-scoped) feature toggles, persisted in localStorage.
const PREFIX = 'riftscript_global_';

export function get(name, fallback = null) {
    try {
        const raw = localStorage.getItem(PREFIX + name);
        if (raw === null) return fallback;
        return JSON.parse(raw);
    } catch (e) { return fallback; }
}

export function set(name, value) {
    try {
        localStorage.setItem(PREFIX + name, JSON.stringify(value));
    } catch (e) { /* quota */ }
}

// Default-on settings: returns true if never set, false only if explicitly set false.
export function getOnDefault(name) {
    const v = get(name);
    return v === null ? true : !!v;
}
