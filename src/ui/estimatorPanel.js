// Renders the estimator panel into the game UI
import * as events from '../core/events.js';
import * as storage from '../core/storage.js';
import * as settings from '../core/settings.js';
import { formatNumber, secondsToDuration } from '../core/util.js';
import { calcGoalTime } from '../features/estimator.js';
import { isLinked, setTimer } from '../features/discord.js';
import { getInsatiableTomeLevel, setInsatiableTomeLevel } from '../features/tomeDetector.js';
import { data } from '../game/data.js';

const PANEL_ID = 'riftscript-estimator';
let goalLevel = 100;
let lootGoal = 0;
let activeTab = 'action';

// Custom item prices — persisted to localStorage
let customPrices = {};

// Loot goals — persisted per actionId
let lootGoals = {};

function loadLootGoals() {
    lootGoals = storage.getData('loot-goals') || {};
}

function saveLootGoal(actionId, target) {
    if (target > 0) {
        lootGoals[actionId] = target;
    } else {
        delete lootGoals[actionId];
    }
    storage.save('loot-goals', lootGoals);
}

function getMainDrop(est) {
    if (!est.drops || !est.drops.length) return null;
    return est.drops.reduce((best, d) => d.perHour > best.perHour ? d : best, est.drops[0]);
}

function loadCustomPrices() {
    customPrices = storage.getData('custom-prices') || {};
}

function saveCustomPrice(itemId, price) {
    customPrices[itemId] = price;
    storage.save('custom-prices', customPrices);
}

function getPrice(itemId, fallback) {
    if (customPrices[itemId] !== undefined) return customPrices[itemId];
    if (fallback != null) return fallback;
    const item = data.items?.byId[itemId];
    return item?.attributes?.MIN_MARKET_PRICE || item?.attributes?.SELL_PRICE || 0;
}

export function initEstimatorPanel() {
    loadCustomPrices();
    loadLootGoals();
    events.on('estimation', onEstimation);
    events.on('page', (page) => {
        if (page.type !== 'action') $(`#${PANEL_ID}`).remove();
    });
}

function getItemName(itemId, synthetic) {
    if (synthetic?.name) return synthetic.name;
    return data.items?.byId[itemId]?.name || `Item ${itemId}`;
}

function getItemImage(itemId, synthetic) {
    if (synthetic?.image) return `/assets/${synthetic.image}`;
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
                <div class="rs-row" data-field="lootGoalRow">
                    <span class="rs-icon">📦</span>
                    <span class="rs-label">Loot goal</span>
                    <span class="rs-mid"><span class="rs-loot-item-name" data-field="lootGoalLabel"></span><input type="number" class="rs-loot-goal-input" value="${lootGoal}" min="0" placeholder="0" /></span>
                    <span class="rs-value"><span data-field="lootGoalTime"></span><span class="rs-extra" data-field="lootGoalExtra"></span></span>
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
            if (e.key === 'Enter') $(this).blur();
        });

    // Loot goal input
    panel.find('.rs-loot-goal-input')
        .on('change', function() {
            const est = events.last('estimation');
            lootGoal = +$(this).val() || 0;
            if (est) saveLootGoal(est.actionId, lootGoal);
            updateValues(est);
        })
        .on('keydown', function(e) {
            if (e.key === 'Enter') $(this).blur();
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

    // Load saved loot goal for this action (without re-rendering input if focused)
    const savedGoal = lootGoals[est.actionId] || 0;
    if (!p.find('.rs-loot-goal-input').is(':focus') && lootGoal !== savedGoal) {
        lootGoal = savedGoal;
        p.find('.rs-loot-goal-input').val(lootGoal || '');
    }

    // Overview
    p.find('[data-field="xpPerHour"]').text(formatNumber(est.xpPerHour));
    // Finished row meaning:
    //   - has bottleneck → show duration + which item runs out first
    //   - infinite (gathering, or combat without damage estimate) → "Continuous"
    //   - not active → "Not active"
    if (!est.isActive) {
        p.find('[data-field="finished"]').text('Not active');
    } else if (Number.isFinite(est.finishedSeconds)) {
        let finishedHtml = secondsToDuration(est.finishedSeconds);
        if (est.bottleneck) {
            const name = getItemName(est.bottleneck.itemId);
            finishedHtml += `<span class="rs-extra">${name} runs out first</span>`;
        }
        p.find('[data-field="finished"]').html(finishedHtml);
    } else {
        p.find('[data-field="finished"]').html(
            `Continuous<span class="rs-extra">no materials being consumed</span>`
        );
    }

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

    // Loot goal
    const mainDrop = getMainDrop(est);
    if (mainDrop && mainDrop.perHour > 0) {
        p.find('[data-field="lootGoalRow"]').show();
        const itemName = getItemName(mainDrop.itemId);
        const currentCount = est.loot?.[mainDrop.itemId] || 0;
        p.find('[data-field="lootGoalLabel"]').text(itemName);

        if (lootGoal > 0) {
            const remaining = Math.max(0, lootGoal - currentCount);
            if (remaining === 0) {
                p.find('[data-field="lootGoalTime"]').html('Done!');
            } else {
                const secs = (remaining / mainDrop.perHour) * 3600;
                p.find('[data-field="lootGoalTime"]').html(secondsToDuration(secs));
                p.find('[data-field="lootGoalExtra"]').html(`${formatNumber(currentCount)} / ${formatNumber(lootGoal)}`);
            }
        } else {
            p.find('[data-field="lootGoalTime"]').html('');
            p.find('[data-field="lootGoalExtra"]').html(`${formatNumber(currentCount)} looted`);
        }
    } else {
        p.find('[data-field="lootGoalRow"]').hide();
    }

    // Items tab — only rebuild if no interactive control is active. The
    // poll-driven estimation event fires up to once per second, and any
    // rebuild while the user is editing a price OR has the tome dropdown
    // open destroys their interaction (some browsers close the native
    // <select> overlay the moment its DOM node is replaced).
    if (!p.find('.rs-price-input:focus, .rs-tome-select:focus').length) {
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
            const bottleneckId = est.bottleneck?.itemId;
            itemsHtml += est.ingredients.map(d => {
                // Use the estimator-provided sellPrice as the default — covers
                // synthetic items (brew has no DB entry) and the Mastery
                // Contract row, whose 'cost per unit' is the produced item's
                // market price, not the contract's own.
                const price = getPrice(d.itemId, d.sellPrice);
                const gold = d.perHour * price;
                ingGold += gold;
                return ingredientRow(d, price, gold, bottleneckId === d.itemId);
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

        // Bind tome tier dropdown — sets the level globally + re-renders so
        // the state tag and food calc update without a page reload.
        p.find('.rs-tome-select').on('change', function() {
            setInsatiableTomeLevel(+$(this).val() || 0);
            updateValues(events.last('estimation'));
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
                <span>${formatNumber(goldPerHour)} gold / hr</span>
                <span class="rs-extra">${formatNumber(perHour)} / hr</span>
            </span>
        </div>
    `;
}

function ingredientRow(d, price, goldPerHour, isBottleneck) {
    const name = getItemName(d.itemId, d.synthetic);
    const image = getItemImage(d.itemId, d.synthetic);
    // Row gets a red tint if it's the bottleneck (no extra tag — the color
    // is the signal). Two fixed extra lines under the perHour value so
    // every row aligns: stored count, then "lasts X" (or omitted when we
    // don't know the consumption rate, e.g. food on a non-combat skill).
    const perHourLine = d.perHour > 0
        ? `${formatNumber(d.perHour)} / hr`
        : '&nbsp;';
    const lastsLine = Number.isFinite(d.secondsLeft) && d.secondsLeft > 0
        ? `lasts ${secondsToDuration(d.secondsLeft)}`
        : '&nbsp;';
    // For food items (HEAL attr) show an inline Insatiable Power Tome tier
    // picker so the player can set it without opening Settings. Right next
    // to the dropdown we render the current HP/s drain (when the toggle is
    // on) or 'disabled' (when it's off in Settings) so the row makes its
    // own state visible.
    const heal = data.items?.byId?.[d.itemId]?.attributes?.HEAL;
    let nameSuffix = '';
    if (heal) {
        const tomeLvl = getInsatiableTomeLevel();
        const tomeActive = settings.getOnDefault('insatiable-tome-active');
        const opts = [0, 1, 2, 3, 4, 5, 6, 7, 8]
            .map(n => `<option value="${n}" ${n === tomeLvl ? 'selected' : ''}>${n === 0 ? '—' : `T${n}`}</option>`)
            .join('');
        let state = '';
        if (tomeLvl > 0) {
            state = tomeActive
                ? `<span class="rs-tome-tag">${(tomeLvl * 0.2).toFixed(1)} HP/s</span>`
                : `<span class="rs-tome-tag rs-tome-tag-off">disabled</span>`;
        }
        // Group dropdown + state tag in an inline-flex unit so they wrap as a
        // single block (not each on its own line) if the panel is narrow.
        // The "Insatiable" label sits directly above the dropdown so the
        // tier number has context without needing a tooltip.
        nameSuffix = `<span class="rs-tome-pick"><span class="rs-tome-select-wrap"><span class="rs-tome-pick-label">Insatiable</span><select class="rs-tome-select">${opts}</select></span>${state}</span>`;
    }
    // Mastery Contract — show an On/Off pill so the player can see whether
    // the consumption rate / cost shown in this row is being applied.
    if (d.contract) {
        nameSuffix = d.contract.active
            ? ` <span class="rs-tome-tag">ON</span>`
            : ` <span class="rs-tome-tag rs-tome-tag-off">OFF</span>`;
    }
    // Promote gold/hr to the primary line; if there's no cost (e.g. an
     // untracked synthetic), fall back to the per-hour line so the row still
     // has a top value.
    const primaryLine = goldPerHour > 0
        ? `<span class="rs-cost">- ${formatNumber(goldPerHour)} gold / hr</span>`
        : `<span>${perHourLine}</span>`;
    const perHourExtra = goldPerHour > 0 && d.perHour > 0
        ? `<span class="rs-extra">${formatNumber(d.perHour)} / hr</span>`
        : '';
    return `
        <div class="rs-row${isBottleneck ? ' rs-bottleneck' : ''}">
            ${image ? `<img class="rs-item-img" src="${image}" />` : ''}
            <span class="rs-label">${name}${nameSuffix}</span>
            <span class="rs-mid"><input type="number" class="rs-price-input" data-item="${d.itemId}" value="${Math.round(price)}" min="0" /></span>
            <span class="rs-value rs-item-value">
                ${primaryLine}
                ${perHourExtra}
                <span class="rs-extra">${formatNumber(d.stored)} stored</span>
                <span class="rs-extra">${lastsLine}</span>
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
