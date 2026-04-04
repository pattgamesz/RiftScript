// Detects whether the player is in Multiplayer or Singleplayer mode
import * as events from '../core/events.js';

let currentMode = null;

export function initModeDetector() {
    setInterval(detectMode, 1000);
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
        console.log('[RiftScript] Game mode:', mode);
        events.emit('mode', mode);
    }
}
