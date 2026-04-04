// Injects RiftScript button into the game's left nav and manages pages
import * as events from '../core/events.js';
import * as storage from '../core/storage.js';
import { getMode } from '../game/mode.js';
import { getDiscordUser, isLinked, openOAuth, unlinkDiscord, setTimer } from '../features/discord.js';

const MENU_ID = 'riftscript-menu-btn';
const PAGE_ID = 'riftscript-page';

let isOpen = false;
let activeMenu = 'info';

const COMPACT_STYLE_ID = 'riftscript-compact-nav';

function applyCompactNav() {
    const enabled = storage.getData('compact-nav');
    const existing = document.getElementById(COMPACT_STYLE_ID);
    if (enabled && !existing) {
        const style = document.createElement('style');
        style.id = COMPACT_STYLE_ID;
        style.textContent = `
            nav-component button,
            nav-component .link,
            nav-component .compact {
                height: auto !important;
            }
        `;
        document.head.appendChild(style);
    } else if (!enabled && existing) {
        existing.remove();
    }
}

function applyRecipeClickthrough() {
    $('skill-page button.row[disabled]').removeAttr('disabled');
}

export function initMenu() {
    applyCompactNav();
    setInterval(injectNavButton, 1000);
    events.on('page', (page) => {
        if (isOpen) closePage();
        if (page.type === 'action' && storage.getData('recipe-clickthrough')) {
            setTimeout(applyRecipeClickthrough, 200);
        }
    });
    window.addEventListener('riftscript-discord-updated', () => {
        if (isOpen) renderPage();
    });
}

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
        if (isOpen) { closePage(); } else { openPage(); }
    });

    settingsBtn.after(btn);
}

function openPage() {
    isOpen = true;
    activeMenu = 'info';

    // Hide the game's content
    const padding = $('app-component > div.scroll > div.padding');
    if (padding.length) {
        padding.children().hide();
    } else {
        $('app-component > div.scroll').children().hide();
    }

    renderPage();

    // Update the game's header bar
    const header = $('app-component > div.scroll > .header, app-component > header-component').first();
    header.find('.title').attr('data-original', header.find('.title').text()).text('RiftScript');
    header.find('.image').hide();
    header.find('.title').before('<div class="riftscript-header-logo">RS</div>');

    $('nav-component button').removeClass('active-link');
    $(`#${MENU_ID}`).addClass('rs-nav-active');
}

function closePage() {
    isOpen = false;
    $(`#${PAGE_ID}`).remove();
    $(`#${MENU_ID}`).removeClass('rs-nav-active');

    // Restore the game's header bar
    const header = $('app-component > div.scroll > .header, app-component > header-component').first();
    const originalTitle = header.find('.title').attr('data-original');
    if (originalTitle) header.find('.title').text(originalTitle);
    header.find('.image').show();
    header.find('.riftscript-header-logo').remove();

    const padding = $('app-component > div.scroll > div.padding');
    if (padding.length) {
        padding.children().show();
    } else {
        $('app-component > div.scroll').children().show();
    }
}

function renderPage() {
    $(`#${PAGE_ID}`).remove();

    const mode = getMode();
    const modeLabel = mode === 'multiplayer' ? 'Multiplayer' : 'Singleplayer';
    const customPrices = storage.getData('custom-prices');
    const priceCount = customPrices ? Object.keys(customPrices).length : 0;

    const page = $(`
        <div id="${PAGE_ID}">
            <div class="rs-layout">
                <div class="rs-col-left">
                    ${activeMenu === 'info' ? `
                        <div class="rs-card">
                            <div class="rs-card-header">RiftScript</div>
                            <div class="rs-row"><span>Version</span><span>1.0.0</span></div>
                            <div class="rs-row"><span>Game Mode</span><span>${modeLabel}</span></div>
                            <div class="rs-row"><span>Made by</span><span>Patt</span></div>
                            <div class="rs-row"><span>Website</span><span><a href="https://rift-guild.com" target="_blank" style="color:#4a9eff;text-decoration:none">rift-guild.com</a></span></div>
                            <div class="rs-row"><span>Based on</span><span>ironwood-scripts by Pancake</span></div>
                        </div>
                        <div class="rs-card">
                            <div class="rs-card-header">Changelog</div>
                            <div class="rs-row"><span style="opacity:0.4">No changelog entries yet.</span></div>
                        </div>
                    ` : ''}
                    ${activeMenu === 'settings' ? renderSettingsCard() : ''}
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
                        <button class="rs-menu-btn ${activeMenu === 'discord' ? 'active' : ''}" data-menu="discord">Discord</button>
                        <button class="rs-menu-btn ${activeMenu === 'prices' ? 'active' : ''}" data-menu="prices">Custom Prices</button>
                    </div>
                </div>
            </div>
        </div>
    `);

    page.find('.rs-menu-btn').on('click', function() {
        activeMenu = $(this).data('menu');
        renderPage();
    });

    page.find('#rs-reset-prices').on('click', function() {
        storage.save('custom-prices', {});
        renderPage();
    });

    page.find('#rs-compact-nav').on('change', function() {
        storage.save('compact-nav', $(this).is(':checked'));
        applyCompactNav();
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

    const padding = $('app-component > div.scroll > div.padding');
    if (padding.length) {
        padding.append(page);
    } else {
        $('app-component > div.scroll').append(page);
    }
}

function renderSettingsCard() {
    const compactNav = storage.getData('compact-nav');
    const recipeClickthrough = storage.getData('recipe-clickthrough');
    return `
        <div class="rs-card">
            <div class="rs-card-header">Settings</div>
            <div class="rs-row rs-setting-row">
                <div class="rs-setting-info">
                    <span>Compact Nav</span>
                    <span class="rs-setting-desc">Removes the fixed height from navigation buttons, making the sidebar more compact.</span>
                </div>
                <label class="rs-toggle">
                    <input type="checkbox" id="rs-compact-nav" ${compactNav ? 'checked' : ''}>
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
