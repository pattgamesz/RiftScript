// DOM readers — extract game state from the page
import * as events from '../core/events.js';
import { parseNumber, expToLevel } from '../core/util.js';
import { data } from './data.js';

export function initReaders() {
    setInterval(readAll, 1000);
}

function readAll() {
    if (!data.ready) return;
    const page = events.last('page');
    if (!page) return;

    readSidebarLevels();

    if (page.type === 'action') {
        readActionExp(page.skill);
        readActionInventory();
        readActionEstimates(page.skill);
        const isActive = $('skill-page .action-stop').length > 0;
        events.emit('action-active', isActive);
    }
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
