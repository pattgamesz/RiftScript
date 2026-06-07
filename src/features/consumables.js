// Equipped consumables for the current skill page — what's actually being
// burned every hour.
//
// Identification comes from the in-game Consumables card (canonical: the
// game already filters by skill type — gather page shows gather potions,
// craft page shows craft potions). For stored counts we sum getUser
// inventory + the equipment slot's own stack, since the equipped stack
// runs out first and the game then auto-pulls from inventory.
//
// Mastery Contract is intentionally excluded from this list. Its in-game
// on/off toggle is rendered as a CSS slider with no semantic checkbox or
// aria attribute and labels that may not appear in DOM text — every
// detection strategy we tried produced false positives that pinned a
// phantom bottleneck on it. Better to omit than to inflate costs.
import { getCachedUser } from '../core/userCache.js';
import { data } from '../game/data.js';

const MASTERY_CONTRACT_ID = 1041;

function totalStockFor(itemId, user) {
    if (!user) return 0;
    let total = +(user.inventory?.[itemId]?.amount
              || user.inventory?.[String(itemId)]?.amount
              || 0);
    const eq = user.equipment || {};
    for (const slot of Object.keys(eq)) {
        const e = eq[slot];
        if (e && +e.id === +itemId) total += +(e.amount || 0);
    }
    return total;
}

// Returns [{ itemId, item, role: 'food' | 'buff', count }], one per row in
// the visible Consumables card that has a recognisable item icon and a
// supported attribute (HEAL for food, DURATION for sigil/potion/brew).
export function getEquippedConsumables() {
    if (!data.items) return [];
    const user = getCachedUser()?.user || null;
    const out = [];
    $('skill-page .header > .name:contains("Consumables")')
        .closest('.card')
        .find('.row')
        .each((_i, el) => {
            const $el = $(el);
            const fullText = $el.text() || '';
            if (/Empty/i.test(fullText)) return;

            const src = $el.find('img').first().attr('src') || '';
            const filename = src.split('/').pop() || '';
            const item = data.items.byImage?.[filename];
            if (!item) return;

            // Skip the Mastery Contract row — see file header comment.
            if (item.id === MASTERY_CONTRACT_ID) return;

            const heal = item.attributes?.HEAL;
            const duration = item.attributes?.DURATION;
            const role = heal ? 'food' : duration ? 'buff' : null;
            if (!role) return;

            const count = totalStockFor(item.id, user);
            out.push({ itemId: item.id, item, role, count });
        });
    return out;
}
