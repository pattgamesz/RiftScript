// Adds a "Target" button next to Craft in the skill-page craft modal that
// sets the quantity to (target - owned) so you craft up to a desired total
// instead of stacking on top of what you already have. Mirror of the market
// version, scoped to the in-game crafting modal.
import { getOnDefault } from '../core/settings.js';
import { parseNumber } from '../core/util.js';

const KEY = 'craft-target-amount';
const BTN_ID = 'rs-craft-target-btn';

let observer;

export function initTargetAmountCrafting() {
    // The crafting modal mounts inside skill-page > modal-component. The same
    // observer pattern is fine — guards on selector + setting key keep work
    // out of unrelated mutations.
    observer = new MutationObserver(() => maybeAddButton());
    observer.observe(document.body, { childList: true, subtree: true });
}

function maybeAddButton() {
    if (!getOnDefault(KEY)) return;
    if (document.getElementById(BTN_ID)) return;

    // Only react to a craft modal sitting inside a skill-page (avoids firing
    // on market or other unrelated modals).
    const $modal = $('skill-page modal-component .modal, skill-page modal-component div.wrapper').last();
    if (!$modal.length) return;

    const $craftBtn = $modal.find('button.craft:contains("Craft")').first();
    if (!$craftBtn.length) return;

    const $input = $modal.find('input[name=quantity], input[placeholder="Quantity"]').first();
    if (!$input.length) return;

    // Clone the game's Craft button so we inherit Angular's scoped CSS attrs
    // and get an identical look to the native button.
    const $target = $craftBtn.clone(false)
        .removeAttr('id')
        .attr('id', BTN_ID)
        .addClass('rs-target-btn')
        .text('Target')
        .attr('disabled', true);
    $craftBtn.before($target);

    const recompute = () => {
        const value = +$input.val() || 0;
        const owned = getRowNumber($modal, 'Owned');
        // Enabled only when the user has typed a target greater than what they
        // already own — otherwise there's nothing to craft to reach the target.
        $target.prop('disabled', !(value && value > owned));
    };

    $input.on('change paste keyup input', recompute);
    $target.on('click', (e) => {
        e.preventDefault();
        const value = +$input.val() || 0;
        const owned = getRowNumber($modal, 'Owned');
        const newQty = Math.max(0, value - owned);
        $input.val(newQty);
        $input[0].dispatchEvent(new Event('input', { bubbles: true }));
        // Pancake's version auto-clicks the Craft button here. We let the user
        // press Craft themselves so they can sanity-check the new amount first.
    });
    recompute();
}

function getRowNumber($modal, label) {
    const $row = $modal.find(`.row:contains("${label}")`);
    if (!$row.length) return 0;
    const text = $row.contents().filter(function() {
        return this.nodeType === Node.TEXT_NODE;
    }).text();
    return parseNumber(text);
}
