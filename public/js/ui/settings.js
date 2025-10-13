/**
 * Settings UI Module
 * Handles settings modal and user preferences
 */

/* global document, window, alert */
import { loadSettings, saveSettings as saveToStorage } from '../utils/storage.js';
import { saveTheme } from '../utils/storage.js';

/**
 * Open settings modal
 */
export function openSettingsModal() {
    applySettings();
    document.getElementById('settingsModal').classList.add('active');
}

/**
 * Close settings modal
 */
export function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
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
 * Change theme
 */
export function changeTheme(theme) {
    saveTheme(theme);
    // Apply theme is in main.js
    window.location.reload(); // Reload to apply theme
}
