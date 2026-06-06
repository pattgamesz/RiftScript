// Reads the player's pet collection from the Taming → Pets page.
// Emits 'reader-pet' with a list of {species, family, name, level, location, element}.
// Also watches for pet detail modals to scrape per-pet stats into our cache.
import * as events from '../core/events.js';
import { parseNumber, debounce, expToLevel } from '../core/util.js';
import { data } from './data.js';
import { setPetStats } from '../core/petStats.js';
import { getUser } from '../core/userCache.js';

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
    // Fresh getUser data can arrive after the first cold-refresh trigger
    // ran (auth token comes from IndexedDB; userCache populates async). When
    // it does, re-run the reader so the Expedition tab gets reconstructed
    // pet data even on a sub-tab where no pet rows are visible.
    events.on('user-data', () => trigger());
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

async function getApiPets() {
    const resp = await getUser();
    if (!resp) return null;
    return extractPetsFromUser(resp);
}

// Match scraped pets against the getUser pet list by (species|level) +
// position within that bucket. species + level is a more stable identity
// than name+species+level — survives renames without breaking the match.
// The bucket position is computed per (species|level) on both sides so the
// indices line up.
function enrichPetsFromApiPets(pets, apiPets) {
    const apiGroups = {};
    for (const ap of apiPets) {
        const k = `${ap.species}|${ap.level}`;
        if (!apiGroups[k]) apiGroups[k] = [];
        apiGroups[k].push(ap);
    }
    const scrapeCounters = {};
    for (const p of pets) {
        const k = `${p.species}|${p.level}`;
        if (p._speciesGI == null) {
            p._speciesGI = scrapeCounters[k] || 0;
            scrapeCounters[k] = p._speciesGI + 1;
        }
        if (p.apiId) continue;
        const bucket = apiGroups[k];
        if (bucket && bucket[p._speciesGI]) {
            const ap = bucket[p._speciesGI];
            p.apiId = ap.id;
            p.apiStats = ap;
        }
    }
}

// Pets in the getUser response live under user.pets.storage as a dict
// keyed by the stable instance petId (e.g. "115" → { displayName: "Deowl34",
// id: "119" (species), exp, bonuses: {health, attack, defense}, passives }).
// team / ranch are arrays of those petIds pointing back into storage.
//
// This is the source of truth for every chip-render value we care about —
// no modal scrape needed for stats, no fragile cache key needed for survival
// across renames: petId is the unique stable identifier.
function extractPetsFromUser(resp) {
    if (!resp || typeof resp !== 'object') return [];
    const petData = resp.user?.pets || resp.pets;
    if (!petData?.storage) return [];
    const storage = petData.storage;
    const teamSet  = new Set((petData.team  || []).map(String));
    const ranchSet = new Set((petData.ranch || []).map(String));
    const out = [];
    for (const [key, p] of Object.entries(storage)) {
        if (!p) continue;
        const petId = p.petId ?? +key;
        const exp = +p.exp || 0;
        out.push({
            id:       +petId || 0,
            name:     p.displayName || '',
            species:  +(p.id ?? 0) || 0,
            exp,
            // Pets cap at level 100 in-game even when exp climbs higher;
            // every formula downstream assumes max-100 so cap here too.
            level:    Math.min(expToLevel(exp), 100),
            // getUser bonuses are stored as half the displayed percentage
            // (each parent contributes up to 25 of a 0–50 range, the game
            // doubles it for display). Every consumer expects the 0–100
            // percentage form, so double it on the way out.
            health:   p.bonuses?.health  != null ? p.bonuses.health  * 2 : null,
            attack:   p.bonuses?.attack  != null ? p.bonuses.attack  * 2 : null,
            defense: p.bonuses?.defense != null ? p.bonuses.defense * 2 : null,
            // Resolve passive IDs to the {name, level, effect} shape the
            // chip renderer + expedition calc share with modal-scraped stats.
            passives: (p.passives || []).map(transformPassive).filter(Boolean),
            location: teamSet.has(String(petId))  ? 'team'
                    : ranchSet.has(String(petId)) ? 'ranch'
                    : 'storage',
        });
    }
    return out.filter(p => p.name);
}

function transformPassive(rawId) {
    const entry = data.petPassives?.byId?.[+rawId];
    if (!entry) return null;
    // Passive names are stored as "Melee Block 2" — split tier number off
    // the end so the chip renderer's grouping by name + level still works.
    const m = (entry.name || '').match(/^(.*?)\s+(\d+)$/);
    return {
        name:     m ? m[1] : entry.name,
        level:    m ? +m[2] : entry.tier ?? null,
        effect:   entry.statValue,
        statName: entry.statName,
    };
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
            const location = partOfTeam ? 'team' : partOfRanch ? 'ranch' : 'collection';

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

            // Emit IMMEDIATELY so chips render from the petStats cache via
            // the legacy keys — instant for unchanged pets, which is the
            // common case. Then enrich + re-emit in the background to catch
            // the renamed-pet path (where apiId is what unlocks the cache).
            lastPets = pets;
            events.emit('reader-pet', pets);

            // Background enrichment: ride on the shared 5-minute userCache;
            // no force-refresh here. Hitting getUser every time the user
            // renames or even just lands on the page triggers the game's
            // rate limiter — and the cache hit IS enough for non-renamed
            // pets, which is the common case.
            (async () => {
                const apiPets = await getApiPets();
                if (!apiPets?.length) return;
                let changed = false;
                for (const p of pets) {
                    if (p.apiId) continue;
                    // Same matching as enrichPetsFromApiPets, inlined so we
                    // can detect if any pet actually got enriched.
                    const k = `${p.name}|${p.species}|${p.level}`;
                    const bucket = apiPets.filter(a => `${a.name}|${a.species}|${a.level}` === k);
                    if (bucket[p.groupIndex]) {
                        const ap = bucket[p.groupIndex];
                        p.apiId = ap.id;
                        p.apiStats = ap;
                        changed = true;
                    }
                }
                if (changed) events.emit('reader-pet', pets);
            })();
        } else {
            // No usable DOM scrape — either we're on a non-Pets sub-tab, or
            // the page is still rendering. Try the API reconstruct path first
            // so fresh getUser data (chip stats, team membership) replaces
            // any previously-emitted stale list. Fall back to re-emitting
            // lastPets if the API has nothing to offer yet (auth not ready).
            //
            // The new extractor already sets location from user.pets.team /
            // ranch (arrays of petIds), so we don't need to second-guess via
            // knownTeamNames name-matching any more — that broke as soon as
            // any team pet was renamed.
            const apiPets = await getApiPets();
            if (apiPets?.length) {
                // Group by species|level to assign stable groupIndexes the
                // chip cache / matching logic can rely on.
                const counters = {};
                const reconstructed = apiPets.map(ap => {
                    const species = data.pets?.byId?.[ap.species];
                    const k = `${ap.species}|${ap.level}`;
                    const gi = counters[k] || 0;
                    counters[k] = gi + 1;
                    return {
                        species: ap.species,
                        family: species?.family,
                        name: ap.name,
                        level: ap.level,
                        // Map getUser's storage bucket to the legacy 'collection'
                        // label so applyToList's family-filter behaves the same
                        // as for DOM-scraped pets.
                        location: ap.location === 'storage' ? 'collection' : ap.location,
                        groupIndex: gi,
                        element: $(),
                        apiId: ap.id,
                        apiStats: ap,
                    };
                });
                // Persist the team names too so a refresh on a non-team-card
                // sub-tab can still bootstrap before getUser comes back.
                knownTeamNames = new Set(reconstructed
                    .filter(p => p.location === 'team')
                    .map(p => p.name));
                saveKnownTeamNames();
                lastPets = reconstructed;
                events.emit('reader-pet', reconstructed);
            } else if (lastPets.length) {
                events.emit('reader-pet', lastPets);
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
    // Pick up the apiId off the matched pet so setPetStats writes a stable
    // 'id:N' key alongside the legacy key — that's what lets the cache
    // survive a rename or level-up without re-opening the modal.
    let groupIndex = 0;
    let apiId = null;
    if (lastClickedRow) {
        const match = lastPets.find(p => p.element[0] === lastClickedRow);
        if (match && match.name === name) {
            groupIndex = match.groupIndex || 0;
            apiId = match.apiId || null;
        }
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
