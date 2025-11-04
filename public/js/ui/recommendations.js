/**
 * Recommendations UI Module
 * Handles displaying AI recommendations
 */

/* global document, localStorage, fetch */
/* eslint-disable no-console */
import { fetchRecommendations } from '../api/analysis.js';
import { timeAgo } from '../utils/time.js';

let lastAnalysisTimestamp = null;
let nextScheduledAnalysis = null;
let countdownInterval = null;

/**
 * Get next scheduled analysis time based on cron schedule
 * Backend runs on cron: at minute 0 of every 2nd hour
 * Runs at: 12 AM, 2 AM, 4 AM, 6 AM, 8 AM, 10 AM, 12 PM, 2 PM, 4 PM, 6 PM, 8 PM, 10 PM
 */
function getNextScheduledAnalysisTime() {
    // If already calculated and still in future, return it
    if (nextScheduledAnalysis && nextScheduledAnalysis > new Date()) {
        return nextScheduledAnalysis;
    }
    
    // Fixed schedule: every 2 hours
    const frequencyHours = 2;
    
    // Calculate next cron execution time
    // Cron format: '0 */X * * *' means at minute 0 of every Xth hour
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Find next hour that's a multiple of frequencyHours
    let nextHour = Math.floor(currentHour / frequencyHours) * frequencyHours;
    
    // If we're past the hour mark (e.g., it's 4:15 PM and cron runs at 4:00 PM)
    // or if we're exactly on the hour but past minute 0, move to next interval
    if (currentHour >= nextHour && currentMinute > 0) {
        nextHour += frequencyHours;
    } else if (currentHour > nextHour) {
        nextHour += frequencyHours;
    }
    
    // Handle day rollover
    let nextDay = now.getDate();
    let nextMonth = now.getMonth();
    let nextYear = now.getFullYear();
    
    if (nextHour >= 24) {
        nextHour -= 24;
        nextDay += 1;
        
        // Handle month rollover (simplified - Date constructor handles this)
        const tempDate = new Date(nextYear, nextMonth, nextDay);
        nextDay = tempDate.getDate();
        nextMonth = tempDate.getMonth();
        nextYear = tempDate.getFullYear();
    }
    
    // Create next scheduled time (always at minute 0)
    nextScheduledAnalysis = new Date(nextYear, nextMonth, nextDay, nextHour, 0, 0, 0);
    
    return nextScheduledAnalysis;
}

/**
 * Update last analysis run time
 */
export function recordAnalysisRun() {
    const now = new Date();
    localStorage.setItem('lastAIAnalysisRun', now.toISOString());
    nextScheduledAnalysis = null; // Reset so it recalculates
}

/**
 * Check if recommendation is still valid (not expired)
 */
function isRecommendationValid(createdAt) {
    const age = Date.now() - new Date(createdAt).getTime();
    const hours = age / (1000 * 60 * 60);
    return hours < 48; // Valid for 48 hours
}

/**
 * Get recommendation freshness indicator
 */
function getRecommendationFreshness(createdAt) {
    const age = Date.now() - new Date(createdAt).getTime();
    const hours = age / (1000 * 60 * 60);
    
    if (hours < 6) return { label: 'FRESH', color: '#10b981', emoji: '🟢' };
    if (hours < 24) return { label: 'VALID', color: '#3b82f6', emoji: '🔵' };
    if (hours < 48) return { label: 'AGING', color: '#f59e0b', emoji: '🟡' };
    return { label: 'EXPIRED', color: '#ef4444', emoji: '🔴' };
}

/**
 * Start countdown timer to update next review countdown
 */
function startCountdownTimer() {
    // Clear any existing interval
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    // Update countdown every minute
    countdownInterval = setInterval(() => {
        const nextReviewEl = document.getElementById('next-review-time');
        if (nextReviewEl) {
            const nextTime = getNextScheduledAnalysisTime();
            const timeUntil = nextTime.getTime() - Date.now();
            const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60));
            const minutesUntil = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
            
            if (hoursUntil > 0) {
                nextReviewEl.textContent = `Next: in ${hoursUntil}h ${minutesUntil}m`;
            } else if (minutesUntil > 0) {
                nextReviewEl.textContent = `Next: in ${minutesUntil}m`;
            } else {
                nextReviewEl.textContent = `Next: soon`;
            }
        }
    }, 60000); // Update every minute
}

/**
 * Load and display recommendations
 */
export async function loadRecommendations() {
    try {
        const data = await fetchRecommendations(5);
        if (!data) return; // Rate limited
        
        // Filter out expired recommendations
        const validData = data.filter(rec => isRecommendationValid(rec.createdAt));
        
        // Start countdown timer
        startCountdownTimer();

        if (validData.length > 0) {
            // Find most recent recommendation
            const mostRecent = validData.reduce((latest, rec) => {
                const recTime = new Date(rec.createdAt);
                return !latest || recTime > new Date(latest.createdAt) ? rec : latest;
            }, null);

            // Update header displays
            updateRecommendationsHeader(validData, mostRecent.createdAt);

            const recsHTML = validData.map(rec => {
                const freshness = getRecommendationFreshness(rec.createdAt);
                const actionClass = rec.action === 'BUY' ? 'positive' : 
                                  rec.action === 'SELL' ? 'negative' : 'neutral';
                
                return `
                    <div class="metric" style="border-left: 4px solid ${freshness.color}; border-top: 2px solid ${
                        rec.action === 'BUY' ? '#10b981' : 
                        rec.action === 'SELL' ? '#ef4444' : '#6b7280'
                    }; padding-left: 15px; margin-bottom: 15px; background: var(--card-bg-secondary); padding: 12px; border-radius: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <strong style="font-size: 16px; color: var(--text-color);">${rec.symbol}</strong>
                                <span style="font-size: 10px; padding: 2px 6px; background: ${freshness.color}; color: white; border-radius: 4px; font-weight: 600;">
                                    ${freshness.emoji} ${freshness.label}
                                </span>
                            </div>
                            <span class="badge badge-${rec.action.toLowerCase()}" style="font-size: 13px;">
                                ${rec.action}
                            </span>
                        </div>
                        <div style="color: var(--text-secondary); font-size: 13px; line-height: 1.5;">
                            <div><strong style="color: var(--text-color);">Confidence:</strong> ${rec.confidence}% | <strong style="color: var(--text-color);">Risk:</strong> ${rec.riskLevel || 'Medium'}</div>
                            ${rec.reasoning ? `<div style="margin-top: 4px;"><strong style="color: var(--text-color);">Reasoning:</strong> ${typeof rec.reasoning === 'object' ? (rec.reasoning.conclusion || rec.reasoning.bullCase || JSON.stringify(rec.reasoning)) : rec.reasoning}</div>` : ''}
                            ${rec.entryPrice ? `<div style="margin-top: 4px;"><strong style="color: var(--text-color);">Entry:</strong> $${rec.entryPrice.toFixed(2)}</div>` : ''}
                            ${rec.stopLoss ? `<div style="margin-top: 4px;"><strong style="color: var(--text-color);">Stop Loss:</strong> $${rec.stopLoss.toFixed(2)} <span class="badge badge-${rec.action.toLowerCase()}" style="font-size: 11px; cursor: pointer; margin-left: 8px;" onclick="populateBuyForm('${rec.symbol}', ${rec.entryPrice || 0}, ${rec.stopLoss || 0})">📋 Quick Buy</span></div>` : ''}
                            <div style="font-size: 11px; margin-top: 5px; color: var(--text-muted);">
                                ${timeAgo(rec.createdAt)}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('recommendations-list').innerHTML = recsHTML;
            
            // Trigger card resize to fit content
            setTimeout(() => {
                const cardContent = document.getElementById('recommendations-content');
                if (cardContent && !cardContent.classList.contains('collapsed')) {
                    cardContent.style.maxHeight = cardContent.scrollHeight + 'px';
                }
            }, 100);
        } else {
            // Show helpful message with next analysis time (no manual buttons)
            const nextAnalysisTime = getNextScheduledAnalysisTime();
            const lastRunStr = localStorage.getItem('lastAIAnalysisRun');
            const hasRunBefore = !!lastRunStr;
            
            document.getElementById('recommendations-list').innerHTML = `
                <div style="padding: 30px; text-align: center; border-radius: 6px; border: 1px solid var(--border-color);">
                    <div style="font-size: 48px; margin-bottom: 15px;">🤖</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">
                        ${hasRunBefore ? 'No Active Recommendations' : 'Waiting for AI Review'}
                    </div>
                    <div style="font-size: 14px; color: var(--text-muted); margin-bottom: 20px;">
                        ${hasRunBefore ? 'All recommendations have expired or no opportunities found' : 'Automated AI analysis will run on schedule'}
                    </div>
                    <div style="background: var(--card-bg-secondary); padding: 15px; border-radius: 8px; max-width: 400px; margin: 0 auto;">
                        <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 5px;">📅 Next Scheduled Review</div>
                        <div style="font-size: 18px; font-weight: 600; color: var(--text-primary);">${(() => {
                            const timeUntil = nextAnalysisTime.getTime() - Date.now();
                            const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60));
                            const minutesUntil = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
                            return hoursUntil > 0 ? `in ${hoursUntil}h ${minutesUntil}m` : `in ${minutesUntil}m`;
                        })()}</div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">${nextAnalysisTime.toLocaleString()}</div>
                    </div>
                    <div style="margin-top: 20px; font-size: 12px; color: var(--text-muted);">
                        💡 Use <strong>Discovered Opportunities</strong> below for manual analysis
                    </div>
                </div>
            `;
            
            // Update header with schedule info
            updateRecommendationsHeader([], null);
            
            // Trigger card resize
            setTimeout(() => {
                const cardContent = document.getElementById('recommendations-content');
                if (cardContent && !cardContent.classList.contains('collapsed')) {
                    cardContent.style.maxHeight = cardContent.scrollHeight + 'px';
                }
            }, 100);
        }
    } catch (error) {
        console.error('Failed to load recommendations:', error);
        document.getElementById('recommendations-list').innerHTML = '<p style="color: #ef4444;">Failed to load recommendations</p>';
        document.getElementById('last-analysis-time').textContent = 'Error loading data';
    }
}

/**
 * Update recommendations header with badge, counts, and timing
 */
function updateRecommendationsHeader(recommendations, lastAnalysisTime) {
    const badge = document.getElementById('recommendations-badge');
    const lastReviewEl = document.getElementById('last-review-time');
    const nextReviewEl = document.getElementById('next-review-time');
    const activeCountEl = document.getElementById('active-recommendations-count');
    
    // Count BUY and SELL recommendations
    const buyCount = recommendations.filter(r => r.action === 'BUY').length;
    const sellCount = recommendations.filter(r => r.action === 'SELL').length;
    const totalCount = buyCount + sellCount;
    
    // Update badge
    if (badge) {
        if (totalCount > 0) {
            badge.textContent = totalCount;
            badge.style.display = 'inline-block';
            // Pulse animation for new recommendations
            badge.style.animation = 'pulse 2s ease-in-out infinite';
        } else {
            badge.style.display = 'none';
        }
    }
    
    // Update last review time
    if (lastReviewEl) {
        if (lastAnalysisTime) {
            lastReviewEl.textContent = `Last: ${timeAgo(lastAnalysisTime)}`;
        } else {
            const lastRunStr = localStorage.getItem('lastAIAnalysisRun');
            if (lastRunStr) {
                lastReviewEl.textContent = `Last: ${timeAgo(lastRunStr)}`;
            } else {
                lastReviewEl.textContent = 'No reviews yet';
            }
        }
    }
    
    // Update next review time
    if (nextReviewEl) {
        const nextTime = getNextScheduledAnalysisTime();
        const timeUntil = nextTime.getTime() - Date.now();
        const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60));
        const minutesUntil = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hoursUntil > 0) {
            nextReviewEl.textContent = `Next: in ${hoursUntil}h ${minutesUntil}m`;
        } else {
            nextReviewEl.textContent = `Next: in ${minutesUntil}m`;
        }
    }
    
    // Update active count
    if (activeCountEl) {
        if (totalCount > 0) {
            const parts = [];
            if (buyCount > 0) parts.push(`${buyCount} BUY`);
            if (sellCount > 0) parts.push(`${sellCount} SELL`);
            activeCountEl.textContent = `Active: ${parts.join(' • ')}`;
            activeCountEl.style.fontWeight = '600';
            activeCountEl.style.color = '#10b981';
        } else {
            activeCountEl.textContent = 'No active recommendations';
            activeCountEl.style.fontWeight = 'normal';
        }
    }
}

/**
 * Update last analysis time (legacy function for compatibility)
 */
export function updateLastAnalysisTime(timestamp) {
    lastAnalysisTimestamp = timestamp;
    refreshAnalysisTimeDisplay();
}

/**
 * Refresh the time display (legacy function for compatibility)
 */
export function refreshAnalysisTimeDisplay() {
    // This is now handled by updateRecommendationsHeader
    // Keep for backward compatibility
}

/**
 * Fetch and display market conditions
 */
export async function loadMarketConditions() {
    try {
        const response = await fetch('/api/market/conditions');
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error:', response.status, errorText);
            throw new Error(`API returned ${response.status}: ${errorText}`);
        }
        
        const conditions = await response.json();
        displayMarketConditions(conditions);
    } catch (error) {
        console.error('Error loading market conditions:', error);
        const contentElTop = document.getElementById('market-conditions-content-top');
        if (contentElTop) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            contentElTop.innerHTML = `<div class="error">Failed to load market conditions<br><small style="font-weight: normal; opacity: 0.8;">${errorMsg}</small></div>`;
        }
    }
}

/**
 * Display market conditions in the UI
 */
function displayMarketConditions(conditions) {
    // Update both locations: top banner and recommendations section
    const timestampEl = document.getElementById('market-conditions-timestamp');
    const contentElTop = document.getElementById('market-conditions-content-top');
    const timestampElTop = document.getElementById('market-conditions-timestamp-top');
    
    if (!contentElTop) return;
    
    // Update timestamps
    const timeAgoText = timeAgo(new Date(conditions.timestamp));
    if (timestampEl) {
        timestampEl.textContent = timeAgoText;
    }
    if (timestampElTop) {
        timestampElTop.textContent = timeAgoText;
    }
    
    // Map regime to emoji and color
    const regimeMap = {
        'bull': { emoji: '📈', label: 'Bull Market', color: '#10b981' },
        'bear': { emoji: '📉', label: 'Bear Market', color: '#ef4444' },
        'sideways': { emoji: '↔️', label: 'Sideways', color: '#6b7280' },
        'high_volatility': { emoji: '⚡', label: 'High Volatility', color: '#f59e0b' }
    };
    
    const volatilityMap = {
        'low': { emoji: '🟢', label: 'Low', color: '#10b981' },
        'medium': { emoji: '🟡', label: 'Medium', color: '#f59e0b' },
        'high': { emoji: '🔴', label: 'High', color: '#ef4444' }
    };
    
    const sentimentMap = {
        'risk-on': { emoji: '🚀', label: 'Risk-On', color: '#10b981' },
        'neutral': { emoji: '⚖️', label: 'Neutral', color: '#6b7280' },
        'risk-off': { emoji: '🛡️', label: 'Risk-Off', color: '#ef4444' }
    };
    
    const regime = regimeMap[conditions.marketRegime] || regimeMap['sideways'];
    const volatility = volatilityMap[conditions.volatility] || volatilityMap['medium'];
    const sentiment = sentimentMap[conditions.riskSentiment] || sentimentMap['neutral'];
    
    const htmlContent = `
        <div>
            <div style="color: var(--text-muted); font-size: 11px; margin-bottom: 4px;">Market Regime</div>
            <div style="font-weight: 600; color: ${regime.color};">${regime.emoji} ${regime.label}</div>
        </div>
        <div>
            <div style="color: var(--text-muted); font-size: 11px; margin-bottom: 4px;">Volatility</div>
            <div style="font-weight: 600; color: ${volatility.color};">${volatility.emoji} ${volatility.label}</div>
        </div>
        <div>
            <div style="color: var(--text-muted); font-size: 11px; margin-bottom: 4px;">Risk Sentiment</div>
            <div style="font-weight: 600; color: ${sentiment.color};">${sentiment.emoji} ${sentiment.label}</div>
        </div>
        <div>
            <div style="color: var(--text-muted); font-size: 11px; margin-bottom: 4px;">BTC Dominance</div>
            <div style="font-weight: 600; color: var(--text-primary);">${conditions.btcDominance.toFixed(1)}%</div>
        </div>
        <div style="grid-column: 1 / -1; margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--border-color);">
            <div style="color: var(--text-muted); font-size: 11px; margin-bottom: 4px;">Current Review Schedule</div>
            <div style="font-weight: 600; color: var(--text-secondary);">⏱️ Every ${conditions.recommendedInterval} ${conditions.recommendedInterval === 1 ? 'hour' : 'hours'}</div>
            <div style="color: var(--text-muted); font-size: 11px; margin-top: 4px; font-style: italic;">${conditions.reasoning}</div>
        </div>
    `;
    
    if (contentElTop) {
        contentElTop.innerHTML = htmlContent;
    }
}

/**
 * Populate buy form with recommendation data
 * TODO: Make this a proper feature - currently just a quick helper
 */
window.populateBuyForm = function(symbol, entryPrice, stopLoss) {
    // Scroll to the manual trading form
    const manualTradingCard = document.querySelector('#manual-trading-content');
    if (manualTradingCard) {
        manualTradingCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Populate the form fields
    const symbolInput = document.getElementById('manualTradeSymbol');
    const stopLossCheckbox = document.getElementById('addStopLoss');
    const stopLossInput = document.getElementById('stopLossPrice');
    
    if (symbolInput) {
        symbolInput.value = symbol;
        console.log(`📋 Populated buy form: ${symbol} @ $${entryPrice} (Stop: $${stopLoss})`);
    }
    
    // Enable stop loss checkbox if not already enabled
    if (stopLossCheckbox && !stopLossCheckbox.checked) {
        stopLossCheckbox.checked = true;
        // Trigger the onchange event to show advanced options
        if (typeof window.toggleAdvancedOptions === 'function') {
            window.toggleAdvancedOptions();
        }
    }
    
    // Set stop loss price after a brief delay to ensure advanced options are visible
    setTimeout(() => {
        if (stopLossInput && stopLoss) {
            stopLossInput.value = stopLoss.toFixed(2);
        }
    }, 100);
    
    // Show success message
    if (typeof window.showSuccess === 'function') {
        window.showSuccess('Quick Buy', `Populated buy form with ${symbol}. Entry: $${entryPrice.toFixed(2)}, Stop Loss: $${stopLoss.toFixed(2)}. Review and adjust before submitting.`);
    }
};
