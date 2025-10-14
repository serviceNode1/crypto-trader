/**
 * Recommendations UI Module
 * Handles displaying AI recommendations
 */

/* global document, localStorage */
/* eslint-disable no-console */
import { fetchRecommendations } from '../api/analysis.js';
import { timeAgo } from '../utils/time.js';

let lastAnalysisTimestamp = null;
let nextScheduledAnalysis = null;

/**
 * Get next scheduled analysis time based on last run and user settings
 */
function getNextScheduledAnalysisTime() {
    // If already calculated and still in future, return it
    if (nextScheduledAnalysis && nextScheduledAnalysis > new Date()) {
        return nextScheduledAnalysis;
    }
    
    // Get user's analysis frequency setting (in hours)
    const settingsStr = localStorage.getItem('tradingSettings');
    const settings = settingsStr ? JSON.parse(settingsStr) : { analysisFrequency: 4 };
    const frequencyHours = settings.analysisFrequency || 4;
    
    // Get last analysis time from localStorage or use current time
    const lastRunStr = localStorage.getItem('lastAIAnalysisRun');
    const lastRun = lastRunStr ? new Date(lastRunStr) : new Date();
    
    // Calculate next run: last run + frequency
    const nextRun = new Date(lastRun.getTime() + (frequencyHours * 60 * 60 * 1000));
    
    // If next run is in the past, schedule for next interval from now
    if (nextRun <= new Date()) {
        nextScheduledAnalysis = new Date(Date.now() + (frequencyHours * 60 * 60 * 1000));
    } else {
        nextScheduledAnalysis = nextRun;
    }
    
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
 * Load and display recommendations
 */
export async function loadRecommendations() {
    try {
        const data = await fetchRecommendations(5);
        if (!data) return; // Rate limited

        if (data.length > 0) {
            // Find most recent recommendation
            const mostRecent = data.reduce((latest, rec) => {
                const recTime = new Date(rec.createdAt);
                return !latest || recTime > new Date(latest.createdAt) ? rec : latest;
            }, null);

            // Update time display
            updateLastAnalysisTime(mostRecent.createdAt);

            const recsHTML = data.map(rec => {
                const actionClass = rec.action === 'BUY' ? 'positive' : 
                                  rec.action === 'SELL' ? 'negative' : 'neutral';
                
                return `
                    <div class="metric" style="border-left: 4px solid ${
                        rec.action === 'BUY' ? '#10b981' : 
                        rec.action === 'SELL' ? '#ef4444' : '#6b7280'
                    }; padding-left: 15px; margin-bottom: 15px; background: var(--card-bg-secondary); padding: 12px; border-radius: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <strong style="font-size: 16px; color: var(--text-color);">${rec.symbol}</strong>
                            <span class="badge badge-${rec.action.toLowerCase()}" style="font-size: 13px;">
                                ${rec.action}
                            </span>
                        </div>
                        <div style="color: var(--text-secondary); font-size: 13px; line-height: 1.5;">
                            <div><strong style="color: var(--text-color);">Confidence:</strong> ${rec.confidence}% | <strong style="color: var(--text-color);">Risk:</strong> ${rec.riskLevel || 'Medium'}</div>
                            ${rec.reasoning ? `<div style="margin-top: 4px;"><strong style="color: var(--text-color);">Reasoning:</strong> ${rec.reasoning}</div>` : ''}
                            ${rec.entryPrice ? `<div style="margin-top: 4px;"><strong style="color: var(--text-color);">Entry:</strong> $${rec.entryPrice.toFixed(2)}</div>` : ''}
                            ${rec.stopLoss ? `<div style="margin-top: 4px;"><strong style="color: var(--text-color);">Stop Loss:</strong> $${rec.stopLoss.toFixed(2)}</div>` : ''}
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
            // Show helpful message with next analysis time and force button
            const nextAnalysisTime = getNextScheduledAnalysisTime();
            document.getElementById('recommendations-list').innerHTML = `
                <div style="padding: 20px; border-radius: 6px; border: 1px solid #e5e7eb;">
                    <div style="text-align: center; margin-bottom: 15px;">
                        <div style="font-size: 14px; margin-bottom: 8px; color: var(--text-color);">No active recommendations yet</div>
                        <div style="font-size: 13px; color: var(--text-muted);">Next scheduled analysis: <strong style="color: var(--text-color);">${nextAnalysisTime.toLocaleString()}</strong></div>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button 
                            onclick="runAIAnalysisNow()" 
                            class="button" 
                            style="padding: 10px 20px; font-size: 14px;">
                            🔍 Run AI Analysis Now
                        </button>
                        <button 
                            onclick="document.getElementById('cryptoSearch').focus()" 
                            class="button" 
                            style="background: #6b7280; padding: 10px 20px; font-size: 14px;">
                            Analyze Specific Coin
                        </button>
                    </div>
                </div>
            `;
            document.getElementById('last-analysis-time').textContent = 'No analysis yet';
            
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
 * Update last analysis time
 */
export function updateLastAnalysisTime(timestamp) {
    lastAnalysisTimestamp = timestamp;
    refreshAnalysisTimeDisplay();
}

/**
 * Refresh the time display
 */
export function refreshAnalysisTimeDisplay() {
    if (!lastAnalysisTimestamp) return;
    
    const displayEl = document.getElementById('last-analysis-time');
    if (displayEl) {
        displayEl.textContent = `Last analysis: ${timeAgo(lastAnalysisTimestamp)}`;
    }
}
