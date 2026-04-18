// Injects RiftScript button into the game's left nav and manages pages
import * as events from '../core/events.js';
import * as storage from '../core/storage.js';
import { getMode } from '../game/mode.js';
import { getDiscordUser, isLinked, openOAuth, unlinkDiscord, setTimer } from '../features/discord.js';
import { openCombatSimPage } from './combatSimPage.js';

const MENU_ID = 'riftscript-menu-btn';
const PAGE_TAG = 'riftscript-page';

let isOpen = false;
let activeMenu = 'info';

// ─── UI Changes ──────────────────────────────────────────────

const UI_CHANGES_ID = 'riftscript-ui-changes';

const UI_SECTIONS = [
    'challenges-page', 'changelog-page', 'daily-quest-page', 'equipment-page',
    'guild-page', 'home-page', 'leaderboards-page', 'market-page', 'merchant-page',
    'quests-page', 'settings-page', 'skill-page', 'upgrade-page', 'taming-page',
    'traits-page', 'mastery-page', 'marks-page', 'profile-page', 'store-page',
    'adventure-page',
].join(', ');
const UI_SELECTOR = `:is(${UI_SECTIONS})`;

function applyUIChanges() {
    const enabled = storage.getData('ui-changes');
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
    applyUIChanges();
    setInterval(injectNavButton, 1000);

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
        if (page.type === 'action' && storage.getData('recipe-clickthrough')) {
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
            <div class="name">RiftScript</div>
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

function renderPage() {
    $(PAGE_TAG).remove();

    const mode = getMode();
    const modeLabel = mode === 'multiplayer' ? 'Multiplayer' : 'Singleplayer';
    const customPrices = storage.getData('custom-prices');
    const priceCount = customPrices ? Object.keys(customPrices).length : 0;

    const page = $(`
        <${PAGE_TAG}>
            <div class="rs-layout">
                <div class="rs-col-left">
                    ${activeMenu === 'info' ? `
                        <div class="rs-card">
                            <div class="rs-card-header">RiftScript</div>
                            <div class="rs-row"><span>Version</span><span>${RIFTSCRIPT_VERSION}</span></div>
                            <div class="rs-row"><span>Game Mode</span><span>${modeLabel}</span></div>
                            <div class="rs-row"><span>Made by</span><span>Patt</span></div>
                            <div class="rs-row"><span>Website</span><span><a href="https://rift-guild.com" target="_blank" style="color:#4a9eff;text-decoration:none">rift-guild.com</a></span></div>
                            <div class="rs-row"><span>Script based on</span><span>ironwood-scripts by Pancake</span></div>
                            <div class="rs-row"><span>Combat Sim based on</span><span>spreadsheet by Rivea</span></div>
                        </div>
                        <div class="rs-card">
                            <div class="rs-card-header">Changelog</div>
                            <div class="rs-changelog">
                                <div class="rs-changelog-section">v1.1.1</div>
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
                    ` : ''}
                    ${activeMenu === 'settings' ? renderSettingsCard() : ''}
                    ${activeMenu === 'combat' ? `
                        <div class="rs-card">
                            <div class="rs-card-header">Combat Simulator</div>
                            <div class="rs-row">
                                <span>Full combat sandbox with simulation, loot breakdown, and time to level.</span>
                                <button class="rs-btn rs-btn-primary" id="rs-open-combatsim">Open Simulator</button>
                            </div>
                        </div>
                    ` : ''}
                    ${activeMenu === 'discord' ? renderDiscordCard() : ''}
                    ${activeMenu === 'prices' ? `
                        <div class="rs-card">
                            <div class="rs-card-header">Custom Prices</div>
                            ${priceCount > 0 ? `
                                <div class="rs-row">
                                    <span>You have ${priceCount} custom price${priceCount !== 1 ? 's' : ''}</span>
                                    <button class="rs-btn rs-btn-danger" id="rs-reset-prices">Reset All</button>
                                </div>
                            ` : `
                                <div class="rs-row"><span style="opacity:0.4">No custom prices set. Edit prices on the Items tab.</span></div>
                            `}
                        </div>
                    ` : ''}
                </div>
                <div class="rs-col-right">
                    <div class="rs-card">
                        <div class="rs-card-header">Menu</div>
                        <button class="rs-menu-btn ${activeMenu === 'info' ? 'active' : ''}" data-menu="info">Info</button>
                        <button class="rs-menu-btn ${activeMenu === 'settings' ? 'active' : ''}" data-menu="settings">Settings</button>
                        <button class="rs-menu-btn ${activeMenu === 'combat' ? 'active' : ''}" data-menu="combat">Combat Calc</button>
                        <button class="rs-menu-btn ${activeMenu === 'discord' ? 'active' : ''}" data-menu="discord">Discord</button>
                        <button class="rs-menu-btn ${activeMenu === 'prices' ? 'active' : ''}" data-menu="prices">Custom Prices</button>
                    </div>
                </div>
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
        storage.save('ui-changes', $(this).is(':checked'));
        applyUIChanges();
    });

    page.find('#rs-recipe-clickthrough').on('change', function() {
        storage.save('recipe-clickthrough', $(this).is(':checked'));
        applyRecipeClickthrough();
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
    const uiChanges = storage.getData('ui-changes');
    const recipeClickthrough = storage.getData('recipe-clickthrough');
    return `
        <div class="rs-card">
            <div class="rs-card-header">Settings</div>
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
