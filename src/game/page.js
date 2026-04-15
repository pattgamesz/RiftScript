// Detects what page/action the player is viewing
import * as events from '../core/events.js';
import { parseNumber } from '../core/util.js';

let lastUrl = '';

export function initPageDetector() {
    // Inject a script into the page context to intercept Angular's history calls.
    // This is needed because @grant GM_xmlhttpRequest puts us in a sandbox
    // where we can't see the page's real history.pushState calls.
    const script = document.createElement('script');
    script.textContent = `
        (function() {
            const origPush = history.pushState;
            history.pushState = function() {
                origPush.apply(history, arguments);
                window.dispatchEvent(new CustomEvent('riftscript-url', { detail: arguments[2] }));
            };
            const origReplace = history.replaceState;
            history.replaceState = function() {
                origReplace.apply(history, arguments);
                window.dispatchEvent(new CustomEvent('riftscript-url', { detail: arguments[2] }));
            };
        })();
    `;
    document.head.appendChild(script);
    script.remove();

    // Listen for the custom event from the page context
    window.addEventListener('riftscript-url', (e) => {
        if (e.detail) detectPage(e.detail);
    });

    // Also listen for popstate (back/forward)
    window.addEventListener('popstate', () => {
        detectPage(window.location.href);
    });

    // Initial detection
    detectPage(window.location.href);
}

function detectPage(url) {
    if (!url) return;
    url = String(url);
    if (url === lastUrl) return;
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
