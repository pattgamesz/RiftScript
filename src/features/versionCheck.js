// Version checker — compares local version with latest deployed version
import { gmFetchText } from '../core/request.js';

const CURRENT_VERSION = RIFTSCRIPT_VERSION;
const CHECK_INTERVAL = 1000 * 60 * 30; // Check every 30 minutes
const INSTALL_URL = 'https://rift-script.web.app/riftscript.user.js';

export function initVersionCheck() {
    // Check after a short delay, then periodically
    setTimeout(check, 5000);
    setInterval(check, CHECK_INTERVAL);
}

async function check() {
    try {
        // Fetch the deployed script and extract version from the header
        const text = await gmFetchText(INSTALL_URL + '?_=' + Date.now());
        const match = text.match(/@version\s+([\d.]+)/);
        if (!match) return;

        const latestVersion = match[1];
        if (latestVersion !== CURRENT_VERSION) {
            showUpdateNotice(latestVersion);
        }
    } catch (e) {
        // Silently fail
    }
}

function showUpdateNotice(newVersion) {
    // Don't show if already showing
    if ($('#riftscript-update-notice').length) return;

    const notice = $(`
        <div id="riftscript-update-notice" class="rs-update-notice">
            <div class="rs-update-text">
                <strong>RiftScript Update Available</strong>
                <span>v${CURRENT_VERSION} → v${newVersion}</span>
            </div>
            <a href="${INSTALL_URL}" target="_blank" class="rs-update-btn">Update</a>
            <button class="rs-update-dismiss">✕</button>
        </div>
    `);

    notice.find('.rs-update-dismiss').on('click', () => notice.remove());

    $('body').append(notice);
}
