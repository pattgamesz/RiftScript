// Shows colored dots on your own market listings indicating if other players
// match or undercut your price (warning vs danger). Mirrors Pancake's pattern.
import * as events from '../core/events.js';
import { formatNumber } from '../core/util.js';
import { getOnDefault } from '../core/settings.js';

const KEY = 'market-competition';
let lastByType = { SELL: null, BUY: null, OWN: null };

export function initMarketCompetition() {
    events.on('reader-market', handleMarketData);
}

function handleMarketData(marketData) {
    if (!marketData?.listings) return;
    lastByType[marketData.type] = marketData;

    // We render competition only when viewing OWN listings; need SELL+BUY data
    // cached from the most recent visit so we can compare.
    if (marketData.type !== 'OWN') return;
    if (!getOnDefault(KEY)) {
        $('.rs-market-competition').remove();
        return;
    }

    showCircles(marketData);
}

function showCircles(ownData) {
    $('.rs-market-competition').remove();

    for (const listing of ownData.listings) {
        const otherType = lastByType[listing.type];
        if (!otherType) continue;

        const matching = otherType.listings.filter(a => !a.isOwn && a.item === listing.item);
        const same = matching.filter(a => a.price === listing.price);
        const better = matching.filter(a =>
            (listing.type === 'SELL' && a.price < listing.price) ||
            (listing.type === 'BUY' && a.price > listing.price)
        );
        if (!same.length && !better.length) continue;

        const cls = better.length ? 'rs-market-competition-danger' : 'rs-market-competition-warning';
        const text = better.concat(same)
            .map(a => `${formatNumber(a.amount)} @ ${formatNumber(a.price)}`)
            .join(' / ');
        listing.element.find('.cost').before(
            `<div class="rs-market-competition ${cls}" title="${text}"></div>`
        );
    }
}
