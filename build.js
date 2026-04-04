import esbuild from 'esbuild';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const VERSION = pkg.version;

const HEADER = `// ==UserScript==
// @name         Ironwood RPG - RiftScript
// @namespace    https://rift-guild.com
// @version      ${VERSION}
// @description  Ironwood RPG enhancement scripts by Rift Guild
// @author       Rift Guild
// @match        https://ironwoodrpg.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ironwoodrpg.com
// @grant        none
// @require      https://code.jquery.com/jquery-3.6.4.min.js
// ==/UserScript==
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
