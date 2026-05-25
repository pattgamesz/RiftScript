// Warns when the visible market listings hit the cap (250) — meaning there
// are more listings than the game can show on screen.
import * as events from '../core/events.js';
import { getOnDefault } from '../core/settings.js';

const KEY = 'market-listing-limit';
const LIMIT = 250;
const WARN_ID = 'rs-market-listing-limit-warning';

export function initMarketListingLimit() {
    events.on('reader-market', update);
}

function update(marketData) {
    $(`#${WARN_ID}`).remove();
    if (!getOnDefault(KEY)) return;
    if (!marketData) return;
    if (marketData.type === 'OWN') return;
    if (marketData.count <= LIMIT) return;
    if (marketData.listings.length < LIMIT) return;

    const $target = $('market-page .count');
    if (!$target.length) return;
    $target.before(
        `<div id="${WARN_ID}" class="rs-listing-limit-warning">
            <span class="rs-listing-limit-icon">⚠</span>
            Showing ${LIMIT} of ${marketData.count} — not all listings visible
        </div>`
    );
}
