# RiftScript

A Tampermonkey userscript to enhance Ironwood RPG, maintained by **Rift Guild**.

Website: [rift-guild.com](https://rift-guild.com)

Originally forked from [ironwood-scripts](https://github.com/Boldy97/ironwood-scripts) by Pancake (Boldy97), licensed under MIT.

## How to install

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Install the RiftScript userscript (link TBD)

## How to develop

These steps assume you are using the Tampermonkey extension with Chrome.

* Create a new Tampermonkey script with this content (replace the last `@require` with your local path to `plugin.js`):
```
// ==UserScript==
// @name         Ironwood RPG - RiftScript Development
// @namespace    https://rift-guild.com
// @version      0.1
// @description  RiftScript development build
// @author       Rift Guild
// @match        https://ironwoodrpg.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ironwoodrpg.com
// @grant        none
// @require      https://code.jquery.com/jquery-3.6.4.min.js
// @require      file:///path/to/RiftScript/plugin.js
// ==/UserScript==
```
* You may need to enable local file access for Tampermonkey:
  * Go to `chrome://extensions`
  * Navigate to Tampermonkey > details
  * Enable "Allow access to file URLs"
* Run `npm run watch` in the packager folder to auto-rebuild on changes

## Architecture

Every script is registered as a separate module via `moduleRegistry`. A module has a name (from filename), dependencies (from function arguments), and a body (function body).

All modules are registered first, then `moduleRegistry.build()` resolves dependencies and initialises everything.

## Module structure

| Directory | Purpose |
|---|---|
| `libraries/` | Shared infrastructure (DOM utils, events, HTTP, config, components) |
| `readers/` | Data extraction from DOM/network responses |
| `stores/` | State management (IndexedDB-backed) |
| `caches/` | Static game data reference |
| `features/` | User-facing feature modules |
| `packager/` | Build tooling |

## Credits

Based on [ironwood-scripts](https://github.com/Boldy97/ironwood-scripts) by Boldy97/Pancake (MIT License).
