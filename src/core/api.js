// Ironwood RPG data API client
import { getAuthToken } from './auth.js';
import { gmFetch } from './request.js';
import { getMode } from '../game/mode.js';

// All public game data is served from our own Firebase Hosting — we don't
// hit any third-party data API at runtime. Dev builds read from the dev
// channel so new data files can be tested before going to prod.
const API_HOSTED = (typeof RIFTSCRIPT_DEV !== 'undefined' && RIFTSCRIPT_DEV)
    ? 'https://rift-script--dev-y8m8gvy1.web.app/data'
    : 'https://rift-script.web.app/data';
const API_AUTH_ROOT = 'https://api-2.ironwoodrpg.com';

async function fetchJSON(path) {
    const headers = { 'Content-Type': 'application/json' };
    const file = path.split('/').pop() + '.json';
    return gmFetch(`${API_HOSTED}/${file}`, { headers, retries: 2 });
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

// Game data endpoints
export const api = {
    listSkills:          () => fetchJSON('public/list/skill'),
    listActions:         () => fetchJSON('public/list/action'),
    listItems:           () => fetchJSON('public/list/item'),
    listItemStats:       () => fetchJSON('public/list/itemStat'),
    listItemAttributes:  () => fetchJSON('public/list/itemAttribute'),
    listDrops:           () => fetchJSON('public/list/drop'),
    listIngredients:     () => fetchJSON('public/list/ingredient'),
    listMonsters:        () => fetchJSON('public/list/monster'),
    listStructures:      () => fetchJSON('public/list/structure'),
    listRecipes:         () => fetchJSON('public/list/recipe'),
    listPets:            () => fetchJSON('public/list/pet'),
    listPetPassives:     () => fetchJSON('public/list/petPassive'),
    listExpeditions:     () => fetchJSON('public/list/expedition'),
    listExpeditionDrops: () => fetchJSON('public/list/expeditionDrop'),
    listMasteries:       () => fetchJSON('public/list/mastery'),
    listTraits:          () => fetchJSON('public/list/trait'),
    listSkillSets:       () => fetchJSON('public/list/skillSet'),
    getVersion:          () => fetchJSON('public/settings/version'),

    // Authenticated endpoints (uses intercepted game token)
    getUser:             () => fetchAuth('getUser'),
    getMarketItems:      () => fetchAuth('getMarketItems'),
    getGuild:            () => fetchAuth('getGuild'),
};
