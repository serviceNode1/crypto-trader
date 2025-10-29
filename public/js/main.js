/**
 * Main Application Entry Point
 * Loads and initializes all UI modules
 */

/* global document, window */
/* eslint-disable no-console */
import { REFRESH_INTERVALS } from './config.js';
import { initializeTheme } from './utils/theme.js';
import { loadPortfolio, loadPerformance, loadRisk, loadPortfolioChart } from './ui/portfolio.js';
import { loadTrades } from './ui/trades.js';
import { loadRecommendations, refreshAnalysisTimeDisplay } from './ui/recommendations.js';
import { loadAIReviewLogs, toggleAIReviewLogs } from './ui/ai-review-logs.js';
import { toggleCardCollapse, initializeCardStates, updateCardHeight } from './ui/cards.js';
import { openInfoModal, closeInfoModal, switchTab } from './ui/modals.js';
import { 
    openSettingsModal, 
    closeSettingsModal, 
    saveSettings,
    applySettings,
    updateConfidenceValue, 
    updateMaxPositionValue,
    changeColorMode,
    changeVisualStyle,
    toggleDebugMode,
    handleTradingModeChange
} from './ui/settings.js';
import { analyzeCrypto, selectCrypto, closeAnalysis, initializeAnalysisAutocomplete } from './ui/analysis.js';
import { 
    runDiscovery, 
    loadCachedDiscoveries, 
    loadDiscoverySettings,
    saveDiscoverySettings,
    refreshDiscoveryTimeDisplay,
    toggleAnalysisLog,
    analyzeDiscovered,
    generateAIRecommendations 
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
    getSettings,
    initializeTradeAutocomplete
} from './ui/trading.js';
import { formatPrice, formatNumber, renderSparkline, getScoreColor } from './utils/formatters.js';

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
    console.log('[Main] 🚀 Application initialization started');
    
    // Initialize theme from localStorage first (immediate visual feedback)
    console.log('[Main] Step 1: Initializing theme...');
    initializeTheme();
    
    // Then load settings from backend (including theme) and apply
    console.log('[Main] Step 2: Loading backend settings...');
    try {
        const response = await auth.fetch('/api/settings');
        if (response && response.ok) {
            const settings = await response.json();
            if (settings.colorMode && settings.visualStyle) {
                const { applyTheme } = await import('./utils/theme.js');
                applyTheme({ colorMode: settings.colorMode, visualStyle: settings.visualStyle });
                console.log('✅ [THEME] Loaded theme from backend:', { colorMode: settings.colorMode, visualStyle: settings.visualStyle });
            }
        }
        console.log('[Main] Step 2 complete');
    } catch (error) {
        console.warn('⚠️ [THEME] Could not load theme from backend, using localStorage:', error);
    }
    
    // Load initial data
    console.log('[Main] Step 3: Loading dashboard data...');
    await loadAllData();
    console.log('[Main] Step 3a: Dashboard data loaded');
    
    console.log('[Main] Step 3b: Loading initial data...');
    await loadInitialData();
    console.log('[Main] Step 3 complete: All data loaded');
    
    // Initialize card states
    console.log('[Main] Step 4: Initializing card states...');
    setTimeout(() => {
        console.log('[Main] Card states timeout fired');
        initializeCardStates();
    }, 100);
    
    // Initialize coin autocomplete
    console.log('[Main] Step 5: Setting up autocomplete initialization...');
    setTimeout(() => {
        console.log('[Main] Autocomplete timeout fired - starting initialization...');
        try {
            initializeTradeAutocomplete();
            initializeAnalysisAutocomplete();
            console.log('[Main] ✅ Coin autocomplete initialization complete');
        } catch (error) {
            console.error('[Main] ❌ Failed to initialize autocomplete:', error);
        }
    }, 200);
    
    // Apply saved settings
    console.log('[Main] Step 6: Applying settings...');
    applySettings();
    
    // Setup auto-refresh
    console.log('[Main] Step 7: Setting up auto-refresh...');
    setInterval(loadAllData, REFRESH_INTERVALS.PORTFOLIO);
    
    // Update time displays
    console.log('[Main] Step 8: Setting up time display updates...');
    setInterval(refreshAnalysisTimeDisplay, REFRESH_INTERVALS.TIME_DISPLAY);
    setInterval(refreshDiscoveryTimeDisplay, REFRESH_INTERVALS.TIME_DISPLAY);
    
    console.log('[Main] ✅ Application initialization complete!');
}

// Expose functions globally for onclick handlers in HTML
window.changeColorMode = changeColorMode;
window.changeVisualStyle = changeVisualStyle;
window.toggleCardCollapse = toggleCardCollapse;
window.updateCardHeight = updateCardHeight;
window.openInfoModal = openInfoModal;
window.closeInfoModal = closeInfoModal;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.switchTab = switchTab;
window.loadPortfolio = loadPortfolio;
window.saveSettings = saveSettings;
window.updateConfidenceValue = updateConfidenceValue;
window.updateMaxPositionValue = updateMaxPositionValue;
window.toggleDebugMode = toggleDebugMode;
window.handleTradingModeChange = handleTradingModeChange;
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
window.generateAIRecommendations = generateAIRecommendations;
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
window.loadAIReviewLogs = loadAIReviewLogs;
window.toggleAIReviewLogs = toggleAIReviewLogs;

// Start the app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
