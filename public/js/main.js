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
import { toggleCardCollapse, initializeCardStates } from './ui/cards.js';
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
import { analyzeCrypto, selectCrypto, closeAnalysis } from './ui/analysis.js';
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
    getSettings
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
window.changeColorMode = changeColorMode;
window.changeVisualStyle = changeVisualStyle;
window.toggleCardCollapse = toggleCardCollapse;
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
