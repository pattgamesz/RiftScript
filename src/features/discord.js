// Discord integration — OAuth linking and timer notifications
import * as storage from '../core/storage.js';

const CLIENT_ID = '1207991847193157642';
const REDIRECT_URI = 'https://rift-script.web.app/discord/callback.html';
const API_BASE = 'https://rift-script.web.app/api';

// Listen for OAuth callback from popup
window.addEventListener('message', (e) => {
    if (e.data?.type === 'riftscript-discord-linked') {
        saveDiscordLink(e.data);
    }
});

export function getDiscordUser() {
    return storage.getData('discord-user');
}

export function isLinked() {
    return !!getDiscordUser();
}

export function openOAuth(iwUsername) {
    const state = encodeURIComponent(iwUsername || '');
    const scopes = 'identify';
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scopes}&state=${state}`;
    window.open(url, 'riftscript-discord', 'width=500,height=700');
}

function saveDiscordLink(data) {
    storage.save('discord-user', {
        userId: data.userId,
        username: data.username,
        avatar: data.avatar,
    });
    // Trigger UI refresh
    window.dispatchEvent(new Event('riftscript-discord-updated'));
}

export function unlinkDiscord() {
    storage.save('discord-user', null);
    window.dispatchEvent(new Event('riftscript-discord-updated'));
}

export async function setTimer({ action, skill, seconds, message }) {
    const user = getDiscordUser();
    if (!user) throw new Error('Discord not linked');

    const fireAt = new Date(Date.now() + seconds * 1000).toISOString();

    const res = await fetch(`${API_BASE}/setTimer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            discordId: user.userId,
            username: user.username,
            action,
            skill,
            fireAt,
            message: message || `Your ${action} in ${skill} has finished!`,
        }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to set timer');
    return data.timerId;
}
