// Market filter — Pancake-style: preset Type filters + saved searches + Rift members highlight.
import * as events from '../core/events.js';
import { trigger as triggerMarketReader } from '../game/marketReader.js';
import { loadRiftMembers, isRiftMember, getMemberInfo, getMemberCount } from '../core/riftMembers.js';
import { data } from '../game/data.js';
import { formatNumber, escapeHtml, escapeAttr, escapeRegex, MOBILE_BREAKPOINT, retryAfter } from '../core/util.js';
import { getQuests as getGuildQuests, scheduleResetRefresh, formatTimeRemaining, nextDailyReset } from './guildQuests.js';

const PANEL_ID = 'rs-market-panel';
const FILTERS_KEY = 'riftscript_market_filters_v1';
const RIFT_MODE_KEY = 'riftscript_market_rift_mode_v1';
const CURRENT_KEY = 'riftscript_market_current_v1';

// Ratio = listing price ÷ vendor sell price. Lower = better deal.
const RATIO_GOOD_MAX = 3;
const RATIO_NEUTRAL_MAX = 5;

// Preset categories. Each maps to a "target" item name; conversions are
// resolved at runtime via data.drops + data.actions + data.ingredients.
const TYPE_TO_ITEM_NAME = {
    'Food': 'Health',
    'Charcoal': 'Charcoal',
    'Compost': 'Compost',
    'Arcane Powder': 'Arcane Powder',
    'Pet Snacks': 'Pet Snacks',
    'Metal Parts': 'Metal Parts',
    'Sigil Pieces': 'Sigil Pieces',
    'Research Points': 'Research Points',
    'Potion Mix': 'Potion Mix',
};

// Per-type valuation overrides. When a type has an `evaluate(item, listing)`
// here, listings are sorted by that function's sortValue (lowest = best),
// and the row chips reflect the returned labels. Categories without an entry
// fall back to the default vendor-price ratio.
//
// evaluate returns null when the listing has nothing valuable in this
// category (e.g. an item without the relevant attribute). null filters it out.
const TYPE_VALUATORS = {
    'Food': {
        match: (item) => (item.attributes?.HEAL || 0) > 0,
        // gold per HP healed — the market floor is 0.80 g/HP across every
        // tier of food, so the thresholds bracket that baseline.
        thresholds: { good: 1.5, neutral: 2.0 },
        evaluate(item, listing) {
            const heal = item.attributes?.HEAL;
            if (!heal) return null;
            const gPerHp = listing.price / heal;
            return {
                sortValue: gPerHp,
                ratioChip: {
                    text: `${gPerHp.toFixed(2)} g/HP`,
                    className: thresholdClass(gPerHp, this.thresholds),
                    title: 'Gold per HP healed (lower = better deal)',
                },
                valueChip: {
                    text: `${heal} HP`,
                    title: 'Total HP this food restores per use',
                },
            };
        },
    },
    // Charcoal is converted from logs at the burner (1–8 charcoal per log).
    // The rift-guild API exposes the log→charcoal recipe set, so this one
    // uses the conv lookup directly; everything else below ships with a
    // hardcoded yield map since the API doesn't currently expose them.
    'Charcoal': {
        thresholds: { good: 10.0, neutral: 15.0 },
        yieldOf(item) { return getTypeConversions('Charcoal')?.[item.id] || 0; },
        match(item) { return this.yieldOf(item) > 0; },
        evaluate(item, listing) {
            return buildConvChips(this, item, listing, {
                unit: 'coal',
                ratioUnit: 'g/coal',
                ratioTitle: 'Gold per charcoal yielded after conversion (lower = better deal)',
                valueTitle: (n, name) => `${name} converts to ${n} charcoal at the burner`,
            });
        },
    },
    // Compost — 8 fruits, hardcoded yields. Floor is 0.40 g/compost.
    'Compost': {
        thresholds: { good: 0.5, neutral: 1.0 },
        yields: {
            300: 20,  // Apple
            301: 40,  // Grapes
            302: 60,  // Cherry
            303: 80,  // Green Apple
            304: 100, // Blackcurrant
            323: 120, // Raspberry
            324: 140, // Blueberry
            347: 160, // Banana
        },
        yieldOf(item) { return this.yields[item.id] || 0; },
        match(item) { return this.yieldOf(item) > 0; },
        evaluate(item, listing) {
            return buildConvChips(this, item, listing, {
                unit: 'compost',
                ratioUnit: 'g/compost',
                ratioTitle: 'Gold per compost yielded after conversion (lower = better deal)',
                valueTitle: (n, name) => `${name} converts to ${n} compost at the composter`,
            });
        },
    },
    // Arcane Powder — 8 gems, hardcoded yields. Floor 2.40 g/powder.
    'Arcane Powder': {
        thresholds: { good: 2.5, neutral: 4.0 },
        yields: {
            30: 50,  31: 100, 32: 150, 33: 200,  // Ruby, Topaz, Emerald, Amethyst
            35: 250, 34: 300, 36: 350, 37: 400,  // Citrine, Diamond, Moonstone, Onyx
        },
        yieldOf(item) { return this.yields[item.id] || 0; },
        match(item) { return this.yieldOf(item) > 0; },
        evaluate(item, listing) {
            return buildConvChips(this, item, listing, {
                unit: 'powder',
                ratioUnit: 'g/powder',
                ratioTitle: 'Gold per arcane powder yielded after conversion (lower = better deal)',
                valueTitle: (n, name) => `${name} converts to ${n} arcane powder`,
            });
        },
    },
    // Pet Snacks — 8 raw fish, hardcoded yields. Floor varies by fish; high
    // tier (King Crab 4.50 g/snack) is the better deal.
    'Pet Snacks': {
        thresholds: { good: 5.0, neutral: 8.0 },
        yields: {
            305: 1, 308: 2, 311: 3, 314: 4,  // Shrimp, Cod, Salmon, Bass
            317: 5, 320: 6, 325: 7, 342: 8,  // Lobster, Swordfish, Shark, King Crab
        },
        yieldOf(item) { return this.yields[item.id] || 0; },
        match(item) { return this.yieldOf(item) > 0; },
        evaluate(item, listing) {
            return buildConvChips(this, item, listing, {
                unit: amount => `snack${amount === 1 ? '' : 's'}`,
                ratioUnit: 'g/snack',
                ratioTitle: 'Gold per pet snack yielded after conversion (lower = better deal)',
                valueTitle: (n, name) => `${name} converts to ${n} pet snack${n === 1 ? '' : 's'}`,
            });
        },
    },
    // Sigil Pieces — 9 sigils, hardcoded yields. Floor 14.00 g/piece.
    'Sigil Pieces': {
        thresholds: { good: 21.0, neutral: 28.0 },
        yields: {
            1210: 2,  1211: 4,  1212: 6,   // Basic Power/Discovery/Wisdom
            1213: 8,  1214: 10, 1215: 12,  // Regular Power/Discovery/Wisdom
            1216: 14, 1217: 16, 1218: 16,  // Super Power/Discovery/Wisdom
        },
        yieldOf(item) { return this.yields[item.id] || 0; },
        match(item) { return this.yieldOf(item) > 0; },
        evaluate(item, listing) {
            return buildConvChips(this, item, listing, {
                unit: 'pieces',
                ratioUnit: 'g/piece',
                ratioTitle: 'Gold per sigil piece yielded after conversion (lower = better deal)',
                valueTitle: (n, name) => `${name} breaks down into ${n} sigil pieces`,
            });
        },
    },
    // Research Points — 8 logbooks, hardcoded yields. Floor 4.00 g/point.
    'Research Points': {
        thresholds: { good: 6.0, neutral: 8.0 },
        yields: {
            1250: 1, 1251: 2, 1252: 3, 1253: 4,  // Beginner, Novice, Competent, Skilled
            1254: 5, 1255: 6, 1256: 7, 1257: 8,  // Adept, Advanced, Expert, Elite
        },
        yieldOf(item) { return this.yields[item.id] || 0; },
        match(item) { return this.yieldOf(item) > 0; },
        evaluate(item, listing) {
            return buildConvChips(this, item, listing, {
                unit: amount => `point${amount === 1 ? '' : 's'}`,
                ratioUnit: 'g/point',
                ratioTitle: 'Gold per research point yielded after conversion (lower = better deal)',
                valueTitle: (n, name) => `${name} converts to ${n} research point${n === 1 ? '' : 's'}`,
            });
        },
    },
    // Metal Parts — 136 smithed-gear sources. Floor is exactly 16 g/part for
    // every source, so the yield can be derived: minMarketPrice / 16. Body
    // pieces give 3 parts per tier, tools/other slots give 2 parts per tier.
    'Metal Parts': {
        thresholds: { good: 24.0, neutral: 32.0 },
        yieldOf(item) {
            if (!isSmithedGearItem(item)) return 0;
            const mm = item.attributes?.MIN_MARKET_PRICE || 0;
            return Math.round(mm / 16);
        },
        match(item) { return this.yieldOf(item) > 0; },
        evaluate(item, listing) {
            return buildConvChips(this, item, listing, {
                unit: 'parts',
                ratioUnit: 'g/part',
                ratioTitle: 'Gold per metal part yielded after conversion (lower = better deal)',
                valueTitle: (n, name) => `${name} converts to ${n} metal parts`,
            });
        },
    },
    // Potion Mix — every tradeable potion converts. Floor is exactly 4 g/mix,
    // so yield can be derived from minMarketPrice. 6+4n in-game formula.
    'Potion Mix': {
        thresholds: { good: 6.0, neutral: 8.0 },
        yieldOf(item) {
            if (!isPotion(item)) return 0;
            const mm = item.attributes?.MIN_MARKET_PRICE || 0;
            const y = Math.round(mm / 4);
            return y >= 6 ? y : 0;
        },
        match(item) { return this.yieldOf(item) > 0; },
        evaluate(item, listing) {
            return buildConvChips(this, item, listing, {
                unit: 'mix',
                ratioUnit: 'g/mix',
                ratioTitle: 'Gold per potion mix yielded after conversion (lower = better deal)',
                valueTitle: (n, name) => `${name} converts to ${n} potion mix`,
            });
        },
    },
};

// Shared chip builder for every conversion-style valuator — every entry
// computes the same `gold/yield-unit` ratio with the same chip layout.
function buildConvChips(valuator, item, listing, cfg) {
    const amount = valuator.yieldOf(item);
    if (!amount) return null;
    const gPer = listing.price / amount;
    const unitLabel = typeof cfg.unit === 'function' ? cfg.unit(amount) : cfg.unit;
    return {
        sortValue: gPer,
        ratioChip: {
            text: `${gPer.toFixed(2)} ${cfg.ratioUnit}`,
            className: thresholdClass(gPer, valuator.thresholds),
            title: cfg.ratioTitle,
        },
        valueChip: {
            text: `${amount} ${unitLabel}`,
            title: cfg.valueTitle(amount, item.name),
        },
    };
}

// Smithed gear name pattern — used by the Metal Parts valuator. Always two
// words (Tier + Slot); upgraded gear uses 3+ words (Superior / Exquisite /
// Perfect prefix), so excluding non-2-word names skips upgrades cleanly.
const METAL_TIERS = new Set(['Copper','Iron','Silver','Gold','Cobalt','Obsidian','Astral','Infernal']);
const METAL_SLOTS = new Set([
    'Helmet','Body','Boots','Gloves','Shield',
    'Sword','Hammer','Pickaxe','Hatchet','Spear','Bow','Scythe','Boomerang',
    'Rod','Spade','Compass','Lantern',
]);
function isSmithedGearItem(item) {
    const parts = (item?.name || '').split(' ');
    if (parts.length !== 2) return false;
    return METAL_TIERS.has(parts[0]) && METAL_SLOTS.has(parts[1]);
}

// Tribute filters — group multiple item categories, no per-item value sort.
const FLOWERS = new Set(['Daisy', 'Hyacinth', 'Lilac', 'Nemesia', 'Peony', 'Rose', 'Snapdragon', 'Tulip']);
const VEGETABLES = new Set(['Carrot', 'Chilli', 'Corn', 'Onion', 'Potato', 'Pumpkin', 'Radish', 'Tomato']);
const SMITHED_SKILLS = new Set(['Defense', 'OneHanded', 'TwoHanded', 'Ranged']);
// Upgraded gear is prefixed with Superior/Exquisite/Perfect (e.g. "Superior Copper Helmet").
// Runes also use quality prefixes (e.g. "Petty One-handed Rune"). Base smithed gear is
// always a 2-word name like "Copper Helmet" — that's the simplest reliable check.

const isBone = i => /(^| )(Bone|Bone Piece|Fang)( |$)/.test(i.name) || /^(Medium|Large|Giant) (Bone|Fang)$/.test(i.name);
const isPotion = i => i.name.includes('Potion');
const isFlower = i => FLOWERS.has(i.name);
const isVegetable = i => VEGETABLES.has(i.name);
const isLog = i => / Log$/.test(i.name);
const isLogbook = i => i.name.includes('Logbook');
// Smithed gear has a 2-word name with a known Tier + Slot — reuse the
// Metal-Parts valuator's check so the two stay in sync. Doesn't depend on
// the (now-numeric) item.skill field.
const isSmithed = i => isSmithedGearItem(i);
const isBar = i => / Bar$/.test(i.name);
const isOre = i => / Ore$/.test(i.name);
const isCrystal = i => / Crystal$/.test(i.name);
const isSigil = i => i.name.includes('Sigil') && !i.name.includes('Pieces');
const isKey = i => / Key( \d+)?$/.test(i.name);
const isEssence = i => / Essence$/.test(i.name);
const isCookedFood = i => /^Cooked /.test(i.name) || / Pie$/.test(i.name);
const isRawFish = i => /^Raw /.test(i.name);

const TRIBUTES = {
    'Forest': {
        desc: 'potions, flowers, vegetables, wood, logbooks, bones',
        match: i => isPotion(i) || isFlower(i) || isVegetable(i) || isLog(i) || isLogbook(i) || isBone(i),
    },
    'Mountain': {
        desc: 'smithed items (non-upgraded), bars, ore, crystals, bones',
        match: i => isSmithed(i) || isBar(i) || isOre(i) || isCrystal(i) || isBone(i),
    },
    'Ocean': {
        desc: 'sigils, keys, essences, food, raw fish, bones',
        match: i => isSigil(i) || isKey(i) || isEssence(i) || isCookedFood(i) || isRawFish(i) || isBone(i),
    },
};

// Tribute filters use the item's vendor sell price (`price` in the API)
// as the per-item tribute value, since tributes generally scale with item
// value in-game. Listings sort by listing price ÷ vendor value — lower is
// a better deal per tribute point contributed. Thresholds match what the
// best-deal filters use as their default vendor ratio.
function buildTributeValuator(name) {
    return {
        thresholds: { good: 1.5, neutral: 2.5 },
        evaluate(item, listing) {
            // Pull straight from the API's `price` field (mapped onto our
            // SELL_PRICE attribute in data.js). That price is what the game
            // values each item at, and tribute contributions scale with it
            // in-game, so it's the right proxy for tribute weight.
            const price = item.attributes?.SELL_PRICE || 0;
            if (!price) return null;
            const ratio = listing.price / price;
            return {
                sortValue: ratio,
                ratioChip: {
                    text: `${ratio.toFixed(2)}x`,
                    className: thresholdClass(ratio, this.thresholds),
                    title: 'Listing price ÷ item price (lower = better deal per tribute point)',
                },
                valueChip: {
                    text: `${formatNumber(price)} tribute`,
                    title: `Item price from the game data — used as the ${name} tribute weight`,
                },
            };
        },
    };
}
const TRIBUTE_VALUATORS = {
    'Forest': buildTributeValuator('Forest'),
    'Mountain': buildTributeValuator('Mountain'),
    'Ocean': buildTributeValuator('Ocean'),
};

let activeTab = 'filter';
let riftMode = 'highlight';
let savedFilters = [];
let currentFilter = { type: 'None', amount: 0, search: '', tribute: null };
let conversionsCache = null; // { [targetItemId]: { [fromItemId]: amountPerInput } }
let questCache = null; // { quests, resetAt, effectiveResetAt } — populated lazily

export function initMarketFilter() {
    savedFilters = readJSON(FILTERS_KEY, []);
    riftMode = readJSON(RIFT_MODE_KEY, 'highlight');
    currentFilter = { type: 'None', amount: 0, search: '', tribute: null, ...readJSON(CURRENT_KEY, {}) };

    loadRiftMembers().catch(e => console.warn('[RiftScript] member load failed:', e));

    events.on('page', onPage);
    events.on('reader-market', applyToListings);
    // When fresh member data arrives (after a background refresh), re-render
    // the panel (member count) and re-trigger the reader so stars appear.
    events.on('rift-members-loaded', () => {
        renderPanel();
        triggerMarketReader();
    });
    // Allow external features (e.g. guild quest panel) to set the search.
    events.on('market-filter-search', ({ search }) => {
        if (search) applyFilter({ type: 'None', tribute: null, search });
    });
    // Tabs throttle setTimeout when inactive — when the page becomes visible
    // again, double-check the quest cache hasn't aged past a reset window.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (!questCache || !isQuestCacheStale()) return;
        const page = events.last('page');
        if (page?.type === 'market') loadQuestsAndRender();
    });
    window.addEventListener('resize', handleResize);
}

function isQuestCacheStale() {
    return !!questCache?.effectiveResetAt && Date.now() >= questCache.effectiveResetAt;
}

let lastPageType = null;
function onPage(page) {
    const wasMarket = lastPageType === 'market';
    lastPageType = page?.type || null;
    if (page?.type !== 'market') return;
    // Only wipe the filter on true entry (navigating in from another page).
    // Don't wipe on sub-tab clicks or re-emits, which would clobber the
    // user's live search / amount inputs mid-typing.
    if (!wasMarket) {
        currentFilter = { type: 'None', amount: 0, search: '', tribute: null };
        writeJSON(CURRENT_KEY, currentFilter);
        setMarketSearch('');
    }
    retryAfter(ensurePanel);
    // Pre-fetch guild quests so the tab count shows up immediately
    loadQuestsAndRender();
}

// ─── Conversion mappings (lazy, memoized) ───────────────────

function getConversions() {
    if (conversionsCache || !data.ready) return conversionsCache;
    const map = {};
    for (const drop of data.drops.list) {
        const action = data.actions.byId[drop.action];
        if (!action || action.type !== 'CONVERSION') continue;
        const ings = data.ingredients.byAction[drop.action];
        if (!ings || !ings.length) continue;
        const fromItemId = ings[0].item;
        if (!map[drop.item]) map[drop.item] = {};
        map[drop.item][fromItemId] = drop.amount;
    }
    conversionsCache = map;
    return map;
}

function getTargetItemId(typeKey) {
    const targetName = TYPE_TO_ITEM_NAME[typeKey];
    if (!targetName) return null;
    return data.items?.byName?.[targetName]?.id ?? null;
}

function getTypeConversions(typeKey) {
    const targetId = getTargetItemId(typeKey);
    if (targetId == null) return null;
    const conv = getConversions();
    return conv?.[targetId] || null;
}

// Resolve which items belong to a Best-deal type. Prefers the valuator's own
// match() when defined (attribute-based, e.g. Food → HEAL > 0), then falls
// back to the conversion-target lookup. Returns an array of items, or null
// when neither path resolves.
function getTypeMatchingItems(typeKey) {
    const valuator = TYPE_VALUATORS[typeKey];
    if (valuator?.match && data.items?.list) {
        const items = data.items.list.filter(i => valuator.match(i));
        if (items.length) return items;
    }
    const conv = getTypeConversions(typeKey);
    if (conv) {
        return Object.keys(conv)
            .map(id => data.items.byId[id])
            .filter(Boolean);
    }
    return null;
}

// Same idea for tributes: filter the item list through the tribute's match
// predicate so applyFilter can type the names into the game's search box.
function getTributeMatchingItems(tributeKey) {
    const tribute = TRIBUTES[tributeKey];
    if (!tribute?.match || !data.items?.list) return null;
    return data.items.list.filter(i => tribute.match(i));
}


// ─── Panel ──────────────────────────────────────────────────

function ensurePanel() {
    const $component = $('market-listings-component');
    if (!$component.length) return;
    if ($(`#${PANEL_ID}`).length) return;
    const $panel = $(`<div id="${PANEL_ID}" class="rs-market-panel"></div>`);

    if (window.innerWidth < MOBILE_BREAKPOINT) {
        // Mobile: place the panel before the entire market component, so it sits
        // above the listings (not inside the flex-row of .groups).
        $component.before($panel);
    } else {
        // Desktop: append to the last group (sidebar position next to the listings)
        const $parent = $component.find('> .groups > :last-child');
        if (!$parent.length) return;
        $parent.append($panel);
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
        const isAboveComponent = $existing.next().is('market-listings-component');
        if (onMobile !== isAboveComponent) {
            $existing.remove();
            ensurePanel();
        }
    }, 200);
}

function renderPanel() {
    const $panel = $(`#${PANEL_ID}`);
    if (!$panel.length) return;

    const memberCount = getMemberCount();
    const memberCountLabel = memberCount
        ? `${memberCount} Rift members loaded`
        : 'Loading Rift members…';

    const questCount = questCache?.quests?.length;
    $panel.html(`
        <div class="rs-mp-tabs">
            <button class="rs-mp-tab ${activeTab === 'filter' ? 'active' : ''}" data-tab="filter">Filter</button>
            <button class="rs-mp-tab ${activeTab === 'saved' ? 'active' : ''}" data-tab="saved">
                Saved ${savedFilters.length ? `<span class="rs-mp-count">${savedFilters.length}</span>` : ''}
            </button>
            <button class="rs-mp-tab ${activeTab === 'guild' ? 'active' : ''}" data-tab="guild">
                Guild ${questCount ? `<span class="rs-mp-count">${questCount}</span>` : ''}
            </button>
        </div>
        <div class="rs-mp-body">
            ${activeTab === 'filter' ? renderFilterTab(memberCountLabel)
            : activeTab === 'saved' ? renderSavedTab()
            : renderGuildTab()}
        </div>
    `);

    if (activeTab === 'filter') {
        $panel.find('.rs-mp-type').on('change', function() {
            const val = $(this).val();
            if (val === 'None') {
                applyFilter({ type: 'None', tribute: null, search: '', amount: 0 });
            } else if (val.startsWith('tribute:')) {
                applyFilter({ tribute: val.slice('tribute:'.length) });
            } else if (val.startsWith('type:')) {
                applyFilter({ type: val.slice('type:'.length), search: '', tribute: null });
            }
        });
        $panel.find('.rs-mp-amount').on('change', function() {
            applyFilter({ amount: +$(this).val() || 0 });
        });
        $panel.find('.rs-mp-rift-mode').on('change', function() {
            riftMode = $(this).val();
            writeJSON(RIFT_MODE_KEY, riftMode);
            triggerMarketReader();
        });
        $panel.find('.rs-mp-refresh-members').on('click', async function() {
            const $btn = $(this);
            $btn.prop('disabled', true).text('Loading…');
            try {
                await loadRiftMembers({ force: true });
                triggerMarketReader();
            } finally {
                renderPanel();
            }
        });
        $panel.find('.rs-mp-save').on('click', saveCurrentFilter);
        $panel.find('.rs-mp-clear').on('click', clearFilter);
    } else if (activeTab === 'guild') {
        $panel.find('.rs-gq-quest').on('click', function() {
            const search = $(this).attr('data-search');
            if (search) applyFilter({ type: 'None', tribute: null, search });
        });
        // Refresh whenever the cached data is from a previous reset window
        if (!questCache || isQuestCacheStale()) loadQuestsAndRender();
    } else {
        $panel.find('.rs-mp-apply').on('click', function() {
            applySavedFilter($(this).data('key'));
        });
        $panel.find('.rs-mp-remove').on('click', function(e) {
            e.stopPropagation();
            removeSavedFilter($(this).data('key'));
        });

        // HTML5 drag-and-drop reorder of saved filters
        let draggedKey = null;
        $panel.find('.rs-mp-saved-row')
            .on('dragstart', function(e) {
                draggedKey = String($(this).attr('data-key'));
                if (e.originalEvent?.dataTransfer) {
                    e.originalEvent.dataTransfer.effectAllowed = 'move';
                    e.originalEvent.dataTransfer.setData('text/plain', draggedKey);
                }
                $(this).addClass('rs-mp-dragging');
            })
            .on('dragend', function() {
                $(this).removeClass('rs-mp-dragging');
                $panel.find('.rs-mp-drag-over').removeClass('rs-mp-drag-over');
                draggedKey = null;
            })
            .on('dragover', function(e) {
                if (!draggedKey) return;
                e.preventDefault();
                if (e.originalEvent?.dataTransfer) e.originalEvent.dataTransfer.dropEffect = 'move';
                $panel.find('.rs-mp-drag-over').removeClass('rs-mp-drag-over');
                $(this).addClass('rs-mp-drag-over');
            })
            .on('drop', function(e) {
                e.preventDefault();
                const targetKey = String($(this).attr('data-key'));
                if (!draggedKey || draggedKey === targetKey) return;
                const from = savedFilters.findIndex(f => f.key === draggedKey);
                const to = savedFilters.findIndex(f => f.key === targetKey);
                if (from < 0 || to < 0) return;
                const [moved] = savedFilters.splice(from, 1);
                savedFilters.splice(to, 0, moved);
                writeJSON(FILTERS_KEY, savedFilters);
                renderPanel();
            });
    }

    $panel.find('.rs-mp-tab').on('click', function() {
        activeTab = $(this).data('tab');
        renderPanel();
        // Opening the Guild tab triggers a fresh getGuild fetch — the in-game
        // quest progress can change at any moment, so showing 5-minute-old
        // cached numbers would be misleading right before a purchase.
        if (activeTab === 'guild') loadQuestsAndRender({ force: true });
    });
}

function renderFilterTab(memberCountLabel) {
    const currentValue = currentFilter.tribute
        ? `tribute:${currentFilter.tribute}`
        : (currentFilter.type && currentFilter.type !== 'None' ? `type:${currentFilter.type}` : 'None');

    const presetOptions = Object.keys(TYPE_TO_ITEM_NAME)
        .map(t => `<option value="type:${t}" ${currentValue === `type:${t}` ? 'selected' : ''}>${t}</option>`)
        .join('');
    const tributeOptions = Object.entries(TRIBUTES)
        .map(([name, t]) => `<option value="tribute:${name}" ${currentValue === `tribute:${name}` ? 'selected' : ''}>${name} tribute</option>`)
        .join('');

    const tributeHint = currentFilter.tribute
        ? `<div class="rs-mp-hint-row">${TRIBUTES[currentFilter.tribute].desc}</div>`
        : '';

    return `
        <div class="rs-mp-row">
            <div class="rs-mp-label">Filter</div>
            <select class="rs-mp-type rs-mp-select">
                <option value="None" ${currentValue === 'None' ? 'selected' : ''}>None</option>
                <optgroup label="Best deal">${presetOptions}</optgroup>
                <optgroup label="Tributes">${tributeOptions}</optgroup>
            </select>
        </div>
        ${tributeHint}
        <div class="rs-mp-row">
            <div class="rs-mp-label">Show best (amount)</div>
            <input type="number" min="0" class="rs-mp-amount rs-mp-input" value="${currentFilter.amount || ''}" placeholder="all">
        </div>
        <div class="rs-mp-divider"></div>
        <div class="rs-mp-row">
            <div class="rs-mp-label">Rift members</div>
            <select class="rs-mp-rift-mode rs-mp-select">
                <option value="off" ${riftMode === 'off' ? 'selected' : ''}>Off</option>
                <option value="highlight" ${riftMode === 'highlight' ? 'selected' : ''}>Highlight</option>
                <option value="exclusive" ${riftMode === 'exclusive' ? 'selected' : ''}>Show only</option>
            </select>
        </div>
        <div class="rs-mp-row">
            <span class="rs-mp-hint">${memberCountLabel}</span>
            <button class="rs-mp-btn rs-mp-refresh-members">Refresh</button>
        </div>
        <div class="rs-mp-divider"></div>
        <div class="rs-mp-row">
            <button class="rs-mp-btn rs-mp-save">Save current filter</button>
            <button class="rs-mp-btn rs-mp-btn-warning rs-mp-clear">Clear filter</button>
        </div>
    `;
}

function renderSavedTab() {
    if (!savedFilters.length) {
        return `<div class="rs-mp-empty">No saved filters yet. Pick a Type or type a search, then "Save current filter".</div>`;
    }
    return savedFilters.map(f => `
        <div class="rs-mp-saved-row" draggable="true" data-key="${escapeAttr(f.key)}">
            <span class="rs-mp-drag-handle" title="Drag to reorder">⋮⋮</span>
            <button class="rs-mp-btn rs-mp-apply" data-key="${escapeAttr(f.key)}">${escapeHtml(filterLabel(f))}</button>
            <button class="rs-mp-btn rs-mp-btn-danger rs-mp-remove" data-key="${escapeAttr(f.key)}" title="Remove">×</button>
        </div>
    `).join('');
}

function renderGuildTab() {
    // Reminder: contribution data is only refreshed when the game's own guild
    // page is opened (or when this tab is opened — that also forces a fetch).
    // Tell users so they don't buy stuff against stale "left" amounts.
    const notice = `<div class="rs-mp-hint-row" style="font-style:normal;color:#fbbf24">
        Tip: open the in-game <b>Guild → Quests</b> page once before buying,
        so this list reflects the latest contributions.
    </div>`;
    if (!questCache) {
        return `${notice}<div class="rs-mp-empty">Loading guild quests…</div>`;
    }
    const { quests, effectiveResetAt } = questCache;
    const timerHtml = effectiveResetAt
        ? `<div class="rs-mp-hint-row" style="font-style:normal">Resets in <span style="color:#fbbf24;font-weight:600">${escapeHtml(formatTimeRemaining(effectiveResetAt - Date.now()))}</span></div>`
        : '';
    if (!quests.length) {
        return `${notice}${timerHtml}<div class="rs-mp-empty">No open guild quests right now.</div>`;
    }
    const rows = quests.map(q => {
        const remaining = Math.max(0, (q.amount || 0) - (q.contributed || 0));
        const itemName = q.itemName || `#${q.itemId}`;
        return `
            <button class="rs-gq-quest" data-search="${escapeAttr(itemName)}" title="Filter market for ${escapeAttr(itemName)}">
                <span class="rs-gq-name">${escapeHtml(itemName)}</span>
                <span class="rs-gq-need">${formatNumber(remaining)} left</span>
            </button>
        `;
    }).join('');
    return `${notice}${timerHtml}<div class="rs-gq-list">${rows}</div>`;
}

async function loadQuestsAndRender({ force = false } = {}) {
    const result = await getGuildQuests({ force });
    if (!result) return;
    // The server's reset time-of-day is constant; compute the next occurrence
    // locally so the countdown is always accurate regardless of API lag.
    const effectiveResetAt = nextDailyReset(result.resetAt);
    questCache = { ...result, effectiveResetAt };

    scheduleResetRefresh(effectiveResetAt, () => {
        questCache = null;
        const page = events.last('page');
        if (page?.type === 'market') loadQuestsAndRender();
    });
    renderPanel();
}

function filterLabel(f) {
    if (f.tribute) return f.amount ? `Best ${f.amount} ${f.tribute} tribute` : `${f.tribute} tribute`;
    if (f.type && f.type !== 'None') {
        return f.amount ? `Best ${f.amount} ${f.type}` : f.type;
    }
    return f.search || '(empty)';
}

// ─── Filter actions ─────────────────────────────────────────

function applyFilter(patch) {
    // Selecting a type clears tribute and vice versa, but never auto-clear
    // amount/search — let the caller (dropdown handler or saved-filter restore)
    // decide whether to keep them.
    if (patch.type && patch.type !== 'None') patch.tribute = null;
    if (patch.tribute && !('type' in patch)) patch.type = 'None';
    Object.assign(currentFilter, patch);
    writeJSON(CURRENT_KEY, currentFilter);

    // Update the in-game search box to match the active filter. Tributes
    // skip the regex injection — Mountain (~160 alternatives) crashes the
    // game's filter on switch, and Ocean's ~1000-char regex of explicit
    // names empties the listings entirely. v1.6.12 tried both and both
    // re-broke (see commit history). Client-side hide is the safe path.
    if (currentFilter.tribute && TRIBUTES[currentFilter.tribute]) {
        setMarketSearch('');
    } else if (currentFilter.type && currentFilter.type !== 'None') {
        const items = getTypeMatchingItems(currentFilter.type);
        if (items?.length) {
            const names = items
                .map(i => i.name)
                .filter(Boolean)
                .map(n => `^${escapeRegex(n)}`)
                .join('|');
            setMarketSearch(names);
        }
    } else if (currentFilter.search) {
        setMarketSearch(currentFilter.search);
    }

    triggerMarketReader();
    renderPanel();
}

function clearFilter() {
    currentFilter = { type: 'None', amount: 0, search: '', tribute: null };
    writeJSON(CURRENT_KEY, currentFilter);
    setMarketSearch('');
    triggerMarketReader();
    renderPanel();
}

function saveCurrentFilter() {
    let key, entry;
    if (currentFilter.tribute) {
        key = `tribute:${currentFilter.tribute}:${currentFilter.amount || 0}`;
        entry = { key, tribute: currentFilter.tribute, amount: currentFilter.amount || 0 };
    } else if (currentFilter.type && currentFilter.type !== 'None') {
        key = `type:${currentFilter.type}:${currentFilter.amount || 0}`;
        entry = { key, type: currentFilter.type, amount: currentFilter.amount || 0 };
    } else {
        const search = getMarketSearchValue();
        if (!search) return;
        key = `search:${search}`;
        entry = { key, search };
    }
    if (savedFilters.some(f => f.key === key)) return;
    savedFilters.push(entry);
    writeJSON(FILTERS_KEY, savedFilters);
    activeTab = 'saved';
    renderPanel();
}

function removeSavedFilter(key) {
    savedFilters = savedFilters.filter(f => f.key !== key);
    writeJSON(FILTERS_KEY, savedFilters);
    renderPanel();
}

function applySavedFilter(key) {
    const f = savedFilters.find(x => x.key === key);
    if (!f) return;
    if (f.tribute) {
        applyFilter({ tribute: f.tribute, amount: f.amount || 0 });
    } else if (f.type) {
        applyFilter({ type: f.type, amount: f.amount || 0, search: '', tribute: null });
    } else {
        applyFilter({ type: 'None', amount: 0, search: f.search || '', tribute: null });
    }
}

// ─── Apply to listings (ratio sort + rift highlight) ────────

function applyToListings(marketData) {
    if (!marketData?.listings) return;
    const memberCount = getMemberCount();
    const isOwnTab = marketData.type === 'OWN';

    // Reset visuals first
    for (const l of marketData.listings) clearListingDecor(l.element);
    if (isOwnTab) return;

    let kept = marketData.listings;
    const tributeMatcher = currentFilter.tribute && TRIBUTES[currentFilter.tribute]?.match;
    if (tributeMatcher) {
        kept = filterByMembership(marketData, item => tributeMatcher(item));
    }
    const typeActive = currentFilter.type && currentFilter.type !== 'None';
    if (typeActive) {
        const items = getTypeMatchingItems(currentFilter.type);
        if (items?.length) {
            const allowed = new Set(items.map(i => i.id));
            kept = filterByMembership(marketData, (_, listing) => allowed.has(listing.item));
        }
    }

    if (riftMode !== 'off' && memberCount) applyRiftHighlight(kept);
}

// `match(item, listing)` returns true if the listing belongs in the active filter.
// Decorates kept listings with value + ratio chips, hides the rest, reorders by sort value,
// and returns the kept listings (possibly empty).
function filterByMembership(marketData, match) {
    const valuator = TYPE_VALUATORS[currentFilter.type]
        || TRIBUTE_VALUATORS[currentFilter.tribute];
    const matching = [];
    for (const l of marketData.listings) {
        const item = data.items?.byId?.[l.item];
        if (!item) continue;
        if (!match(item, l)) continue;

        if (valuator) {
            const ev = valuator.evaluate(item, l);
            if (!ev) continue; // listing has no value in this category — drop
            l._eval = ev;
            l._sort = ev.sortValue;
        } else {
            // Default: cost relative to the vendor sell price.
            const vendorPrice = item.attributes?.SELL_PRICE || 0;
            const ratio = vendorPrice > 0 ? l.price / vendorPrice : Infinity;
            l._eval = {
                sortValue: ratio,
                ratioChip: Number.isFinite(ratio)
                    ? { text: `${formatNumber(ratio)}x`, className: ratioClass(ratio),
                        title: 'Listing price ÷ vendor sell price (lower = better deal)' }
                    : null,
                valueChip: vendorPrice
                    ? { text: formatNumber(vendorPrice), title: 'Vendor sell price per item' }
                    : null,
            };
            l._sort = ratio;
        }
        matching.push(l);
    }
    // SELL: lower sort value = better deal (ascending). BUY: reverse.
    const dir = marketData.type === 'BUY' ? -1 : 1;
    matching.sort((a, b) => dir * (a._sort - b._sort));

    const limited = currentFilter.amount > 0
        ? matching.slice(0, currentFilter.amount)
        : matching;
    const keepSet = new Set(limited);

    for (const l of marketData.listings) {
        if (!keepSet.has(l)) { l.element.hide(); continue; }
        if (l._eval?.valueChip) addChip(l.element, 'rs-value-chip', l._eval.valueChip);
        if (l._eval?.ratioChip) addChip(l.element, 'rs-ratio-chip', l._eval.ratioChip);
    }
    reorderListings(limited);
    return limited;
}

function thresholdClass(value, thresholds) {
    if (value <= thresholds.good) return 'rs-ratio-good';
    if (value <= thresholds.neutral) return 'rs-ratio-neutral';
    return 'rs-ratio-bad';
}

function applyRiftHighlight(listings) {
    for (const listing of listings) {
        const isRift = listing.seller && isRiftMember(listing.seller);
        if (riftMode === 'exclusive') listing.element.toggle(!!isRift);
        if (!isRift) continue;
        listing.element.addClass('rs-rift-listing');
        if (listing.element.find('.rs-rift-badge').length) continue;
        const info = getMemberInfo(listing.seller);
        const guildLabel = info?.guildName || 'Rift';
        const badge = `<span class="rs-rift-badge" title="${escapeAttr(guildLabel)}">★</span>`;
        const $amount = listing.element.find('.amount').first();
        if ($amount.length) $amount.after(badge);
        else listing.element.find('.name').first().after(badge);
    }
}

// Generic chip injector — prepends into .cost so the chip inherits the
// right-aligned position the game pushes the price into.
function addChip($el, baseClass, { text, className = '', title = '' }) {
    if ($el.find(`.${baseClass}`).length) return;
    const cls = className ? `${baseClass} ${className}` : baseClass;
    const chip = `<span class="${cls}" title="${escapeAttr(title)}">${escapeHtml(text)}</span>`;
    const $cost = $el.find('.cost').first();
    if ($cost.length) $cost.prepend(chip);
    else $el.find('.amount').first().after(chip);
}

function ratioClass(ratio) {
    if (ratio <= RATIO_GOOD_MAX) return 'rs-ratio-good';
    if (ratio <= RATIO_NEUTRAL_MAX) return 'rs-ratio-neutral';
    return 'rs-ratio-bad';
}

function reorderListings(listings) {
    if (!listings.length) return;
    const parent = listings[0].element[0]?.parentNode;
    if (!parent) return;
    // Batch-move via DocumentFragment so the browser does one layout pass.
    const frag = document.createDocumentFragment();
    for (const l of listings) frag.appendChild(l.element[0]);
    parent.appendChild(frag);
}

function clearListingDecor($el) {
    $el.removeClass('rs-rift-listing');
    $el.find('.rs-rift-badge, .rs-ratio-chip, .rs-value-chip').remove();
    $el.show();
}

// ─── Helpers ────────────────────────────────────────────────

function getMarketSearchValue() {
    return $('market-listings-component .search > input').val()?.trim() || '';
}

function setMarketSearch(value) {
    const $input = $('market-listings-component .search > input');
    if (!$input.length) return;
    $input.val(value);
    $input[0].dispatchEvent(new Event('input', { bubbles: true }));
}

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        return fallback;
    }
}

function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* quota */ }
}
