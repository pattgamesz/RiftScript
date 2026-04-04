// RiftScript — Ironwood RPG enhancement scripts by Patt
import { loadGameData } from './game/data.js';
import { initPageDetector } from './game/page.js';
import { initReaders } from './game/reader.js';
import { initModeDetector } from './game/mode.js';
import { initEstimator } from './features/estimator.js';
import { initVersionCheck } from './features/versionCheck.js';
import { initEstimatorPanel } from './ui/estimatorPanel.js';
import { initMenu } from './ui/menu.js';
import { initStyles } from './ui/styles.js';

(async function RiftScript() {
    'use strict';

    console.log(`[RiftScript] Starting v${RIFTSCRIPT_VERSION}...`);

    initStyles();
    initPageDetector();
    initModeDetector();

    await loadGameData();

    initReaders();
    initEstimator();
    initVersionCheck();
    initEstimatorPanel();
    initMenu();

    console.log('[RiftScript] Ready.');
})();
