// Adds a "Target" button next to Buy/Order in the market modal that sets the
// quantity to (target - owned) so you fill up to a desired total instead of
// adding to your current stock.
import { getOnDefault } from '../core/settings.js';
import { parseNumber } from '../core/util.js';

const KEY = 'market-target-amount';
const BTN_ID = 'rs-market-target-btn';

let observer;

export function initTargetAmountMarket() {
    // Observe the page for modals appearing. The market modal mounts inside
    // market-listings-component or market-order-component.
    observer = new MutationObserver(() => maybeAddButton());
    observer.observe(document.body, { childList: true, subtree: true });
}

function maybeAddButton() {
    if (!getOnDefault(KEY)) return;
    if (document.getElementById(BTN_ID)) return;

    const $modal = $('.modal, market-listings-component div.preview, market-order-component div.modal').last();
    if (!$modal.length) return;

    const $actionBtn = $modal.find('button.action:contains("Buy"),button.action:contains("Order")').first();
    if (!$actionBtn.length) return;

    const $input = $modal.find('input[placeholder="Quantity"]').first();
    if (!$input.length) return;

    // Clone the existing Buy/Order button so we inherit Angular's scoped
    // CSS (the [_ngcontent-*] attrs) — looks identical to the game's button.
    const $target = $actionBtn.clone(false)
        .removeAttr('id')
        .attr('id', BTN_ID)
        .addClass('rs-target-btn')
        .text('Target')
        .attr('disabled', true);
    $actionBtn.before($target);

    const recompute = () => {
        const value = +$input.val() || 0;
        const owned = getRowNumber($modal, 'Owned');
        const available = getRowNumber($modal, 'Available') || Infinity;
        const ok = !!value && value > owned && (value - owned) <= available;
        $target.prop('disabled', !ok);
    };

    $input.on('change paste keyup input', recompute);
    $target.on('click', (e) => {
        e.preventDefault();
        const value = +$input.val() || 0;
        const owned = getRowNumber($modal, 'Owned');
        const newQty = Math.max(0, value - owned);
        $input.val(newQty);
        $input[0].dispatchEvent(new Event('input', { bubbles: true }));
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
