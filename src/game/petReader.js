// Reads the player's pet collection from the Taming → Pets page.
// Emits 'reader-pet' with a list of {species, family, name, level, location, element}.
// Also watches for pet detail modals to scrape per-pet stats into our cache.
import * as events from '../core/events.js';
import { parseNumber, debounce } from '../core/util.js';
import { data } from './data.js';
import { setPetStats } from '../core/petStats.js';
import { getUser, getCachedUser } from '../core/userCache.js';

let inProgress = false;
let modalObserver = null;
let lastReadModalEl = null;
let lastPets = [];           // last emitted pet list (for modal -> groupIndex lookup)
let lastClickedRow = null;   // DOM element the user just clicked
let knownTeamNames = new Set(); // cached across sub-tab navigation

// Persist team-name set across sessions so the Expedition calc has team
// data even on a hard refresh while on the in-game Expedition sub-tab.
// Storing only names (not full pets) keeps it small + privacy-friendly.
const TEAM_NAMES_KEY = 'riftscript_pet_team_names_v1';
function loadKnownTeamNames() {
    try {
        const raw = localStorage.getItem(TEAM_NAMES_KEY);
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) knownTeamNames = new Set(arr);
    } catch (e) { /* ignore */ }
}
function saveKnownTeamNames() {
    try {
        localStorage.setItem(TEAM_NAMES_KEY, JSON.stringify([...knownTeamNames]));
    } catch (e) { /* quota */ }
}

export function initPetReader() {
    loadKnownTeamNames();
    events.on('page', () => trigger());
    $(document).on('click', 'taming-page button, taming-page .tab', () => setTimeout(trigger, 200));

    // Track which exact pet row the user clicked so we can attribute modal data
    // back to the right pet (matters for breeders with many same-name pets).
    $(document).on('mousedown click', 'taming-page button.row', function() {
        lastClickedRow = this;
    });

    // Watch for pet detail modals appearing anywhere in the DOM. The observer
    // is on document.body because the modal is inserted as a top-level sibling
    // of taming-page; debounce the callback so Angular's frequent re-renders
    // during taming sub-tab switches don't trigger 50+ regex / DOM scans.
    const debouncedReadModal = debounce(maybeReadModal, 80);
    modalObserver = new MutationObserver(debouncedReadModal);
    modalObserver.observe(document.body, { childList: true, subtree: true });
}

export function trigger() {
    const page = events.last('page');
    if (page?.type !== 'taming') return;
    readPetScreen();
}

// Synchronous fast-path. Returns null if no cache is hydrated yet — caller
// should fall through to the async getApiPets() to fetch.
function getApiPetsSync() {
    const resp = getCachedUser();
    return resp ? extractPetsFromUser(resp) : null;
}

// Build a single reconstructed pet object from a getUser entry, overlaying
// any matching DOM-scraped row's fresh location / element / groupIndex
// when one exists. Tries every available index on data.pets so the species
// lookup doesn't depend on which key shape getUser happens to use.
function buildReconstructedPet(ap, scrapedPets = []) {
    const scraped = scrapedPets.find(p => p.name === ap.name);
    const idx = data.pets || {};
    const species = idx.byId?.[ap.species]
        || idx.bySpecies?.[ap.species]
        || idx.byTechnicalName?.[ap.species]
        || idx.byName?.[ap.species]
        || null;
    return {
        species: ap.species,
        family: species?.family,
        name: ap.name,
        level: scraped?.level ?? ap.level,
        location: scraped?.location
            || (knownTeamNames.has(ap.name) ? 'team' : 'collection'),
        groupIndex: scraped?.groupIndex ?? 0,
        element: scraped?.element || $(),
        apiId: ap.id,
        apiStats: ap,
    };
}

async function getApiPets() {
    const resp = await getUser();
    if (!resp) return null;
    return extractPetsFromUser(resp);
}

// Overlay freshly-scraped Expedition-Team rows on top of the cached full
// pets list. For each lastPet whose (name, species) matches a scraped row,
// take the scraped element + location + level (in case the pet just levelled
// up) but keep the cached apiId/apiStats so chips and stats lookups continue
// working. Pets not present in the scrape pass through unchanged.
function mergeTeamIntoLastPets(lastPets, scrapedPets) {
    if (!scrapedPets.length) return lastPets;
    const scrapedByKey = new Map();
    for (const sp of scrapedPets) {
        scrapedByKey.set(`${sp.name}|${sp.species}`, sp);
    }
    return lastPets.map(p => {
        const sp = scrapedByKey.get(`${p.name}|${p.species}`);
        if (!sp) return p;
        return {
            ...p,
            location: sp.location,
            element: sp.element,
            level: sp.level,
        };
    });
}

// Attach apiId + apiStats to pets[] using the supplied apiPets list.
// Returns true when at least one pet's apiId actually changed.
function enrichPetsWithApi(pets, apiPets) {
    if (!apiPets?.length) return false;
    const apiGroups = {};
    for (const ap of apiPets) {
        const k = `${ap.name}|${ap.species}|${ap.level}`;
        if (!apiGroups[k]) apiGroups[k] = [];
        apiGroups[k].push(ap);
    }
    let changed = false;
    for (const p of pets) {
        const k = `${p.name}|${p.species}|${p.level}`;
        const bucket = apiGroups[k];
        if (bucket && bucket[p.groupIndex]) {
            const ap = bucket[p.groupIndex];
            if (p.apiId !== ap.id) {
                p.apiId = ap.id;
                p.apiStats = ap;
                changed = true;
            }
        }
    }
    return changed;
}

function extractPetsFromUser(resp) {
    if (!resp || typeof resp !== 'object') return [];
    const keys = Object.keys(resp);
    const petsKey = keys.find(k => /pet/i.test(k) && Array.isArray(resp[k]));
    if (!petsKey) return [];
    const raw = resp[petsKey];
    return raw.map(p => ({
        id: p.id ?? p.petId ?? p.petID,
        name: p.name ?? p.displayName,
        species: p.species ?? p.speciesId ?? p.petSpecies,
        level: p.level ?? 1,
        health: p.health ?? p.statHealth ?? null,
        attack: p.attack ?? p.statAttack ?? null,
        defense: p.defense ?? p.statDefense ?? null,
        passives: p.passives ?? p.petPassives ?? [],
    })).filter(p => p.name);
}

async function readPetScreen() {
    if (inProgress) return;
    if (!data.pets) return;
    inProgress = true;
    try {
        // Detect which taming sub-tab we're on. The Pets sub-tab is the only
        // one with both the Expedition Team header AND the Ranch header (its
        // signature card layout). Other sub-tabs (Expedition, Breeding) also
        // show pet rows but without those headers — scraping them as if they
        // were the Pets sub-tab wipes out lastPets and knownTeamNames with
        // partial / wrongly-located data.
        const hasTeamCard  = $('taming-page .card .header:contains("Expedition Team")').length > 0;
        const hasRanchCard = $('taming-page .card .header:contains("Ranch")').length > 0;
        const isPetsSubTab = hasTeamCard && hasRanchCard;
        // Expedition sub-tab signature: the Stats card has the "Expedition
        // Trait Rotation" / "Total Taming XP" rows. The pet rows visible
        // there are the player's team but the card containing them has no
        // "Expedition Team" header, so partOfTeam from the per-row check
        // would mark them collection. Override below.
        const isExpeditionSubTab = !isPetsSubTab && (
            $('taming-page .name:contains("Expedition Trait Rotation")').length > 0
            || $('taming-page .name:contains("Total Taming XP")').length > 0
        );

        const pets = [];
        $('taming-page button.row').each((_i, el) => {
            const $el = $(el);
            const $img = $el.find('.image img').first();
            if (!$img.length) return;
            const src = $img.attr('src') || '';
            const filename = src.split('/').pop();
            const species = data.pets.byImage[filename] || data.pets.byImage[src];
            if (!species) return;

            const $info = $el.find('.image').next();
            const name = $info.find('.flex > :nth-child(1)').first().text().trim();
            const levelText = $info.find('.flex > :nth-child(2)').first().text();
            const level = parseNumber(levelText);

            const $card = $el.closest('.card');
            const partOfTeam = !!$card.find('.header:contains("Expedition Team")').length;
            const partOfRanch = !!$card.find('.header:contains("Ranch")').length;
            // On the Expedition sub-tab the only pet rows visible are the
            // team itself, so default everything there to team if not
            // otherwise tagged.
            const location = partOfTeam ? 'team'
                : partOfRanch ? 'ranch'
                : isExpeditionSubTab ? 'team'
                : 'collection';

            pets.push({
                species: species.id,
                family: species.family,
                name,
                level,
                location,
                element: $el,
            });
        });

        // Only treat the scrape as authoritative when we're actually on the
        // Pets sub-tab. Otherwise the scraped subset would overwrite our good
        // cached data with partial / mis-located pets.
        if (pets.length && isPetsSubTab) {
            // Compute groupIndex: position-within-(name|species|level) group
            const groupCounters = {};
            for (const p of pets) {
                const k = `${p.name}|${p.species}|${p.level}`;
                p.groupIndex = (groupCounters[k] || 0);
                groupCounters[k] = p.groupIndex + 1;
            }

            // Remember team membership so we can reconstruct it on sub-tabs
            // where the team DOM isn't rendered (e.g., expedition sub-tab).
            knownTeamNames = new Set(pets.filter(p => p.location === 'team').map(p => p.name));
            saveKnownTeamNames();

            // Synchronous enrichment from whatever is already cached — instant
            // on hot path (localStorage or in-memory). Chips render NOW with
            // full data when the cache is warm.
            enrichPetsWithApi(pets, getApiPetsSync());

            lastPets = pets;
            events.emit('reader-pet', pets);

            // Background refresh — fetches getUser if the cache is stale or
            // empty, then re-emits if new data unlocks any pet IDs. Doesn't
            // block initial chip render on the cold-start network roundtrip.
            getApiPets().then(apiPets => {
                if (enrichPetsWithApi(pets, apiPets)) {
                    events.emit('reader-pet', pets);
                }
            }).catch(() => { /* swallow — sync fallback already emitted */ });
        } else {
            // Non-Pets sub-tab. The Expedition / Breeding sub-tabs show the
            // 3 team pets but without the Ranch+Team headers our
            // is-Pets-sub-tab check needs. Persist team names from the visible
            // rows (so a cold load on Expedition still knows the team), then
            // fall through to re-emit lastPets (if any) or reconstruct from
            // API. Don't replace lastPets with the partial scrape.
            if (pets.length) {
                const teamNames = pets
                    .filter(p => p.location === 'team')
                    .map(p => p.name);
                if (teamNames.length) {
                    knownTeamNames = new Set(teamNames);
                    saveKnownTeamNames();
                }
            }

            if (lastPets.length) {
                // We already have a full pets list from a previous Pets
                // sub-tab visit. Re-emit it as-is — going to Expedition /
                // Breeding and back to Pets must not touch team membership.
                events.emit('reader-pet', lastPets);
            } else {
                // Sync-first reconstruction from the userCache. Cold refresh
                // on the Expedition sub-tab hits this — every piece of data
                // the expedition calc needs is already in localStorage:
                //   - userCache (the getUser response, hydrated synchronously)
                //   - knownTeamNames (loaded on init for team membership)
                //   - petStats (looked up by apiId by applyToList downstream)
                //   - data.pets (indexed for species lookup)
                // No network roundtrip needed for the initial emit.
                const syncApiPets = getApiPetsSync();
                if (syncApiPets?.length) {
                    const reconstructed = syncApiPets.map(ap => buildReconstructedPet(ap, pets));
                    lastPets = reconstructed;
                    events.emit('reader-pet', reconstructed);

                    // Background refresh — only re-emit if the new fetch
                    // brought back a different number of pets (handles new
                    // hatch / release between sessions).
                    getApiPets().then(fresh => {
                        if (fresh?.length && fresh.length !== syncApiPets.length) {
                            const refreshed = fresh.map(ap => buildReconstructedPet(ap, pets));
                            lastPets = refreshed;
                            events.emit('reader-pet', refreshed);
                        }
                    }).catch(() => { /* swallow */ });
                } else if (pets.length) {
                    // No cache at all (first run after install) but visible
                    // team rows exist on the Expedition sub-tab — use those.
                    const groupCounters = {};
                    for (const p of pets) {
                        const k = `${p.name}|${p.species}|${p.level}`;
                        p.groupIndex = (groupCounters[k] || 0);
                        groupCounters[k] = p.groupIndex + 1;
                    }
                    events.emit('reader-pet', pets);
                    // Fetch in the background to enrich with apiStats.
                    getApiPets().then(fresh => {
                        if (fresh?.length) {
                            const reconstructed = fresh.map(ap => buildReconstructedPet(ap, pets));
                            lastPets = reconstructed;
                            events.emit('reader-pet', reconstructed);
                        }
                    }).catch(() => {});
                } else {
                    // Truly cold (no cache, no DOM rows) — wait for the API.
                    const apiPets = await getApiPets();
                    if (apiPets?.length) {
                        const reconstructed = apiPets.map(ap => buildReconstructedPet(ap, pets));
                        lastPets = reconstructed;
                        events.emit('reader-pet', reconstructed);
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[RiftScript] pet reader error:', e);
    } finally {
        inProgress = false;
    }
}

// Look for an open pet detail modal and scrape its stats into the cache.
function maybeReadModal() {
    const $modal = $('modal-component, .modal').last();
    if (!$modal.length) return;
    // Only act on taming page
    const page = events.last('page');
    if (page?.type !== 'taming') return;
    // Pet modal has an "Abilities" section
    if (!$modal.find('.name:contains("Abilities"), .header:contains("Abilities")').length) return;

    const $header = $modal.find('.header').first();
    const $img = $header.find('img').first();
    const src = $img.attr('src') || '';
    const filename = src.split('/').pop();
    const species = data.pets?.byImage?.[filename] || data.pets?.byImage?.[src];

    const name = $header.find('.description > button, .description > .name, .name').first().text().trim();
    if (!name) return;
    // Dedup by modal DOM element so re-scrapes only happen on a fresh modal
    // (not on every MutationObserver tick of the same open modal). Same-name
    // pets get different modal elements, so each gets scraped.
    if ($modal[0] === lastReadModalEl) return;

    const levelText = $header.find('.description > div, .level').first().text();
    const level = parseNumber(levelText);

    const stats = parseModalStats($modal);
    const passives = parseModalPassives($modal);
    const abilities = species ? extractAbilities(species) : [];

    // Resolve which specific pet was clicked: prefer matching by the last
    // clicked DOM row, fall back to first matching name+species+level.
    // We also grab the apiId off the matched pet so the stat cache is keyed
    // stably across level-ups (the apiId is the stable identifier).
    let groupIndex = 0;
    let apiId = null;
    if (lastClickedRow) {
        const match = lastPets.find(p => p.element[0] === lastClickedRow);
        if (match && match.name === name) {
            groupIndex = match.groupIndex || 0;
            apiId = match.apiId || null;
        }
    }
    if (!apiId) {
        // Fallback: any pet with matching name+species+level+groupIndex.
        const match = lastPets.find(p =>
            p.name === name &&
            p.species === species?.id &&
            p.level === level &&
            (p.groupIndex || 0) === groupIndex
        );
        apiId = match?.apiId || null;
    }
    const petKey = { name, species: species?.id, level, groupIndex, apiId };
    setPetStats(petKey, {
        species: species?.id,
        family: species?.family,
        level,
        ...stats,
        passives,
        abilities,
    });
    lastReadModalEl = $modal[0];
    events.emit('reader-pet-modal', {
        name, level, ...stats, passives, abilities,
        species, family: species?.family,
        modalEl: $modal[0],
    });
    // Re-trigger list update so chips reflect the newly cached pet
    setTimeout(trigger, 100);
}

function parseModalStats($modal) {
    // Modal rows look like: "Health  141 (98%)" — grab the % in parens.
    const labels = ['Health', 'Attack', 'Defense', 'Total'];
    const out = {};
    for (const label of labels) {
        const $row = $modal.find(`.row:contains("${label}"), .stat:contains("${label}")`).first();
        if (!$row.length) continue;
        const text = $row.text();
        const m = text.match(/\((\d+(?:\.\d+)?)\s*%\)/) || text.match(/(\d+(?:\.\d+)?)\s*%/);
        if (m) out[label.toLowerCase()] = parseFloat(m[1]);
    }
    return out;
}

function parseModalPassives($modal) {
    // Passive rows look like: "Melee Block 2  +4%". The label has the level
    // baked into the name; the value has the effect %.
    const passives = [];
    const seen = new Set();
    $modal.find('.row').each((_i, el) => {
        const $row = $(el);
        const text = $row.text().replace(/\s+/g, ' ').trim();
        // Skip non-passive rows. Abilities / Species lack `\b` separation
        // because jQuery .text() concatenates "Abilities" + "Wood 6" without
        // a space — use a plain prefix match instead of \b.
        if (/^(Health|Attack|Defense|Total|Abilities|Species)/i.test(text)) return;
        // Require the trailing "+X%" effect — that's what distinguishes a
        // passive row from anything else in the modal.
        const m = text.match(/^([A-Za-z][A-Za-z ]+?)\s+(\d+)\s*\+?\s*(\d+(?:\.\d+)?)\s*%$/);
        if (!m) return;
        const name = m[1].trim();
        const level = parseInt(m[2]);
        const effect = m[3] ? parseFloat(m[3]) : null;
        const key = `${name}|${level}`;
        if (seen.has(key)) return;
        seen.add(key);
        passives.push({ name, level, effect });
    });
    return passives;
}

function extractAbilities(species) {
    if (!species?.abilities) return [];
    if (Array.isArray(species.abilities)) {
        return species.abilities.map(a => {
            if (typeof a === 'string') return { name: a };
            const key = Object.keys(a)[0];
            return { name: key, value: a[key] };
        });
    }
    return [];
}
