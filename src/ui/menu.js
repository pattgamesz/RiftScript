// Injects RiftScript button into the game's left nav and manages pages
import * as events from '../core/events.js';
import * as storage from '../core/storage.js';
import * as settings from '../core/settings.js';
import { getMode } from '../game/mode.js';
import { getDiscordUser, isLinked, openOAuth, unlinkDiscord, setTimer } from '../features/discord.js';
import { openCombatSimPage } from './combatSimPage.js';

const MENU_ID = 'riftscript-menu-btn';
const PAGE_TAG = 'riftscript-page';

let isOpen = false;
let activeMenu = 'info';

function migrateUISettings() {
    // Migrate old mode-scoped UI settings to global keys
    for (const key of ['ui-changes', 'recipe-clickthrough']) {
        if (settings.get(key) != null) continue;
        const old = storage.getData(key);
        if (old != null) settings.set(key, old);
    }
}

// ─── UI Changes ──────────────────────────────────────────────

const UI_CHANGES_ID = 'riftscript-ui-changes';

const UI_SECTIONS = [
    'challenges-page', 'changelog-page', 'daily-quest-page', 'equipment-page',
    'guild-page', 'home-page', 'leaderboards-page', 'market-page', 'merchant-page',
    'quests-page', 'settings-page', 'skill-page', 'upgrade-page', 'taming-page',
    'traits-page', 'mastery-page', 'marks-page', 'profile-page', 'store-page',
    'adventure-page', 'attunement-page',
].join(', ');
const UI_SELECTOR = `:is(${UI_SECTIONS})`;

function applyUIChanges() {
    const enabled = settings.get('ui-changes');
    const existing = document.getElementById(UI_CHANGES_ID);
    if (enabled && !existing) {
        document.documentElement.style.setProperty('--gap', '10px');
        const style = document.createElement('style');
        style.id = UI_CHANGES_ID;
        style.textContent = `
            nav-component button,
            nav-component .link,
            nav-component .compact,
            nav-component .row-button {
                height: auto !important;
            }
            .riftscript-nav-btn {
                padding: 6px 24px !important;
            }
            .riftscript-nav-logo {
                width: 24px !important;
                height: 24px !important;
                font-size: 0.6em !important;
            }
            ${UI_SELECTOR} :not(.multi-row) > :is(
                button.item, button.row, button.socket-button,
                button.level-button, div.item, div.row
            ) {
                padding: 2px 6px !important;
                min-height: 0 !important;
            }
            ${UI_SELECTOR} :not(.multi-row) > :is(
                button.item div.image, button.row div.image,
                div.item div.image, div.item div.placeholder-image,
                div.row div.image, div.row div.image-missing,
                div.row div.avatar-missing
            ) {
                height: 32px !important;
                width: 32px !important;
                min-height: 0 !important;
                min-width: 0 !important;
            }
            ${UI_SELECTOR} div.lock {
                height: unset !important;
                padding: 0 !important;
            }
            ${UI_SELECTOR} div.filters {
                gap: 4px !important;
            }
            ${UI_SELECTOR} button.filter {
                padding: 1px 6px !important;
                min-width: 0 !important;
            }
            action-component div.body > div.image,
            enchant-component div.body > div.image,
            automate-component div.body > div.image,
            daily-quest-page div.body > div.image {
                height: 48px !important;
                width: 48px !important;
            }
            div.progress div.body {
                padding: 8px !important;
            }
            action-component div.bars {
                padding: 0 !important;
            }
            equipment-component button {
                padding: 0 !important;
            }
            inventory-page .items {
                grid-gap: 0 !important;
            }
            div.scroll.custom-scrollbar .header,
            div.scroll.custom-scrollbar button {
                height: 28px !important;
            }
            div.scroll.custom-scrollbar img {
                height: 16px !important;
                width: 16px !important;
            }
            .scroll {
                overflow-y: auto !important;
                -ms-overflow-style: none;
                scrollbar-width: none;
            }
            .scroll::-webkit-scrollbar {
                display: none;
            }
        `;
        document.head.appendChild(style);
    } else if (!enabled && existing) {
        document.documentElement.style.removeProperty('--gap');
        existing.remove();
    }
}

function applyRecipeClickthrough() {
    $('skill-page button.row[disabled]').removeAttr('disabled');
}

// ─── Init ────────────────────────────────────────────────────

const GAME_PAGES = 'skill-page, equipment-page, home-page, market-page, merchant-page, settings-page, taming-page, profile-page, quests-page, guild-page, adventure-page, challenges-page, leaderboards-page, upgrade-page, traits-page, mastery-page, marks-page, store-page, daily-quest-page, changelog-page';

export function initMenu() {
    migrateUISettings();
    applyUIChanges();
    setInterval(injectNavButton, 1000);

    // Re-apply UI changes once game mode is detected (settings may have been
    // saved under a mode-scoped key before this fix)
    events.on('mode', () => {
        migrateUISettings();
        applyUIChanges();
    });

    events.on('page', (page) => {
        // Navigated away — clean up our page (same as Pancake's handlePage)
        if (page.type !== 'riftscript') {
            $(PAGE_TAG).remove();
            $(`#${MENU_ID}`).removeClass('rs-nav-active');
            if (isOpen) {
                $('header-component div.wrapper > div.image').show();
                // Fix header title — Angular sometimes stops updating it
                // But don't override if another custom page is taking over
                if (page.type !== 'combatsim') {
                    let headerName = page.type;
                    headerName = headerName.charAt(0).toUpperCase() + headerName.slice(1);
                    $('header-component div.wrapper > div.title').text(headerName);
                }
            }
            isOpen = false;
        }
        if (page.type === 'action' && settings.get('recipe-clickthrough')) {
            setTimeout(applyRecipeClickthrough, 200);
        }
    });
    window.addEventListener('riftscript-discord-updated', () => {
        if (isOpen) renderPage();
    });
}

// ─── Nav Button ──────────────────────────────────────────────

function injectNavButton() {
    if ($(`#${MENU_ID}`).length) return;
    const settingsBtn = $('nav-component button[routerlink="/settings"]');
    if (!settingsBtn.length) return;

    const btn = $(`
        <button id="${MENU_ID}" type="button" class="riftscript-nav-btn">
            <div class="riftscript-nav-logo">RS</div>
            <div class="name">RiftScript${RIFTSCRIPT_DEV ? ' <span style="color:#f59e0b;font-size:0.7em">DEV</span>' : ''}</div>
        </button>
    `);

    btn.on('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen) {
            cleanupPage();
            triggerAngularNav('settings');
        } else {
            openPage();
        }
    });

    settingsBtn.after(btn);
}

// ─── Page Lifecycle ──────────────────────────────────────────

function triggerAngularNav(page) {
    window.history.pushState({}, '', page);
    window.history.pushState({}, '', page);
    window.history.back();
}

async function goToPage(page) {
    if (page === 'settings') {
        // Angular won't re-route if already on settings — go elsewhere first
        triggerAngularNav('merchant');
        await waitForElement('merchant-page', 3000);
    }
    triggerAngularNav(page);
}

async function openPage() {
    isOpen = true;
    activeMenu = 'info';

    // If a custom page is already open, just remove and re-render
    if ($(PAGE_TAG).length) {
        $(PAGE_TAG).remove();
    } else {
        // Navigate to settings via Angular, wait for it, then remove it
        await goToPage('settings');
        await waitForElement('settings-page', 3000);
        $('settings-page').remove();
    }

    // Update header
    $('header-component div.wrapper > div.title').text('RiftScript');
    $('header-component div.wrapper > div.image').hide();

    // Update nav active state
    $('nav-component button').removeClass('active-link');
    $(`#${MENU_ID}`).addClass('rs-nav-active');

    // Push our path
    history.pushState({}, '', 'riftscript');

    renderPage();
}

function cleanupPage() {
    isOpen = false;
    $(PAGE_TAG).remove();
    $(`#${MENU_ID}`).removeClass('rs-nav-active');
    $('header-component div.wrapper > div.image').show();
}

function waitForElement(selector, timeout = 2000) {
    return new Promise((resolve) => {
        if ($(selector).length) return resolve();
        const interval = setInterval(() => {
            if ($(selector).length) {
                clearInterval(interval);
                resolve();
            }
        }, 50);
        setTimeout(() => { clearInterval(interval); resolve(); }, timeout);
    });
}

// ─── Render ──────────────────────────────────────────────────

const MENU_TABS = [
    { id: 'info',     label: 'Info' },
    { id: 'settings', label: 'Settings' },
    { id: 'combat',   label: 'Combat Calc' },
    { id: 'discord',  label: 'Discord' },
    { id: 'prices',   label: 'Custom Prices' },
];

function renderInfoCard() {
    const modeLabel = getMode() === 'multiplayer' ? 'Multiplayer' : 'Singleplayer';
    return `
        <div class="rs-card">
            <div class="rs-card-header">RiftScript</div>
            <div class="rs-row"><span>Version</span><span>${RIFTSCRIPT_VERSION}${RIFTSCRIPT_DEV ? ' [DEV]' : ''}</span></div>
            <div class="rs-row"><span>Game Mode</span><span>${modeLabel}</span></div>
            <div class="rs-row"><span>Made by</span><span>Patt</span></div>
            <div class="rs-row"><span>Website</span><span><a href="https://rift-guild.com" target="_blank" style="color:#4a9eff;text-decoration:none">rift-guild.com</a></span></div>
            <div class="rs-row"><span>Script based on</span><span>ironwood-scripts by Pancake</span></div>
            <div class="rs-row"><span>Combat Sim based on</span><span>spreadsheet by Rivea</span></div>
        </div>
    `;
}

function renderCombatCard() {
    return `
        <div class="rs-card">
            <div class="rs-card-header">Combat Simulator</div>
            <div class="rs-row">
                <span>Full combat sandbox with simulation, loot breakdown, and time to level.</span>
                <button class="rs-btn rs-btn-primary" id="rs-open-combatsim">Open Simulator</button>
            </div>
        </div>
    `;
}

function renderPricesCard() {
    const customPrices = storage.getData('custom-prices');
    const priceCount = customPrices ? Object.keys(customPrices).length : 0;
    const body = priceCount > 0 ? `
        <div class="rs-row">
            <span>You have ${priceCount} custom price${priceCount !== 1 ? 's' : ''}</span>
            <button class="rs-btn rs-btn-danger" id="rs-reset-prices">Reset All</button>
        </div>
    ` : `
        <div class="rs-row"><span style="opacity:0.4">No custom prices set. Edit prices on the Items tab.</span></div>
    `;
    return `
        <div class="rs-card">
            <div class="rs-card-header">Custom Prices</div>
            ${body}
        </div>
    `;
}

function renderChangelogCard() {
    return `
        <div class="rs-card">
            <div class="rs-card-header">Changelog</div>
            <div class="rs-changelog">
                                <div class="rs-changelog-section">v1.5.0 — Combat Simulator: complete Rivea sheet port</div>
                                <ul>
                                    <li><b>Combat Sim now mirrors the entire Rivea spreadsheet</b> — every named range that affects XP/loot/profit is wired up. Mark variants (Primary/Defense/FullSet/RegionSet), Trait set bonuses, Runic Tome chain, Eff Skill Rune, Adventure Profit per-item rates, and 14 relic-effect toggles.</li>
                                    <li><b>Three earlier-broken masteries now actually work</b>: Coin Drop (loot value), Double XP (XP/hr), Lantern (key cost reduction).</li>
                                    <li><b>Insatiable in the simulator</b>: real per-hit proc rolls (T8 + Wisdom + Relic ≈ 24% extra-hit chance), not just a flat XP boost.</li>
                                    <li><b>Pet Manager / Expedition calc now survives sub-tab navigation</b>: the panel re-injects itself on every taming sub-tab (Pets / Ranch / Breeding / Expedition) and re-emits the last good pet scrape so the expedition calc keeps its data.</li>
                                    <li>Seed input for reproducible simulations.</li>
                                    <li>Equipment-derived fields no longer overwrite manual edits.</li>
                                    <li>Outskirts kills/hr fix (efficiency no longer double-applied).</li>
                                    <li>Many smaller bug fixes from v1.4.1 – v1.4.6.</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.4.1 – v1.4.4 — Combat Simulator overhaul</div>
                                <ul>
                                    <li><b>Bug fixes</b>: XP/hr and Loot/hr now include every modifier shown in the breakdown panels (potion, brew, relic, trait, mark, guild, masteries) — previously only the equipment chip values were applied.</li>
                                    <li><b>Outskirts fix</b>: kills/hr no longer double-applies efficiency when grinding Outskirts content.</li>
                                    <li><b>Potion/Brew fix</b>: the +XP / +Loot effect from your selected potion/brew is now actually used in the math (was silently 0).</li>
                                    <li><b>Sheet-conformant formulas</b>: full port of Rivea's Tiers / Sigils / MapMods / Potions / Brews tables. Potion bonuses now scale correctly with Potent mastery, Wisdom Tome, and Potent Relic stacking.</li>
                                    <li><b>New Modifiers tab cards</b>: Masteries (Potent / Savage / Insatiable / Coin / Double XP / Lantern tier + Runic level), Sigil selector, Active Map (mod type + tier + state), Relic Effects (doublers for Potent/Savage/Insatiable + Outskirts XP relic).</li>
                                    <li><b>Insatiable XP procs</b> toggle (+50% XP per kill when active).</li>
                                    <li><b>Seed input</b> for deterministic, reproducible runs — same seed → same dice rolls.</li>
                                    <li>Equipment-derived efficiency / loot / XP fields no longer overwrite your manual edits when you change equipment.</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.4.0</div>
                                <ul>
                                    <li><b>Pet Manager</b> on the Taming page — inline H/A/D + passive chips on every pet (click once to cache), best-in-family ★ marker, exact duplicate detection, "Only perfect stats" filter, family + sort options</li>
                                    <li><b>Expedition Calculator</b> tab in the Pet Manager — per-tier success chance, drops, food cost, egg chance, EXP per run; weekly rotation auto-detected; plan ahead for next week / in 2 weeks</li>
                                    <li><b>Guild Quests tab</b> on the market filter — open quests with live reset countdown, click a quest to instantly search the market for it</li>
                                    <li>Drag-and-drop reorder for saved market filters</li>
                                    <li>Rift member ★ moved to a cleaner spot; vendor/ratio chips now sit next to the price</li>
                                    <li>Market filter auto-resets each time you enter the market page</li>
                                    <li>Target button on Buy/Order modals now matches the game's native button styling</li>
                                    <li>Compact UI now also applies to the Attunement page</li>
                                    <li>Idle Beep is off by default and no longer false-triggers on page navigation</li>
                                    <li>Faster startup: game data cached locally with background refresh (no third-party data API)</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.3.5</div>
                                <ul>
                                    <li>Pet stats now sourced from the getUser API — each pet's data lookup is unique (no more sharing stats between same-name pets)</li>
                                    <li>Sort uses CSS order instead of moving DOM nodes — stable position-based fallback for breeders</li>
                                    <li>Hunger passive always shown red regardless of tier</li>
                                    <li>Cached counter updates instantly when you click a new pet</li>
                                    <li>Fix: jQuery handler crash that broke the entire pet panel</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.3.4</div>
                                <ul>
                                    <li>Removed runtime dependency on third-party data API — public game data is now exclusively served from our own hosting</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.3.3</div>
                                <ul>
                                    <li>Public game data now served from our own hosting first — fixes pet panel and other features for Firefox users who couldn't reach the live API's cert chain</li>
                                    <li>Pet panel shows a clear error message if data still fails to load</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.3.2</div>
                                <ul>
                                    <li>Pet panel moves to the right sidebar on desktop (above on mobile)</li>
                                    <li>Pet stat chips now match the game's tag style exactly and sit on a second row under the in-game tags</li>
                                    <li>Passives are shown as initials+level chips with full name on hover — level 4 turns green</li>
                                    <li>Perfect 300% total roll highlights the game's own % tag green (no duplicate chip)</li>
                                    <li>Legend explaining all colors and the modal-cache flow</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.3.1</div>
                                <ul>
                                    <li>Pet manager — inline H/A/D stat chips on every pet, no rename gymnastics</li>
                                    <li>Stats are scraped from the pet detail modal and cached in localStorage — click any pet once to populate</li>
                                    <li>Gold ★ on the best pet per family (highest total stats) and green chips on best per-stat in family</li>
                                    <li>Sort the pet list by level, health, attack, defense, total stats, or family</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.3.0</div>
                                <ul>
                                    <li>Market: Competition indicator (dots on your own listings if others match/undercut)</li>
                                    <li>Market: Price buttons (Min / Low / High quick-fill when listing)</li>
                                    <li>Market: Listing limit warning when more than 250 listings exist for an item</li>
                                    <li>Market: Target amount button on Buy/Order modals — fills only what you still need</li>
                                    <li>Pets: family filter and duplicate-pet highlighting on the Taming page</li>
                                    <li>Idle Beep: short tone when your active action stops</li>
                                    <li>Settings page now grouped (General / Market / Pets) with per-feature toggles</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.2.2</div>
                                <ul>
                                    <li>Value ratio switched to listing price ÷ vendor sell price — thresholds: green ≤ 3×, orange 3–5×, red &gt; 5×</li>
                                    <li>"Show best (amount)" only applies when you click outside the field, so you can type multi-digit numbers</li>
                                    <li>Saved filters correctly restore the Show best amount when reapplied</li>
                                    <li>Fixed browser crash when switching between tribute filters (huge regex no longer injected, batched DOM reorder)</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.2.1</div>
                                <ul>
                                    <li>All filters now use the same value metric: listing price ÷ minimum market price (more accurate than the old conversion-yield ratio)</li>
                                    <li>Saved filters include the "Show best" amount, including for tributes</li>
                                    <li>Market filter panel sits above the listings on mobile (≤ 750px) so it's reachable without scrolling</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.2.0</div>
                                <ul>
                                    <li>Tribute filters — Forest, Mountain, and Ocean tribute presets in the Filter dropdown</li>
                                    <li>Vendor sell price chip on every tribute listing for quick reference</li>
                                    <li>Color-coded ratio chip (listing ÷ min market price) — green ≤2×, orange 2–3×, red ≥3×</li>
                                    <li>Tribute listings auto-sort with the best deals on top</li>
                                    <li>Mountain tribute excludes upgraded gear (Superior / Exquisite / Perfect) and runes</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.1.6</div>
                                <ul>
                                    <li>Rift Members highlight on the market now actually works — switched seller lookup to the Ironwood API for reliable matching</li>
                                    <li>Market filter loads instantly on page open (no more click-a-tab-to-trigger)</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.1.5</div>
                                <ul>
                                    <li>Market Filter — preset Type categories (Food, Charcoal, Compost, …) with best-deal sort and ratio chip, plus saved filters</li>
                                    <li>Rift Members toggle on market listings — highlight or show only listings sold by Rift / RiftAcademy / RiftChill members</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.1.4</div>
                                <ul>
                                    <li>Loot Goal — set a target amount for any gathered item and see a live time estimate</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.1.3</div>
                                <ul>
                                    <li>Fixed UI Changes and Recipe Clickthrough not staying enabled after reload</li>
                                    <li>Fixed game data failing to load when the API is temporarily unreachable</li>
                                    <li>Game data is now cached locally — features keep working even if the API goes down</li>
                                    <li>Added automatic retry for failed API requests</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.1.2</div>
                                <ul>
                                    <li>Combat Simulator page — simulate fights with full modifier support, equipment selector, and content settings</li>
                                    <li>Set Amount timer on skill pages</li>
                                    <li>Navigation and page routing fixes</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.1.1</div>
                                <ul>
                                    <li>Fixed minor bugs</li>
                                </ul>
                                <div class="rs-changelog-section" style="margin-top:16px;padding-top:12px;border-top:1px solid #2a3a50">v1.1.0</div>
                                <div class="rs-changelog-section">Combat Calculator</div>
                                <ul>
                                    <li>New Combat Calc tab in the RiftScript menu</li>
                                    <li>Auto-fetches your player stats, monster stats, equipment bonuses, and food from the game API</li>
                                    <li>Shows fetched values alongside editable fields so you can simulate "what if" scenarios</li>
                                    <li>Calculates kills/hr, XP/hr, food/hr, loot/hr, and profit/hr</li>
                                    <li>Uses merchant sell prices (singleplayer) or market minimum prices (multiplayer) for loot values</li>
                                    <li>Respects custom prices set on the Items tab</li>
                                </ul>
                                <div class="rs-changelog-section">Game Data Integration</div>
                                <ul>
                                    <li>RiftScript now reads your game session to fetch player stats, equipment, and inventory for the Combat Calculator</li>
                                    <li>Your token is only used to call the official Ironwood API — it's never stored or sent anywhere else</li>
                                    <li>Full source code is open</li>
                                </ul>
                                <div class="rs-changelog-section">UI Changes</div>
                                <ul>
                                    <li>Compact Nav replaced with full UI Changes — now matches Pancake's script</li>
                                    <li>Smaller rows, images, filters, inventory grid, progress bars, and hidden scrollbars</li>
                                    <li>Multiplayer/Singleplayer switch button also gets compacted</li>
                                </ul>
                                <div class="rs-changelog-section">RiftScript Page</div>
                                <ul>
                                    <li>RiftScript now opens as a proper game page instead of an overlay</li>
                                    <li>No more broken buttons when the menu is open</li>
                                </ul>
                                <div class="rs-changelog-section">Menu Restructure</div>
                                <ul>
                                    <li>New tab layout: Info, Settings, Combat Calc, Discord, Custom Prices</li>
                                    <li>Info tab shows version, game mode, credits, and changelog</li>
                                    <li>Version number now shown dynamically</li>
                                </ul>
                                <div class="rs-changelog-section">Other</div>
                                <ul>
                                    <li>Recipe Clickthrough setting with description tooltip</li>
                                    <li>Discord linking moved to its own tab with privacy info</li>
                                    <li>Project is now open source: <a href="https://github.com/pattgamesz/RiftScript" target="_blank" style="color:#4a9eff;text-decoration:none">github.com/pattgamesz/RiftScript</a></li>
                                </ul>
            </div>
        </div>
    `;
}

const TAB_RENDERERS = {
    info: () => renderInfoCard() + renderChangelogCard(),
    settings: renderSettingsCard,
    combat: renderCombatCard,
    discord: renderDiscordCard,
    prices: renderPricesCard,
};

function renderMenuSidebar() {
    const buttons = MENU_TABS
        .map(t => `<button class="rs-menu-btn ${activeMenu === t.id ? 'active' : ''}" data-menu="${t.id}">${t.label}</button>`)
        .join('');
    return `
        <div class="rs-card">
            <div class="rs-card-header">Menu</div>
            ${buttons}
        </div>
    `;
}

function renderPage() {
    $(PAGE_TAG).remove();

    const tabContent = (TAB_RENDERERS[activeMenu] || (() => ''))();
    const page = $(`
        <${PAGE_TAG}>
            <div class="rs-layout">
                <div class="rs-col-left">${tabContent}</div>
                <div class="rs-col-right">${renderMenuSidebar()}</div>
            </div>
        </${PAGE_TAG}>
    `);

    // Bind events
    page.find('.rs-menu-btn').on('click', function() {
        activeMenu = $(this).data('menu');
        renderPage();
    });

    page.find('#rs-reset-prices').on('click', function() {
        storage.save('custom-prices', {});
        renderPage();
    });

    page.find('#rs-ui-changes').on('change', function() {
        settings.set('ui-changes', $(this).is(':checked'));
        applyUIChanges();
    });

    page.find('#rs-recipe-clickthrough').on('change', function() {
        settings.set('recipe-clickthrough', $(this).is(':checked'));
        applyRecipeClickthrough();
    });

    page.find('.rs-feature-toggle').on('change', function() {
        const key = $(this).data('key');
        settings.set(key, $(this).is(':checked'));
    });

    page.find('#rs-discord-link').on('click', () => openOAuth());
    page.find('#rs-discord-unlink').on('click', () => {
        unlinkDiscord();
        renderPage();
    });
    page.find('#rs-discord-test-timer').on('click', async function() {
        const btn = $(this);
        btn.text('Sending…').prop('disabled', true);
        try {
            await setTimer({
                action: 'Test',
                skill: 'RiftScript',
                seconds: 10,
                message: 'This is a test notification from RiftScript!',
            });
            btn.text('Sent ✓');
            setTimeout(() => btn.text('Test Timer').prop('disabled', false), 3000);
        } catch (e) {
            btn.text('Failed').prop('disabled', false);
            console.error('[RiftScript] Test timer error:', e);
        }
    });

    page.find('#rs-open-combatsim').on('click', () => {
        cleanupPage();
        openCombatSimPage();
    });

    // Insert into the game's page area (same place settings-page was)
    $('div.padding > div.wrapper > router-outlet').after(page);
}

// ─── Settings Card ───────────────────────────────────────────

function renderSettingsCard() {
    const uiChanges = settings.get('ui-changes');
    const recipeClickthrough = settings.get('recipe-clickthrough');
    const setting = (key, label, desc, defaultOn = false) => {
        const stored = settings.get(key);
        const checked = stored === null ? defaultOn : !!stored;
        return `
            <div class="rs-row rs-setting-row">
                <div class="rs-setting-info">
                    <span>${label}</span>
                    <span class="rs-setting-desc">${desc}</span>
                </div>
                <label class="rs-toggle">
                    <input type="checkbox" class="rs-feature-toggle" data-key="${key}" ${checked ? 'checked' : ''}>
                    <span class="rs-toggle-slider"></span>
                </label>
            </div>
        `;
    };
    return `
        <div class="rs-card">
            <div class="rs-card-header">General</div>
            <div class="rs-row rs-setting-row">
                <div class="rs-setting-info">
                    <span>UI Changes</span>
                    <span class="rs-setting-desc">Compact UI — smaller rows, images, filters, hidden scrollbars, and reduced spacing throughout the game.</span>
                </div>
                <label class="rs-toggle">
                    <input type="checkbox" id="rs-ui-changes" ${uiChanges ? 'checked' : ''}>
                    <span class="rs-toggle-slider"></span>
                </label>
            </div>
            <div class="rs-row rs-setting-row">
                <div class="rs-setting-info">
                    <span>Recipe Clickthrough</span>
                    <span class="rs-setting-desc">Allows clicking on locked recipes to view their requirements.</span>
                </div>
                <label class="rs-toggle">
                    <input type="checkbox" id="rs-recipe-clickthrough" ${recipeClickthrough ? 'checked' : ''}>
                    <span class="rs-toggle-slider"></span>
                </label>
            </div>
            <div class="rs-row rs-setting-row">
                <div class="rs-setting-info">
                    <span>Idle Beep</span>
                    <span class="rs-setting-desc">Plays a short beep when your current action stops (you become idle). Off by default.</span>
                </div>
                <label class="rs-toggle">
                    <input type="checkbox" class="rs-feature-toggle" data-key="idle-beep" ${settings.get('idle-beep') ? 'checked' : ''}>
                    <span class="rs-toggle-slider"></span>
                </label>
            </div>
        </div>
        <div class="rs-card">
            <div class="rs-card-header">Market</div>
            ${setting('market-competition', 'Competition indicator', 'Colored dot on your own listings if others match (orange) or undercut (red) your price.', true)}
            ${setting('market-listing-limit', 'Listing limit warning', 'Banner when more than 250 listings exist for the current item — game UI caps at 250.', true)}
            ${setting('market-price-buttons', 'Price buttons', 'Adds Min / Low / High quick-fill buttons next to the Price input when listing.', true)}
            ${setting('market-target-amount', 'Target amount', 'Adds a Target button on Buy/Order modals — fills only what you need to reach a desired total.', true)}
        </div>
        <div class="rs-card">
            <div class="rs-card-header">Pets</div>
            <div class="rs-row">
                <span style="font-size:0.78em;color:rgba(255,255,255,0.5);line-height:1.4">
                    Toggles for the pet panel live on the Taming → Pets page itself: family filter and duplicate highlighting.
                    Pet stat tools (renamer / highlighter / redesign) need Pancake's encoded-name system — coming later.
                </span>
            </div>
        </div>
    `;
}

// ─── Discord Card ────────────────────────────────────────────

function renderDiscordCard() {
    const user = getDiscordUser();
    if (user) {
        const avatarUrl = user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png?size=64`
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
        return `
            <div class="rs-card">
                <div class="rs-card-header">Discord</div>
                <div class="rs-row">
                    <span style="display:flex;align-items:center;gap:8px">
                        <img src="${avatarUrl}" style="width:24px;height:24px;border-radius:50%">
                        ${user.username}
                    </span>
                    <span style="color:#4ade80">Linked</span>
                </div>
                <div class="rs-row">
                    <span>Timer notifications</span>
                    <span>Enabled</span>
                </div>
                <div class="rs-row">
                    <span>Send a test DM in ~10 seconds</span>
                    <button class="rs-btn rs-btn-primary" id="rs-discord-test-timer">Test Timer</button>
                </div>
                <div class="rs-row">
                    <span></span>
                    <button class="rs-btn rs-btn-danger" id="rs-discord-unlink">Unlink Discord</button>
                </div>
            </div>
        `;
    }
    return `
        <div class="rs-card">
            <div class="rs-card-header">Discord</div>
            <div class="rs-row">
                <span>Link your Discord to receive timer notifications via DM from Rifty.</span>
            </div>
            <div class="rs-row">
                <span style="opacity:0.5;font-size:0.8em;line-height:1.4">We only request your Discord ID (to send DMs), username, and avatar (to show your linked status). No other data is accessed or stored.</span>
            </div>
            <div class="rs-row">
                <span></span>
                <button class="rs-btn rs-btn-primary" id="rs-discord-link">Link Discord</button>
            </div>
        </div>
    `;
}
