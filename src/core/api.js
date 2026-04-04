// Ironwood RPG data API client
const API_ROOT = 'https://iwrpg.vectordungeon.com';

async function fetchJSON(path) {
    const res = await fetch(`${API_ROOT}/${path}`, {
        headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json();
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
};
