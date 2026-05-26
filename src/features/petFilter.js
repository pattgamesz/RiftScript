// Pet panel on the taming page. Features:
//   • Family filter
//   • Highlight duplicates (family has > 1 in collection)
//   • Inline stat chips per pet (H/A/D %) sourced from our modal-scrape cache
//   • Gold "best" star on the per-family champion (unique top across H+A+D)
//   • Sort by level / health / attack / defense / family
import * as events from '../core/events.js';
import { trigger as triggerPetReader } from '../game/petReader.js';
import { data } from '../game/data.js';
import { get as gget, set as gset, getOnDefault } from '../core/settings.js';
import { getPetStats, getCachedCount } from '../core/petStats.js';
import { formatNumber, escapeHtml, MOBILE_BREAKPOINT, retryAfter } from '../core/util.js';
import { getExpeditionResults, scrapeRotationsFromDOM } from './expeditionCalc.js';

const PANEL_ID = 'rs-pet-panel';
const FAMILY_KEY = 'pet-filter-family';
const DUP_KEY = 'pet-highlight-duplicates';
const SORT_KEY = 'pet-sort';
const PERFECT_KEY = 'pet-only-perfect';
const TAB_KEY = 'pet-active-tab';
const EXP_WEEK_KEY = 'pet-exp-week-offset';
const EXP_TIER_KEY = 'pet-exp-selected-tier';

let activeTab = 'manager'; // 'manager' | 'expedition'

export function initPetFilter() {
    activeTab = gget(TAB_KEY, 'manager');
    // Migrate: rotation tab was removed (merged into expedition detail view)
    if (activeTab === 'rotation') {
        activeTab = 'expedition';
        gset(TAB_KEY, activeTab);
    }
    events.on('page', onPage);
    events.on('reader-pet', pets => {
        applyToList(pets);
        // Re-render so expedition tab reflects latest team composition / stats
        if (activeTab === 'expedition') renderPanel();
    });
    events.on('reader-pet-modal', () => {
        // Re-render so the "X cached" counter reflects the newly added pet,
        // then re-scan so chips on the existing row pick up the cached data.
        renderPanel();
        triggerPetReader();
    });
    window.addEventListener('resize', handleResize);
    // Sub-tab clicks inside taming-page (Pets / Ranch / Breeding / Expedition)
    // re-render Angular's groups container without firing a 'page' event, so
    // our injected panel disappears. Poll-and-reinject keeps it alive on every
    // taming sub-tab including the in-game Expedition view. ensurePanel handles
    // its own renderPanel; we don't trigger the pet reader here because that
    // could re-render the panel out from under an in-progress click.
    setInterval(() => {
        if ($('taming-page').length && !$(`#${PANEL_ID}`).length) {
            ensurePanel();
        }
    }, 1000);

    // Delegated handlers — survive every renderPanel re-render because they're
    // bound to document, not to the (frequently replaced) panel children.
    bindDelegatedHandlers();
}

function bindDelegatedHandlers() {
    const sel = `#${PANEL_ID}`;
    $(document).on('click', `${sel} .rs-pet-tab`, function() {
        activeTab = $(this).data('tab');
        gset(TAB_KEY, activeTab);
        renderPanel();
    });
    $(document).on('change', `${sel} .rs-exp-tier-select`, function() {
        gset(EXP_TIER_KEY, +$(this).val() || 0);
        renderPanel();
    });
    $(document).on('change', `${sel} .rs-exp-week`, function() {
        gset(EXP_WEEK_KEY, +$(this).val() || 0);
        renderPanel();
    });
    $(document).on('change', `${sel} .rs-pet-family`, function() {
        gset(FAMILY_KEY, $(this).val());
        triggerPetReader();
    });
    $(document).on('change', `${sel} .rs-pet-sort`, function() {
        gset(SORT_KEY, $(this).val());
        triggerPetReader();
    });
    $(document).on('change', `${sel} .rs-pet-dup`, function() {
        gset(DUP_KEY, $(this).is(':checked'));
        triggerPetReader();
    });
    $(document).on('change', `${sel} .rs-pet-perfect`, function() {
        gset(PERFECT_KEY, $(this).is(':checked'));
        triggerPetReader();
    });
}

function onPage(page) {
    if (page?.type !== 'taming') {
        // Clean up the panel so it doesn't linger on other pages — Angular
        // keeps taming-page in the DOM after navigation, so our injected
        // panel would otherwise stay visible on top.
        $(`#${PANEL_ID}`).remove();
        return;
    }
    retryAfter(ensurePanel);
}

function ensurePanel() {
    if (!$('taming-page').length) return;
    if ($(`#${PANEL_ID}`).length) return;
    const $panel = $(`<div id="${PANEL_ID}" class="rs-pet-panel"></div>`);

    if (window.innerWidth < MOBILE_BREAKPOINT) {
        // Mobile: above the page so it's reachable without scrolling
        $('taming-page').before($panel);
    } else {
        // Desktop: bottom of the right sidebar (last group inside .groups),
        // same position as the calculation cards on skill pages.
        const $sidebar = $('taming-page > .groups > :last-child');
        if ($sidebar.length) {
            $sidebar.append($panel);
        } else {
            // Fallback: after the last card (or, if none, before the page)
            const $target = $('taming-page .card').last();
            if ($target.length) $target.after($panel);
            else $('taming-page').before($panel);
        }
    }

    if (!data.pets) {
        $panel.html(`
            <div class="rs-pet-panel-card">
                <div class="rs-pet-header"><span>Pet manager</span></div>
                <div class="rs-pet-hint" style="color:#f87171;font-style:normal">
                    Pet data not loaded — Ironwood's pets API failed on script startup.
                    Try a hard refresh (Ctrl+F5) to reload game data.
                </div>
            </div>
            <div class="rs-branding">Powered by RiftScript</div>
        `);
        // Retry once data eventually arrives
        const retry = setInterval(() => {
            if (data.pets) {
                clearInterval(retry);
                $(`#${PANEL_ID}`).remove();
                ensurePanel();
                triggerPetReader();
            }
        }, 1000);
        setTimeout(() => clearInterval(retry), 30_000);
        return;
    }
    renderPanel();
}

let resizeTimer;
function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        const $existing = $(`#${PANEL_ID}`);
        if (!$existing.length) return;
        const onMobile = window.innerWidth < MOBILE_BREAKPOINT;
        const isAbovePage = $existing.next().is('taming-page');
        if (onMobile !== isAbovePage) {
            $existing.remove();
            ensurePanel();
        }
    }, 200);
}

function renderPanel() {
    const $panel = $(`#${PANEL_ID}`);
    if (!$panel.length) return;

    $panel.html(`
        <div class="rs-pet-panel-card">
            <div class="rs-pet-tabs">
                <button class="rs-pet-tab ${activeTab === 'manager' ? 'active' : ''}" data-tab="manager">Pets</button>
                <button class="rs-pet-tab ${activeTab === 'expedition' ? 'active' : ''}" data-tab="expedition">Expedition</button>
            </div>
            ${activeTab === 'manager' ? renderManagerTab() : renderExpeditionTab()}
        </div>
        <div class="rs-branding">Powered by RiftScript</div>
    `);
    // Tab + form handlers are bound once via bindDelegatedHandlers() in init.
}

function renderManagerTab() {
    const families = [...new Set(data.pets.list.map(p => p.family).filter(Boolean))].sort();
    const family = gget(FAMILY_KEY, 'All');
    const dup = getOnDefault(DUP_KEY);
    const sort = gget(SORT_KEY, 'default');

    const cached = getCachedCount();
    return `
        <div class="rs-pet-hint-row">
            <span class="rs-pet-hint">Click any pet once to read its H / A / D — they'll appear inline next to the game's tags.</span>
            <span class="rs-pet-cache" title="Click a pet to cache its stats. Caching is automatic.">${cached} cached</span>
        </div>
        <div class="rs-pet-row">
            <div class="rs-pet-label">Family</div>
            <select class="rs-pet-family rs-pet-select">
                <option value="All" ${family === 'All' ? 'selected' : ''}>All</option>
                ${families.map(f => `<option value="${escapeHtml(f)}" ${family === f ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('')}
            </select>
        </div>
        <div class="rs-pet-row">
            <div class="rs-pet-label">Sort</div>
            <select class="rs-pet-sort rs-pet-select">
                <option value="default" ${sort === 'default' ? 'selected' : ''}>Default (in-game order)</option>
                <option value="family" ${sort === 'family' ? 'selected' : ''}>Family A→Z</option>
                <option value="level" ${sort === 'level' ? 'selected' : ''}>Level (highest first)</option>
                <option value="health" ${sort === 'health' ? 'selected' : ''}>Health % (best first)</option>
                <option value="attack" ${sort === 'attack' ? 'selected' : ''}>Attack % (best first)</option>
                <option value="defense" ${sort === 'defense' ? 'selected' : ''}>Defense % (best first)</option>
                <option value="total" ${sort === 'total' ? 'selected' : ''}>Total stats (best first)</option>
            </select>
        </div>
        <div class="rs-pet-row">
            <div class="rs-pet-label">Highlight duplicates</div>
            <label class="rs-toggle">
                <input type="checkbox" class="rs-pet-dup" ${dup ? 'checked' : ''}>
                <span class="rs-toggle-slider"></span>
            </label>
        </div>
        <div class="rs-pet-row">
            <div class="rs-pet-label">Only show perfect stats</div>
            <label class="rs-toggle">
                <input type="checkbox" class="rs-pet-perfect" ${gget(PERFECT_KEY) ? 'checked' : ''}>
                <span class="rs-toggle-slider"></span>
            </label>
        </div>
        <div class="rs-pet-legend">
            <div class="rs-pet-legend-row">
                <span class="rs-pet-chip">H95</span>
                <span class="rs-pet-chip rs-pet-chip-passive">LF1</span>
                <span>Health / Attack / Defense % &nbsp;·&nbsp; passive (initials + level)</span>
            </div>
            <div class="rs-pet-legend-row">
                <span class="rs-pet-chip rs-pet-chip-best">A100</span>
                <span>Perfect stat or family-best — green also on level-4 passives and 300% total</span>
            </div>
            <div class="rs-pet-legend-row">
                <span class="rs-pet-legend-star">★</span>
                <span class="rs-pet-legend-dup"></span>
                <span>Best in family (highest H+A+D) &nbsp;·&nbsp; exact duplicate (same H/A/D + passives)</span>
            </div>
        </div>
    `;
}

function expeditionResultsOrError() {
    if (!data.expeditions) {
        return { error: `<div class="rs-pet-hint" style="font-style:normal">Expedition data not loaded yet — give it a moment.</div>` };
    }
    scrapeRotationsFromDOM();
    const weekOffset = +gget(EXP_WEEK_KEY, 0) || 0;
    const pets = events.last('reader-pet') || [];
    const result = getExpeditionResults(pets, weekOffset);
    if (!result.ready) {
        if (result.reason === 'empty') {
            return { error: `<div class="rs-pet-hint" style="font-style:normal">No expedition team set. Assign pets to your team, or open the Pets sub-tab once to detect them.</div>` };
        }
        return { error: `<div class="rs-pet-hint" style="font-style:normal">Click each team pet once to cache its stats (${result.teamWithStats.length}/${result.teamPets.length} cached).</div>` };
    }
    return { result, weekOffset };
}

function renderExpeditionTab() {
    const r = expeditionResultsOrError();
    if (r.error) return r.error;
    const { result, weekOffset } = r;
    const { tiers } = result;

    // Default to the highest tier with 100% success, fall back to highest overall
    const stored = +gget(EXP_TIER_KEY, 0);
    const defaultTier = [...tiers].reverse().find(t => t.chance >= 100)?.tier
        || tiers[tiers.length - 1]?.tier
        || 1;
    const selectedTier = tiers.find(t => t.tier === stored)?.tier || defaultTier;
    const sel = tiers.find(t => t.tier === selectedTier);

    const tierOptions = tiers.map(t =>
        `<option value="${t.tier}" ${t.tier === selectedTier ? 'selected' : ''}>T${t.tier}: ${escapeHtml(t.name)}</option>`
    ).join('');

    const cls = sel.chance >= 100 ? 'rs-exp-good' : sel.chance >= 80 ? 'rs-exp-mid' : 'rs-exp-bad';
    const dropRows = (sel.drops || []).map(d => `
        <div class="rs-exp-detail-row">
            <span class="rs-exp-detail-label">${escapeHtml(d.name)}</span>
            <span class="rs-exp-detail-value">${formatNumber(d.amount)}</span>
        </div>
    `).join('') || `<div class="rs-pet-hint" style="font-style:normal;padding:6px 14px">No matching drops — team has no relevant abilities.</div>`;

    return `
        <div class="rs-pet-row">
            <div class="rs-pet-label">Expedition</div>
            <select class="rs-exp-tier-select rs-pet-select">${tierOptions}</select>
        </div>
        <div class="rs-pet-row">
            <div class="rs-pet-label">Rotation for</div>
            <select class="rs-exp-week rs-pet-select">
                <option value="0" ${weekOffset === 0 ? 'selected' : ''}>This week</option>
                <option value="1" ${weekOffset === 1 ? 'selected' : ''}>Next week</option>
                <option value="2" ${weekOffset === 2 ? 'selected' : ''}>In 2 weeks</option>
            </select>
        </div>
        <div class="rs-exp-detail-block">
            <div class="rs-exp-detail-row">
                <span class="rs-exp-detail-label">Success chance</span>
                <span class="rs-exp-detail-value ${cls === 'rs-exp-good' ? 'rs-exp-chance-good' : cls === 'rs-exp-mid' ? 'rs-exp-chance-mid' : 'rs-exp-chance-bad'}">${formatNumber(sel.chance)}%</span>
            </div>
            <div class="rs-exp-detail-row">
                <span class="rs-exp-detail-label">Rotation</span>
                <span class="rs-exp-detail-value" style="text-transform:capitalize">${sel.rotation}</span>
            </div>
            ${sel.food ? `
                <div class="rs-exp-detail-row">
                    <span class="rs-exp-detail-label">Food cost</span>
                    <span class="rs-exp-detail-value">${formatNumber(sel.food.amount)} ${escapeHtml(sel.food.name)}</span>
                </div>
            ` : ''}
            ${sel.egg ? `
                <div class="rs-exp-detail-row">
                    <span class="rs-exp-detail-label">Egg chance</span>
                    <span class="rs-exp-detail-value">${formatNumber(sel.egg.chance * 100)}% ${escapeHtml(sel.egg.name)}</span>
                </div>
            ` : ''}
            <div class="rs-exp-detail-row">
                <span class="rs-exp-detail-label">EXP per run</span>
                <span class="rs-exp-detail-value">${formatNumber(sel.exp)}</span>
            </div>
        </div>
        <div class="rs-pet-section-header">Drops per run</div>
        <div class="rs-exp-drop-list">${dropRows}</div>
    `;
}

// Composite key avoids confusion when two pets share name+species+level (breeders).
const petKey = (p) => `${p.name}|${p.species}|${p.level}|${p.groupIndex || 0}`;

// Duplicate fingerprint: family + H/A/D + sorted passive set.
function fingerprintOf(p) {
    const s = p.cachedStats;
    if (!s || s.health == null) return null;
    const passives = Array.isArray(s.passives)
        ? s.passives.filter(x => x?.name).map(x => `${x.name}|${x.level || 0}`).sort().join(',')
        : '';
    return `${p.family}|${Math.round(s.health)}|${Math.round(s.attack)}|${Math.round(s.defense)}|${passives}`;
}

function countFingerprints(pets) {
    const out = {};
    for (const p of pets) {
        const fp = fingerprintOf(p);
        if (fp) out[fp] = (out[fp] || 0) + 1;
    }
    return out;
}

// Best per family — highest total, tiebreak on count of level-4 (non-hunger) passives.
function computeBestPerFamily(pets) {
    const best = {};
    const scores = {};
    for (const p of pets) {
        const s = p.cachedStats;
        if (!s || s.health == null) continue;
        const total = (s.health || 0) + (s.attack || 0) + (s.defense || 0);
        let maxTier = 0;
        if (Array.isArray(s.passives)) {
            for (const pp of s.passives) {
                if (!pp) continue;
                if ((pp.level || 0) >= 4 && !/hunger/i.test(pp.name || '')) maxTier++;
            }
        }
        const cur = scores[p.family];
        if (!cur || total > cur.total || (total === cur.total && maxTier > cur.maxTier)) {
            scores[p.family] = { total, maxTier };
            best[p.family] = petKey(p);
        }
    }
    return best;
}

// Per-stat best per family — used for green "best" highlight on individual chips.
function computeStatBestPerFamily(pets) {
    const out = {};
    for (const p of pets) {
        const s = p.cachedStats;
        if (!s) continue;
        if (!out[p.family]) out[p.family] = {};
        for (const k of ['health', 'attack', 'defense']) {
            const v = s[k] || 0;
            if (v > (out[p.family][k] || 0)) out[p.family][k] = v;
        }
    }
    return out;
}

function applyToList(pets) {
    if (!pets?.length) return;
    const family = gget(FAMILY_KEY, 'All');
    const dup = !!gget(DUP_KEY);
    const sort = gget(SORT_KEY, 'default');
    const onlyPerfect = !!gget(PERFECT_KEY);

    // Attach stats — prefer getUser API (unique per pet ID), fall back to modal-scrape cache.
    for (const pet of pets) pet.cachedStats = pet.apiStats || getPetStats(pet);

    const fingerprintCount = countFingerprints(pets);
    const bestPerFamily = computeBestPerFamily(pets);
    const statBestPerFamily = computeStatBestPerFamily(pets);

    for (const pet of pets) {
        decoratePet(pet, { family, dup, onlyPerfect, fingerprintCount, bestPerFamily, statBestPerFamily });
    }

    // Sort via CSS `order` so DOM order stays stable — critical for breeders
    // where groupIndex disambiguates same-name pets.
    const collectionPets = pets.filter(p => p.location === 'collection');
    if (sort === 'default') {
        for (const p of collectionPets) p.element.css('order', '');
    } else {
        sortPets(collectionPets, sort).forEach((p, i) => p.element.css('order', i));
    }
}

function decoratePet(pet, ctx) {
    const $el = pet.element;
    $el.removeClass('rs-pet-duplicate rs-pet-best rs-pet-release-row');
    $el.find('.rs-pet-chip, .rs-pet-best-star, .rs-pet-additions, .rs-pet-release').remove();
    $el.find('.tags > *').removeClass('rs-pet-chip-best-perfect');

    // Family filter applies only to the main collection
    if (pet.location === 'collection') {
        $el.css('display', ctx.family === 'All' || pet.family === ctx.family ? '' : 'none');
    } else {
        $el.css('display', '');
    }

    if (ctx.dup && pet.location === 'collection') {
        const fp = fingerprintOf(pet);
        if (fp && ctx.fingerprintCount[fp] > 1) $el.addClass('rs-pet-duplicate');
    }

    const s = pet.cachedStats;
    if (s && (s.health != null || s.attack != null || s.defense != null)) {
        injectStatAndPassiveChips(pet, s, ctx);
    }

    if (ctx.bestPerFamily[pet.family] === petKey(pet) && pet.location === 'collection') {
        $el.addClass('rs-pet-best');
        if (!$el.find('.rs-pet-best-star').length) {
            $el.find('.image').first().append(
                `<span class="rs-pet-best-star" title="Best in family">★</span>`
            );
        }
    }
}

function injectStatAndPassiveChips(pet, s, ctx) {
    const $el = pet.element;
    const $tags = $el.find('.tags').first();
    const gameTagClass = detectTagClass($tags);
    const fbest = ctx.statBestPerFamily[pet.family] || {};
    const total = s.total != null ? s.total : ((s.health || 0) + (s.attack || 0) + (s.defense || 0));
    const isPerfect = total >= 300;

    // The game already shows total % in its own .tags (e.g. "196%"). Highlight that
    // existing chip when the roll is perfect (300%).
    if (isPerfect && $tags.length) {
        const $totalChip = $tags.children().filter(function() {
            return /^\d+(\.\d+)?\s*%$/.test($(this).text().trim());
        }).last();
        if ($totalChip.length) $totalChip.addClass('rs-pet-chip-best-perfect');
    }

    const $target = $tags.length ? $tags : $el.find('.image').next();
    if (!$target.length) return;

    // Build a single additions row under the game's tags. In "only perfect"
    // mode, non-perfect chips are skipped and we track whether anything was
    // emitted so collection pets can be marked as release candidates.
    let html = '';
    let hasKeeper = false;

    const renderStat = (letter, value, isBest) => {
        if (value == null) return;
        const isPerfectStat = value === 100;
        if (ctx.onlyPerfect && !isPerfectStat) return;
        if (isPerfectStat) hasKeeper = true;
        html += statChip(letter, value, isBest || isPerfectStat, gameTagClass);
    };
    renderStat('H', s.health, isPerfect || s.health === fbest.health);
    renderStat('A', s.attack, isPerfect || s.attack === fbest.attack);
    renderStat('D', s.defense, isPerfect || s.defense === fbest.defense);

    if (Array.isArray(s.passives)) {
        for (const p of s.passives) {
            if (!p?.name) continue;
            const isMaxTier = (p.level || 0) >= 4;
            const isNegative = /hunger/i.test(p.name);
            const isPerfectPassive = isMaxTier && !isNegative;
            if (ctx.onlyPerfect && !isPerfectPassive) continue;
            if (isPerfectPassive) hasKeeper = true;
            html += passiveChip(p, gameTagClass);
        }
    }

    if (html) {
        const $additions = $(`<div class="rs-pet-additions">${html}</div>`);
        if ($tags.length) $tags.after($additions);
        else $target.append($additions);
    }

    if (ctx.onlyPerfect && !hasKeeper && pet.location === 'collection') {
        $el.addClass('rs-pet-release-row');
        $el.find('.image').first().append(
            `<span class="rs-pet-release" title="No perfect stats — release candidate">✕</span>`
        );
    }
}

function sortPets(pets, by) {
    const copy = [...pets];
    copy.sort((a, b) => {
        if (by === 'family') return (a.family || '').localeCompare(b.family || '');
        if (by === 'level') return (b.level || 0) - (a.level || 0);
        const sa = a.cachedStats || {};
        const sb = b.cachedStats || {};
        if (by === 'total') {
            const at = (sa.health || 0) + (sa.attack || 0) + (sa.defense || 0);
            const bt = (sb.health || 0) + (sb.attack || 0) + (sb.defense || 0);
            return bt - at;
        }
        return (sb[by] || 0) - (sa[by] || 0);
    });
    return copy;
}

// Detect the game's tag class once per session by inspecting an existing tag.
let detectedTagClass = null;
function detectTagClass($tags) {
    if (detectedTagClass) return detectedTagClass;
    if (!$tags?.length) return '';
    const $existing = $tags.children().not('.rs-pet-chip').first();
    if ($existing.length) detectedTagClass = $existing[0].className || '';
    return detectedTagClass || '';
}

// Font Awesome (FA6 free) icons per stat / passive prefix. Pet panel chips
// use these instead of letter abbreviations so the tags read at a glance.
// Matching is by the passive's first word (lower-case): "Loot Find" → loot.
const STAT_ICONS = {
    H: { icon: 'fa-heart',           label: 'Health' },
    A: { icon: 'fa-burst',           label: 'Attack' },
    D: { icon: 'fa-shield-halved',   label: 'Defense' },
};
const PASSIVE_ICONS = {
    melee:   'fa-hand-fist',
    ranged:  'fa-crosshairs',
    magic:   'fa-wand-magic-sparkles',
    loot:    'fa-sack-dollar',
    egg:     'fa-egg',
    hunger:  'fa-bowl-food',
    health:  'fa-heart',
    attack:  'fa-burst',
    defense: 'fa-shield-halved',
};
function passiveIcon(name) {
    const firstWord = (name || '').toLowerCase().split(/\s+/)[0];
    return PASSIVE_ICONS[firstWord] || null;
}

function statChip(letter, value, isBest, gameTagClass) {
    if (value == null) return '';
    const cls = `${gameTagClass} rs-pet-chip${isBest ? ' rs-pet-chip-best' : ''}`.trim();
    const meta = STAT_ICONS[letter];
    const v = Math.round(value);
    if (!meta) return `<div class="${cls}">${letter}${v}</div>`;
    return `<div class="${cls}" title="${meta.label}: ${v}%"><i class="fa-solid ${meta.icon}"></i><span>${v}</span></div>`;
}

function passiveChip(passive, gameTagClass) {
    const name = passive.name || '';
    const tooltip = `${name} ${passive.level || ''}`.trim() + (passive.effect ? ` (+${passive.effect}%)` : '');
    const isNegative = /hunger/i.test(name);
    const isMaxTier = !isNegative && (passive.level || 0) >= 4;
    const extra = (isNegative ? ' rs-pet-chip-negative' : '') + (isMaxTier ? ' rs-pet-chip-tier-max' : '');
    const cls = `${gameTagClass} rs-pet-chip rs-pet-chip-passive${extra}`.trim();
    const icon = passiveIcon(name);
    const level = passive.level || '';
    // Icon present → show icon + level. Unknown passive → fall back to the
    // legacy abbreviation so we never render an empty chip.
    const inner = icon
        ? `<i class="fa-solid ${icon}"></i><span>${level}</span>`
        : (name.split(/\s+/).map(w => w[0]?.toUpperCase() || '').join('') + level);
    return `<div class="${cls}" title="${escapeHtml(tooltip)}">${inner}</div>`;
}
