// ==UserScript==
// @name         Ironwood RPG - RiftScript
// @namespace    https://rift-guild.com
// @version      1.0.0
// @description  A collection of scripts to enhance Ironwood RPG - by Rift Guild (https://rift-guild.com)
// @author       Rift Guild
// @match        https://ironwoodrpg.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ironwoodrpg.com
// @grant        none
// @require      https://code.jquery.com/jquery-3.6.4.min.js
// ==/UserScript==

window.RIFTSCRIPT_ROOT = 'https://rift-guild.com';
window.RIFTSCRIPT_VERSION = '1.0.0';
Object.defineProperty(Array.prototype, '_groupBy', {
    enumerable: false,
    value: function(selector) {
        return Object.values(this.reduce(function(rv, x) {
            (rv[selector(x)] = rv[selector(x)] || []).push(x);
            return rv;
        }, {}));
    }
});
Object.defineProperty(Array.prototype, '_distinct', {
    enumerable: false,
    value: function() {
        return [...new Set(this)];
    }
});
