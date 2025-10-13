/**
 * LocalStorage Utilities
 * Helper functions for browser localStorage operations
 * 
 * NOTE: These can be used alongside existing localStorage code in index.html
 * Gradually migrate to using these centralized functions
 */

/* global localStorage */
/* eslint-disable no-console */
import { DEFAULT_SETTINGS } from '../config.js';

/**
 * Load settings from localStorage
 */
export function loadSettings() {
    const saved = localStorage.getItem('tradingSettings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings) {
    localStorage.setItem('tradingSettings', JSON.stringify(settings));
    console.log('Settings saved:', settings);
}

/**
 * Load theme preference from localStorage
 */
export function loadTheme() {
    return localStorage.getItem('theme') || 'auto';
}

/**
 * Save theme preference to localStorage
 */
export function saveTheme(theme) {
    localStorage.setItem('theme', theme);
}

/**
 * Load discovery settings from localStorage
 */
export function loadDiscoverySettings() {
    const settings = loadSettings();
    return {
        universe: settings.coinUniverse || 'top25',
        strategy: settings.discoveryStrategy || 'moderate',
    };
}

/**
 * Save cached discoveries to localStorage
 */
export function saveCachedDiscoveries(discoveries, metadata) {
    const cacheData = {
        discoveries,
        metadata,
        timestamp: new Date().toISOString(),
    };
    localStorage.setItem('cachedDiscoveries', JSON.stringify(cacheData));
}

/**
 * Load cached discoveries from localStorage
 */
export function loadCachedDiscoveries() {
    const cached = localStorage.getItem('cachedDiscoveries');
    return cached ? JSON.parse(cached) : null;
}

/**
 * Clear cached discoveries
 */
export function clearCachedDiscoveries() {
    localStorage.removeItem('cachedDiscoveries');
}
