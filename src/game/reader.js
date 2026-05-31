// DOM readers — extract game state from the page
import * as events from '../core/events.js';
import { parseNumber, expToLevel, pollWhileVisible } from '../core/util.js';
import { data } from './data.js';

export function initReaders() {
    pollWhileVisible(readAll, 1000);
}

function readAll() {
    if (!data.ready) return;
    const page = events.last('page');
    if (!page) return;

    readSidebarLevels();

    if (page.type === 'action') {
        // Skip the whole block if the skill-page is being torn down — prevents
        // a stale page snapshot from emitting a false "inactive" during nav.
        const $skill = $('skill-page');
        if (!$skill.length) return;
        readActionExp(page.skill);
        readActionInventory();
        readActionLoot();
        readActionConsumables();
        readActionEstimates(page.skill);
        readSetAmount(page.skill);
        const isActive = $skill.find('.action-stop').length > 0;
        events.emit('action-active', isActive);
    }
}

// Read the Consumables card on a skill-page — covers food, sigils, potions,
// brews, anything the game lists with a stored count. Empty slots are skipped.
// The default extractItem helper reads .amount/.value which on this card
// holds the effect (e.g. "240 HP", "22%"), not the stored count — so we
// extract the count separately by scanning the row for plain numbers that
// aren't followed by a unit suffix.
function readActionConsumables() {
    const consumables = {};
    $('skill-page .header > .name:contains("Consumables")')
        .closest('.card')
        .find('.row')
        .each((_i, el) => {
            const $el = $(el);
            const fullText = $el.text() || '';
            // Slot toggle states the player has explicitly disabled / left empty.
            if (/Empty/i.test(fullText)) return;

            // Resolve item via image (unambiguous) or name lookup.
            const src = $el.find('img').first().attr('src') || '';
            const filename = src.split('/').pop();
            let item = data.items.byImage[filename];
            if (!item) {
                const nameText = ($el.find('.name').first().text() || '')
                    .replace(/\s*\d[\d,]*.*$/, '').trim();
                item = data.items.byName[nameText];
            }
            if (!item) return;

            // Try .amount first (cleanest source), then fall back to scanning
            // the row text for the largest plain number that isn't a unit
            // suffix (%, HP, hr, gold, sec, min).
            const amountText = ($el.find('.amount').first().text() || '').trim();
            let stored = parseNumber(amountText) || 0;
            if (!stored) stored = findConsumableStored(fullText);

            // Emit even with stored=0 so the row appears in the UI. The
            // estimator will render '0 stored' for genuinely empty slots and
            // the real count when it's been parsed correctly.
            consumables[item.id] = stored;
        });
    events.emit('action-consumables', consumables);
}

// Pick the largest plain number in the row's text that isn't followed by a
// unit suffix (% / HP / hr / gold / sec). On a Consumables row that's the
// stored count; effect values are excluded by the unit-suffix filter.
function findConsumableStored(text) {
    const numberRe = /\d[\d,]*/g;
    let best = 0;
    let m;
    while ((m = numberRe.exec(text)) !== null) {
        const after = text.slice(m.index + m[0].length, m.index + m[0].length + 5);
        if (/^(%|\s*HP|\s*hr|\s*gold|\s*sec|\s*min)/i.test(after)) continue;
        const n = parseNumber(m[0]);
        if (n > best) best = n;
    }
    return best;
}

// Read all skill levels from the left sidebar (always visible)
function readSidebarLevels() {
    const levels = {};
    $('nav-component button.skill').each((_i, el) => {
        const $el = $(el);
        const name = $el.find('.name').text();
        const skill = data.skills.byName[name];
        if (!skill) return;
        const level = +(/\d+/.exec($el.find('.level').text())?.[0] || 0);
        levels[skill.id] = { id: skill.id, level, exp: 0 };
    });
    if (Object.keys(levels).length) {
        events.emit('levels', levels);
    }
}

// Read XP from the action page Stats tab
function readActionExp(skillId) {
    const card = $('skill-page .tabs > button:contains("Stats")').closest('.card');
    if (!card.length) return;

    // Look for "Total ... XP" row
    const text = card
        .find('.row > .name:contains("Total"):contains("XP")')
        .closest('.row')
        .find('.value')
        .text();
    if (text) {
        const exp = parseNumber(text);
        const level = expToLevel(exp);
        events.emit('action-exp', { id: skillId, exp, level });
    }
}

// Read materials from the action page
function readActionInventory() {
    const inventory = {};
    $('skill-page .header > .name:contains("Materials")')
        .closest('.card')
        .find('.row')
        .each((_i, el) => {
            const $el = $(el);
            extractItem($el, inventory);
        });
    events.emit('action-inventory', inventory);
}

// Read loot items and their counts from the Loot section
function readActionLoot() {
    const loot = {};
    $('skill-page .header > .name:contains("Loot")')
        .closest('.card')
        .find('.row')
        .each((_i, el) => {
            extractItem($(el), loot);
        });
    events.emit('action-loot', loot);
}

// Read the set amount from the Loot header (e.g. "1,177 / 2,734")
function readSetAmount(skillId) {
    const amountText = $('skill-page .header > .name:contains("Loot")').parent().find('.amount').text();
    if (!amountText || !amountText.includes('/')) {
        events.emit('action-set-amount', { skill: skillId, remaining: null });
        return;
    }
    const done = parseNumber(amountText.split('/')[0]);
    const total = parseNumber(amountText.split('/')[1]);
    const remaining = total - done;
    events.emit('action-set-amount', { skill: skillId, remaining: remaining > 0 ? remaining : null });
}

// Read the game's own Stats/Estimates values
function readActionEstimates(skillId) {
    const result = { skill: skillId };

    const card = $('skill-page .tabs > button:contains("Estimates")').closest('.card');
    if (!card.length) return;

    card.find('.row').each((_i, el) => {
        const $el = $(el);
        const name = $el.find('.name').text().trim();
        const value = $el.find('.value, .amount').text().trim();
        if (!name || !value) return;

        const num = parseNumber(value.split('/')[0]);
        const isPerHour = value.includes('/');

        if (name === 'XP' && isPerHour) result.xpPerHour = num;
        else if (name === 'Actions' && isPerHour) result.actionsPerHour = num;
        else if (name === 'Monsters' && isPerHour) result.actionsPerHour = num;
        else if (/^Food$/i.test(name) && isPerHour) result.foodPerHour = num;
        else if (/Damage(\s*Taken)?$|Health(\s*Lost)?$/i.test(name) && isPerHour) {
            result.damagePerHour = num;
        }
    });

    if (result.xpPerHour || result.actionsPerHour) {
        events.emit('game-estimates', result);
    }
}

function extractItem($el, target) {
    const name = $el.find('.name').text().trim();
    if (!name) return;

    let item = data.items.byName[name];
    if (!item) {
        const src = $el.find('img').attr('src');
        if (src) {
            const filename = src.split('/').pop();
            item = data.items.byImage[filename];
        }
    }
    if (!item) return;

    let amount = parseNumber($el.find('.amount, .value').text()) || 1;
    const uses = parseNumber($el.find('.uses, .use').text());
    if (uses) amount = uses;
    target[item.id] = (target[item.id] || 0) + amount;
}
