# RiftScript

A Tampermonkey userscript that adds quality-of-life features to [Ironwood RPG](https://ironwoodrpg.com), maintained by **Rift Guild**.

Website: [rift-guild.com](https://rift-guild.com) · Script: [rift-script.web.app](https://rift-script.web.app)

Originally forked from [ironwood-scripts](https://github.com/Boldy97/ironwood-scripts) by Pancake (Boldy97). The current codebase has been substantially rewritten — see [Architecture](#architecture).

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Open <https://rift-script.web.app> and click the install button — Tampermonkey will pick up the userscript header automatically.
3. Reload Ironwood RPG. RiftScript announces itself with `[RiftScript] Ready.` in the browser console.

## Features

| Area | What it adds |
|---|---|
| **Estimator** | Per-skill panel with XP/hour, Actions/hour, time-to-level, time-to-tier, goal-level calc, loot goal tracker, per-action profit. Bottleneck detection on the Items tab — the consumable that runs out first is highlighted, with `lasts X` per row. |
| **Consumables** | Sigils, potions, brews and Mastery Contracts feed into the bottleneck calc. Insatiable Power Tome's HP/s food drain applies to every skill (inline tier dropdown on food rows). Mastery Contract cost equals the produced item's market price × actions/hour. |
| **Combat Sim** | Full-page simulator with the same modifier system as the in-game numbers (efficiency, double-loot, double-XP, food, sigils, brews, tomes, relics, traits, sets, masteries). |
| **Market** | Filter presets by category, best-deal sort and ratio chip, listing-limit warning, quick min/low/high price-fill buttons, target-amount Buy/Order modals. |
| **Pets** | Pet manager on the Taming page — H/A/D + passive chips on every pet, best-in-family ★ marker, duplicate detection, perfect-stat filter, family filter and sort. |
| **Discord** | OAuth link with the [Rifty bot](https://rift-guild.com) for action-finished DMs. |
| **Other** | Idle beep, target-amount on Craft modals, load-failure toast, version-update notice. |

## Develop

```bash
npm install
npm run watch      # rebuild on every save
npm run build      # one-shot build → public/riftscript.user.js
npm run deploy:dev # build dev variant, push to the Firebase 'dev' channel
npm run deploy     # build prod, push to the live Firebase channel
```

Point Tampermonkey at the local build by creating a development userscript:

```
// ==UserScript==
// @name         Ironwood RPG - RiftScript Local
// @match        https://ironwoodrpg.com/*
// @grant        GM_xmlhttpRequest
// @connect      api-2.ironwoodrpg.com
// @require      https://code.jquery.com/jquery-3.6.4.min.js
// @require      file:///absolute/path/to/RiftScript/public/riftscript.user.js
// ==/UserScript==
```

In `chrome://extensions` → Tampermonkey → Details → enable **Allow access to file URLs**.

## Architecture

ES modules bundled into a single IIFE userscript by [esbuild](https://esbuild.github.io). Entry point is `src/main.js`; every feature is its own module with an `initX()` export that wires up DOM listeners or event-bus subscriptions.

Cross-feature plumbing is the tiny event bus in `src/core/events.js` — `events.emit(name, data)`, `events.on(name, handler)`, with a one-event replay cache so subscribers that arrive late still see the last value. Readers in `src/game/` scrape the DOM on a 1-second poller and emit; features subscribe.

| Directory | Purpose |
|---|---|
| `src/core/` | Auth, event bus, settings, storage, util, HTTP wrapper, shared userCache, game API client. |
| `src/game/` | DOM readers (skill page, market, pets, modes) + the game-data store (`data.js`). |
| `src/features/` | Self-contained features: estimator, combat calc, market filter/competition, pet filter, tome detector, etc. |
| `src/ui/` | Injected panels and styles (estimator panel, combat sim page, menu, Discord card). |
| `public/` | The built userscript (`riftscript.user.js`), the landing page, and the bundled static game data served from Firebase Hosting. |

### Game data

All public game data (items, skills, monsters, drops, ingredients, pets, expeditions, masteries, traits) is served from our own Firebase Hosting at `https://rift-script.web.app/data/`. The script caches it in `localStorage` with the script version as the cache-buster — stale-while-revalidate, so features activate instantly on a warm load and refresh in the background.

### Player data

A single shared `getUser` request feeds the tome detector, pet reader, combat panel and combat sim. The cache lives in `src/core/userCache.js` (5-minute TTL, localStorage-backed, in-flight dedup, stale-fallback on network failure) and is primed once at startup by `primeUserCache()`. Player data never leaves the script's own requests — the game's session token is read from the Firebase IndexedDB Auth store and forwarded only to `api-2.ironwoodrpg.com`.

## Credits

- Based on [ironwood-scripts](https://github.com/Boldy97/ironwood-scripts) by Boldy97/Pancake (MIT License).
- Combat Sim formulas ported from [Rivea's Ironwood RPG Combat Calc spreadsheet](https://docs.google.com/spreadsheets/d/19iQkvGIyW2f_a3vmF7vNnE2EIEKOOHTNlsKdgnsOtzQ/edit).
