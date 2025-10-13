/**
 * Discovery UI Module
 * Handles crypto discovery and opportunity scanning
 */

/* global document, fetch */
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
        const settings = window.getSettings ? window.getSettings() : { coinUniverse: 'top25', discoveryStrategy: 'moderate' };
        const universe = settings.coinUniverse || 'top25';
        const strategy = settings.discoveryStrategy || 'moderate';
        
        // Show loading
        btn.disabled = true;
        btn.textContent = '⏳ Scanning...';
        status.style.display = 'block';
        const refreshText = forceRefresh ? ' (bypassing cache)' : '';
        const universeText = universe === 'top10' ? 'top 10' : universe === 'top25' ? 'top 25' : universe === 'top50' ? 'top 50' : 'top 100';
        const strategyText = strategy === 'conservative' ? '(Conservative)' : strategy === 'aggressive' ? '(Aggressive)' : '(Moderate)';
        message.textContent = `Scanning ${universeText} coins ${strategyText}${refreshText}...`;
        
        // Clear previous log
        logContent.innerHTML = '';
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
            logSummary.textContent = `${data.summary.totalAnalyzed} analyzed · ${data.summary.passed} passed · ${data.summary.rejected} rejected`;
            displayAnalysisLog(data.analysisLog, data.summary);
        }
        
        // Display results
        if (data.candidates && data.candidates.length > 0) {
            listDiv.innerHTML = formatDiscoveries(data.candidates);
        } else {
            listDiv.innerHTML = formatNoOpportunities(data.summary, data.analysisLog);
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
    
    const displayEl = document.getElementById('discovery-time');
    if (displayEl) {
        displayEl.textContent = `Last discovery: ${timeAgo(lastDiscoveryTimestamp)}`;
    }
}

/**
 * Load discovery settings into dropdowns
 */
export function loadDiscoverySettings() {
    const settings = window.loadSettings ? window.loadSettings() : { coinUniverse: 'top25', discoveryStrategy: 'moderate' };
    document.getElementById('discoveryUniverseSelect').value = settings.coinUniverse || 'top25';
    document.getElementById('discoveryStrategySelect').value = settings.discoveryStrategy || 'moderate';
}

/**
 * Save discovery settings
 */
export function saveDiscoverySettings() {
    const settings = window.loadSettings ? window.loadSettings() : {};
    settings.coinUniverse = document.getElementById('discoveryUniverseSelect').value;
    settings.discoveryStrategy = document.getElementById('discoveryStrategySelect').value;
    localStorage.setItem('tradingSettings', JSON.stringify(settings));
    
    // Also update settings modal if it exists
    const coinUniverseEl = document.getElementById('coinUniverse');
    const discoveryStrategyEl = document.getElementById('discoveryStrategy');
    if (coinUniverseEl) coinUniverseEl.value = settings.coinUniverse;
    if (discoveryStrategyEl) discoveryStrategyEl.value = settings.discoveryStrategy;
}

/**
 * Toggle analysis log visibility
 */
export function toggleAnalysisLog() {
    const content = document.getElementById('analysis-log-content');
    const toggle = document.getElementById('log-toggle');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '▲';
    } else {
        content.style.display = 'none';
        toggle.textContent = '▼';
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
function formatNoOpportunities(summary, analysisLog) {
    return `
        <div style="padding: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 15px;">😔</div>
            <h3 style="color: #374151; margin-bottom: 10px;">No Opportunities Found</h3>
            <p style="color: #6b7280; margin-bottom: 20px;">
                Analyzed ${summary.totalAnalyzed} coins, but none met the criteria.
            </p>
            
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: left;">
                <h4 style="color: #374151; margin-bottom: 15px;">📊 Top Rejection Reasons:</h4>
                ${summary.topRejectionReasons.map((r, i) => `
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: ${i < summary.topRejectionReasons.length - 1 ? '1px solid #e5e7eb' : 'none'};">
                        <span style="color: #6b7280;">${r.reason}</span>
                        <span style="font-weight: 600; color: #374151;">${r.count} coins</span>
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
    const logContent = document.getElementById('analysis-log-content');
    
    const html = `
        <div style="padding: 15px;">
            <!-- Summary Stats -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
                <div style="text-align: center; padding: 15px; background: white; border-radius: 6px; border: 1px solid #e5e7eb;">
                    <div style="font-size: 24px; font-weight: 600; color: #3b82f6;">${summary.totalAnalyzed}</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">Total Analyzed</div>
                </div>
                <div style="text-align: center; padding: 15px; background: white; border-radius: 6px; border: 1px solid #e5e7eb;">
                    <div style="font-size: 24px; font-weight: 600; color: #10b981;">${summary.passed}</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">Passed</div>
                </div>
                <div style="text-align: center; padding: 15px; background: white; border-radius: 6px; border: 1px solid #e5e7eb;">
                    <div style="font-size: 24px; font-weight: 600; color: #ef4444;">${summary.rejected}</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">Rejected</div>
                </div>
            </div>

            <!-- Log Entries -->
            <div style="background: white; border-radius: 6px; border: 1px solid #e5e7eb;">
                ${analysisLog.map((entry, index) => `
                    <div style="padding: 12px; border-bottom: ${index < analysisLog.length - 1 ? '1px solid #f3f4f6' : 'none'}; ${entry.passed ? 'background: #f0fdf4;' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 5px;">
                            <div>
                                <strong style="color: #1f2937; font-size: 15px;">
                                    ${entry.symbol}
                                </strong>
                                <span style="color: #6b7280; font-size: 13px; margin-left: 8px;">
                                    ${entry.name} · Rank #${entry.rank}
                                </span>
                            </div>
                            <span style="font-size: 11px; color: #9ca3af;">
                                ${new Date(entry.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                        <div style="color: ${entry.passed ? '#059669' : '#6b7280'}; font-size: 13px; margin-bottom: 8px;">
                            ${entry.reason}
                        </div>
                        ${entry.details && Object.keys(entry.details).length > 0 ? `
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; font-size: 12px; color: #6b7280;">
                                ${entry.details.volumeScore !== undefined ? `
                                    <div>Vol Score: <strong>${entry.details.volumeScore.toFixed(0)}</strong></div>
                                ` : ''}
                                ${entry.details.momentumScore !== undefined ? `
                                    <div>Momentum: <strong>${entry.details.momentumScore.toFixed(0)}</strong></div>
                                ` : ''}
                                ${entry.details.sentimentScore !== undefined ? `
                                    <div>Sentiment: <strong>${entry.details.sentimentScore.toFixed(0)}</strong></div>
                                ` : ''}
                                ${entry.compositeScore !== undefined ? `
                                    <div>Composite: <strong style="color: ${getScoreColor(entry.compositeScore)};">${entry.compositeScore.toFixed(0)}</strong></div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    logContent.innerHTML = html;
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
        
        <div style="margin-top: 15px; padding: 12px; background: #f9fafb; border-radius: 6px; text-align: center; color: #6b7280; font-size: 14px;">
            <strong>💡 Tip:</strong> 
            Price shows current value + 24h change. Chart shows last 48 hours of price movement.
        </div>
    `;
}
