// Plays a short beep when your current action stops (you become idle).
// Off by default. Suppressed for ~2s after a page change so navigating away
// from a running action doesn't fire a false positive.
import * as events from '../core/events.js';
import { get } from '../core/settings.js';

const KEY = 'idle-beep';
const NAV_COOLDOWN_MS = 2000;
let lastActive = null;
let lastPageChange = 0;
let audioCtx = null;

export function initIdleBeep() {
    events.on('page', () => {
        lastPageChange = Date.now();
        // Reset so the next active→inactive transition only fires after a
        // genuine in-page stop, not the navigation-induced DOM teardown.
        lastActive = null;
    });

    events.on('action-active', (isActive) => {
        const justNavigated = Date.now() - lastPageChange < NAV_COOLDOWN_MS;
        if (lastActive === true && isActive === false && !justNavigated) {
            if (get(KEY)) beep();
        }
        lastActive = isActive;
    });
}

// Synthesize a short pleasant beep with WebAudio — no external audio file needed.
function beep() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
        console.warn('[RiftScript] beep failed:', e);
    }
}
