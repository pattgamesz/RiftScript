import esbuild from 'esbuild';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const VERSION = pkg.version;
const isDev = process.argv.includes('--dev');
const LABEL = isDev ? ' [DEV]' : '';

const HEADER = `// ==UserScript==
// @name         Ironwood RPG - RiftScript${LABEL}
// @namespace    ${isDev ? 'https://rift-guild.com/dev' : 'https://rift-guild.com'}
// @version      ${VERSION}
// @description  Ironwood RPG enhancement scripts by Patt
// @author       Patt
// @match        https://ironwoodrpg.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ironwoodrpg.com
// @grant        GM_xmlhttpRequest
// @connect      api-2.ironwoodrpg.com
// @connect      rift-script.web.app
// @connect      rift-script--dev-y8m8gvy1.web.app
// @connect      rift-guild.com
// @connect      firestore.googleapis.com
// @noframes
// @require      https://code.jquery.com/jquery-3.6.4.min.js
// ==/UserScript==
//
// @connect explained:
// - api-2.ironwoodrpg.com : Fetches your player data (stats, equipment, inventory, market listings) for combat/market features.
//   Uses your existing game session token from IndexedDB — never stored or sent anywhere else.
// - rift-script.web.app : Hosts the script, Discord OAuth callback, update checks.
// - rift-guild.com : Public game data API (items, actions, drops, monsters, etc.) — extracted from ironwoodrpg main.js, CORS-open, 1h CDN-cached.
// - firestore.googleapis.com : Public read of Rift guild member list for market highlighting.
//
// Discord OAuth: Used to link your Discord account. We only request your username, avatar, and user ID.
// Your user ID is used to send DM notifications from the Rifty bot. No other Discord data is accessed.
//
// Source code: https://github.com/pattgamesz/RiftScript
`;

const watch = process.argv.includes('--watch');

const config = {
    entryPoints: ['src/main.js'],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    outfile: 'public/riftscript.user.js',
    banner: { js: HEADER },
    define: {
        'RIFTSCRIPT_VERSION': JSON.stringify(VERSION),
        'RIFTSCRIPT_DEV': JSON.stringify(isDev),
    },
    logLevel: 'info',
};

// Stamp the deployed userscript version into the landing page. Targets the
// <span class="version">v...</span> element specifically so it's idempotent —
// replaces either the __VERSION__ placeholder or a previous version number.
function stampIndexHtml() {
    const path = 'public/index.html';
    if (!fs.existsSync(path)) return;
    const original = fs.readFileSync(path, 'utf8');
    const stamped = original.replace(
        /<span class="version">v[^<]+<\/span>/,
        `<span class="version">v${VERSION}</span>`
    );
    if (stamped !== original) fs.writeFileSync(path, stamped);
}

if (watch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await esbuild.build(config);
    fs.copyFileSync('public/riftscript.user.js', 'plugin.js');
    stampIndexHtml();
    console.log(`Built v${VERSION} → plugin.js + public/riftscript.user.js + index.html`);
}
