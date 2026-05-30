// XP / Level formulas
export function levelToExp(level) {
    if (level <= 1) return 0;
    if (level <= 100) return Math.floor(Math.pow(level, 3.5) * 6 / 5);
    return Math.round(12_000_000 * Math.pow(Math.pow(3500, 0.01), level - 100));
}

export function expToLevel(exp) {
    if (exp <= 0) return 1;
    if (exp <= 12_000_000) return Math.floor(Math.pow((exp + 1) / 1.2, 1 / 3.5));
    return 100 + Math.floor(Math.log((exp + 1) / 12_000_000) / Math.log(Math.pow(3500, 0.01)));
}

export function expToNextLevel(exp) {
    return levelToExp(expToLevel(exp) + 1) - exp;
}

export function expToNextTier(exp) {
    const level = expToLevel(exp);
    let target = 10;
    while (target <= level) target += 15;
    return levelToExp(target) - exp;
}

export function expToGoalLevel(exp, goalLevel) {
    return levelToExp(goalLevel) - exp;
}

// Tier ↔ Level
export function tierToLevel(tier) {
    return tier <= 1 ? tier : tier * 15 - 20;
}

// Number formatting
export function formatNumber(n) {
    let digits = 2;
    if (n < 0.1 && n > -0.1) digits = 3;
    if (n < 0.01 && n > -0.01) digits = 4;
    return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function parseNumber(text) {
    if (!text || text.includes('Empty')) return 0;
    const match = /\d+[^\s]*/.exec(text);
    if (!match) return 0;
    let s = match[0].replace(/,/g, '').replace(/&.*$/, '');
    let mult = 1;
    if (s.endsWith('%')) mult = 0.01;
    if (s.endsWith('K')) mult = 1_000;
    if (s.endsWith('M')) mult = 1_000_000;
    return Math.round((parseFloat(s) || 0) * mult * 100) / 100;
}

// Time formatting
export function secondsToDuration(sec) {
    sec = Math.floor(sec);
    if (sec > 86400 * 100) return 'A very long time';
    const d = Math.floor(sec / 86400); sec %= 86400;
    const h = Math.floor(sec / 3600);  sec %= 3600;
    const m = Math.floor(sec / 60);    sec %= 60;
    let r = '';
    if (r || d) r += `${String(d).padStart(2,'0')}d `;
    if (r || h) r += `${String(h).padStart(2,'0')}h `;
    if (r || m) r += `${String(m).padStart(2,'0')}m `;
    r += `${String(sec).padStart(2,'0')}s`;
    return r;
}

export function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

export function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// HTML / regex escaping
const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => HTML_ESCAPE[c]);
}
export const escapeAttr = escapeHtml;

export function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Mobile breakpoint for panels that reposition on small screens.
export const MOBILE_BREAKPOINT = 750;

// Try fn now and after delay(s) — used to catch Angular component mounts that
// finish slightly after our page event fires.
export function retryAfter(fn, delays = [200, 800]) {
    for (const ms of delays) setTimeout(fn, ms);
}

// setInterval that skips ticks when the browser tab is hidden. Same return
// value as setInterval (an id you can pass to clearInterval).
export function pollWhileVisible(fn, ms) {
    return setInterval(() => {
        if (document.hidden) return;
        fn();
    }, ms);
}

// Self-terminating poller. fn() returns false to signal "done, stop polling".
// Skips ticks while the tab is hidden. Returns a handle with start/stop —
// callers can stop manually or call start() to resume after a previous stop.
export function pollUntilDone(fn, ms) {
    let id = null;
    const handle = {
        start() {
            if (id) return;
            id = setInterval(() => {
                if (document.hidden) return;
                if (fn() === false) handle.stop();
            }, ms);
        },
        stop() {
            if (id) clearInterval(id);
            id = null;
        },
        get running() { return id !== null; },
    };
    handle.start();
    return handle;
}
