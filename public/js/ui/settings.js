/**
 * Settings UI Module
 * Handles settings management functions
 */

/* global document, alert, confirm, console */
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
        analysisFrequency: parseInt(document.getElementById('analysisFrequency').value),
        debugMode: document.getElementById('debugModeToggle').checked
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
    
    // Debug mode
    const debugMode = settings.debugMode || false;
    document.getElementById('debugModeToggle').checked = debugMode;
    updateDebugModeUI(debugMode);
    
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

/**
 * Toggle debug mode with confirmation
 */
export function toggleDebugMode(isEnabled) {
    if (isEnabled) {
        const confirmed = confirm(
            '⚠️ Enable Debug Mode?\n\n' +
            'This will use EXTREMELY LIBERAL discovery filters.\n' +
            'The system will find buy signals even in terrible market conditions.\n\n' +
            '✅ Use this ONLY for testing automatic trading logic.\n' +
            '❌ Do NOT use for making real investment decisions.\n\n' +
            'Debug mode uses a 40/100 threshold instead of normal 60-70/100.\n\n' +
            'Continue?'
        );
        
        if (!confirmed) {
            document.getElementById('debugModeToggle').checked = false;
            return;
        }
        
        console.warn('⚠️  DEBUG MODE ENABLED - Liberal discovery filters active');
    } else {
        console.info('✅ Debug Mode disabled - Normal discovery filters restored');
    }
    
    updateDebugModeUI(isEnabled);
    saveSettings();
}

/**
 * Update debug mode UI indicators
 */
function updateDebugModeUI(isDebugMode) {
    const banner = document.getElementById('debugModeBanner');
    const warning = document.getElementById('debugModeWarning');
    
    if (isDebugMode) {
        banner.style.display = 'block';
        warning.style.display = 'block';
    } else {
        banner.style.display = 'none';
        warning.style.display = 'none';
    }
}
