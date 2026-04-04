// Game data cache — loaded once from Ironwood API on startup
import { api } from '../core/api.js';

function index(arr, ...keys) {
    const result = {};
    for (const key of keys) result[key] = {};
    for (const item of arr) {
        for (const key of keys) {
            if (item[key] !== undefined) result[key][item[key]] = item;
        }
    }
    return result;
}

export const data = {
    skills: null,
    actions: null,
    items: null,
    drops: null,
    ingredients: null,
    structures: null,
    monsters: null,
    ready: false,
};

export async function loadGameData() {
    try {
        const [skills, actions, items, drops, ingredients, structures, monsters] = await Promise.all([
            api.listSkills(),
            api.listActions(),
            api.listItems(),
            api.listDrops(),
            api.listIngredients(),
            api.listStructures(),
            api.listMonsters(),
        ]);

        data.skills = {
            list: skills,
            byId: index(skills, 'id').id,
            byName: index(skills, 'displayName').displayName,
            byTechnicalName: index(skills, 'technicalName').technicalName,
        };

        data.actions = {
            list: actions,
            byId: index(actions, 'id').id,
            byName: index(actions, 'name').name,
        };

        // Items API returns {item: {id, name, image, ...}, stats: {...}}
        // Flatten to {id, name, image, stats, attributes, ...}
        const flatItems = items.map(entry => ({
            ...entry.item,
            stats: entry.stats || { global: {}, bySkill: {} },
        }));

        // Index items by image filename
        const itemsByImage = {};
        for (const item of flatItems) {
            if (item.image) {
                itemsByImage[item.image] = item;
                const filename = item.image.split('/').pop();
                if (filename) itemsByImage[filename] = item;
            }
        }

        data.items = {
            list: flatItems,
            byId: index(flatItems, 'id').id,
            byName: index(flatItems, 'name').name,
            byImage: itemsByImage,
        };

        // Index drops by action
        const dropsByAction = {};
        for (const drop of drops) {
            if (!dropsByAction[drop.action]) dropsByAction[drop.action] = [];
            dropsByAction[drop.action].push(drop);
        }
        data.drops = { list: drops, byAction: dropsByAction };

        // Index ingredients by action
        const ingredientsByAction = {};
        for (const ing of ingredients) {
            if (!ingredientsByAction[ing.action]) ingredientsByAction[ing.action] = [];
            ingredientsByAction[ing.action].push(ing);
        }
        data.ingredients = { list: ingredients, byAction: ingredientsByAction };

        data.structures = {
            list: structures,
            byId: index(structures, 'id').id,
            byName: index(structures, 'name').name,
        };

        data.monsters = {
            list: monsters,
            byId: index(monsters, 'id').id,
        };

        data.ready = true;
        console.log('[RiftScript] Game data loaded:', {
            skills: skills.length,
            actions: actions.length,
            items: items.length,
            drops: drops.length,
            ingredients: ingredients.length,
            structures: structures.length,
            monsters: monsters.length,
        });
    } catch (e) {
        console.error('[RiftScript] Failed to load game data:', e);
    }
}
