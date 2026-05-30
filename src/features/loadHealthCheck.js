// Surfaces a refresh prompt in the bottom-right when the script has clearly
// failed to initialize key pieces (game data + auth token). Re-uses the same
// rs-update-notice slot the version checker uses, so only one toast at a time.
import { data } from '../game/data.js';
import { hasAuth } from '../core/auth.js';

const FIRST_CHECK_MS = 15_000; // 15s — enough for cache-warm + auth IndexedDB
const RETRY_CHECK_MS = 30_000; // 30s — try again before giving up + showing
const NOTICE_ID = 'riftscript-load-failure';

export function initLoadHealthCheck() {
    setTimeout(maybeShow, FIRST_CHECK_MS);
    setTimeout(maybeShow, RETRY_CHECK_MS);
}

function maybeShow() {
    if (document.getElementById(NOTICE_ID)) return; // already showing
    const issues = [];
    if (!data.ready) issues.push('game data');
    if (!hasAuth()) issues.push('auth token');
    if (!issues.length) return;

    const notice = $(`
        <div id="${NOTICE_ID}" class="rs-update-notice">
            <div class="rs-update-text">
                <strong>RiftScript didn't load fully</strong>
                <span>${issues.join(' + ')} unavailable — refresh to retry</span>
            </div>
            <button class="rs-update-btn rs-refresh-btn">Refresh</button>
            <button class="rs-update-dismiss">✕</button>
        </div>
    `);
    notice.find('.rs-refresh-btn').on('click', () => location.reload());
    notice.find('.rs-update-dismiss').on('click', () => notice.remove());
    $('body').append(notice);
}
