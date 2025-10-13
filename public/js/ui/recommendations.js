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
                            <div><strong>Confidence:</strong> ${rec.confidence}%</div>
                            <div><strong>Reasoning:</strong> ${rec.reasoning || 'Based on market analysis'}</div>
                            <div style="font-size: 11px; margin-top: 5px; color: #9ca3af;">
                                ${timeAgo(rec.createdAt)}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('recommendations-list').innerHTML = recsHTML;
        } else {
            document.getElementById('recommendations-list').innerHTML = 
                '<p style="color: #6b7280; text-align: center; padding: 20px;">No recommendations yet. Run AI analysis to generate recommendations.</p>';
        }
    } catch (error) {
        console.error('Failed to load recommendations:', error);
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
