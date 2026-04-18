import esbuild from 'esbuild';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const VERSION = pkg.version;
const isDev = process.argv.includes('--dev');
const LABEL = isDev ? ' [DEV]' : '';

const HEADER = `// ==UserScript==
// @name         Ironwood RPG - RiftScript${LABEL}
// @namespace    https://rift-guild.com
// @version      ${VERSION}
// @description  Ironwood RPG enhancement scripts by Patt
// @author       Patt
// @match        https://ironwoodrpg.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ironwoodrpg.com
// @grant        GM_xmlhttpRequest
// @connect      api-2.ironwoodrpg.com
// @connect      iwrpg.vectordungeon.com
// @connect      rift-script.web.app
// @noframes
// @require      https://code.jquery.com/jquery-3.6.4.min.js
// ==/UserScript==
//
// @connect explained:
// - api-2.ironwoodrpg.com : Fetches your player data (stats, equipment, inventory) for the Combat Calculator.
//   Uses your existing game session token from IndexedDB — never stored or sent anywhere else.
// - iwrpg.vectordungeon.com : Public game data API (items, skills, monsters, drops). No auth needed.
// - rift-script.web.app : Checks for script updates and hosts the Discord OAuth callback.
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

if (watch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await esbuild.build(config);
    fs.copyFileSync('public/riftscript.user.js', 'plugin.js');
    console.log(`Built v${VERSION} → plugin.js + public/riftscript.user.js`);
}
