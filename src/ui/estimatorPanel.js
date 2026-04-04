// Renders the estimator panel into the game UI
import * as events from '../core/events.js';
import * as storage from '../core/storage.js';
import { formatNumber, secondsToDuration } from '../core/util.js';
import { calcGoalTime } from '../features/estimator.js';
import { isLinked, setTimer } from '../features/discord.js';
import { data } from '../game/data.js';

const PANEL_ID = 'riftscript-estimator';
let goalLevel = 100;
let activeTab = 'action';

// Custom item prices — persisted to localStorage
let customPrices = {};

function loadCustomPrices() {
    customPrices = storage.getData('custom-prices') || {};
}

function saveCustomPrice(itemId, price) {
    customPrices[itemId] = price;
    storage.save('custom-prices', customPrices);
}

function getPrice(itemId) {
    if (customPrices[itemId] !== undefined) return customPrices[itemId];
    const item = data.items?.byId[itemId];
    return item?.attributes?.MIN_MARKET_PRICE || item?.attributes?.SELL_PRICE || 0;
}

export function initEstimatorPanel() {
    loadCustomPrices();
    events.on('estimation', onEstimation);
    events.on('page', (page) => {
        if (page.type !== 'action') $(`#${PANEL_ID}`).remove();
    });
}

function getItemName(itemId) {
    return data.items?.byId[itemId]?.name || `Item ${itemId}`;
}

function getItemImage(itemId) {
    const item = data.items?.byId[itemId];
    return item ? `/assets/${item.image}` : '';
}

function onEstimation(est) {
    // If panel doesn't exist yet, create it
    if (!$(`#${PANEL_ID}`).length) {
        createPanel(est);
    }
    // Update values in place (no re-render)
    updateValues(est);
}

function createPanel(est) {
    $(`#${PANEL_ID}`).remove();

    const panel = $(`
        <div id="${PANEL_ID}">
        <div class="rs-divider"></div>
        <div class="riftscript-panel">
            <div class="rs-tabs">
                <button type="button" class="rs-tab" data-tab="action" ${activeTab === 'action' ? 'disabled' : ''}><div>Actions</div></button>
                <button type="button" class="rs-tab" data-tab="items" ${activeTab === 'items' ? 'disabled' : ''}><div>Items</div></button>
            </div>
            <div class="rs-tab-content ${activeTab !== 'action' ? 'rs-hidden' : ''}" data-tab="action">
                <div class="rs-row"><span class="rs-icon">⭐</span><span class="rs-label">Exp/hour</span><span class="rs-value" data-field="xpPerHour"></span></div>
                <div class="rs-row">
                    <span class="rs-icon">🏁</span><span class="rs-label">Finished</span>
                    <span class="rs-mid">${isLinked() ? '<button class="rs-timer-btn" title="Set Discord timer">⏰</button>' : ''}</span>
                    <span class="rs-value" data-field="finished"></span>
                </div>
                <div class="rs-row" data-field="levelRow"><span class="rs-icon">⬆️</span><span class="rs-label">Level up</span><span class="rs-value" data-field="levelUp"></span></div>
                <div class="rs-row" data-field="tierRow"><span class="rs-icon">🏆</span><span class="rs-label">Tier up</span><span class="rs-value" data-field="tierUp"></span></div>
                <div class="rs-row">
                    <span class="rs-icon">🎯</span>
                    <span class="rs-label">Goal level</span>
                    <span class="rs-mid"><input type="number" class="rs-goal-input" value="${goalLevel}" min="1" max="200" /></span>
                    <span class="rs-value"><span class="rs-goal-result" data-field="goalTime"></span></span>
                </div>
            </div>
            <div class="rs-tab-content ${activeTab !== 'items' ? 'rs-hidden' : ''}" data-tab="items">
                <div data-field="itemsContent"></div>
            </div>
        </div>
        <div class="rs-branding">Powered by RiftScript</div>
        </div>
    `);

    // Tab switching
    panel.find('.rs-tab').on('click', function() {
        activeTab = $(this).data('tab');
        panel.find('.rs-tab').prop('disabled', false);
        $(this).prop('disabled', true);
        panel.find('.rs-tab-content').addClass('rs-hidden');
        panel.find(`.rs-tab-content[data-tab="${activeTab}"]`).removeClass('rs-hidden');
    });

    // Goal level input — only update on blur or enter, not every keystroke
    panel.find('.rs-goal-input')
        .on('change', function() {
            goalLevel = +$(this).val() || 100;
            updateValues(events.last('estimation'));
        })
        .on('keydown', function(e) {
            if (e.key === 'Enter') {
                $(this).blur();
            }
        });

    // Timer button
    panel.find('.rs-timer-btn').on('click', async function() {
        const est = events.last('estimation');
        if (!est || !est.isActive || est.finishedSeconds === Infinity) {
            alert('No active action with a finish time to set a timer for.');
            return;
        }
        try {
            $(this).text('⏳').prop('disabled', true);
            await setTimer({
                action: est.actionName,
                skill: est.skillName,
                seconds: Math.ceil(est.finishedSeconds),
            });
            $(this).text('✅');
            setTimeout(() => $(this).text('⏰').prop('disabled', false), 3000);
        } catch (e) {
            $(this).text('❌').prop('disabled', false);
            console.error('[RiftScript] Timer error:', e);
        }
    });

    // Insert into the right column (second child of .wrapper inside skill-page)
    const rightCol = $('skill-page > .wrapper').children().eq(1);
    if (rightCol.length) {
        rightCol.append(panel);
    } else {
        $('skill-page').append(panel);
    }
}

function updateValues(est) {
    if (!est) return;
    const p = $(`#${PANEL_ID}`);
    if (!p.length) return;

    // Overview
    p.find('[data-field="xpPerHour"]').text(formatNumber(est.xpPerHour));
    p.find('[data-field="finished"]').text(est.isActive ? secondsToDuration(est.finishedSeconds) : 'Not active');

    if (est.levelUpSeconds > 0) {
        p.find('[data-field="levelRow"]').show();
        p.find('[data-field="levelUp"]').html(
            `${secondsToDuration(est.levelUpSeconds)}<span class="rs-extra">${formatNumber(est.levelUpActions)} actions</span>`
        );
    } else {
        p.find('[data-field="levelRow"]').hide();
    }

    if (est.tierUpSeconds > 0) {
        p.find('[data-field="tierRow"]').show();
        p.find('[data-field="tierUp"]').html(
            `${secondsToDuration(est.tierUpSeconds)}<span class="rs-extra">${formatNumber(est.tierUpActions)} actions</span>`
        );
    } else {
        p.find('[data-field="tierRow"]').hide();
    }

    // Goal — only update if input isn't focused
    if (!p.find('.rs-goal-input').is(':focus')) {
        const goal = calcGoalTime(goalLevel);
        p.find('[data-field="goalTime"]').html(
            goal && goal.seconds > 0
                ? `${secondsToDuration(goal.seconds)}<span class="rs-extra">${formatNumber(goal.actions)} actions</span>`
                : 'Now'
        );
    }

    // Items tab — only rebuild if not focused on a price input
    if (!p.find('.rs-price-input:focus').length) {
        let dropGold = 0;
        let ingGold = 0;

        let itemsHtml = '';
        if (est.drops.length) {
            itemsHtml += '<div class="rs-section-header">Produced</div>';
            itemsHtml += est.drops.map(d => {
                const price = getPrice(d.itemId);
                const gold = d.perHour * price;
                dropGold += gold;
                return itemRow(d.itemId, d.perHour, price, gold);
            }).join('');
        }
        if (est.ingredients.length) {
            itemsHtml += '<div class="rs-section-header">Consumed</div>';
            itemsHtml += est.ingredients.map(d => {
                const price = getPrice(d.itemId);
                const gold = d.perHour * price;
                ingGold += gold;
                return itemRow(d.itemId, d.perHour, price, gold);
            }).join('');
        }

        const profit = dropGold - ingGold;
        const profitClass = profit >= 0 ? 'rs-profit-positive' : 'rs-profit-negative';
        itemsHtml += '<div class="rs-section-header">Profit</div>';
        itemsHtml += row('Produced', `${formatNumber(dropGold)} gold / hr`, '📈');
        if (ingGold > 0) {
            itemsHtml += row('Materials', `- ${formatNumber(ingGold)} gold / hr`, '📦');
        }
        itemsHtml += `<div class="rs-row"><span class="rs-icon">💰</span><span class="rs-label">Net profit</span><span class="rs-value ${profitClass}">${formatNumber(profit)} gold / hr</span></div>`;

        p.find('[data-field="itemsContent"]').html(itemsHtml);

        // Bind price input events
        p.find('.rs-price-input').on('change', function() {
            const itemId = $(this).data('item');
            const price = +$(this).val() || 0;
            saveCustomPrice(itemId, price);
            updateValues(events.last('estimation'));
        }).on('keydown', function(e) {
            if (e.key === 'Enter') $(this).blur();
        });
    }

}

function itemRow(itemId, perHour, price, goldPerHour) {
    const name = getItemName(itemId);
    const image = getItemImage(itemId);
    return `
        <div class="rs-row">
            ${image ? `<img class="rs-item-img" src="${image}" />` : ''}
            <span class="rs-label">${name}</span>
            <span class="rs-mid"><input type="number" class="rs-price-input" data-item="${itemId}" value="${Math.round(price)}" min="0" /></span>
            <span class="rs-value rs-item-value">
                <span>${formatNumber(perHour)} / hr</span>
                <span class="rs-extra">${formatNumber(goldPerHour)} gold / hr</span>
            </span>
        </div>
    `;
}

function row(label, value, icon = '', extra = '', imageUrl = '') {
    const img = imageUrl
        ? `<img class="rs-item-img" src="${imageUrl}" />`
        : (icon ? `<span class="rs-icon">${icon}</span>` : '');
    const extraHtml = extra ? `<span class="rs-extra">${extra}</span>` : '';
    return `
        <div class="rs-row">
            ${img}
            <span class="rs-label">${label}</span>
            <span class="rs-value">${value}${extraHtml}</span>
        </div>
    `;
}
