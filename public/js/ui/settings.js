/**
 * Settings UI Module
 * Handles settings management functions
 */

/* global document, alert, confirm */
/* eslint-disable no-console */
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
 * Handle trading mode change from radio buttons
 */
export function handleTradingModeChange(mode) {
    // Map mode to autoExecute and humanApproval settings
    let autoExecute, humanApproval;
    
    switch(mode) {
        case 'manual':
            autoExecute = false;
            humanApproval = true;
            break;
        case 'semi-auto':
            autoExecute = true;
            humanApproval = true;
            break;
        case 'full-auto':
            autoExecute = true;
            humanApproval = false;
            break;
        default:
            autoExecute = true;
            humanApproval = true; // Default to semi-auto
    }
    
    // Save immediately when mode changes
    const settings = loadSettings();
    settings.autoExecute = autoExecute;
    settings.humanApproval = humanApproval;
    saveToStorage(settings);
    
    console.log(`Trading mode changed to: ${mode}`, { autoExecute, humanApproval });
}

/**
 * Save settings to localStorage
 */
export function saveSettings() {
    // Get trading mode from radio buttons
    const tradingModeRadios = document.getElementsByName('tradingMode');
    let tradingMode = 'semi-auto'; // default
    for (const radio of tradingModeRadios) {
        if (radio.checked) {
            tradingMode = radio.value;
            break;
        }
    }
    
    // Convert trading mode to autoExecute/humanApproval
    let autoExecute, humanApproval;
    switch(tradingMode) {
        case 'manual':
            autoExecute = false;
            humanApproval = true;
            break;
        case 'semi-auto':
            autoExecute = true;
            humanApproval = true;
            break;
        case 'full-auto':
            autoExecute = true;
            humanApproval = false;
            break;
        default:
            autoExecute = true;
            humanApproval = true;
    }
    
    const settings = {
        autoExecute: autoExecute,
        confidenceThreshold: parseInt(document.getElementById('confidenceThreshold').value),
        humanApproval: humanApproval,
        positionSizingStrategy: document.getElementById('positionSizingStrategy').value,
        maxPositionSize: parseInt(document.getElementById('maxPositionSize').value),
        takeProfitStrategy: document.getElementById('takeProfitStrategy').value,
        autoStopLoss: document.getElementById('autoStopLossToggle').checked,
        coinUniverse: document.getElementById('coinUniverse').value,
        discoveryStrategy: document.getElementById('discoveryStrategy').value,
        // analysisFrequency removed - fixed at 2 hours in backend
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
    
    // Determine trading mode from autoExecute and humanApproval
    let tradingMode;
    if (!settings.autoExecute) {
        tradingMode = 'manual';
    } else if (settings.autoExecute && settings.humanApproval) {
        tradingMode = 'semi-auto';
    } else if (settings.autoExecute && !settings.humanApproval) {
        tradingMode = 'full-auto';
    } else {
        tradingMode = 'semi-auto'; // Default
    }
    
    // Set the correct radio button
    const tradingModeRadios = document.getElementsByName('tradingMode');
    for (const radio of tradingModeRadios) {
        radio.checked = (radio.value === tradingMode);
    }
    
    // Trading settings
    document.getElementById('confidenceThreshold').value = settings.confidenceThreshold;
    document.getElementById('confidenceValue').textContent = settings.confidenceThreshold;
    document.getElementById('positionSizingStrategy').value = settings.positionSizingStrategy;
    document.getElementById('maxPositionSize').value = settings.maxPositionSize;
    document.getElementById('maxPositionValue').textContent = settings.maxPositionSize;
    document.getElementById('takeProfitStrategy').value = settings.takeProfitStrategy;
    document.getElementById('autoStopLossToggle').checked = settings.autoStopLoss;
    document.getElementById('coinUniverse').value = settings.coinUniverse;
    document.getElementById('discoveryStrategy').value = settings.discoveryStrategy;
    // analysisFrequency removed - fixed at 2 hours in backend
    
    // Debug mode
    const debugMode = settings.debugMode || false;
    document.getElementById('debugModeToggle').checked = debugMode;
    updateDebugModeUI(debugMode);
    
    // Sync discovery section dropdowns with saved settings
    const universeSelectEl = document.getElementById('discoveryUniverseSelect');
    const strategySelectEl = document.getElementById('discoveryStrategySelect');
    if (universeSelectEl) universeSelectEl.value = settings.coinUniverse || 'top25';
    if (strategySelectEl) strategySelectEl.value = settings.discoveryStrategy || 'moderate';
    
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
