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
import { formatNumber, escapeHtml, MOBILE_BREAKPOINT, retryAfter, debounce, pollUntilDone } from '../core/util.js';
import { getExpeditionResults, scrapeRotationsFromDOM } from './expeditionCalc.js';

const PANEL_ID = 'rs-pet-panel';
const FAMILY_KEY = 'pet-filter-family';
const DUP_KEY = 'pet-highlight-duplicates';
const SORT_KEY = 'pet-sort';
const PERFECT_KEY = 'pet-only-perfect';
const TAB_KEY = 'pet-active-tab';
const EXP_WEEK_KEY = 'pet-exp-week-offset';
const EXP_TIER_KEY = 'pet-exp-selected-tier';
const CHIPS_ENABLED_KEY = 'pet-chips-enabled';
const ICON_COLORS_KEY = 'pet-icon-colors-enabled';

let activeTab = 'manager'; // 'manager' | 'expedition'
let panelPoller = null;    // self-stopping poller, only runs while on taming

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
    // Modal decoration is cheap — apply it immediately for snappy feel.
    // The follow-up panel re-render + reader trigger are heavier; debounce
    // them so rapid pet clicks don't stack up full re-renders.
    const debouncedPostModal = debounce(() => {
        renderPanel();
        triggerPetReader();
    }, 120);
    events.on('reader-pet-modal', (m) => {
        decoratePetModal(m);
        debouncedPostModal();
    });
    window.addEventListener('resize', handleResize);
    // Sub-tab clicks inside taming-page (Pets / Ranch / Breeding / Expedition)
    // re-render Angular's groups container without firing a 'page' event, so
    // our injected panel disappears. The poller keeps the panel alive while
    // we're on taming, and self-stops the moment we leave the page. onPage
    // re-arms it on the next taming entry.
    panelPoller = pollUntilDone(() => {
        if (!$('taming-page').length) return false; // left taming → stop
        if (!$(`#${PANEL_ID}`).length) ensurePanel();
        // Backstop: re-trigger the reader if any visible row lost its marker
        // class (Angular re-renders rows on level-up / breed / feed and
        // wipes the children we injected). 1Hz is intentionally calm — a
        // faster MutationObserver fed a feedback loop with the chip
        // injection mutations + Angular's change detection, which the user
        // saw as constant flicker.
        if (anyRowMissingMarker()) triggerPetReader();
    }, 1000);

    // Delegated handlers — survive every renderPanel re-render because they're
    // bound to document, not to the (frequently replaced) panel children.
    bindDelegatedHandlers();
}

function anyRowMissingMarker() {
    const rows = document.querySelectorAll('taming-page button.row');
    for (const row of rows) {
        if (!row.classList.contains('rs-pet-processed')) return true;
    }
    return false;
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
    $(document).on('change', `${sel} .rs-pet-chips-toggle`, function() {
        gset(CHIPS_ENABLED_KEY, $(this).is(':checked'));
        triggerPetReader();
    });
    $(document).on('change', `${sel} .rs-pet-icon-colors-toggle`, function() {
        gset(ICON_COLORS_KEY, $(this).is(':checked'));
        triggerPetReader();
    });
}

function onPage(page) {
    if (page?.type !== 'taming') {
        // Clean up the panel so it doesn't linger on other pages — Angular
        // keeps taming-page in the DOM after navigation, so our injected
        // panel would otherwise stay visible on top. Poller self-stops on
        // its next tick when taming-page is gone.
        $(`#${PANEL_ID}`).remove();
        return;
    }
    retryAfter(ensurePanel);
    // Re-arm the panel poller in case we just navigated back to taming.
    if (panelPoller && !panelPoller.running) panelPoller.start();
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
    // Skip the re-render when the user is mid-interaction with a dropdown.
    // The 1Hz panelPoller and reader-pet emits would otherwise replace the
    // <select> the user just opened, cancelling their pending choice — the
    // exact reason tier / week dropdowns appeared to 'jump back' on change.
    if ($panel.find('select:focus').length) return;

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
            <div class="rs-pet-label">RiftScript pet chips</div>
            <label class="rs-toggle">
                <input type="checkbox" class="rs-pet-chips-toggle" ${getOnDefault(CHIPS_ENABLED_KEY) ? 'checked' : ''}>
                <span class="rs-toggle-slider"></span>
            </label>
        </div>
        <div class="rs-pet-row">
            <div class="rs-pet-label">Colored chip icons</div>
            <label class="rs-toggle">
                <input type="checkbox" class="rs-pet-icon-colors-toggle" ${gget(ICON_COLORS_KEY) ? 'checked' : ''}>
                <span class="rs-toggle-slider"></span>
            </label>
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
                <span class="rs-pet-chip"><i class="fa-solid fa-tree"></i><span>6</span></span>
                <span class="rs-pet-chip rs-pet-chip-best"><i class="fa-solid fa-heart"></i><span>92</span></span>
                <span class="rs-pet-chip rs-pet-chip-best-perfect"><i class="fa-solid fa-burst"></i><span>100</span></span>
                <span class="rs-pet-chip rs-pet-chip-passive"><i class="fa-solid fa-sack-dollar"></i><span>1</span></span>
                <span>Chips: ability / stat / passive — <span style="color:#4ade80">green</span> = best in family, <span style="color:#fbbf24">gold</span> = perfect (100% stat, 300% total, lvl 4+ passive). Hover for names.</span>
            </div>
            <div class="rs-pet-legend-row">
                <span class="rs-pet-legend-star">★</span>
                <span class="rs-pet-legend-dup"></span>
                <span>★ best in family · highlighted row = exact duplicate · opening a pet outlines the modal green/gold (also on hatchlings).</span>
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
    const chipsEnabled = getOnDefault(CHIPS_ENABLED_KEY);
    // Icon colors default OFF — user opts in via the toggle.
    const iconColorsEnabled = !!gget(ICON_COLORS_KEY);

    // Toggle game-tag hiding + icon-coloring via classes on taming-page.
    // CSS rules live in styles.js — best/perfect border colors are always on.
    $('taming-page')
        .toggleClass('rs-pet-chips-on', chipsEnabled)
        .toggleClass('rs-pet-icon-colors-on', iconColorsEnabled);

    // Attach stats — prefer getUser API (unique per pet ID), fall back to modal-scrape cache.
    for (const pet of pets) pet.cachedStats = pet.apiStats || getPetStats(pet);

    const fingerprintCount = countFingerprints(pets);
    const bestPerFamily = computeBestPerFamily(pets);
    const statBestPerFamily = computeStatBestPerFamily(pets);

    for (const pet of pets) {
        decoratePet(pet, { family, dup, onlyPerfect, chipsEnabled, fingerprintCount, bestPerFamily, statBestPerFamily });
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
    // Mark the row so the panelPoller can tell whether the game has re-
    // rendered it (level-up, breed, equipment change wipe our injected
    // children). A row missing this class on a poll tick → re-trigger.
    $el.addClass('rs-pet-processed');

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
    // Chips toggle: when off, skip all our chip injection so only the game's
    // native tags show. Best-star / family-filter / duplicate-highlight still apply.
    if (ctx.chipsEnabled && s && (s.health != null || s.attack != null || s.defense != null)) {
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

    // Species abilities first (Wood / Bones / Fish / etc.) so they read as the
    // pet's primary identity, with H/A/D and passives after. When a pet has
    // only one ability, pad the second slot with an invisible spacer chip so
    // the H/A/D + passive chips line up across every row.
    const species = data.pets?.byId?.[pet.species];
    if (species && !ctx.onlyPerfect) {
        if (species.abilityName1) html += abilityChip(species.abilityName1, species.abilityValue1, gameTagClass);
        if (species.abilityName2) {
            html += abilityChip(species.abilityName2, species.abilityValue2, gameTagClass);
        } else if (species.abilityName1) {
            html += `<div class="${gameTagClass} rs-pet-chip rs-pet-chip-spacer" aria-hidden="true"><i class="fa-solid fa-leaf"></i><span>0</span></div>`.trim();
        }
    }

    const renderStat = (letter, value, isBest) => {
        if (value == null) return;
        const isPerfectStat = value === 100;
        if (ctx.onlyPerfect && !isPerfectStat) return;
        if (isPerfectStat) hasKeeper = true;
        // Perfect (100% stat OR 300% total) → gold. Best-in-family → green.
        html += statChip(letter, value, isBest, gameTagClass, isPerfect || isPerfectStat);
    };
    renderStat('H', s.health, s.health === fbest.health);
    renderStat('A', s.attack, s.attack === fbest.attack);
    renderStat('D', s.defense, s.defense === fbest.defense);

    if (Array.isArray(s.passives)) {
        // Sort passives into a stable display order before rendering so each
        // pet's chip row reads the same way (defensive → utility → offensive
        // → hunger). Sort is non-destructive — keeps original array intact.
        const sortedPassives = [...s.passives].sort(
            (a, b) => passiveSortKey(a?.name) - passiveSortKey(b?.name)
        );
        for (const p of sortedPassives) {
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
// Fixed display order for passive chips so the row reads consistently across
// every pet. Defensive triplet first, then utility, then offensive, with
// negative Hunger pinned at the end. Unknown passives sort after Hunger.
const PASSIVE_ORDER = [
    'melee', 'ranged', 'magic',
    'loot', 'egg',
    'health', 'attack', 'defense',
    'hunger',
];
function passiveSortKey(name) {
    const firstWord = (name || '').toLowerCase().split(/\s+/)[0];
    const i = PASSIVE_ORDER.indexOf(firstWord);
    return i >= 0 ? i : PASSIVE_ORDER.length;
}

// Species ability icons. Names match the lowercase keys used by the game's
// petAbility / drop type system (wood / bones / fish / etc.).
const ABILITY_ICONS = {
    wood:     'fa-tree',
    bones:    'fa-bone',
    fish:     'fa-fish',
    flowers:  'fa-spa',
    ore:      'fa-mountain',
    veges:    'fa-carrot',
    crystals: 'fa-gem',
    logbooks: 'fa-book',
};
function abilityChip(name, value, gameTagClass) {
    if (!name || value == null || value === 0) return '';
    const key = String(name).toLowerCase();
    const icon = ABILITY_ICONS[key];
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    const cls = `${gameTagClass} rs-pet-chip rs-pet-chip-ability`.trim();
    const tooltip = `${label} ${value}`;
    const inner = icon
        ? `<i class="fa-solid ${icon}"></i><span>${value}</span>`
        : `${label[0]}${value}`;
    return `<div class="${cls}" title="${escapeHtml(tooltip)}">${inner}</div>`;
}

function statChip(letter, value, isBest, gameTagClass, isPerfect = false) {
    if (value == null) return '';
    // Perfect (100%) > best-in-family. Gold beats green when both apply.
    const colorCls = isPerfect ? 'rs-pet-chip-best-perfect'
                  : isBest    ? 'rs-pet-chip-best'
                  : '';
    const cls = `${gameTagClass} rs-pet-chip ${colorCls}`.trim();
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

// ─── Pet detail / hatchling modal outline ──────────────────────────
//
// Called from the reader-pet-modal listener. Compares the modal pet's stats
// against the same-family pets we've already scraped (lastPets via the
// 'reader-pet' event cache) and applies an outline class:
//   - gold  rs-pet-modal-perfect : any H/A/D = 100%, or total = 300%, or
//                                  any non-Hunger passive is level 4+
//   - green rs-pet-modal-best    : pet's total >= max total across family
//   - per-row highlights also added to the in-modal Health / Attack /
//     Defense / Total / passive lines so the user sees at a glance which
//     stats outshine the rest of the family.
function decoratePetModal({ health, attack, defense, total, passives, family, modalEl }) {
    if (!modalEl) return;
    const $modal = $(modalEl);
    $modal.removeClass('rs-pet-modal-best rs-pet-modal-perfect');
    $modal.find('.row').removeClass('rs-pet-modal-row-best rs-pet-modal-row-perfect');
    if (health == null && attack == null && defense == null) return;

    const totalCalc = total != null ? total : ((health || 0) + (attack || 0) + (defense || 0));
    const isPerfectTotal = totalCalc >= 300;
    const isPerfectH = health === 100;
    const isPerfectA = attack === 100;
    const isPerfectD = defense === 100;
    const hasMaxPassive = Array.isArray(passives) && passives.some(p =>
        p && p.name && (p.level || 0) >= 4 && !/hunger/i.test(p.name));
    const isPerfect = isPerfectTotal || isPerfectH || isPerfectA || isPerfectD || hasMaxPassive;

    // Family best lookup — use the cached pet list from the last reader-pet emit.
    const family_pets = (events.last('reader-pet') || []).filter(p => p.family === family);
    let bestTotal = 0;
    const bestStat = { health: 0, attack: 0, defense: 0 };
    for (const p of family_pets) {
        const ps = p.cachedStats || p.apiStats || getPetStats(p);
        if (!ps) continue;
        const t = (ps.health || 0) + (ps.attack || 0) + (ps.defense || 0);
        if (t > bestTotal) bestTotal = t;
        for (const k of ['health', 'attack', 'defense']) {
            if ((ps[k] || 0) > bestStat[k]) bestStat[k] = ps[k] || 0;
        }
    }
    const isBest = totalCalc > 0 && totalCalc >= bestTotal;

    // Whole-modal outline: gold wins over green.
    if (isPerfect) $modal.addClass('rs-pet-modal-perfect');
    else if (isBest) $modal.addClass('rs-pet-modal-best');

    // Per-row highlights inside the modal.
    const highlightRow = (label, perfect, best) => {
        const $row = $modal.find(`.row:contains("${label}"), .stat:contains("${label}")`).first();
        if (!$row.length) return;
        if (perfect) $row.addClass('rs-pet-modal-row-perfect');
        else if (best) $row.addClass('rs-pet-modal-row-best');
    };
    highlightRow('Health',  isPerfectH, (health  || 0) > 0 && health  >= bestStat.health);
    highlightRow('Attack',  isPerfectA, (attack  || 0) > 0 && attack  >= bestStat.attack);
    highlightRow('Defense', isPerfectD, (defense || 0) > 0 && defense >= bestStat.defense);
    highlightRow('Total',   isPerfectTotal, totalCalc > 0 && totalCalc >= bestTotal);

    // Per-passive highlights (level 4+, non-Hunger = gold).
    if (Array.isArray(passives)) {
        for (const p of passives) {
            if (!p?.name) continue;
            const isMax = (p.level || 0) >= 4 && !/hunger/i.test(p.name);
            if (!isMax) continue;
            const $row = $modal.find(`.row:contains("${p.name}")`).first();
            if ($row.length) $row.addClass('rs-pet-modal-row-perfect');
        }
    }

    // 4-passive breeding check — only show a banner when the pet itself has
    // 4 passives. <4 passives = no banner (irrelevant for breeding decisions).
    $modal.find('.rs-pet-modal-breeding-info').remove();
    const realPassives = Array.isArray(passives) ? passives.filter(p => p?.name) : [];
    if (realPassives.length < 4) return;

    // All-perfect = every passive is level 4+ and none is Hunger. That's the
    // ultimate breeder roll → gold banner. Otherwise it's still a 4-passive
    // keeper, just not maxed → green banner.
    const allPerfect = realPassives.every(p =>
        (p.level || 0) >= 4 && !/hunger/i.test(p.name)
    );

    // Count other 4-passive pets in the family (any level). Subtract self if
    // the modal pet is in the cache (regular click); hatchlings aren't cached
    // yet so the count is already correct for them.
    let fourPassiveInFamily = 0;
    for (const p of family_pets) {
        const ps = p.cachedStats || p.apiStats || getPetStats(p);
        const cnt = Array.isArray(ps?.passives) ? ps.passives.filter(x => x?.name).length : 0;
        if (cnt >= 4) fourPassiveInFamily++;
    }
    const others = Math.max(0, fourPassiveInFamily - 1);

    let msg;
    let variant;
    if (allPerfect) {
        variant = 'rs-pet-modal-breeding-info-gold';
        msg = others === 0
            ? '✨ First 4-perfect-passive pet in this family — keeper!'
            : `✓ 4 perfect passives — family has ${others} other 4-passive pet${others !== 1 ? 's' : ''}`;
    } else {
        variant = 'rs-pet-modal-breeding-info-green';
        msg = others === 0
            ? 'First pet in this family with 4 passives'
            : `4 passives — family has ${others} other 4-passive pet${others !== 1 ? 's' : ''}`;
    }

    const $info = $(`<div class="rs-pet-modal-breeding-info ${variant}">${escapeHtml(msg)}</div>`);
    const $header = $modal.find('.header').first();
    if ($header.length) $header.after($info);
    else $modal.prepend($info);
}
