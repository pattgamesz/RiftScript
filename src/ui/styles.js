// Inject RiftScript CSS into the page
export function initStyles() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
}

const CSS = `
/* Divider — matches game's .divider style */
.rs-divider {
    margin-top: var(--gap, 8px);
    border-top: 1px dashed rgba(255,255,255,0.1);
}

/* RiftScript Panel */
.riftscript-panel {
    background: var(--background-color, #1a1a2e);
    border-radius: 4px;
    margin-top: var(--gap, 8px);
    box-shadow: 0 4px 8px -2px rgba(0,0,0,0.3);
    overflow: hidden;
}

/* Tabs — mirrors game's .tabs > button.tab pattern */
.rs-tabs {
    display: flex;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
.rs-tabs > button.rs-tab {
    all: unset;
    flex: 1 1 0;
    padding: 12px 0;
    color: rgba(255,255,255,0.45);
    font-size: 0.9em;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    box-sizing: border-box;
}
.rs-tabs > button.rs-tab:hover {
    color: rgba(255,255,255,0.7);
}
.rs-tabs > button.rs-tab[disabled] {
    color: #fff;
    border-bottom-color: #4a9eff;
    cursor: default;
}

/* Tab content */
.rs-tab-content {
    padding: 4px 0;
}
.rs-hidden {
    display: none !important;
}

/* Rows */
.rs-row {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 8px;
    min-height: 40px;
}
.rs-row:not(:last-child) {
    border-bottom: 1px solid #2a3a50;
}
.rs-icon {
    width: 24px;
    text-align: center;
    flex-shrink: 0;
    font-size: 1em;
}
.rs-item-img {
    width: 24px;
    height: 24px;
    image-rendering: pixelated;
    flex-shrink: 0;
}
.rs-label {
    flex: 1;
    color: rgba(255,255,255,0.7);
    font-size: 0.85em;
}
.rs-value {
    text-align: right;
    color: #fff;
    font-size: 0.85em;
    font-weight: 500;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}
.rs-extra {
    font-size: 0.75em;
    color: rgba(255,255,255,0.4);
    font-weight: 400;
}

/* Section headers */
.rs-section-header {
    padding: 8px 12px 4px;
    font-size: 0.75em;
    font-weight: 600;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Middle column for inputs */
.rs-mid {
    flex: 1;
    display: flex;
    justify-content: center;
}
.rs-goal-result {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

/* Goal input */
.rs-goal-input {
    all: unset;
    width: 44px;
    padding: 4px 6px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 4px;
    color: #fff;
    font-size: 0.85em;
    text-align: center;
    box-sizing: border-box;
}
.rs-goal-input:focus {
    border-color: #4a9eff;
}

/* Item price input */
.rs-item-value {
    gap: 2px;
}
.rs-item-price {
    display: flex;
    align-items: center;
    gap: 4px;
}
.rs-price-input {
    all: unset;
    width: 50px;
    padding: 2px 4px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 3px;
    color: #fff;
    font-size: 0.8em;
    text-align: center;
    box-sizing: border-box;
}
.rs-price-input:focus {
    border-color: #4a9eff;
}

/* Timer button */
.rs-timer-btn {
    all: unset;
    cursor: pointer;
    font-size: 1em;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background 0.15s;
}
.rs-timer-btn:hover {
    background: rgba(255,255,255,0.1);
}

/* Update notice */
.rs-update-notice {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #172033;
    border: 1px solid #2a3a50;
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 9999;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    animation: rs-fadein 0.3s ease;
}
.rs-update-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: #fff;
    font-size: 0.85em;
}
.rs-update-text span {
    color: rgba(255,255,255,0.4);
    font-size: 0.85em;
}
.rs-update-btn {
    all: unset;
    padding: 6px 16px;
    background: #4a9eff;
    color: #fff;
    border-radius: 4px;
    font-size: 0.85em;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
}
.rs-update-btn:hover {
    background: #3a8eef;
}
.rs-update-dismiss {
    all: unset;
    color: rgba(255,255,255,0.3);
    cursor: pointer;
    font-size: 1em;
    padding: 0 4px;
}
.rs-update-dismiss:hover {
    color: rgba(255,255,255,0.7);
}

/* Profit colors */
.rs-profit-positive { color: #4ade80 !important; }
.rs-profit-negative { color: #f87171 !important; }

/* Branding */
.rs-branding {
    text-align: right;
    padding: 4px 2px 0;
    font-size: 0.6em;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.3px;
}

/* Nav Button — matches game button spacing */
.riftscript-nav-btn {
    all: unset;
    display: flex;
    align-items: center;
    width: 100%;
    padding: 12px 24px;
    gap: 10px;
    cursor: pointer;
    box-sizing: border-box;
    background: var(--background-color, #1a1a2e);
    border-top: 1px solid rgba(74,158,255,0.15);
    border-bottom: 1px solid #263849;
}
.riftscript-nav-btn:hover {
    background: #152030;
}
.riftscript-nav-btn.rs-nav-active {
    background: #172a40;
}
.riftscript-header-logo {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #4a9eff;
    border-radius: 6px;
    font-size: 0.8em;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.5px;
    margin-right: var(--margin, 12px);
}
.riftscript-nav-logo {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #4a9eff;
    border-radius: 6px;
    font-size: 0.75em;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.5px;
    flex-shrink: 0;
}
.riftscript-nav-btn .name {
    font-size: 1em;
    color: #fff;
    font-weight: 600;
}

/* RiftScript Page */
riftscript-page {
    height: 100%;
    overflow-y: auto;
    padding-top: var(--gap, 24px);
}

.rs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--gap, 24px);
    padding-bottom: 0;
    max-width: 1260px;
    margin: 0 auto;
}
.rs-header-title {
    font-size: 1.4em;
    font-weight: 700;
    color: #fff;
}
.rs-header-badge {
    font-size: 0.75em;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 4px;
    background: rgba(74,158,255,0.15);
    color: #4a9eff;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.rs-layout {
    display: flex;
    gap: var(--gap, 24px);
    padding: var(--gap, 24px);
    max-width: 1260px;
    margin: 0 auto;
}
.rs-col-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--gap, 24px);
}
.rs-col-right {
    width: 280px;
    flex-shrink: 0;
}
.rs-card {
    background: #172033;
    border-radius: 4px;
    overflow: hidden;
}
.rs-card-header {
    padding: var(--margin, 12px) var(--gap, 24px);
    font-weight: 600;
    font-size: 0.9em;
    color: #fff;
    border-bottom: 1px solid #2a3a50;
}
riftscript-page .rs-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--margin, 12px) var(--gap, 24px);
    font-size: 0.9em;
    color: rgba(255,255,255,0.7);
    border-bottom: 1px solid #2a3a50;
    min-height: var(--row, 56px);
}
riftscript-page .rs-row:last-child {
    border-bottom: none;
}
.rs-menu-btn {
    all: unset;
    display: flex;
    align-items: center;
    width: 100%;
    padding: var(--margin, 12px) var(--gap, 24px);
    font-size: 0.9em;
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    box-sizing: border-box;
    border-bottom: 1px solid #2a3a50;
    min-height: var(--row, 56px);
}
.rs-menu-btn:last-child {
    border-bottom: none;
}
.rs-menu-btn:hover {
    background: rgba(255,255,255,0.03);
    color: rgba(255,255,255,0.8);
}
.rs-menu-btn.active {
    color: #fff;
    background: rgba(74,158,255,0.08);
}
.rs-btn {
    all: unset;
    padding: 6px 14px;
    border-radius: 4px;
    font-size: 0.8em;
    font-weight: 600;
    cursor: pointer;
}
.rs-btn-primary {
    background: rgba(74,158,255,0.2);
    color: #4a9eff;
}
.rs-btn-primary:hover {
    background: rgba(74,158,255,0.3);
}
.rs-btn-danger {
    background: rgba(248,113,113,0.15);
    color: #f87171;
}
.rs-btn-danger:hover {
    background: rgba(248,113,113,0.25);
}

/* Toast */
.rs-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(30,30,50,0.95);
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 0.9em;
    z-index: 9999;
    backdrop-filter: blur(8px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.3);
    animation: rs-fadein 0.3s ease;
}
@keyframes rs-fadein {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Settings rows */
.rs-setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.rs-setting-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.rs-setting-desc {
    font-size: 0.75em;
    color: rgba(255,255,255,0.3);
    line-height: 1.3;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.2s ease, opacity 0.2s ease;
    opacity: 0;
}
.rs-setting-row:hover .rs-setting-desc {
    max-height: 40px;
    opacity: 1;
}

/* Toggle switch */
.rs-toggle {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
}
.rs-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
}
.rs-toggle-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: rgba(255,255,255,0.12);
    border-radius: 20px;
    transition: background 0.2s;
}
.rs-toggle-slider::before {
    content: "";
    position: absolute;
    width: 14px;
    height: 14px;
    left: 3px;
    bottom: 3px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
}
.rs-toggle input:checked + .rs-toggle-slider {
    background: #4a9eff;
}
.rs-toggle input:checked + .rs-toggle-slider::before {
    transform: translateX(16px);
}

/* Combat Calculator Inputs */
.rs-combat-input {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 4px;
    color: #fff;
    padding: 4px 8px;
    font-size: 13px;
    width: 90px;
    text-align: right;
    outline: none;
}
.rs-combat-input:focus {
    border-color: #4a9eff;
}
.rs-combat-select {
    width: auto;
    min-width: 120px;
    text-align: left;
    cursor: pointer;
}
.rs-combat-input[type="number"]::-webkit-inner-spin-button,
.rs-combat-input[type="number"]::-webkit-outer-spin-button {
    opacity: 0.5;
}
.rs-cb-fetched {
    color: #4a9eff;
    font-size: 12px;
    margin-left: 4px;
    text-align: right;
}
.rs-cb-fetched:empty {
    display: none;
}
.rs-cb-alert {
    background: rgba(248,113,113,0.12);
    border: 1px solid rgba(248,113,113,0.3);
    border-radius: 8px;
    color: #f87171;
    padding: 10px 14px;
    font-size: 13px;
    margin-bottom: 8px;
}

/* Changelog */
.rs-changelog {
    padding: 12px 24px 16px;
    font-size: 0.85em;
    color: rgba(255,255,255,0.7);
    line-height: 1.6;
}
.rs-changelog-section {
    color: #4a9eff;
    font-weight: 600;
    font-size: 0.95em;
    margin-top: 12px;
    margin-bottom: 4px;
}
.rs-changelog-section:first-child {
    margin-top: 0;
}
.rs-changelog ul {
    margin: 0;
    padding-left: 18px;
}
.rs-changelog li {
    margin-bottom: 2px;
}

/* ─── Combat Simulator Page ─────────────────────────────────── */

combatsim-page {
    display: block;
}

/* Alert bar */
.cs-alert {
    background: rgba(248,113,113,0.12);
    border: 1px solid rgba(248,113,113,0.3);
    border-radius: 8px;
    color: #f87171;
    padding: 10px 16px;
    font-size: 13px;
    margin: 16px 24px 0;
    max-width: 1260px;
}

/* Layout */
.cs-layout {
    display: flex;
    gap: 24px;
    padding: 24px;
    max-width: 1260px;
    margin: 0 auto;
}
.cs-col-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
}
.cs-col-side {
    width: 340px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

/* Cards */
.cs-card {
    background: #172033;
    border-radius: 6px;
    overflow: hidden;
}
.cs-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    font-weight: 600;
    font-size: 0.9em;
    color: #fff;
    border-bottom: 1px solid #2a3a50;
}

/* Monster Card */
.cs-monster-card {
    display: flex;
    flex-direction: column;
}
.cs-monster-image {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    padding: 20px;
    background: rgba(0,0,0,0.15);
}
.cs-monster-image img {
    max-height: 96px;
    image-rendering: pixelated;
}
.cs-monster-name {
    font-size: 1.2em;
    font-weight: 700;
    color: #fff;
    padding: 12px 16px 4px;
}

/* Stat badges */
.cs-stat-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px 16px;
}
.cs-badge {
    background: rgba(255,255,255,0.08);
    padding: 4px 10px;
    font-size: 0.8em;
    border-radius: 4px;
    font-weight: 600;
    white-space: nowrap;
}
.cs-badge-green { color: #4ade80; }
.cs-badge-red { color: #f87171; }
.cs-badge-neutral { color: rgba(255,255,255,0.7); }

/* Region Tabs */
.cs-region-tabs {
    display: flex;
    border-bottom: 1px solid #2a3a50;
}
.cs-region-tab {
    flex: 1;
    text-align: center;
    padding: 10px;
    cursor: pointer;
    color: rgba(255,255,255,0.5);
    transition: color 0.15s, border-color 0.15s, background 0.15s;
    border-bottom: 2px solid transparent;
    font-size: 0.85em;
    font-weight: 500;
    background: none;
    border-top: none;
    border-left: none;
    border-right: none;
}
.cs-region-tab:hover {
    color: rgba(255,255,255,0.7);
}
.cs-region-tab.active {
    color: #fff;
    border-bottom-color: #4a9eff;
    background: rgba(74,158,255,0.05);
}

/* Type Tabs (Normal/Elite) */
.cs-type-tabs {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-bottom: 1px solid #2a3a50;
}
.cs-type-tab {
    padding: 6px 20px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.15);
    background: none;
    color: rgba(255,255,255,0.5);
    font-size: 0.85em;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
}
.cs-type-tab:hover {
    color: rgba(255,255,255,0.7);
    border-color: rgba(255,255,255,0.25);
}
.cs-type-tab.active {
    color: #fff;
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.3);
}

/* Monster List */
.cs-monster-list {
    max-height: 350px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.15) transparent;
}
.cs-monster-list::-webkit-scrollbar {
    width: 6px;
}
.cs-monster-list::-webkit-scrollbar-track {
    background: transparent;
}
.cs-monster-list::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 3px;
}
.cs-monster-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.25);
}
.cs-monster-entry {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    gap: 10px;
    cursor: pointer;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    transition: background 0.12s;
    width: 100%;
    background: none;
    border-top: none;
    border-left: none;
    border-right: none;
    color: inherit;
    font: inherit;
    text-align: left;
}
.cs-monster-entry:hover {
    background: rgba(255,255,255,0.03);
}
.cs-monster-entry.active {
    background: rgba(74,158,255,0.1);
    border-left: 3px solid #4a9eff;
    padding-left: 13px;
}
.cs-monster-entry-img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
    flex-shrink: 0;
}
.cs-monster-entry-name {
    flex: 1;
    font-size: 0.85em;
    color: #fff;
}
.cs-monster-entry-xp {
    font-size: 0.75em;
    color: rgba(255,255,255,0.4);
}
.cs-monster-entry-level {
    font-size: 0.75em;
    color: rgba(255,255,255,0.4);
    min-width: 45px;
    text-align: right;
}

/* Drops Table */
.cs-drops-table {
    display: flex;
    flex-direction: column;
}
.cs-drop-row {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    gap: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    font-size: 0.85em;
}
.cs-drop-img {
    width: 28px;
    height: 28px;
    image-rendering: pixelated;
    flex-shrink: 0;
}
.cs-drop-name {
    flex: 1;
    color: rgba(255,255,255,0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.cs-drop-amount {
    color: rgba(255,255,255,0.4);
    font-size: 0.85em;
    min-width: 40px;
    text-align: right;
}
.cs-drop-chance {
    min-width: 80px;
    text-align: right;
    font-weight: 500;
}
.cs-rarity-common { color: rgba(255,255,255,0.6); }
.cs-rarity-uncommon { color: #4ade80; }
.cs-rarity-rare { color: #4a9eff; }
.cs-rarity-epic { color: #a78bfa; }
.cs-rarity-legendary { color: #fbbf24; }
.cs-rarity-always { color: rgba(255,255,255,0.7); }

/* Consumables */
.cs-consumable-row {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    gap: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
}

/* Stat grid — 2 columns inside player/monster cards */
.cs-stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
}
.cs-stat-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    font-size: 0.85em;
    color: rgba(255,255,255,0.7);
    border-bottom: 1px solid rgba(255,255,255,0.05);
    border-right: 1px solid rgba(255,255,255,0.05);
}
.cs-stat-row:nth-child(even) {
    border-right: none;
}
.cs-stat-label {
    white-space: nowrap;
}
.cs-suffix {
    opacity: 0.4;
    font-size: 0.9em;
}

/* Inputs */
.cs-input {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 4px;
    color: #fff;
    padding: 4px 8px;
    font-size: 12px;
    width: 70px;
    text-align: right;
    outline: none;
}
.cs-input:focus {
    border-color: #4a9eff;
}
.cs-select {
    width: auto;
    min-width: 130px;
    text-align: left;
    cursor: pointer;
}
.cs-input[type="number"]::-webkit-inner-spin-button,
.cs-input[type="number"]::-webkit-outer-spin-button {
    opacity: 0.4;
}

.cs-fetched-label {
    font-weight: 400;
    color: #4a9eff;
    font-size: 0.85em;
}
.cs-fetched {
    color: #4a9eff;
    font-size: 11px;
    margin-right: 4px;
}
.cs-fetched:empty {
    display: none;
}

.cs-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.85em;
    color: rgba(255,255,255,0.7);
    border-bottom: 1px solid rgba(255,255,255,0.05);
}

/* Control grid — single column */
.cs-control-grid {
    display: flex;
    flex-direction: column;
}
.cs-control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    font-size: 0.85em;
    color: rgba(255,255,255,0.7);
    border-bottom: 1px solid rgba(255,255,255,0.05);
}

/* Simulate button */
.cs-simulate-btn {
    width: 100%;
    padding: 14px;
    background: #4a9eff;
    color: #fff;
    font-weight: 700;
    font-size: 0.95em;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
    letter-spacing: 0.5px;
}
.cs-simulate-btn:hover { background: #3a8eef; }
.cs-simulate-btn:active { background: #2a7edf; }
.cs-simulate-btn:disabled {
    opacity: 0.6;
    cursor: default;
}

/* Results */
.cs-result-hero {
    text-align: center;
    padding: 24px 16px;
}
.cs-hero-number {
    font-size: 2.4em;
    font-weight: 700;
    color: #4ade80;
    line-height: 1;
}
.cs-hero-label {
    font-size: 0.7em;
    color: rgba(255,255,255,0.4);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-top: 4px;
}

.cs-result-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    font-size: 0.85em;
    color: rgba(255,255,255,0.7);
    border-bottom: 1px solid rgba(255,255,255,0.05);
}
.cs-result-profit {
    font-weight: 600;
    font-size: 0.95em;
}
.cs-positive { color: #4ade80 !important; }
.cs-negative { color: #f87171 !important; }

.cs-divider {
    border-bottom: 1px dashed rgba(255,255,255,0.1);
}

/* Loot breakdown */
.cs-loot-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 16px;
    font-size: 0.8em;
    color: rgba(255,255,255,0.7);
    border-bottom: 1px solid rgba(255,255,255,0.05);
}
.cs-loot-img {
    width: 24px;
    height: 24px;
    image-rendering: pixelated;
    flex-shrink: 0;
}
.cs-loot-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.cs-loot-qty {
    color: rgba(255,255,255,0.4);
    min-width: 60px;
    text-align: right;
}
.cs-loot-gold {
    color: #4a9eff;
    min-width: 80px;
    text-align: right;
    font-weight: 500;
}

/* Time to Level */
.cs-ttl-result {
    text-align: center;
    padding: 16px;
}
.cs-ttl-time {
    font-size: 1.5em;
    font-weight: 700;
    color: #4a9eff;
}
.cs-ttl-label {
    font-size: 0.75em;
    color: rgba(255,255,255,0.4);
    margin-top: 4px;
}

/* XP bar */
.cs-xp-bar {
    height: 6px;
    background: rgba(255,255,255,0.1);
    border-radius: 3px;
    overflow: hidden;
}
.cs-xp-fill {
    background: #4a9eff;
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
}

/* Skill header */
.cs-skill-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
}
.cs-skill-level {
    font-size: 0.85em;
    color: rgba(255,255,255,0.5);
    font-weight: 600;
}
.cs-skill-xp {
    font-size: 0.75em;
    color: rgba(255,255,255,0.4);
}
`;
