/**
 * Application Configuration
 * Central place for all app constants and settings
 */

/* global window */
export const API_BASE = window.location.origin + '/api';

export const REFRESH_INTERVALS = {
    PORTFOLIO: 120000,      // 2 minutes
    TIME_DISPLAY: 60000,    // 1 minute
};

export const PAGINATION = {
    TRADES_PER_PAGE: 10,
};

export const DEFAULT_SETTINGS = {
    autoExecute: false,
    confidenceThreshold: 75,
    humanApproval: true,
    positionSizingStrategy: 'equal',
    maxPositionSize: 5,
    takeProfitStrategy: 'full',
    autoStopLoss: true,
    coinUniverse: 'top25',
    discoveryStrategy: 'moderate',
    analysisFrequency: 4,
};

export const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto',
};
