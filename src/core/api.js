// Ironwood RPG data API client
//
// Public game data is sourced from the Rift Guild gameData API at
// rift-guild.com/api/gameData — extracted live from ironwoodrpg.com's main.js
// and cached on a 1h CDN. Single /all endpoint pulls everything (~580KB) in
// one request; the adapter in game/data.js maps the new flat shape onto the
// indexed structure the rest of the script expects.
//
// Authenticated player data still goes to api-2.ironwoodrpg.com using the
// game's own session token (read from IndexedDB; never persisted).
import { getAuthToken } from './auth.js';
import { gmFetch } from './request.js';
import { getMode } from '../game/mode.js';

const GAMEDATA_ROOT = 'https://rift-guild.com/api/gameData';
const API_AUTH_ROOT = 'https://api-2.ironwoodrpg.com';

function fetchGameData(type) {
    const url = type ? `${GAMEDATA_ROOT}/${type}` : GAMEDATA_ROOT;
    return gmFetch(url, {
        headers: { 'Content-Type': 'application/json' },
        retries: 2,
    });
}

function fetchAuth(path) {
    const token = getAuthToken();
    if (!token) throw new Error('No auth token available');
    return gmFetch(`${API_AUTH_ROOT}/${path}`, {
        headers: {
            'Content-Type': 'application/json',
            'token': token,
            'is-solo': getMode() === 'singleplayer' ? 'true' : 'false',
        }
    });
}

export const api = {
    // Single fetch returns the entire game-data bundle. Used by loadGameData.
    fetchAllGameData: () => fetchGameData('all'),
    // Per-type fetches kept available for ad-hoc use.
    listSkills:          () => fetchGameData('skills'),
    listActions:         () => fetchGameData('actions'),
    listConversions:     () => fetchGameData('conversionActions'),
    listItems:           () => fetchGameData('items'),
    listDrops:           () => fetchGameData('drops'),
    listIngredients:     () => fetchGameData('ingredients'),
    listMonsters:        () => fetchGameData('monsters'),
    listStructures:      () => fetchGameData('structures'),
    listRecipes:         () => fetchGameData('recipes'),
    listPets:            () => fetchGameData('pets'),
    listPetPassives:     () => fetchGameData('petPassives'),
    listExpeditions:     () => fetchGameData('expeditions'),
    listExpeditionDrops: () => fetchGameData('expeditionDrops'),
    listEnums:           () => fetchGameData('enums'),
    getMeta:             () => fetchGameData('_meta'),

    // Authenticated endpoints (uses intercepted game token)
    getUser:             () => fetchAuth('getUser'),
    getMarketItems:      () => fetchAuth('getMarketItems'),
    getGuild:            () => fetchAuth('getGuild'),
};
