// Reads market listings from the DOM and enriches them with seller names
// from the api-2.ironwoodrpg.com/getMarketItems API.
import * as events from '../core/events.js';
import { parseNumber, debounce } from '../core/util.js';
import { data } from './data.js';
import { api } from '../core/api.js';
import { hasAuth } from '../core/auth.js';

const LISTING_ROW = 'market-listings-component .search ~ button';
let inProgress = false;

// API cache — getMarketItems gives us a flat list of all current listings.
// 5min TTL: market data is stable enough and the endpoint is expensive.
let apiCache = null;
let apiCacheTime = 0;
let apiInFlight = null;
let apiBackoffUntil = 0;
const API_TTL_MS = 5 * 60_000;
const API_BACKOFF_MS = 5 * 60_000;

export function initMarketReader() {
    events.on('page', onPage);
    $(document).on('input', 'market-listings-component .search > input', debounce(trigger, 500));
    $(document).on('click', 'market-listings-component .card > .tabs > button', () => {
        setTimeout(trigger, 200);
    });
}

function onPage(page) {
    if (page?.type !== 'market') return;
    // Listing rows render asynchronously after the market-listings-component
    // mounts. Retry until rows appear (or we've waited 5s).
    let attempts = 0;
    const maxAttempts = 20;
    const poll = () => {
        attempts++;
        const ready = $('market-listings-component .search ~ button').length > 0;
        if (ready) {
            trigger();
            return;
        }
        if (attempts < maxAttempts) {
            setTimeout(poll, 250);
        }
    };
    poll();
}

export function trigger() {
    const page = events.last('page');
    if (page?.type !== 'market') return;
    readMarketScreen();
}

async function getApiListings() {
    if (!hasAuth()) return null;
    const now = Date.now();
    if (apiCache && now - apiCacheTime < API_TTL_MS) return apiCache;
    if (now < apiBackoffUntil) return apiCache; // back off after errors
    if (apiInFlight) return apiInFlight;        // de-dupe concurrent fetches
    apiInFlight = (async () => {
        try {
            const resp = await api.getMarketItems();
            apiCache = normalizeApiResponse(resp);
            apiCacheTime = now;
            return apiCache;
        } catch (e) {
            // Back off 2min so we don't spam the API or trigger any in-game
            // error toasts if the user's session is in a weird state.
            apiBackoffUntil = Date.now() + API_BACKOFF_MS;
            return apiCache; // fall back to last good cache, may be null
        } finally {
            apiInFlight = null;
        }
    })();
    return apiInFlight;
}

// Normalize the API response to a flat array of {item, amount, price, type, seller}
// Confirmed shape: { listings: [{ id, createdAt, name, cost, amount, itemId, type }], ... }
function normalizeApiResponse(resp) {
    // Merge every array-typed field; we don't know which holds the seller-attributed
    // listings (could be `listings`, `items`, or both).
    let raw = [];
    if (Array.isArray(resp)) raw = resp;
    else if (resp && typeof resp === 'object') {
        for (const v of Object.values(resp)) if (Array.isArray(v)) raw = raw.concat(v);
    }
    return raw.map(r => ({
        item: r.itemId ?? r.item ?? r.itemID,
        amount: Number(r.amount ?? r.quantity ?? r.count ?? 0),
        price: Number(r.cost ?? r.price ?? r.gold ?? 0),
        type: (r.type ?? r.listingType ?? r.side ?? '').toString().toUpperCase(),
        seller: r.name ?? r.sellerName ?? r.seller ?? r.playerName ?? r.displayName
              ?? r.userName ?? r.username ?? r.player ?? r.user ?? r.owner ?? null,
    })).filter(l => l.item != null && l.seller);
}

async function readMarketScreen() {
    if (inProgress) return;
    if (!$('market-listings-component').length) return;
    inProgress = true;
    try {
        const selectedTab = $('market-listings-component .card > .tabs > button.tab-active').text().trim().toLowerCase();
        const tabType = selectedTab === 'orders' ? 'BUY' : selectedTab === 'listings' ? 'OWN' : 'SELL';

        const domListings = [];
        $(LISTING_ROW).each((_i, el) => {
            const $el = $(el);
            const name = $el.find('.name').first().text().trim();
            const item = data.items.byName[name];
            if (!item) return;
            const amount = parseNumber($el.find('.amount').first().text());
            // Read price from .cost but strip our own chips first — they live
            // inside .cost and would otherwise pollute parseNumber on re-read.
            const $costClone = $el.find('.cost').first().clone();
            $costClone.find('.rs-value-chip, .rs-ratio-chip').remove();
            const price = parseNumber($costClone.text());
            const listingType = tabType !== 'OWN'
                ? tabType
                : $el.find('.tag').length ? 'BUY' : 'SELL';
            const isOwn = !!$el.attr('disabled');
            domListings.push({
                type: listingType,
                item: item.id,
                itemName: name,
                amount,
                price,
                isOwn,
                seller: null,
                element: $el,
            });
        });

        // Attach seller info from API (best-effort, doesn't block)
        if (tabType !== 'OWN' && domListings.length) {
            const apiList = await getApiListings();
            if (apiList) attachSellers(domListings, apiList, tabType);
        }

        events.emit('reader-market', {
            type: tabType,
            count: domListings.length,
            listings: domListings,
        });
    } catch (e) {
        console.warn('[RiftScript] market reader error:', e);
    } finally {
        inProgress = false;
    }
}

// Match each DOM row to an API listing. Try most-specific to least-specific keys.
function attachSellers(domListings, apiList, tabType) {
    // Build three pools of decreasing specificity
    const byItemPriceAmt = new Map();
    const byItemPrice = new Map();
    const byItem = new Map();
    const apiTypes = new Set();
    for (const api of apiList) {
        apiTypes.add(api.type || '(empty)');
        const it = String(api.item);
        const k3 = `${it}|${api.price}|${api.amount}`;
        const k2 = `${it}|${api.price}`;
        if (!byItemPriceAmt.has(k3)) byItemPriceAmt.set(k3, []);
        if (!byItemPrice.has(k2))    byItemPrice.set(k2, []);
        if (!byItem.has(it))         byItem.set(it, []);
        byItemPriceAmt.get(k3).push(api.seller);
        byItemPrice.get(k2).push(api.seller);
        byItem.get(it).push(api.seller);
    }
    let m3 = 0, m2 = 0, m1 = 0;
    for (const dom of domListings) {
        const it = String(dom.item);
        const k3 = `${it}|${dom.price}|${dom.amount}`;
        const k2 = `${it}|${dom.price}`;
        let bucket = byItemPriceAmt.get(k3);
        if (bucket?.length) { dom.seller = bucket.shift(); m3++; continue; }
        bucket = byItemPrice.get(k2);
        if (bucket?.length) { dom.seller = bucket.shift(); m2++; continue; }
        bucket = byItem.get(it);
        if (bucket?.length) { dom.seller = bucket.shift(); m1++; continue; }
    }
    const total = m3 + m2 + m1;
    // Only log if matching breaks, so the console stays quiet in normal use.
    if (total === 0 && domListings.length && apiList.length) {
        console.warn(`[RiftScript] seller-match failed: 0/${domListings.length} matched. API total=${apiList.length}, types=${[...apiTypes].join(',')}`);
        console.warn('[RiftScript] sample DOM row:', { item: domListings[0].item, itemName: domListings[0].itemName, price: domListings[0].price, amount: domListings[0].amount, type: domListings[0].type });
        const apiSample = apiList.find(a => String(a.item) === String(domListings[0].item)) || apiList[0];
        console.warn('[RiftScript] sample API row:', apiSample);
    }
}
