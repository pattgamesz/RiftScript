// Adds Min / Low / High quick-fill buttons next to the Price input in the
// market listing/order modal. Reads values from the modal text.
import { getOnDefault } from '../core/settings.js';
import { parseNumber } from '../core/util.js';

const KEY = 'market-price-buttons';
const BTN_CONTAINER_ID = 'rs-market-price-buttons';

export function initMarketPriceButtons() {
    // The modal opens when you click a market row to make a listing/order.
    $(document).on('click', 'market-listings-component .search ~ button.row', () => addButtons('sell'));
    $(document).on('click', 'market-order-component .search ~ button.row', () => addButtons('order'));
    // Cover the case where rows are inside market-list-component on some pages
    $(document).on('click', 'market-list-component .search ~ button.row', () => addButtons('sell'));
}

async function addButtons(type) {
    if (!getOnDefault(KEY)) return;
    // Wait for the modal price input to appear (up to 1s).
    const input = await waitForInput();
    if (!input) return;
    if (document.getElementById(BTN_CONTAINER_ID)) return;

    const $input = $(input);
    const $container = $(`<div id="${BTN_CONTAINER_ID}" class="rs-price-btns"></div>`);

    $container.append(makeBtn('Min', () => findModalPrice('Minimum'), $input));
    if (type === 'order') {
        $container.append(makeBtn('High', () => findModalPrice('Market Highest'), $input));
    } else {
        $container.append(makeBtn('Low', () => findModalPrice('Market Lowest'), $input));
    }
    $input.before($container);
}

function waitForInput(timeout = 1000) {
    return new Promise(resolve => {
        const start = Date.now();
        const check = () => {
            const el = document.querySelector('.modal input[placeholder="Price"]');
            if (el) return resolve(el);
            if (Date.now() - start > timeout) return resolve(null);
            setTimeout(check, 50);
        };
        check();
    });
}

function makeBtn(label, getPrice, $input) {
    const $btn = $(`<button type="button" class="rs-price-btn">${label}</button>`);
    $btn.on('click', (e) => {
        e.preventDefault();
        const price = getPrice();
        if (!price) return;
        $input.val(price);
        $input[0].dispatchEvent(new Event('input', { bubbles: true }));
    });
    return $btn;
}

function findModalPrice(label) {
    const $row = $(`.modal .row:not(.item-description):contains("${label}")`);
    return parseNumber($row.text());
}
