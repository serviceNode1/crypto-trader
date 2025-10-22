/**
 * Settings UI Module
 * Handles settings management functions
 */

/* global document */
/* eslint-disable no-console */
import { loadSettings, saveSettings as saveToStorage } from '../utils/storage.js';
import { loadThemeSettings, saveThemeSettings, applyTheme } from '../utils/theme.js';
import { showError, showSuccess, showConfirm } from '../utils/modal.js';

/**
 * Save settings to backend API
 */
async function saveSettingsToBackend(settings) {
    try {
        console.log('📡 [SETTINGS] Making API call to /api/settings...');
        
        // Prepare settings for backend (including UI preferences now)
        const backendSettings = {
            autoExecute: settings.autoExecute,
            confidenceThreshold: settings.confidenceThreshold,
            humanApproval: settings.humanApproval,
            positionSizingStrategy: settings.positionSizingStrategy,
            maxPositionSize: settings.maxPositionSize,
            takeProfitStrategy: settings.takeProfitStrategy,
            autoStopLoss: settings.autoStopLoss,
            coinUniverse: settings.coinUniverse,
            discoveryStrategy: settings.discoveryStrategy,
            colorMode: settings.colorMode,
            visualStyle: settings.visualStyle,
            // Note: debugMode remains frontend-only
        };
        
        console.log('📡 [SETTINGS] Payload being sent:', backendSettings);
        
        const response = await auth.fetch('/api/settings', {
            method: 'PUT',
            body: JSON.stringify(backendSettings),
        });
        
        if (!response) {
            throw new Error('No response from server');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ [SETTINGS] Server rejected settings:', data);
            throw new Error(data.message || data.error || 'Failed to save settings');
        }
        
        console.log('✅ [SETTINGS] Settings saved successfully to backend!');
        console.log('✅ [SETTINGS] Updated settings from server:', data);
        console.log('✅ [SETTINGS] User ID:', data.userId);
        
        return data;
    } catch (error) {
        console.error('❌ [SETTINGS] Error saving settings to backend:', error);
        await showError('Settings Error', `Failed to save settings: ${error.message}`);
        throw error;
    }
}

/**
 * Load settings from backend API
 */
async function loadSettingsFromBackend() {
    try {
        console.log('📡 [SETTINGS] Loading settings from backend API...');
        
        const response = await auth.fetch('/api/settings', {
            method: 'GET',
        });
        
        if (!response) {
            throw new Error('No response from server');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ [SETTINGS] Failed to load settings:', data);
            throw new Error(data.error || 'Failed to load settings');
        }
        
        console.log('✅ [SETTINGS] Settings loaded from backend:', data);
        console.log('✅ [SETTINGS] User ID:', data.userId);
        
        // Merge with localStorage settings (ONLY for frontend-only settings like debugMode)
        const localSettings = loadSettings();
        const mergedSettings = {
            ...data,
            debugMode: localSettings.debugMode || false,  // Only debugMode is frontend-only now
        };
        
        // Save merged settings to localStorage
        saveToStorage(mergedSettings);
        
        return mergedSettings;
    } catch (error) {
        console.error('❌ [SETTINGS] Error loading settings from backend:', error);
        // Fall back to localStorage
        return loadSettings();
    }
}

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
        colorMode: document.getElementById('colorModeSelect').value,
        visualStyle: document.getElementById('visualStyleSelect').value,
        // analysisFrequency removed - fixed at 2 hours in backend
        debugMode: document.getElementById('debugModeToggle').checked
    };
    
    console.log('🔧 [SETTINGS] Saving settings to localStorage:', settings);
    saveToStorage(settings);
    
    // Save to backend API
    console.log('🔧 [SETTINGS] Sending settings to backend API...');
    saveSettingsToBackend(settings).catch(error => {
        console.error('❌ [SETTINGS] Failed to save settings to backend:', error);
    });
    
    // Sync with discovery dropdowns
    const universeSelectEl = document.getElementById('discoveryUniverseSelect');
    const strategySelectEl = document.getElementById('discoveryStrategySelect');
    if (universeSelectEl) universeSelectEl.value = settings.coinUniverse;
    if (strategySelectEl) strategySelectEl.value = settings.discoveryStrategy;
}

/**
 * Apply saved settings to UI
 */
export async function applySettings() {
    console.log('🔧 [SETTINGS] Loading settings for UI...');
    
    // Load from backend first, fall back to localStorage
    const settings = await loadSettingsFromBackend();
    
    console.log('🔧 [SETTINGS] Applying settings to UI:', settings);
    
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
    if (universeSelectEl) universeSelectEl.value = settings.coinUniverse || 'top50';
    if (strategySelectEl) strategySelectEl.value = settings.discoveryStrategy || 'moderate';
    
    // Theme settings (now from backend)
    document.getElementById('colorModeSelect').value = settings.colorMode || 'auto';
    document.getElementById('visualStyleSelect').value = settings.visualStyle || 'default';
    
    // Apply theme immediately
    if (settings.colorMode && settings.visualStyle) {
        applyTheme({ colorMode: settings.colorMode, visualStyle: settings.visualStyle });
    }
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
export async function saveAndCloseSettings() {
    saveSettings();
    closeSettingsModal();
    await showSuccess('Settings Saved', 'Your settings have been saved successfully!');
}

/**
 * Change color mode
 */
export async function changeColorMode(colorMode) {
    console.log('🎨 [THEME] Changing color mode to:', colorMode);
    
    // Apply immediately for instant feedback
    applyTheme({ colorMode, visualStyle: document.getElementById('visualStyleSelect')?.value || 'default' });
    
    // Save to backend
    try {
        await saveSettingsToBackend({ colorMode });
        console.log('✅ [THEME] Color mode saved to backend');
    } catch (error) {
        console.error('❌ [THEME] Failed to save color mode:', error);
    }
}

/**
 * Change visual style
 */
export async function changeVisualStyle(visualStyle) {
    console.log('🎨 [THEME] Changing visual style to:', visualStyle);
    
    // Apply immediately for instant feedback
    applyTheme({ colorMode: document.getElementById('colorModeSelect')?.value || 'auto', visualStyle });
    
    // Save to backend
    try {
        await saveSettingsToBackend({ visualStyle });
        console.log('✅ [THEME] Visual style saved to backend');
    } catch (error) {
        console.error('❌ [THEME] Failed to save visual style:', error);
    }
}

/**
 * Toggle debug mode with confirmation
 */
export async function toggleDebugMode(isEnabled) {
    if (isEnabled) {
        const confirmed = await showConfirm(
            'Enable Debug Mode?',
            `<p style="margin-bottom: 12px;">This will use <strong>EXTREMELY LIBERAL</strong> discovery filters.</p>
            <p style="margin-bottom: 12px;">The system will find buy signals even in terrible market conditions.</p>
            <p style="margin-bottom: 12px;">This is useful for testing the system and finding edge cases.</p>
            <p style="color: #ef4444; font-weight: 600;">⚠️ DO NOT use this mode with real money!</p>`,
            {
                icon: '⚠️',
                confirmText: 'Enable Debug Mode',
                cancelText: 'Cancel',
                confirmColor: '#ef4444'
            }
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
