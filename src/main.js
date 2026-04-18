// RiftScript — Ironwood RPG enhancement scripts by Patt
import { initAuthInterceptor } from './core/auth.js';
import { loadGameData } from './game/data.js';
import { initPageDetector } from './game/page.js';
import { initReaders } from './game/reader.js';
import { initModeDetector } from './game/mode.js';
import { initEstimator } from './features/estimator.js';
import { initVersionCheck } from './features/versionCheck.js';
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

    await Promise.all([
        initAuthInterceptor(),
        loadGameData(),
    ]);

    initReaders();
    initEstimator();
    initVersionCheck();
    initEstimatorPanel();
    initMenu();
    initCombatSimPage();

    console.log('[RiftScript] Ready.');
})();
