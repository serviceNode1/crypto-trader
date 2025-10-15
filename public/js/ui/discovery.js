/**
 * Discovery UI Module
 * Handles crypto discovery and opportunity scanning
 */

/* global document, window, localStorage */
/* eslint-disable no-console */
import { API_BASE } from '../config.js';
import { formatPrice, formatNumber, getScoreColor, renderSparkline } from '../utils/formatters.js';
import { timeAgo } from '../utils/time.js';

let lastDiscoveryTimestamp = null;

/**
 * Run discovery scan
 */
export async function runDiscovery() {
    const btn = document.getElementById('discoveryBtn');
    const status = document.getElementById('discovery-status');
    const message = document.getElementById('discovery-message');
    const listDiv = document.getElementById('discoveries-list');
    const logContainer = document.getElementById('analysis-log-container');
    const logContent = document.getElementById('analysis-log-content');
    const logSummary = document.getElementById('log-summary');
    const forceRefresh = document.getElementById('forceRefreshCheckbox').checked;
    const discoveryInfo = document.getElementById('discovery-info');
    
    try {
        // Get coin universe from settings
        const settings = window.getSettings ? window.getSettings() : { coinUniverse: 'top25', discoveryStrategy: 'moderate', debugMode: false };
        const universe = settings.coinUniverse || 'top25';
        
        // Use debug strategy if debug mode is enabled, otherwise use selected strategy
        const strategy = settings.debugMode ? 'debug' : (settings.discoveryStrategy || 'moderate');
        
        // Log warning if debug mode is active
        if (settings.debugMode) {
            console.warn('⚠️  Running discovery in DEBUG MODE with liberal filters');
        }
        
        // Show loading
        btn.disabled = true;
        btn.textContent = '⏳ Scanning...';
        status.style.display = 'block';
        const refreshText = forceRefresh ? ' (bypassing cache)' : '';
        const universeText = universe === 'top10' ? 'top 10' : universe === 'top25' ? 'top 25' : universe === 'top50' ? 'top 50' : 'top 100';
        const strategyText = strategy === 'debug' ? '⚠️ DEBUG MODE' : strategy === 'conservative' ? '(Conservative)' : strategy === 'aggressive' ? '(Aggressive)' : '(Moderate)';
        message.textContent = `Scanning ${universeText} coins ${strategyText}${refreshText}...`;
        
        // Clear previous log entries (but keep the AI section structure)
        const logEntriesContainer = document.getElementById('analysis-log-entries');
        if (logEntriesContainer) {
            logEntriesContainer.innerHTML = '';
        }
        
        // Hide AI recommendations section (will be shown again if discoveries found)
        const recsSection = document.getElementById('recommendations-section');
        if (recsSection) {
            recsSection.style.display = 'none';
        }
        
        logContainer.style.display = 'none';
        
        // Run discovery
        const url = `${API_BASE}/discover?universe=${universe}&strategy=${strategy}${forceRefresh ? '&forceRefresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Discovery failed');
        }
        
        const data = await response.json();
        
        // Hide loading, show results
        status.style.display = 'none';
        btn.disabled = false;
        btn.textContent = '🚀 Run Discovery';
        
        // Update discovery info
        if (data.timestamp) {
            discoveryInfo.style.display = 'block';
            lastDiscoveryTimestamp = new Date(data.timestamp);
            refreshDiscoveryTimeDisplay();
            document.getElementById('discovery-execution-time').textContent = `${(data.executionTime / 1000).toFixed(2)}s`;
            document.getElementById('discovery-cache-status').textContent = data.forceRefresh ? '❌ No (Fresh data)' : '✅ Yes (Cached)';
        }
        
        // Show analysis log
        if (data.analysisLog && data.analysisLog.length > 0) {
            logContainer.style.display = 'block';
            
            // Add hint about AI section if there are discoveries
            const aiHint = data.candidates && data.candidates.length > 0 ? ' · 🤖 Click to see AI analysis' : '';
            logSummary.textContent = `${data.summary.totalAnalyzed} analyzed · ${data.summary.passed} passed · ${data.summary.rejected} rejected${aiHint}`;
            
            displayAnalysisLog(data.analysisLog, data.summary);
            
            // Keep log collapsed by default - user must manually expand
            const toggle = document.getElementById('log-toggle');
            if (toggle) toggle.textContent = '▼';
            logContent.classList.remove('expanded');
        }
        
        // Display results
        if (data.candidates && data.candidates.length > 0) {
            listDiv.innerHTML = formatDiscoveries(data.candidates);
        } else {
            listDiv.innerHTML = formatNoOpportunities(data.summary, data.analysisLog);
        }
        
        // Ensure card content adjusts to new content size
        setTimeout(() => {
            const cardContent = document.getElementById('discovery-content');
            if (cardContent && !cardContent.classList.contains('collapsed')) {
                cardContent.style.maxHeight = cardContent.scrollHeight + 'px';
            }
        }, 100);
        
        // Show AI recommendations section if there are discoveries
        // Note: Log stays collapsed by default - user can manually expand to see AI section
        if (data.candidates && data.candidates.length > 0) {
            setTimeout(() => {
                const recsSection = document.getElementById('recommendations-section');
                
                // Make the AI section visible (but keep log collapsed)
                if (recsSection) {
                    recsSection.style.display = 'block';
                    console.log('[Discovery] AI recommendations section ready (expand Analysis Log to see it)');
                }
            }, 150);
        }
        
    } catch (error) {
        console.error('Discovery error:', error);
        status.style.display = 'none';
        btn.disabled = false;
        btn.textContent = '🚀 Run Discovery';
        listDiv.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 20px;">❌ Discovery failed. Please try again.</p>';
    }
}

/**
 * Load cached discoveries on page load
 */
export async function loadCachedDiscoveries() {
    try {
        const response = await fetch(`${API_BASE}/discover/top?limit=10`);
        if (!response.ok) {
            throw new Error('Failed to load cached discoveries');
        }
        
        const discoveries = await response.json();
        
        if (discoveries && discoveries.length > 0) {
            document.getElementById('discoveries-list').innerHTML = formatDiscoveries(discoveries);
            
            // Find most recent discovery
            const mostRecent = discoveries.reduce((latest, d) => {
                const dTime = new Date(d.discoveredAt);
                return !latest || dTime > new Date(latest.discoveredAt) ? d : latest;
            }, null);
            
            if (mostRecent && mostRecent.discoveredAt) {
                lastDiscoveryTimestamp = new Date(mostRecent.discoveredAt);
                refreshDiscoveryTimeDisplay();
                
                // Show discovery info
                const discoveryInfo = document.getElementById('discovery-info');
                discoveryInfo.style.display = 'block';
                document.getElementById('discovery-execution-time').textContent = 'N/A (cached)';
                document.getElementById('discovery-cache-status').textContent = '✅ Yes (From database)';
            }
            
            // Ensure card content is visible after loading data
            setTimeout(() => {
                const cardContent = document.getElementById('discovery-content');
                if (cardContent && !cardContent.classList.contains('collapsed')) {
                    // Update max-height to accommodate new content
                    cardContent.style.maxHeight = cardContent.scrollHeight + 'px';
                }
            }, 100); // Small delay to ensure DOM has updated
        } else {
            // No cached discoveries - auto-run first discovery
            setTimeout(() => {
                runDiscovery();
            }, 2000); // Wait 2 seconds after page load to let other data load
        }
    } catch (error) {
        console.error('Failed to load cached discoveries:', error);
        // Show prompt to run discovery
        document.getElementById('discoveries-list').innerHTML = `
            <p style="color: #6b7280; text-align: center; padding: 20px;">
                No discoveries found. Click "Run Discovery" to find trading opportunities.
            </p>
        `;
    }
}

/**
 * Refresh discovery time display
 */
export function refreshDiscoveryTimeDisplay() {
    if (!lastDiscoveryTimestamp) return;
    
    const displayEl = document.getElementById('discovery-timestamp');
    if (displayEl) {
        displayEl.textContent = timeAgo(lastDiscoveryTimestamp);
    }
}

/**
 * Load discovery settings into dropdowns
 */
export function loadDiscoverySettings() {
    // Load from localStorage
    const savedSettings = localStorage.getItem('tradingSettings');
    const settings = savedSettings ? JSON.parse(savedSettings) : { coinUniverse: 'top25', discoveryStrategy: 'moderate' };
    
    // Set dropdown values
    const universeSelect = document.getElementById('discoveryUniverseSelect');
    const strategySelect = document.getElementById('discoveryStrategySelect');
    
    if (universeSelect) {
        universeSelect.value = settings.coinUniverse || 'top25';
    }
    if (strategySelect) {
        strategySelect.value = settings.discoveryStrategy || 'moderate';
    }
}

/**
 * Save discovery settings
 */
export function saveDiscoverySettings() {
    // Load current settings
    const savedSettings = localStorage.getItem('tradingSettings');
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    
    // Update with current dropdown values
    settings.coinUniverse = document.getElementById('discoveryUniverseSelect').value;
    settings.discoveryStrategy = document.getElementById('discoveryStrategySelect').value;
    
    // Save back to localStorage
    localStorage.setItem('tradingSettings', JSON.stringify(settings));
    
    // Also update settings modal if it exists
    const coinUniverseEl = document.getElementById('coinUniverse');
    const discoveryStrategyEl = document.getElementById('discoveryStrategy');
    if (coinUniverseEl) coinUniverseEl.value = settings.coinUniverse;
    if (discoveryStrategyEl) discoveryStrategyEl.value = settings.discoveryStrategy;
}

/**
 * Toggle analysis log visibility with animation
 */
export function toggleAnalysisLog() {
    const content = document.getElementById('analysis-log-content');
    const toggle = document.getElementById('log-toggle');
    
    if (!content || !toggle) {
        console.warn('Analysis log elements not found');
        return;
    }
    
    const isExpanded = content.classList.contains('expanded');
    
    console.log('Toggling analysis log. Currently expanded:', isExpanded);
    console.log('Content classes before:', content.className);
    console.log('Content style.maxHeight:', content.style.maxHeight);
    
    if (isExpanded) {
        // Collapse
        content.classList.remove('expanded');
        toggle.textContent = '▼';
        console.log('Collapsed - classes after:', content.className);
    } else {
        // Expand
        content.classList.add('expanded');
        toggle.textContent = '▲';
        console.log('Expanded - classes after:', content.className);
    }
}

/**
 * Analyze a discovered coin
 */
export function analyzeDiscovered(symbol) {
    // Set the symbol in the search box
    document.getElementById('cryptoSearch').value = symbol;
    // Scroll to crypto selector
    document.querySelector('.crypto-selector').scrollIntoView({ behavior: 'smooth' });
    // Trigger analysis
    setTimeout(() => window.analyzeCrypto(), 500);
}

/**
 * Format no opportunities message
 */
function formatNoOpportunities(summary, _analysisLog) {
    return `
        <div style="padding: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 15px;">😔</div>
            <h3 style="color: var(--text-primary); margin-bottom: 10px;">No Opportunities Found</h3>
            <p style="color: var(--text-muted); margin-bottom: 20px;">
                Analyzed ${summary.totalAnalyzed} coins, but none met the criteria.
            </p>
            
            <div style="border-radius: 8px; padding: 20px; margin: 20px 0; text-align: left;">
                <h4 style="color: var(--text-primary); margin-bottom: 15px;">📊 Top Rejection Reasons:</h4>
                ${summary.topRejectionReasons.map((r, i) => `
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: ${i < summary.topRejectionReasons.length - 1 ? '1px solid var(--border-color)' : 'none'};">
                        <span style="color: var(--text-muted);">${r.reason}</span>
                        <span style="font-weight: 600; color: var(--text-primary);">${r.count} coins</span>
                    </div>
                `).join('')}
            </div>

            <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0; text-align: left;">
                <strong style="color: #92400e;">💡 Suggestions:</strong>
                <ul style="margin: 10px 0 0 20px; color: #78350f;">
                    <li>Market conditions may be unfavorable right now</li>
                    <li>Try expanding to "Top 100" in settings</li>
                    <li>Check back later when market activity increases</li>
                    <li>Review the analysis log below for detailed reasons</li>
                </ul>
            </div>
        </div>
    `;
}

/**
 * Display analysis log
 */
function displayAnalysisLog(analysisLog, summary) {
    const logEntriesContainer = document.getElementById('analysis-log-entries');
    
    if (!logEntriesContainer) {
        console.error('[Discovery] analysis-log-entries container not found! Did you refresh the page?');
        console.log('[Discovery] Available elements:', document.querySelectorAll('[id*="log"]'));
        return;
    }
    
    console.log('[Discovery] Found log entries container, rendering', analysisLog.length, 'entries');
    
    const html = `
        <div style="padding: 10px;">
            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); padding: 8px 10px; border-bottom: 2px solid var(--border-color); margin-bottom: 5px;">
                📋 Detailed Analysis (${analysisLog.length} coins)
            </div>
            <!-- Log Entries - COMPACT with SCROLL -->
            <div style="font-size: 11px; max-height: 400px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px;">
                ${analysisLog.map((entry, index) => `
                    <div style="padding: 6px 10px; border-bottom: ${index < analysisLog.length - 1 ? '1px solid #f3f4f6' : 'none'}; ${entry.passed ? 'background: #f0fdf4;' : 'background: #fafafa;'}">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="flex: 1;">
                                <strong style="color: #1f2937; font-size: 12px;">${entry.symbol}</strong>
                                <span style="color: #6b7280; font-size: 11px; margin-left: 6px;">#${entry.rank}</span>
                                <span style="color: ${entry.passed ? '#059669' : '#6b7280'}; font-size: 11px; margin-left: 10px;">
                                    ${entry.passed ? '✅' : '❌'} ${entry.reason}
                                </span>
                            </div>
                            <div style="font-size: 10px; color: #9ca3af; margin-left: 15px;">
                                ${entry.compositeScore !== undefined ? `Score: <strong style="color: ${getScoreColor(entry.compositeScore)};">${entry.compositeScore.toFixed(0)}</strong>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    logEntriesContainer.innerHTML = html;
}

/**
 * Format discoveries into HTML table
 */
function formatDiscoveries(discoveries) {
    // Calculate discovery age for freshness badge
    let freshnessHTML = '';
    if (discoveries.length > 0 && discoveries[0].discoveredAt) {
        const discoveredAt = new Date(discoveries[0].discoveredAt);
        const now = new Date();
        const ageMinutes = Math.floor((now - discoveredAt) / (1000 * 60));
        const ageHours = Math.floor(ageMinutes / 60);
        
        let badgeColor, badgeText, warningHTML = '';
        
        if (ageHours < 2) {
            // Fresh (0-2 hours)
            badgeColor = '#10b981';
            badgeText = `✅ Fresh (${ageMinutes < 60 ? ageMinutes + ' min' : ageHours + 'h'} ago)`;
        } else if (ageHours < 4) {
            // Recent (2-4 hours)
            badgeColor = '#f59e0b';
            badgeText = `⚠️ Recent (${ageHours}h ago)`;
            warningHTML = '<div style="padding: 10px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; margin-bottom: 15px; color: #92400e; font-size: 13px;">⚠️ Discovery data is a few hours old. Consider running a fresh discovery for current opportunities.</div>';
        } else if (ageHours < 6) {
            // Stale (4-6 hours)
            badgeColor = '#ef4444';
            badgeText = `🕐 Stale (${ageHours}h ago)`;
            warningHTML = '<div style="padding: 10px; background: #fee2e2; border: 1px solid #ef4444; border-radius: 6px; margin-bottom: 15px; color: #991b1b; font-size: 13px;">🕐 <strong>Data is stale.</strong> Market conditions may have changed significantly. Run discovery for current opportunities.</div>';
        } else {
            // Very stale (6+ hours)
            badgeColor = '#6b7280';
            badgeText = `❌ Expired (${ageHours}h ago)`;
            warningHTML = '<div style="padding: 10px; background: #f3f4f6; border: 1px solid #6b7280; border-radius: 6px; margin-bottom: 15px; color: #374151; font-size: 13px;">❌ <strong>Data has expired.</strong> These opportunities are outdated. Please run discovery to find current opportunities.</div>';
        }
        
        freshnessHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <span style="padding: 6px 12px; background: ${badgeColor}; color: white; border-radius: 6px; font-size: 13px; font-weight: 600;">
                    ${badgeText}
                </span>
            </div>
            ${warningHTML}
        `;
    }
    
    return `
        ${freshnessHTML}
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
                    <th style="padding: 12px; text-align: left;">Rank</th>
                    <th style="padding: 12px; text-align: left;">Symbol</th>
                    <th style="padding: 12px; text-align: left;">Name</th>
                    <th style="padding: 12px; text-align: right;">Price</th>
                    <th style="padding: 12px; text-align: center;">7D Chart</th>
                    <th style="padding: 12px; text-align: right;">Score</th>
                    <th style="padding: 12px; text-align: right;">Volume 24h</th>
                    <th style="padding: 12px; text-align: right;">Market Cap</th>
                    <th style="padding: 12px; text-align: center;">Action</th>
                </tr>
            </thead>
            <tbody>
                ${discoveries.map((coin, index) => `
                    <tr style="border-bottom: 1px solid #e5e7eb; ${index % 2 === 0 ? 'background: #fafafa;' : ''}">
                        <td style="padding: 12px;">
                            <span style="font-weight: 600; color: ${index < 3 ? '#667eea' : '#6b7280'};">
                                #${index + 1}
                            </span>
                        </td>
                        <td style="padding: 12px;">
                            <strong style="color: #1f2937; font-size: 16px;">${coin.symbol}</strong>
                        </td>
                        <td style="padding: 12px; color: #6b7280;">${coin.name}</td>
                        <td style="padding: 12px; text-align: right;">
                            <div style="display: flex; flex-direction: column; align-items: flex-end;">
                                <span style="font-weight: 600; color: #1f2937;">$${formatPrice(coin.currentPrice)}</span>
                                <span style="font-size: 12px; color: ${coin.priceChange24h >= 0 ? '#10b981' : '#ef4444'};">
                                    ${coin.priceChange24h >= 0 ? '▲' : '▼'} ${Math.abs(coin.priceChange24h).toFixed(2)}%
                                </span>
                            </div>
                        </td>
                        <td style="padding: 12px; text-align: center;">
                            ${renderSparkline(coin.sparkline, coin.priceChange7d)}
                        </td>
                        <td style="padding: 12px; text-align: right;">
                            <div style="display: flex; align-items: center; justify-content: flex-end;">
                                <div style="width: 60px; height: 8px; background: #e5e7eb; border-radius: 4px; margin-right: 8px;">
                                    <div style="width: ${coin.compositeScore}%; height: 100%; background: ${getScoreColor(coin.compositeScore)}; border-radius: 4px;"></div>
                                </div>
                                <span style="font-weight: 600; color: ${getScoreColor(coin.compositeScore)};">${Math.round(coin.compositeScore)}</span>
                            </div>
                        </td>
                        <td style="padding: 12px; text-align: right; color: #6b7280;">
                            $${formatNumber(coin.volume24h)}
                        </td>
                        <td style="padding: 12px; text-align: right; color: #6b7280;">
                            $${formatNumber(coin.marketCap)}
                        </td>
                        <td style="padding: 12px; text-align: center;">
                            <button class="button" style="padding: 6px 12px; font-size: 13px;" onclick="window.analyzeDiscovered('${coin.symbol}')">
                                Analyze
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div style="margin-top: 15px; padding: 12px; border-radius: 6px; text-align: center; color: var(--text-muted); font-size: 14px;">
            <strong>💡 Tip:</strong> 
            Price shows current value + 24h change. Chart shows last 48 hours of price movement.
        </div>
    `;
}

/**
 * Generate AI recommendations for discovered coins
 */
export async function generateAIRecommendations() {
    const btn = document.getElementById('generateRecommendationsBtn');
    const status = document.getElementById('recommendations-status');
    const message = document.getElementById('recommendations-message');
    const results = document.getElementById('recommendations-results');
    const maxRecs = parseInt(document.getElementById('maxRecommendations').value) || 5;
    
    // Dynamic loading messages
    const loadingMessages = [
        `🔍 Scanning top ${maxRecs} discovered coins...`,
        `📊 Fetching technical indicators...`,
        `📰 Collecting news and sentiment data...`,
        `🤖 Running AI analysis...`,
        `💭 AI is thinking deeply...`,
        `🧠 Analyzing market conditions...`,
        `⚡ Processing signals...`,
        `📈 Calculating entry and exit points...`,
        `🎯 Determining confidence levels...`,
        `✨ Finalizing recommendations...`
    ];
    
    let messageIndex = 0;
    let messageInterval;
    
    try {
        // Check if debug mode is enabled
        const settings = window.getSettings ? window.getSettings() : { debugMode: false };
        const debugMode = settings.debugMode || false;
        
        console.log(`[AI Recommendations] Starting analysis for ${maxRecs} coins...`);
        if (debugMode) {
            console.warn('[AI Recommendations] ⚠️ DEBUG MODE ACTIVE - Using aggressive/risky AI prompts');
        }
        
        // Expand the analysis log so user can see the AI section
        const logContent = document.getElementById('analysis-log-content');
        const logToggle = document.getElementById('log-toggle');
        if (logContent && !logContent.classList.contains('expanded')) {
            logContent.classList.add('expanded');
            if (logToggle) logToggle.textContent = '▲';
        }
        
        // Show loading
        btn.disabled = true;
        btn.textContent = '⏳ Analyzing...';
        status.style.display = 'block';
        message.textContent = loadingMessages[0];
        results.innerHTML = '';
        
        // Rotate messages every 3 seconds
        messageInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            message.textContent = loadingMessages[messageIndex];
        }, 3000);
        
        console.log(`[AI Recommendations] Calling API: POST ${API_BASE}/recommendations/generate`);
        console.log(`[AI Recommendations] Request body:`, { maxBuy: maxRecs, maxSell: 0, debugMode });
        
        // Call API
        const response = await fetch(`${API_BASE}/recommendations/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                maxBuy: maxRecs, 
                maxSell: 0,  // We only want BUY recommendations from discovery
                debugMode: debugMode  // Pass debug mode to backend
            })
        });
        
        console.log(`[AI Recommendations] Response status:`, response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI Recommendations] API Error:`, errorText);
            throw new Error(`Failed to generate recommendations: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`[AI Recommendations] Success! Received data:`, data);
        
        // Stop message rotation
        clearInterval(messageInterval);
        
        // Hide loading
        status.style.display = 'none';
        btn.disabled = false;
        btn.textContent = '🤖 Generate AI Recommendations';
        
        // Display results
        displayRecommendations(data, maxRecs);
        
        console.log(`[AI Recommendations] Displayed ${data.buyRecommendations?.length || 0} BUY recommendations`);
        
    } catch (error) {
        console.error('[AI Recommendations] Error:', error);
        
        // Stop message rotation
        if (messageInterval) clearInterval(messageInterval);
        
        status.style.display = 'none';
        btn.disabled = false;
        btn.textContent = '🤖 Generate AI Recommendations';
        
        results.innerHTML = `
            <div style="color: #ef4444; text-align: center; padding: 40px 20px; background: #fee2e2; border: 2px solid #ef4444; border-radius: 8px;">
                <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
                <h3 style="margin-bottom: 10px;">Failed to Generate Recommendations</h3>
                <p style="margin-bottom: 15px;">${error.message}</p>
                <div style="background: white; padding: 15px; border-radius: 6px; text-align: left; max-width: 600px; margin: 0 auto;">
                    <strong>🔧 Troubleshooting:</strong>
                    <ul style="margin: 10px 0 0 20px; line-height: 1.8;">
                        <li>Check the browser console for detailed errors (F12)</li>
                        <li>Verify the API server is running</li>
                        <li>Check your OpenAI or Anthropic API keys</li>
                        <li>Try analyzing fewer coins (select 3 instead of ${maxRecs})</li>
                    </ul>
                </div>
                <button class="button" onclick="generateAIRecommendations()" style="margin-top: 20px;">
                    🔄 Try Again
                </button>
            </div>
        `;
    }
}

/**
 * Display AI recommendations
 */
function displayRecommendations(data, maxAnalyzed) {
    const results = document.getElementById('recommendations-results');
    const buyRecs = data.buyRecommendations || [];
    const skipped = data.skipped || { buy: 0, sell: 0 };
    
    // Debug: log first recommendation to see structure
    if (buyRecs.length > 0) {
        console.log('[AI Recommendations] First rec structure:', buyRecs[0]);
    }
    
    // Summary header - collapsible
    let html = `
        <div onclick="toggleRecommendationsResults()" style="background: ${buyRecs.length > 0 ? '#f0fdf4' : '#fef3c7'}; border-left: 4px solid ${buyRecs.length > 0 ? '#10b981' : '#f59e0b'}; padding: 15px; border-radius: 6px; margin-bottom: 20px; cursor: pointer; user-select: none;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: ${buyRecs.length > 0 ? '#065f46' : '#92400e'}; font-size: 16px;">
                        ${buyRecs.length > 0 ? '✅ Analysis Complete' : '⚠️ Analysis Complete'}
                        <span id="recommendations-toggle" style="margin-left: 10px; font-size: 14px;">▼</span>
                    </strong>
                    <p style="margin: 5px 0 0 0; color: ${buyRecs.length > 0 ? '#065f46' : '#92400e'}; font-size: 14px;">
                        Generated <strong>${buyRecs.length} BUY</strong> and <strong>0 SELL</strong> recommendations · Click to expand
                    </p>
                </div>
                <div style="text-align: right; font-size: 13px; color: ${buyRecs.length > 0 ? '#065f46' : '#92400e'};">
                    <div>Analyzed: ${maxAnalyzed} coins</div>
                    <div>AI Confirmed: ${buyRecs.length} BUY signals</div>
                </div>
            </div>
        </div>
    `;
    
    // Single wrapper with the ID for animation (inside Analysis Log)
    html += '<div id="ai-recommendations-content">';
    
    if (buyRecs.length === 0) {
        html += `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 15px;">🤔</div>
                <h3 style="color: var(--text-primary); margin-bottom: 10px;">No Strong BUY Signals Found</h3>
                <p style="color: var(--text-muted); margin-bottom: 20px;">
                    The AI analyzed ${maxAnalyzed} coins but found no strong buy opportunities at this time.
                </p>
                <div style="border-radius: 8px; padding: 20px; text-align: left; max-width: 600px; margin: 0 auto;">
                    <strong style="color: var(--text-primary);">💡 What this means:</strong>
                    <ul style="margin: 10px 0 0 20px; color: var(--text-muted); line-height: 1.8;">
                        <li>Discovery found candidates, but AI analysis was <strong>not convinced</strong></li>
                        <li>Technical indicators may show mixed signals</li>
                        <li>Sentiment could be neutral or negative</li>
                        <li>Market conditions may not be favorable</li>
                        <li>The AI is being <strong>conservative</strong> (which is good!)</li>
                    </ul>
                </div>
                <div style="margin-top: 20px; padding: 15px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; text-align: left; max-width: 600px; margin: 20px auto 0;">
                    <strong style="color: #92400e;">🔧 Try These:</strong>
                    <ul style="margin: 10px 0 0 20px; color: #78350f; line-height: 1.8;">
                        <li>Enable <strong>Debug Mode</strong> in settings (lowers AI thresholds)</li>
                        <li>Try a different coin universe (Top 50 or Top 100)</li>
                        <li>Use <strong>Aggressive</strong> discovery strategy</li>
                        <li>Wait for better market conditions</li>
                        <li>Manually analyze individual coins with "Analyze" button</li>
                    </ul>
                </div>
            </div>
        `;
    } else {
        // Show BUY recommendations with scrolling (CSS handles max-height)
        html += '<div style="padding-right: 10px;"><div style="display: grid; gap: 20px;">';
        
        buyRecs.forEach((rec, index) => {
            const confidenceColor = rec.confidence >= 80 ? '#10b981' : rec.confidence >= 70 ? '#3b82f6' : '#f59e0b';
            const riskColor = rec.riskLevel === 'LOW' ? '#10b981' : rec.riskLevel === 'MEDIUM' ? '#f59e0b' : '#ef4444';
            
            html += `
                <div class="recommendation-card" style="border: 2px solid ${confidenceColor};">
                    <!-- Header -->
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                                <h3 style="margin: 0; color: var(--text-primary); font-size: 24px;">${rec.symbol || 'Unknown'}</h3>
                                <span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-size: 13px;">
                                    📈 BUY
                                </span>
                            </div>
                            <div style="color: var(--text-muted); font-size: 13px; margin-top: 5px;">
                                Current Price: $${rec.currentPrice?.toFixed(6) || rec.entryPrice?.toFixed(6) || 'N/A'} · 
                                Discovery Score: ${rec.discoveryScore?.toFixed(0) || 'N/A'}/100 · 
                                ${rec.discoveryReason || 'discovery'}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 28px; font-weight: 700; color: ${confidenceColor};">
                                ${rec.confidence}%
                            </div>
                            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Confidence</div>
                        </div>
                    </div>
                    
                    <!-- Price Levels -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
                        <div class="recommendation-info-box" style="background:#ffffff;">
                            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 5px;">ENTRY</div>
                            <div style="font-size: 16px; font-weight: 600; color: #3b82f6;">
                                $${rec.entryPrice?.toFixed(4) || 'N/A'}
                            </div>
                        </div>
                        <div class="recommendation-info-box" style="background: #fef2f2;">
                            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 5px;">STOP LOSS</div>
                            <div style="font-size: 16px; font-weight: 600; color: #ef4444;">
                                $${rec.stopLoss?.toFixed(4) || 'N/A'}
                            </div>
                        </div>
                        <div class="recommendation-info-box" style="background: #f0fdf4;">
                            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 5px;">TARGET 1</div>
                            <div style="font-size: 16px; font-weight: 600; color: #10b981;">
                                $${rec.takeProfitLevels?.[0]?.toFixed(4) || 'N/A'}
                            </div>
                        </div>
                        <div class="recommendation-info-box" style="background: #f0fdf4;">
                            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 5px;">TARGET 2</div>
                            <div style="font-size: 16px; font-weight: 600; color: #10b981;">
                                $${rec.takeProfitLevels?.[1]?.toFixed(4) || 'N/A'}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Key Metrics -->
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px;">
                        <div class="recommendation-info-box">
                            <div style="font-size: 11px; color: var(--text-muted);">POSITION SIZE</div>
                            <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin-top: 3px;">
                                ${((rec.positionSize || 0) * 100).toFixed(1)}%
                            </div>
                        </div>
                        <div class="recommendation-info-box">
                            <div style="font-size: 11px; color: var(--text-muted);">RISK LEVEL</div>
                            <div style="font-size: 15px; font-weight: 600; color: ${riskColor}; margin-top: 3px;">
                                ${rec.riskLevel || 'MEDIUM'}
                            </div>
                        </div>
                        <div class="recommendation-info-box">
                            <div style="font-size: 11px; color: var(--text-muted);">TIMEFRAME</div>
                            <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin-top: 3px;">
                                ${rec.timeframe?.replace('-term', '') || 'N/A'}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Reasoning -->
                    <div class="recommendation-reasoning">
                        <details>
                            <summary style="cursor: pointer; font-weight: 600; color: var(--text-primary); margin-bottom: 10px;">
                                🧠 AI Reasoning (Click to expand)
                            </summary>
                            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                                <div style="margin-bottom: 15px;">
                                    <strong style="color: #10b981;">✅ Bull Case:</strong>
                                    <p style="margin: 5px 0 0 0; color: var(--text-primary); font-size: 13px; line-height: 1.6;">
                                        ${rec.reasoning?.bullCase || 'Not provided'}
                                    </p>
                                </div>
                                <div style="margin-bottom: 15px;">
                                    <strong style="color: #ef4444;">⚠️ Bear Case:</strong>
                                    <p style="margin: 5px 0 0 0; color: var(--text-primary); font-size: 13px; line-height: 1.6;">
                                        ${rec.reasoning?.bearCase || 'Not provided'}
                                    </p>
                                </div>
                                <div>
                                    <strong style="color: #3b82f6;">🎯 Conclusion:</strong>
                                    <p style="margin: 5px 0 0 0; color: var(--text-primary); font-size: 13px; line-height: 1.6;">
                                        ${rec.reasoning?.conclusion || 'Not provided'}
                                    </p>
                                </div>
                            </div>
                        </details>
                    </div>
                    
                    <!-- Key Factors -->
                    ${rec.keyFactors && rec.keyFactors.length > 0 ? `
                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--text-primary); font-size: 13px;">🔑 Key Factors:</strong>
                            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                                ${rec.keyFactors.map(factor => `
                                    <span style="background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 4px; font-size: 12px;">
                                        ${factor}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += '</div></div>';
    }
    
    // Close the recommendations-content wrapper
    html += '</div>';
    
    results.innerHTML = html;
    
    // Auto-expand with animation after a short delay
    setTimeout(() => {
        const content = document.getElementById('ai-recommendations-content');
        const toggle = document.getElementById('recommendations-toggle');
        if (content && toggle) {
            console.log('[AI Recommendations] Adding expanded class');
            
            content.classList.add('expanded');
            toggle.textContent = '▲';
            
            console.log('[AI Recommendations] Expanded class added, classes:', content.classList.value);
        }
    }, 100);
}

/**
 * Toggle recommendations results visibility with smooth animation
 */
window.toggleRecommendationsResults = function() {
    const content = document.getElementById('ai-recommendations-content');
    const toggle = document.getElementById('recommendations-toggle');
    
    if (!content || !toggle) {
        console.error('[Toggle] Elements not found!');
        return;
    }
    
    // Toggle using CSS class
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        toggle.textContent = '▼';
        console.log('[Toggle] Removed expanded class - collapsing');
    } else {
        content.classList.add('expanded');
        toggle.textContent = '▲';
        console.log('[Toggle] Added expanded class - expanding');
    }
    
    console.log('[Toggle] Current classes:', content.classList.value);
};
