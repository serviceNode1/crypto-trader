/**
 * Main Application Entry Point
 * Loads and initializes all UI modules
 */

/* global document, window */
/* eslint-disable no-console */
import { REFRESH_INTERVALS } from './config.js';
import { loadTheme, saveTheme } from './utils/storage.js';
import { loadPortfolio, loadPerformance, loadRisk, loadPortfolioChart } from './ui/portfolio.js';
import { loadTrades } from './ui/trades.js';
import { loadRecommendations, refreshAnalysisTimeDisplay } from './ui/recommendations.js';
import { toggleCardCollapse, initializeCardStates } from './ui/cards.js';
import { openInfoModal, closeInfoModal, switchTab } from './ui/modals.js';
import { 
    openSettingsModal, 
    closeSettingsModal, 
    saveSettings,
    applySettings,
    updateConfidenceValue,
    updateMaxPositionValue,
    changeTheme
} from './ui/settings.js';
import { analyzeCrypto, selectCrypto, closeAnalysis } from './ui/analysis.js';
import { 
    runDiscovery, 
    loadCachedDiscoveries, 
    loadDiscoverySettings,
    saveDiscoverySettings,
    refreshDiscoveryTimeDisplay,
    toggleAnalysisLog,
    analyzeDiscovered 
} from './ui/discovery.js';
import { loadMarketContext, runAIAnalysisNow } from './ui/market-context.js';
import { 
    toggleAdvancedOptions,
    updateQuantityPlaceholder,
    previewTrade,
    executeTrade,
    sellPosition,
    handleConfirmClick,
    openPositionDetails,
    openProtectionManager,
    saveProtection,
    getSettings
} from './ui/trading.js';
import { formatPrice, formatNumber, renderSparkline, getScoreColor } from './utils/formatters.js';

/**
 * Theme management
 */
function applyTheme(theme) {
    const html = document.documentElement;
    
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        html.setAttribute('data-theme', theme);
    }
    
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = theme;
    }
}

function initializeTheme() {
    const savedTheme = loadTheme();
    applyTheme(savedTheme);
    
    if (savedTheme === 'auto') {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (loadTheme() === 'auto') {
                applyTheme('auto');
            }
        });
    }
}

/**
 * Load all dashboard data
 */
async function loadAllData() {
    await Promise.allSettled([
        loadPortfolio(),
        loadPerformance(),
        loadRisk(),
        loadPortfolioChart(),
        loadTrades(),
        loadRecommendations(),
    ]);
}

/**
 * Load initial page data (non-refreshing)
 */
async function loadInitialData() {
    await Promise.allSettled([
        loadCachedDiscoveries(),
        loadMarketContext(),
    ]);
    loadDiscoverySettings();
}

/**
 * Initialize the application
 */
async function init() {
    
    // Initialize theme
    initializeTheme();
    
    // Load initial data
    await loadAllData();
    await loadInitialData();
    
    // Initialize card states
    setTimeout(() => initializeCardStates(), 100);
    
    // Apply saved settings
    applySettings();
    
    // Setup auto-refresh
    setInterval(loadAllData, REFRESH_INTERVALS.PORTFOLIO);
    
    // Update time displays
    setInterval(refreshAnalysisTimeDisplay, REFRESH_INTERVALS.TIME_DISPLAY);
    setInterval(refreshDiscoveryTimeDisplay, REFRESH_INTERVALS.TIME_DISPLAY);
    
}

// Expose functions globally for onclick handlers in HTML
window.toggleCardCollapse = toggleCardCollapse;
window.openInfoModal = openInfoModal;
window.closeInfoModal = closeInfoModal;
window.switchTab = switchTab;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings = saveSettings;
window.updateConfidenceValue = updateConfidenceValue;
window.updateMaxPositionValue = updateMaxPositionValue;
window.changeTheme = changeTheme;
window.loadTrades = loadTrades;
window.loadPortfolio = loadPortfolio;
window.loadRecommendations = loadRecommendations;
window.analyzeCrypto = analyzeCrypto;
window.selectCrypto = selectCrypto;
window.closeAnalysis = closeAnalysis;
window.runDiscovery = runDiscovery;
window.toggleAnalysisLog = toggleAnalysisLog;
window.analyzeDiscovered = analyzeDiscovered;
window.saveDiscoverySettings = saveDiscoverySettings;
window.runAIAnalysisNow = runAIAnalysisNow;
window.toggleAdvancedOptions = toggleAdvancedOptions;
window.updateQuantityPlaceholder = updateQuantityPlaceholder;
window.previewTrade = previewTrade;
window.executeTrade = executeTrade;
window.sellPosition = sellPosition;
window.handleConfirmClick = handleConfirmClick;
window.openPositionDetails = openPositionDetails;
window.openProtectionManager = openProtectionManager;
window.saveProtection = saveProtection;
window.getSettings = getSettings;
window.formatPrice = formatPrice;
window.formatNumber = formatNumber;
window.renderSparkline = renderSparkline;
window.getScoreColor = getScoreColor;

// Start the app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
