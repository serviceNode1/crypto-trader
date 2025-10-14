/**
 * Settings UI Module
 * Handles settings modal and user preferences
 */

/* global document, window, alert */
import { loadSettings, saveSettings as saveToStorage } from '../utils/storage.js';
import { loadThemeSettings, saveThemeSettings, applyTheme } from '../utils/theme.js';

/**
 * Open settings modal
 */
export function openSettingsModal() {
    applySettings();
    document.getElementById('settingsModal').classList.add('active');
    document.body.classList.add('modal-open');
}

/**
 * Close settings modal
 */
export function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

/**
 * Save settings to localStorage
 */
export function saveSettings() {
    const settings = {
        autoExecute: document.getElementById('autoExecuteToggle').checked,
        confidenceThreshold: parseInt(document.getElementById('confidenceThreshold').value),
        humanApproval: document.getElementById('humanApprovalToggle').checked,
        positionSizingStrategy: document.getElementById('positionSizingStrategy').value,
        maxPositionSize: parseInt(document.getElementById('maxPositionSize').value),
        takeProfitStrategy: document.getElementById('takeProfitStrategy').value,
        autoStopLoss: document.getElementById('autoStopLossToggle').checked,
        coinUniverse: document.getElementById('coinUniverse').value,
        discoveryStrategy: document.getElementById('discoveryStrategy').value,
        analysisFrequency: parseInt(document.getElementById('analysisFrequency').value)
    };
    
    saveToStorage(settings);
    
    // Sync with discovery dropdowns
    const universeSelectEl = document.getElementById('discoveryUniverseSelect');
    const strategySelectEl = document.getElementById('discoveryStrategySelect');
    if (universeSelectEl) universeSelectEl.value = settings.coinUniverse;
    if (strategySelectEl) strategySelectEl.value = settings.discoveryStrategy;
}

/**
 * Apply saved settings to UI
 */
export function applySettings() {
    const settings = loadSettings();
    
    // Trading settings
    document.getElementById('autoExecuteToggle').checked = settings.autoExecute;
    document.getElementById('confidenceThreshold').value = settings.confidenceThreshold;
    document.getElementById('confidenceValue').textContent = settings.confidenceThreshold;
    document.getElementById('humanApprovalToggle').checked = settings.humanApproval;
    document.getElementById('positionSizingStrategy').value = settings.positionSizingStrategy;
    document.getElementById('maxPositionSize').value = settings.maxPositionSize;
    document.getElementById('maxPositionValue').textContent = settings.maxPositionSize;
    document.getElementById('takeProfitStrategy').value = settings.takeProfitStrategy;
    document.getElementById('autoStopLossToggle').checked = settings.autoStopLoss;
    document.getElementById('coinUniverse').value = settings.coinUniverse;
    document.getElementById('discoveryStrategy').value = settings.discoveryStrategy;
    document.getElementById('analysisFrequency').value = settings.analysisFrequency;
    
    // Theme settings
    const themeSettings = loadThemeSettings();
    document.getElementById('colorModeSelect').value = themeSettings.colorMode;
    document.getElementById('visualStyleSelect').value = themeSettings.visualStyle;
}

/**
 * Update confidence value display
 */
export function updateConfidenceValue(value) {
    document.getElementById('confidenceValue').textContent = value;
}

/**
 * Update max position value display
 */
export function updateMaxPositionValue(value) {
    document.getElementById('maxPositionValue').textContent = value;
}

/**
 * Save and close settings
 */
export function saveAndCloseSettings() {
    saveSettings();
    closeSettingsModal();
    alert('✅ Settings saved successfully!');
}

/**
 * Change color mode
 */
export function changeColorMode(colorMode) {
    const settings = loadThemeSettings();
    settings.colorMode = colorMode;
    saveThemeSettings(settings);
    applyTheme(settings);
}

/**
 * Change visual style
 */
export function changeVisualStyle(visualStyle) {
    const settings = loadThemeSettings();
    settings.visualStyle = visualStyle;
    saveThemeSettings(settings);
    applyTheme(settings);
}
