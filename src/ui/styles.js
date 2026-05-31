// Inject RiftScript CSS + Font Awesome (for the pet/passive chip icons).
export function initStyles() {
    if (!document.getElementById('rs-fa-css')) {
        const link = document.createElement('link');
        link.id = 'rs-fa-css';
        link.rel = 'stylesheet';
        link.href = 'https://use.fontawesome.com/releases/v6.5.1/css/all.css';
        document.head.appendChild(link);
    }
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
}

const CSS = `
/* Divider \u2014 matches game's .divider style */
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

/* Tabs \u2014 mirrors game's .tabs > button.tab pattern */
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
    flex: 0 0 140px;
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
/* Per-row cost line on consumed items — slightly brighter so the cost
 * stands out next to the muted stored/lasts info. */
.rs-extra.rs-cost {
    color: rgba(248, 113, 113, 0.85);
}

/* Bottleneck ingredient — the consumable that will run out first. Subtle
 * red tint + left-border so it stands out without screaming. */
.rs-bottleneck {
    background: rgba(239, 68, 68, 0.08);
    box-shadow: inset 3px 0 0 #ef4444;
}
/* Small inline tag next to food row names showing the Insatiable Power Tome
 * level + HP/s. Gold when the toggle is on (the rate is being used);
 * neutral grey with 'off' label when detected but the toggle is off. */
.rs-tome-tag {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 6px;
    font-size: 0.7em;
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.4);
    border-radius: 3px;
    letter-spacing: 0.2px;
    font-weight: 600;
}
.rs-tome-tag-off {
    color: rgba(255,255,255,0.4);
    border-color: rgba(255,255,255,0.2);
}
/* Inline tome tier picker on food rows — dropdown + state tag grouped so
 * they stay on the same line as the item name and wrap as a unit when
 * space is tight. */
.rs-tome-pick {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 6px;
    vertical-align: middle;
    white-space: nowrap;
}
.rs-tome-select {
    background: rgba(0,0,0,0.3);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 3px;
    padding: 1px 3px;
    font-size: 0.7em;
    font-weight: 600;
    cursor: pointer;
    height: 18px;
    line-height: 1;
}
.rs-tome-select:hover {
    border-color: rgba(251, 191, 36, 0.5);
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

/* Middle column for inputs — fixed width so inputs always align */
.rs-mid {
    flex: 0 0 170px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
}
.rs-loot-item-name {
    font-size: 0.78em;
    color: rgba(255,255,255,0.45);
    white-space: nowrap;
}
.rs-goal-result {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

/* Goal inputs */
.rs-goal-input,
.rs-loot-goal-input {
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
.rs-goal-input:focus,
.rs-loot-goal-input:focus {
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

/* Nav Button \u2014 matches game button spacing */
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

/* ─── Market Filter Panel ─────────────────────────────── */
.rs-market-panel {
    background: #172033;
    border: 1px solid #2a3a50;
    border-radius: 4px;
    margin-top: var(--gap, 12px);
    margin-bottom: var(--gap, 12px);
    overflow: hidden;
    font-size: 0.9em;
}
.rs-mp-tabs {
    display: flex;
    border-bottom: 1px solid #2a3a50;
}
.rs-mp-tab {
    all: unset;
    flex: 1;
    padding: 10px 0;
    text-align: center;
    color: rgba(255,255,255,0.5);
    font-weight: 600;
    cursor: pointer;
    border-bottom: 2px solid transparent;
}
.rs-mp-tab:hover { color: rgba(255,255,255,0.8); }
.rs-mp-tab.active {
    color: #fff;
    border-bottom-color: #4a9eff;
}
.rs-mp-count {
    margin-left: 4px;
    padding: 1px 6px;
    border-radius: 8px;
    background: rgba(74,158,255,0.2);
    color: #4a9eff;
    font-size: 0.75em;
}
.rs-mp-body {
    padding: 4px 0;
}
.rs-mp-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    gap: 8px;
    color: rgba(255,255,255,0.7);
}
.rs-mp-label {
    font-size: 0.9em;
    color: rgba(255,255,255,0.7);
}
.rs-mp-hint {
    font-size: 0.78em;
    color: rgba(255,255,255,0.4);
}
.rs-mp-divider {
    margin: 4px 14px;
    border-top: 1px dashed rgba(255,255,255,0.08);
}
.rs-mp-select {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 4px;
    color: #fff;
    padding: 4px 8px;
    font-size: 0.85em;
    outline: none;
    cursor: pointer;
}
.rs-mp-select:focus { border-color: #4a9eff; }
.rs-mp-select option {
    background: #1a1a2e;
    color: #fff;
}
.rs-mp-input {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 4px;
    color: #fff;
    padding: 4px 8px;
    font-size: 0.85em;
    width: 80px;
    text-align: right;
    outline: none;
}
.rs-mp-input:focus { border-color: #4a9eff; }
.rs-ratio-chip {
    display: inline-block;
    margin-left: 6px;
    margin-right: 8px;
    padding: 1px 6px;
    border-radius: 8px;
    background: rgba(74,158,255,0.15);
    color: #4a9eff;
    font-size: 0.8em;
    font-weight: 600;
}
.rs-value-chip {
    display: inline-block;
    margin-left: 6px;
    margin-right: 8px;
    padding: 1px 6px;
    border-radius: 8px;
    background: rgba(251,191,36,0.15);
    color: #fbbf24;
    font-size: 0.8em;
    font-weight: 600;
}
.rs-ratio-good {
    background: rgba(74,222,128,0.18) !important;
    color: #4ade80 !important;
}
.rs-ratio-neutral {
    background: rgba(251,146,60,0.18) !important;
    color: #fb923c !important;
}
.rs-ratio-bad {
    background: rgba(248,113,113,0.18) !important;
    color: #f87171 !important;
}
.rs-mp-hint-row {
    padding: 0 14px 8px;
    color: rgba(255,255,255,0.5);
    font-size: 0.78em;
    line-height: 1.4;
    font-style: italic;
}
.rs-mp-select optgroup {
    background: #1a1a2e;
    color: rgba(255,255,255,0.4);
    font-style: normal;
    font-weight: 600;
}
.rs-mp-btn {
    all: unset;
    padding: 5px 12px;
    border-radius: 4px;
    font-size: 0.8em;
    font-weight: 600;
    cursor: pointer;
    background: rgba(74,158,255,0.18);
    color: #4a9eff;
    text-align: center;
}
.rs-mp-btn:hover { background: rgba(74,158,255,0.28); }
.rs-mp-btn:disabled { opacity: 0.5; cursor: default; }
.rs-mp-btn-warning {
    background: rgba(251,191,36,0.18);
    color: #fbbf24;
}
.rs-mp-btn-warning:hover { background: rgba(251,191,36,0.28); }
.rs-mp-btn-danger {
    background: rgba(248,113,113,0.18);
    color: #f87171;
    padding: 4px 8px;
    min-width: 20px;
}
.rs-mp-btn-danger:hover { background: rgba(248,113,113,0.28); }
.rs-mp-empty {
    padding: 14px;
    color: rgba(255,255,255,0.4);
    font-size: 0.85em;
    text-align: center;
    font-style: italic;
}
.rs-mp-saved-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 14px;
    border-top: 2px solid transparent;
}
.rs-mp-saved-row .rs-mp-apply {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.rs-mp-drag-handle {
    cursor: grab;
    color: rgba(255,255,255,0.3);
    padding: 0 4px;
    user-select: none;
    font-size: 1em;
    line-height: 1;
}
.rs-mp-drag-handle:active {
    cursor: grabbing;
}
.rs-mp-dragging {
    opacity: 0.4;
}
.rs-mp-drag-over {
    border-top-color: #4a9eff !important;
}

/* ─── Market competition dots ─────────────────────────── */
.rs-market-competition {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    margin-right: 6px;
    display: inline-block;
    vertical-align: middle;
}
.rs-market-competition-warning { background-color: #fbbf24; }
.rs-market-competition-danger  { background-color: #f87171; }

/* ─── Price buttons in listing modal ──────────────────── */
.rs-price-btns {
    display: flex;
    gap: 6px;
    margin: 6px 0;
}
.rs-price-btn {
    all: unset;
    padding: 4px 10px;
    background: rgba(74,158,255,0.18);
    color: #4a9eff;
    border-radius: 4px;
    font-size: 0.85em;
    font-weight: 600;
    cursor: pointer;
}
.rs-price-btn:hover { background: rgba(74,158,255,0.28); }

/* ─── Target Amount button ─────────────────────────────── */
.rs-target-btn {
    background-color: #fbbf24 !important;
    margin-right: 8px;
}
.rs-target-btn:disabled { opacity: 0.5; cursor: default; }

/* ─── Listing limit warning ───────────────────────────── */
.rs-listing-limit-warning {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    margin: 8px 0;
    background: rgba(251,191,36,0.12);
    border: 1px solid rgba(251,191,36,0.3);
    border-radius: 6px;
    color: #fbbf24;
    font-size: 0.85em;
    font-weight: 500;
}
.rs-listing-limit-icon {
    font-size: 1.1em;
}

/* ─── Pet panel + duplicate highlight ─────────────────── */
.rs-pet-panel {
    margin: var(--gap, 12px) 0;
}
.rs-pet-panel-card {
    background: #172033;
    border: 1px solid #2a3a50;
    border-radius: 4px;
    overflow: hidden;
}
.rs-pet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    color: #fff;
    font-weight: 600;
    font-size: 0.9em;
    border-bottom: 1px solid #2a3a50;
}
.rs-pet-tabs {
    display: flex;
    align-items: center;
    border-bottom: 1px solid #2a3a50;
}
.rs-pet-tab {
    all: unset;
    flex: 1;
    padding: 10px 0;
    text-align: center;
    color: rgba(255,255,255,0.5);
    font-weight: 600;
    font-size: 0.9em;
    cursor: pointer;
    border-bottom: 2px solid transparent;
}
.rs-pet-tab:hover { color: rgba(255,255,255,0.8); }
.rs-pet-tab.active {
    color: #fff;
    border-bottom-color: #4a9eff;
}
.rs-pet-hint-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 14px 4px;
}
.rs-pet-hint-row .rs-pet-hint {
    padding: 0;
    flex: 1;
}
.rs-pet-hint-row .rs-pet-cache {
    font-size: 0.78em;
    color: rgba(74,158,255,0.85);
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
    padding-top: 1px;
}
.rs-exp-team {
    padding: 8px 14px;
    color: rgba(255,255,255,0.7);
    font-size: 0.85em;
    border-bottom: 1px solid rgba(255,255,255,0.05);
}
.rs-exp-team strong {
    color: #fff;
}
.rs-pet-cache {
    font-size: 0.78em;
    color: rgba(74,158,255,0.85);
    font-weight: 500;
}
.rs-pet-hint {
    padding: 6px 14px 4px;
    font-size: 0.75em;
    color: rgba(255,255,255,0.45);
    font-style: italic;
    line-height: 1.4;
}
.rs-pet-select {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 4px;
    color: #fff;
    padding: 4px 8px;
    font-size: 0.85em;
    outline: none;
    cursor: pointer;
}
.rs-pet-select option {
    background: #1a1a2e;
    color: #fff;
}
/* Pet stat chips — match the game's tag styling exactly so they sit
   inline naturally next to Ore/Fish/% tags. Reference:
   border-radius:4px, padding:2px 6px, border:1px solid #263849,
   font-size:14px, color:#aaa. */
.rs-pet-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: 4px;
    padding: 2px 6px;
    border: 1px solid #263849;
    background: transparent;
    font-size: 14px;
    color: #aaa;
    margin-left: 4px;
    margin-top: 2px;
    line-height: 1.4;
    white-space: nowrap;
}
.rs-pet-chip > i {
    font-size: 0.85em;
    opacity: 0.85;
}
/* Placeholder for pets with only one ability — takes the same space as a
 * normal chip so H/A/D + passive columns line up across every row. */
.rs-pet-chip-spacer {
    visibility: hidden;
}

/* Per-icon colors — dampened palette (Tailwind 600-800 range + lower opacity)
 * so each type is recognizable without screaming for attention. Gated behind
 * the rs-pet-icon-colors-on class on taming-page so users can toggle the
 * coloring off and fall back to default-grey icons. Border colors on
 * best/perfect/tier-max chips stay on regardless. */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-heart             { color: #dc2626; } /* Health */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-burst             { color: #ea580c; } /* Attack */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-shield-halved     { color: #2563eb; } /* Defense */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-hand-fist         { color: #b45309; } /* Melee */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-crosshairs        { color: #ca8a04; } /* Ranged */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-wand-magic-sparkles { color: #7c3aed; } /* Magic */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-sack-dollar       { color: #eab308; } /* Loot Find — gold */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-egg               { color: #f3f4f6; } /* Egg Find — off-white */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-bowl-food         { color: #991b1b; } /* Hunger */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-tree              { color: #15803d; } /* Wood */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-bone              { color: #d1d5db; } /* Bones */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-fish              { color: #0891b2; } /* Fish */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-spa               { color: #db2777; } /* Flowers */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-mountain          { color: #6b7280; } /* Ore */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-carrot            { color: #65a30d; } /* Veges */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-gem               { color: #14b8a6; } /* Crystals */
taming-page.rs-pet-icon-colors-on .rs-pet-chip > i.fa-book              { color: #92400e; } /* Logbooks */

/* When the chips toggle is on, hide the game's native .tags content on
 * every pet row so only our icon chips show. The .tags container itself
 * stays in the layout — only its children are hidden — to avoid breaking
 * the flex spacing the game depends on. */
taming-page.rs-pet-chips-on button.row .tags > * {
    display: none !important;
}

/* Pet detail / hatchling modal outline. Applied to whichever element holds
 * the modal — modal-component or .modal — so we use a generic selector. */
.rs-pet-modal-best {
    outline: 2px solid #4ade80;
    box-shadow: 0 0 16px rgba(74, 222, 128, 0.35);
    border-radius: 4px;
}
.rs-pet-modal-perfect {
    outline: 2px solid #fbbf24;
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.45);
    border-radius: 4px;
}

/* Per-row highlights inside the modal (Health / Attack / Defense / Total /
 * passive rows). Uses a subtle background tint + accent border so the row
 * still reads cleanly. */
.rs-pet-modal-row-best {
    background: rgba(74, 222, 128, 0.08) !important;
    box-shadow: inset 3px 0 0 #4ade80;
}
.rs-pet-modal-row-perfect {
    background: rgba(251, 191, 36, 0.12) !important;
    box-shadow: inset 3px 0 0 #fbbf24;
}

/* Breeding info banner inside the pet detail / hatchling modal — tells the
 * user whether the family already has 4-passive pets so they can judge
 * whether a fresh hatch is worth keeping as a breeder. */
.rs-pet-modal-breeding-info {
    margin: 6px 12px 4px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.75);
    border-left: 3px solid rgba(255, 255, 255, 0.25);
    border-radius: 3px;
    font-size: 0.85em;
    line-height: 1.4;
}
.rs-pet-modal-breeding-info-gold {
    background: rgba(251, 191, 36, 0.12);
    color: #fbbf24;
    border-left-color: #fbbf24;
}
.rs-pet-modal-breeding-info-green {
    background: rgba(74, 222, 128, 0.10);
    color: #4ade80;
    border-left-color: #4ade80;
}
/* Best-in-family stat — green outline */
.rs-pet-chip-best {
    border-color: #4ade80 !important;
}
/* Perfect — gold outline */
.rs-pet-chip-best-perfect {
    border-color: #fbbf24 !important;
}
.rs-pet-chip-passive {
    color: rgba(255,255,255,0.55);
    border-color: rgba(255,255,255,0.1);
}
/* Max-tier passive (level 4) — gold outline */
.rs-pet-chip-tier-max {
    border-color: #fbbf24 !important;
}
/* Negative passives (Hunger) — always red regardless of tier */
.rs-pet-chip-negative {
    color: #f87171 !important;
    border-color: #f87171 !important;
}
/* Second row container for our added chips (H/A/D + passives), sits below
   the game's .tags row. */
.rs-pet-additions {
    margin-top: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.rs-pet-additions .rs-pet-chip {
    margin-left: 0;
    margin-top: 0;
}
.rs-pet-best-star {
    position: absolute;
    top: -4px;
    right: -4px;
    color: #fbbf24;
    font-size: 1.1em;
    text-shadow: 0 0 4px rgba(251,191,36,0.8);
    pointer-events: none;
}
.rs-pet-release {
    position: absolute;
    bottom: -4px;
    right: -4px;
    color: #f87171;
    font-size: 1.2em;
    font-weight: 800;
    text-shadow: 0 0 4px rgba(248,113,113,0.9);
    pointer-events: none;
}
.rs-pet-release-row {
    opacity: 0.6;
}
.rs-pet-release-row .image {
    position: relative;
}
.rs-pet-best .image {
    position: relative;
}
.rs-pet-legend {
    border-top: 1px dashed rgba(255,255,255,0.08);
    margin-top: 4px;
    padding: 8px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.rs-pet-legend-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75em;
    color: rgba(255,255,255,0.55);
    line-height: 1.4;
}
.rs-pet-legend-row > span:last-child {
    flex: 1;
    min-width: 0;
}
.rs-pet-legend-row .rs-pet-chip {
    margin-left: 0;
    flex-shrink: 0;
}
.rs-pet-legend-row .rs-pet-legend-star,
.rs-pet-legend-row .rs-pet-legend-dup {
    flex-shrink: 0;
}
.rs-pet-legend-star {
    color: #fbbf24;
    font-size: 1em;
    text-shadow: 0 0 4px rgba(251,191,36,0.6);
}
.rs-pet-legend-dup {
    display: inline-block;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    box-shadow: inset 0 0 4px 0 rgba(251,191,36,0.7);
    background: rgba(251,191,36,0.08);
}
.rs-pet-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
}
.rs-pet-label {
    font-size: 0.9em;
    color: rgba(255,255,255,0.75);
}
.rs-pet-family {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 4px;
    color: #fff;
    padding: 4px 8px;
    font-size: 0.85em;
    outline: none;
    cursor: pointer;
}
.rs-pet-duplicate {
    box-shadow: inset 0 0 8px 0 rgba(251,191,36,0.6) !important;
}

/* ─── Expedition calculator panel ─────────────────────── */
.rs-exp-panel {
    background: #172033;
    border: 1px solid #2a3a50;
    border-radius: 4px;
    margin-top: var(--gap, 12px);
    margin-bottom: var(--gap, 12px);
    overflow: hidden;
}
.rs-exp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    color: #fff;
    font-weight: 600;
    font-size: 0.9em;
    border-bottom: 1px solid #2a3a50;
}
.rs-exp-team-stats {
    font-size: 0.78em;
    color: rgba(74,158,255,0.85);
    font-weight: 500;
}
.rs-exp-empty {
    padding: 14px;
    color: rgba(255,255,255,0.4);
    font-size: 0.85em;
    text-align: center;
    font-style: italic;
}
.rs-exp-list {
    display: flex;
    flex-direction: column;
}
.rs-exp-row {
    display: grid;
    grid-template-columns: 32px 1fr auto auto;
    gap: 10px;
    align-items: center;
    padding: 6px 14px;
    border-top: 1px solid rgba(255,255,255,0.04);
    font-size: 0.85em;
}
.rs-exp-row:first-child { border-top: none; }
.rs-exp-tier {
    font-weight: 700;
    color: rgba(255,255,255,0.55);
}
.rs-exp-name {
    color: rgba(255,255,255,0.85);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.rs-exp-rot {
    font-size: 0.75em;
    color: rgba(255,255,255,0.45);
    text-transform: capitalize;
    padding: 1px 6px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 4px;
}
.rs-exp-chance {
    font-weight: 700;
    min-width: 56px;
    text-align: right;
}
.rs-exp-good .rs-exp-chance { color: #4ade80; }
.rs-exp-mid  .rs-exp-chance { color: #fbbf24; }
.rs-exp-bad  .rs-exp-chance { color: #f87171; }

.rs-exp-detail-block {
    border-top: 1px solid rgba(255,255,255,0.05);
    margin-top: 4px;
}
.rs-exp-detail-row {
    display: flex;
    justify-content: space-between;
    padding: 5px 14px;
    font-size: 0.85em;
    color: rgba(255,255,255,0.7);
    border-bottom: 1px solid rgba(255,255,255,0.03);
}
.rs-exp-detail-label { color: rgba(255,255,255,0.55); }
.rs-exp-detail-value { color: #fff; font-weight: 500; }
.rs-exp-chance-good { color: #4ade80 !important; }
.rs-exp-chance-mid  { color: #fbbf24 !important; }
.rs-exp-chance-bad  { color: #f87171 !important; }
.rs-pet-section-header {
    padding: 10px 14px 4px;
    font-size: 0.75em;
    font-weight: 600;
    color: rgba(255,255,255,0.45);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-top: 1px solid rgba(255,255,255,0.05);
    margin-top: 4px;
}
.rs-exp-drop-list {
    padding-bottom: 4px;
}

/* ─── Guild Quests panel ──────────────────────────────── */
.rs-gq-panel {
    background: #172033;
    border: 1px solid #2a3a50;
    border-radius: 4px;
    margin-top: var(--gap, 12px);
    margin-bottom: var(--gap, 12px);
    overflow: hidden;
    font-size: 0.9em;
}
.rs-gq-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    color: #fff;
    font-weight: 600;
    border-bottom: 1px solid #2a3a50;
}
.rs-gq-count {
    font-size: 0.85em;
    color: rgba(255,255,255,0.5);
    font-weight: 500;
}
.rs-gq-timer {
    font-size: 0.78em;
    color: #fbbf24;
    font-weight: 500;
}
.rs-gq-empty {
    padding: 14px;
    color: rgba(255,255,255,0.4);
    font-size: 0.85em;
    text-align: center;
    font-style: italic;
}
.rs-gq-list {
    display: flex;
    flex-direction: column;
}
.rs-gq-quest {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    cursor: pointer;
    border-top: 1px solid rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.85);
    font-size: 0.9em;
}
.rs-gq-quest:first-child { border-top: none; }
.rs-gq-quest:hover {
    background: rgba(74,158,255,0.08);
    color: #fff;
}
.rs-gq-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 8px;
}
.rs-gq-need {
    font-size: 0.8em;
    color: #fbbf24;
    font-weight: 500;
    flex-shrink: 0;
}

/* Rift member marker on market listings — just a star, no row highlight */
.rs-rift-badge {
    display: inline-block;
    color: #fbbf24;
    font-size: 1em;
    margin-left: 8px;
    margin-right: 4px;
    text-shadow: 0 0 4px rgba(251,191,36,0.6);
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

/* \u2500\u2500\u2500 Combat Simulator Page \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

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
    max-height: none;
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

/* Stat grid \u2014 2 columns inside player/monster cards */
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

/* Control grid \u2014 single column */
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

/* \u2500\u2500\u2500 Combat Simulator Expanded Sections \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

/* Modifier Breakdown Card */
.cs-breakdown { padding: 12px 16px; }
.cs-breakdown-total { display: flex; justify-content: space-between; font-weight: 600; font-size: 0.95em; color: #fff; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 8px; }
.cs-breakdown-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 0.8em; color: rgba(255,255,255,0.5); }
.cs-breakdown-row span:last-child { color: rgba(255,255,255,0.7); }

/* Section Dividers within cards */
.cs-section-label { padding: 10px 16px 4px; font-size: 0.75em; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.3); font-weight: 600; }

/* Toggle rows (tomes, relics, guild event, etc.) */
.cs-toggle-row { display: flex; align-items: center; padding: 6px 16px; font-size: 0.85em; color: rgba(255,255,255,0.7); border-bottom: 1px solid rgba(255,255,255,0.05); }
.cs-toggle-row > span:first-child { flex: 1; }
.cs-toggle-row label { display: flex; align-items: center; cursor: pointer; margin-right: 10px; }
.cs-toggle-row input[type="checkbox"] { accent-color: #4a9eff; width: 16px; height: 16px; }

/* Consumable cost summary */
.cs-cost-row { display: flex; justify-content: space-between; padding: 6px 16px; font-size: 0.85em; color: rgba(255,255,255,0.5); border-bottom: 1px solid rgba(255,255,255,0.05); }
.cs-cost-row span:last-child { color: #f87171; }
.cs-cost-total { display: flex; justify-content: space-between; padding: 8px 16px; font-size: 0.9em; font-weight: 600; color: #fff; border-top: 1px solid rgba(255,255,255,0.1); }
.cs-cost-total span:last-child { color: #f87171; }

/* Guild settings inputs (compact grid) */
.cs-guild-grid { display: grid; grid-template-columns: 1fr 1fr; }
.cs-guild-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 16px; font-size: 0.85em; color: rgba(255,255,255,0.7); border-bottom: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.05); }
.cs-guild-row:nth-child(even) { border-right: none; }

/* Potion/Brew selector row */
.cs-consumable-select-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; font-size: 0.85em; color: rgba(255,255,255,0.7); border-bottom: 1px solid rgba(255,255,255,0.05); }

/* Info tooltip / helper text */
.cs-info-text { padding: 8px 16px; font-size: 0.75em; color: rgba(255,255,255,0.3); line-height: 1.4; }

/* Compact input (smaller than cs-input, for guild levels etc.) */
.cs-input-sm { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: #fff; padding: 3px 6px; font-size: 11px; width: 50px; text-align: right; outline: none; }
.cs-input-sm:focus { border-color: #4a9eff; }

/* \u2500\u2500\u2500 Equipment Selector Card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.cs-equip-card {
    background: #172033;
    border-radius: 6px;
    overflow: hidden;
}

.cs-equip-slot {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 16px;
    font-size: 0.85em;
    color: rgba(255,255,255,0.7);
    border-bottom: 1px solid rgba(255,255,255,0.05);
}
.cs-equip-slot-label {
    width: 60px;
    flex-shrink: 0;
    font-size: 0.75em;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255,255,255,0.35);
    font-weight: 600;
}
.cs-equip-slot-img {
    width: 24px;
    height: 24px;
    image-rendering: pixelated;
    flex-shrink: 0;
    border-radius: 3px;
    background: rgba(255,255,255,0.04);
}
.cs-equip-slot-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #fff;
    font-size: 0.9em;
}
.cs-equip-slot-empty {
    flex: 1;
    color: rgba(255,255,255,0.25);
    font-style: italic;
    font-size: 0.85em;
}
.cs-equip-select {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 4px;
    color: #fff;
    padding: 3px 6px;
    font-size: 11px;
    max-width: 180px;
    min-width: 120px;
    outline: none;
    cursor: pointer;
}
.cs-equip-select:focus {
    border-color: #4a9eff;
}
.cs-equip-select option {
    background: #1a1a2e;
    color: #fff;
}
.cs-equip-select optgroup {
    background: #1a1a2e;
    color: rgba(255,255,255,0.5);
    font-style: normal;
    font-weight: 600;
}

.cs-equip-summary {
    padding: 10px 16px;
    border-top: 1px solid rgba(255,255,255,0.08);
}
.cs-equip-summary-title {
    font-size: 0.75em;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255,255,255,0.35);
    font-weight: 600;
    margin-bottom: 6px;
}
.cs-equip-summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 12px;
}
.cs-equip-stat {
    display: flex;
    justify-content: space-between;
    font-size: 0.8em;
    padding: 2px 0;
}
.cs-equip-stat-label {
    color: rgba(255,255,255,0.5);
}
.cs-equip-stat-value {
    color: #4ade80;
    font-weight: 500;
}
.cs-equip-stat-value.zero {
    color: rgba(255,255,255,0.2);
}

/* Setup Tabs (Equipment/Modifiers/Consumables) */
/* Equipment grid \u2014 2 columns like the game */
.cs-equip-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
}
.cs-equip-grid .cs-equip-slot {
    border-right: 1px solid rgba(255,255,255,0.05);
}
.cs-equip-grid .cs-equip-slot:nth-child(even) {
    border-right: none;
}

.cs-setup-tabs {
    display: flex;
    border-bottom: 1px solid #2a3a50;
}
.cs-setup-tab {
    flex: 1;
    text-align: center;
    padding: 12px;
    cursor: pointer;
    color: rgba(255,255,255,0.5);
    transition: color 0.15s, border-color 0.15s, background 0.15s;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 0.9em;
    font-weight: 600;
    background: none;
}
.cs-setup-tab:hover {
    color: rgba(255,255,255,0.7);
}
.cs-setup-tab.active {
    color: #fff;
    border-bottom-color: #4a9eff;
    background: rgba(74,158,255,0.05);
}
.cs-tab-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.cs-credit {
    text-align: center;
    padding: 12px 24px 24px;
    font-size: 0.75em;
    color: rgba(255,255,255,0.3);
    letter-spacing: 0.3px;
}
`;
