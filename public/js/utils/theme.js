/**
 * Theme Management System
 * Handles color modes (light/dark/auto) and visual styles (default/glass/seasonal)
 */

/* global window, document, localStorage, matchMedia */
/* eslint-disable no-console */

/**
 * Theme configuration
 */
const THEME_CONFIG = {
    colorModes: ['light', 'dark', 'auto'],
    visualStyles: ['default', 'glass'],
    // Future: Add seasonal themes like 'halloween', 'winter', 'spring'
    defaultColorMode: 'auto',
    defaultVisualStyle: 'default',
};

/**
 * Load theme settings from localStorage
 * @returns {Object} Theme settings {colorMode, visualStyle}
 */
export function loadThemeSettings() {
    const saved = localStorage.getItem('themeSettings');
    
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse theme settings:', e);
        }
    }
    
    // Migrate old theme setting if exists
    const oldTheme = localStorage.getItem('theme');
    if (oldTheme) {
        const migrated = {
            colorMode: oldTheme === 'auto' ? 'auto' : oldTheme,
            visualStyle: 'default',
        };
        saveThemeSettings(migrated);
        localStorage.removeItem('theme'); // Clean up old format
        return migrated;
    }
    
    // Return defaults
    return {
        colorMode: THEME_CONFIG.defaultColorMode,
        visualStyle: THEME_CONFIG.defaultVisualStyle,
    };
}

/**
 * Save theme settings to localStorage
 * @param {Object} settings - {colorMode, visualStyle}
 */
export function saveThemeSettings(settings) {
    localStorage.setItem('themeSettings', JSON.stringify(settings));
}

/**
 * Get the actual color theme to apply (resolves 'auto' mode)
 * @param {string} colorMode - 'light', 'dark', or 'auto'
 * @returns {string} 'light' or 'dark'
 */
export function resolveColorMode(colorMode) {
    if (colorMode === 'auto') {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? 'dark' : 'light';
    }
    return colorMode;
}

/**
 * Apply theme to the document
 * @param {Object} settings - {colorMode, visualStyle}
 */
export function applyTheme(settings) {
    const html = document.documentElement;
    
    // Apply color mode
    const actualColorMode = resolveColorMode(settings.colorMode);
    html.setAttribute('data-theme', actualColorMode);
    
    // Apply visual style
    html.setAttribute('data-style', settings.visualStyle);
    
    console.log(`Theme applied: ${settings.colorMode} (${actualColorMode}) + ${settings.visualStyle}`);
}

/**
 * Change color mode
 * @param {string} colorMode - 'light', 'dark', or 'auto'
 */
export function changeColorMode(colorMode) {
    const settings = loadThemeSettings();
    settings.colorMode = colorMode;
    saveThemeSettings(settings);
    applyTheme(settings);
    
    // Update UI if select exists
    const select = document.getElementById('colorModeSelect');
    if (select) {
        select.value = colorMode;
    }
}

/**
 * Change visual style
 * @param {string} visualStyle - 'default', 'glass', etc.
 */
export function changeVisualStyle(visualStyle) {
    const settings = loadThemeSettings();
    settings.visualStyle = visualStyle;
    saveThemeSettings(settings);
    applyTheme(settings);
    
    // Update UI if select exists
    const select = document.getElementById('visualStyleSelect');
    if (select) {
        select.value = visualStyle;
    }
}

/**
 * Initialize theme system
 * - Load saved settings
 * - Apply theme
 * - Set up system preference change listener
 */
export function initializeTheme() {
    const settings = loadThemeSettings();
    applyTheme(settings);
    
    // Listen for system theme changes (only if in auto mode)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
        const currentSettings = loadThemeSettings();
        if (currentSettings.colorMode === 'auto') {
            // Re-apply theme to reflect system change
            applyTheme(currentSettings);
        }
    });
    
    console.log('Theme system initialized');
}

/**
 * Get available themes for UI display
 * @returns {Object} Available color modes and visual styles
 */
export function getAvailableThemes() {
    return {
        colorModes: [
            { value: 'light', label: '☀️ Light', description: 'Light color scheme' },
            { value: 'dark', label: '🌙 Dark', description: 'Dark color scheme' },
            { value: 'auto', label: '🔄 Auto', description: 'Follow system preference' },
        ],
        visualStyles: [
            { value: 'default', label: 'Default', description: 'Classic solid design' },
            { value: 'glass', label: 'Glass', description: 'Modern transparent glassmorphism' },
            // Future: Add seasonal themes
            // { value: 'winter', label: '❄️ Winter', description: 'Seasonal winter theme' },
        ],
    };
}

/**
 * Check if a visual style is available
 * @param {string} style - Style to check
 * @returns {boolean}
 */
export function isStyleAvailable(style) {
    // Both default and glass are now available
    return ['default', 'glass'].includes(style);
}

// Backward compatibility exports
export const loadTheme = loadThemeSettings;
export const saveTheme = saveThemeSettings;
