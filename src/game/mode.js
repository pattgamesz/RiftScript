// Detects whether the player is in Multiplayer or Singleplayer mode
import * as events from '../core/events.js';
import { pollUntilDone } from '../core/util.js';

let currentMode = null;

// Polls until we know the mode, then sleeps. Page events restart polling so a
// runtime mode switch (e.g. user toggles SP/MP) is picked up promptly.
const modePoller = pollUntilDone(() => {
    detectMode();
    return currentMode ? false : true;
}, 1000);

export function initModeDetector() {
    events.on('page', () => {
        // A page event might be from a mode toggle — re-detect to confirm.
        modePoller.start();
    });
}

export function getMode() {
    return currentMode || 'singleplayer';
}

function detectMode() {
    // The nav shows the mode you can SWITCH TO
    const switchText = $('nav-component .name.ng-star-inserted').first().text().trim().toLowerCase();
    let mode = null;
    if (switchText.includes('multiplayer')) {
        mode = 'multiplayer';
    } else if (switchText.includes('singleplayer') || switchText.includes('single')) {
        mode = 'singleplayer';
    }
    if (mode && mode !== currentMode) {
        currentMode = mode;
        events.emit('mode', mode);
    }
}
