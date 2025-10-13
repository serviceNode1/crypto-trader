/**
 * Recommendations UI Module
 * Handles displaying AI recommendations
 */

/* global document */
/* eslint-disable no-console */
import { fetchRecommendations } from '../api/analysis.js';
import { timeAgo } from '../utils/time.js';

let lastAnalysisTimestamp = null;

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
                    }; padding-left: 15px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <strong style="font-size: 16px;">${rec.symbol}</strong>
                            <span class="badge badge-${rec.action.toLowerCase()}" style="font-size: 13px;">
                                ${rec.action}
                            </span>
                        </div>
                        <div style="color: #6b7280; font-size: 13px; line-height: 1.5;">
                            <div><strong>Confidence:</strong> ${rec.confidence}% | <strong>Risk:</strong> ${rec.riskLevel || 'Medium'}</div>
                            ${rec.reasoning ? `<div style="margin-top: 4px;"><strong>Reasoning:</strong> ${rec.reasoning}</div>` : ''}
                            ${rec.entryPrice ? `<div style="margin-top: 4px;">Entry: $${rec.entryPrice.toFixed(2)}</div>` : ''}
                            ${rec.stopLoss ? `<div style="margin-top: 4px;">Stop Loss: $${rec.stopLoss.toFixed(2)}</div>` : ''}
                            <div style="font-size: 11px; margin-top: 5px; color: #9ca3af;">
                                ${timeAgo(rec.createdAt)}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('recommendations-list').innerHTML = recsHTML;
        } else {
            // Show helpful message with next analysis time and force button
            const nextAnalysisTime = new Date(Date.now() + 3600000); // Next hour
            document.getElementById('recommendations-list').innerHTML = `
                <div style="padding: 20px; background: #fafbfc; border-radius: 6px; border: 1px solid #e5e7eb;">
                    <div style="text-align: center; margin-bottom: 15px;">
                        <div style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">No active recommendations yet</div>
                        <div style="color: #9ca3af; font-size: 13px;">Next scheduled analysis: <strong>${nextAnalysisTime.toLocaleTimeString()}</strong></div>
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
