// RiftScript — Ironwood RPG enhancement scripts by Patt
import { initAuthInterceptor } from './core/auth.js';
import { primeUserCache } from './core/userCache.js';
import { loadGameData } from './game/data.js';
import { initPageDetector } from './game/page.js';
import { initReaders } from './game/reader.js';
import { initModeDetector } from './game/mode.js';
import { initEstimator } from './features/estimator.js';
import { initVersionCheck } from './features/versionCheck.js';
import { initMarketReader } from './game/marketReader.js';
import { initMarketFilter } from './features/marketFilter.js';
import { initMarketCompetition } from './features/marketCompetition.js';
import { initMarketPriceButtons } from './features/marketPriceButtons.js';
import { initMarketListingLimit } from './features/marketListingLimit.js';
import { initTargetAmountMarket } from './features/targetAmountMarket.js';
import { initTargetAmountCrafting } from './features/targetAmountCrafting.js';
import { initIdleBeep } from './features/idleBeep.js';
import { initLoadHealthCheck } from './features/loadHealthCheck.js';
import { initTomeDetector } from './features/tomeDetector.js';
import { initPetReader } from './game/petReader.js';
import { initPetFilter } from './features/petFilter.js';
import { initEstimatorPanel } from './ui/estimatorPanel.js';
import { initMenu } from './ui/menu.js';
import { initCombatSimPage } from './ui/combatSimPage.js';
import { initStyles } from './ui/styles.js';

(async function RiftScript() {
    'use strict';

    console.log(`[RiftScript] Starting v${RIFTSCRIPT_VERSION}${RIFTSCRIPT_DEV ? ' [DEV]' : ''}...`);

    initStyles();
    initPageDetector();
    initModeDetector();
    initMenu();

    await Promise.all([
        initAuthInterceptor(),
        loadGameData(),
    ]);

    // Fire-and-forget: warm the shared userCache so features that need it
    // (tome detector, combat panel, pet reader, combat sim) don't each pay
    // the latency of a first fetch.
    primeUserCache();

    initReaders();
    initMarketReader();
    initPetReader();
    initEstimator();
    initVersionCheck();
    initLoadHealthCheck();
    initTomeDetector();
    initEstimatorPanel();
    initCombatSimPage();
    initMarketFilter();
    initMarketCompetition();
    initMarketPriceButtons();
    initMarketListingLimit();
    initTargetAmountMarket();
    initTargetAmountCrafting();
    initIdleBeep();
    initPetFilter();

    console.log('[RiftScript] Ready.');
})();
