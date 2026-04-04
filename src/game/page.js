// Detects what page/action the player is viewing
import * as events from '../core/events.js';
import { parseNumber } from '../core/util.js';

let lastUrl = '';

export function initPageDetector() {
    // Intercept URL changes
    const origPush = history.pushState;
    history.pushState = function() {
        origPush.apply(history, arguments);
        detectPage(arguments[2]);
    };
    const origReplace = history.replaceState;
    history.replaceState = function() {
        origReplace.apply(history, arguments);
        detectPage(arguments[2]);
    };
    // Poll URL for changes Angular routing might not trigger via pushState
    setInterval(() => {
        const url = window.location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            detectPage(url);
        }
    }, 500);
    // Initial detection
    detectPage(window.location.href);
}

function detectPage(url) {
    if (!url) return;
    lastUrl = url;
    const parts = url.replace(/.*ironwoodrpg\.com/, '').split('/').filter(Boolean);

    if (url.includes('/skill/') && url.includes('/action/')) {
        events.emit('page', {
            type: 'action',
            skill: +parts[parts.indexOf('skill') + 1],
            action: +parts[parts.indexOf('action') + 1],
        });
    } else if (url.includes('/skill/15')) {
        events.emit('page', { type: 'taming' });
    } else if (url.includes('house/build')) {
        events.emit('page', { type: 'structure' });
    } else if (url.includes('house/enchant')) {
        events.emit('page', { type: 'enchantment' });
    } else {
        events.emit('page', { type: parts[parts.length - 1] || 'home' });
    }
}
