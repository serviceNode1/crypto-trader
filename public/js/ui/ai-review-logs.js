/**
 * AI Review Logs UI Module
 * Displays logs of AI scheduled review system
 */

/* global document */
/* eslint-disable no-console */
import { API_BASE } from '../config.js';
import { timeAgo } from '../utils/time.js';

/**
 * Load and display AI review logs
 */
export async function loadAIReviewLogs() {
    console.log('loadAIReviewLogs called');
    
    const contentEl = document.getElementById('ai-review-logs-content');
    if (!contentEl) {
        console.error('AI review logs content element not found');
        return;
    }
    
    contentEl.innerHTML = '<p style="padding: 20px; text-align: center;">Loading logs...</p>';
    
    try {
        console.log('Fetching AI review logs from:', `${API_BASE}/ai-review-logs?limit=50`);
        const response = await fetch(`${API_BASE}/ai-review-logs?limit=50`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('AI review logs loaded:', data);
        displayAIReviewLogs(data.logs, data.stats);
        
        // Update parent card height after content is rendered
        setTimeout(() => {
            const cardContent = document.getElementById('recommendations-content');
            if (cardContent && !cardContent.classList.contains('collapsed')) {
                cardContent.style.maxHeight = cardContent.scrollHeight + 'px';
                console.log('Updated card height after logs loaded:', cardContent.scrollHeight + 'px');
            }
        }, 50);
        
    } catch (error) {
        console.error('Failed to load AI review logs:', error);
        contentEl.innerHTML = `
            <p style="color: #ef4444; padding: 20px; text-align: center;">
                Failed to load AI review logs: ${error.message}
            </p>
        `;
    }
}

/**
 * Display AI review logs
 */
function displayAIReviewLogs(logs, stats) {
    const container = document.getElementById('ai-review-logs-content');
    
    if (!logs || logs.length === 0) {
        container.innerHTML = `
            <div style="padding: 30px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 15px;">📋</div>
                <p style="color: var(--text-muted);">No AI review logs yet</p>
                <p style="font-size: 13px; color: var(--text-muted); margin-top: 10px;">
                    Logs will appear here after the first scheduled AI review runs
                </p>
            </div>
        `;
        return;
    }
    
    // Stats summary
    const statsHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; padding: 15px; background: var(--card-bg-secondary); border-radius: 8px;">
            <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: 600; color: var(--text-primary);">${stats.totalReviews}</div>
                <div style="font-size: 12px; color: var(--text-muted);">Total Reviews</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: 600; color: #10b981;">${stats.successfulReviews}</div>
                <div style="font-size: 12px; color: var(--text-muted);">Successful</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: 600; color: #ef4444;">${stats.failedReviews}</div>
                <div style="font-size: 12px; color: var(--text-muted);">Failed</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: 600; color: #3b82f6;">${stats.totalBuyRecommendations}</div>
                <div style="font-size: 12px; color: var(--text-muted);">BUY Recs</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: 600; color: #f59e0b;">${stats.totalSellRecommendations}</div>
                <div style="font-size: 12px; color: var(--text-muted);">SELL Recs</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: 600; color: var(--text-primary);">${Math.round(stats.avgDurationMs / 1000)}s</div>
                <div style="font-size: 12px; color: var(--text-muted);">Avg Duration</div>
            </div>
        </div>
    `;
    
    // Logs timeline
    const logsHTML = logs.map(log => {
        const statusColor = log.status === 'completed' ? '#10b981' : 
                           log.status === 'failed' ? '#ef4444' : '#f59e0b';
        const statusIcon = log.status === 'completed' ? '✅' : 
                          log.status === 'failed' ? '❌' : '⏳';
        
        const typeIcon = log.reviewType === 'scheduled' ? '⏰' :
                        log.reviewType === 'manual' ? '👤' : '🔔';
        
        return `
            <div style="border-left: 4px solid ${statusColor}; padding: 15px; margin-bottom: 15px; background: var(--card-bg-secondary); border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div>
                        <span style="font-weight: 600; color: var(--text-primary);">
                            ${typeIcon} ${log.reviewType.charAt(0).toUpperCase() + log.reviewType.slice(1)} Review
                        </span>
                        <span style="margin-left: 10px; font-size: 13px; padding: 3px 8px; background: ${statusColor}; color: white; border-radius: 4px; font-weight: 600;">
                            ${statusIcon} ${log.status.toUpperCase()}
                        </span>
                        ${log.phase ? `<span style="margin-left: 8px; font-size: 12px; color: var(--text-muted);">Phase: ${log.phase}</span>` : ''}
                    </div>
                    <div style="text-align: right; font-size: 12px; color: var(--text-muted);">
                        ${timeAgo(log.timestamp)}<br>
                        ${log.duration ? `<span style="color: var(--text-primary); font-weight: 500;">${Math.round(log.duration / 1000)}s</span>` : ''}
                    </div>
                </div>
                
                ${log.status === 'completed' ? `
                    <div style="display: flex; gap: 20px; font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
                        <span>📊 ${log.coinsAnalyzed || 0} coins analyzed</span>
                        <span style="color: #10b981;">📈 ${log.buyRecommendations || 0} BUY</span>
                        <span style="color: #ef4444;">📉 ${log.sellRecommendations || 0} SELL</span>
                        <span>⏭️ ${log.skippedOpportunities || 0} skipped</span>
                    </div>
                    ${log.metadata?.aiRejected ? `
                        <div style="font-size: 12px; color: var(--text-muted); padding: 8px; background: var(--bg); border-radius: 4px;">
                            🤖 AI rejected: ${log.metadata.aiRejected.buy} BUY + ${log.metadata.aiRejected.sell} SELL (recommended HOLD instead)
                        </div>
                    ` : ''}
                ` : ''}
                
                ${log.errorMessage ? `
                    <div style="margin-top: 10px; padding: 10px; background: #fee2e2; border-radius: 4px; font-size: 13px; color: #991b1b;">
                        <strong>Error:</strong> ${log.errorMessage}
                    </div>
                ` : ''}
                
                ${log.metadata && Object.keys(log.metadata).length > 0 ? `
                    <details style="margin-top: 10px; font-size: 12px;">
                        <summary style="cursor: pointer; color: var(--text-muted); user-select: none;">
                            View Metadata
                        </summary>
                        <pre style="margin-top: 8px; padding: 10px; background: var(--bg-card); border-radius: 4px; overflow-x: auto; font-size: 11px;">${JSON.stringify(log.metadata, null, 2)}</pre>
                    </details>
                ` : ''}
            </div>
        `;
    }).join('');
    
    container.innerHTML = statsHTML + logsHTML;
}

/**
 * Toggle AI review logs visibility
 */
export function toggleAIReviewLogs() {
    console.log('toggleAIReviewLogs called');
    const container = document.getElementById('ai-review-logs-panel');
    
    if (!container) {
        console.error('AI review logs panel not found - check HTML for id="ai-review-logs-panel"');
        return;
    }
    
    // Check computed style, not just inline style
    const computedStyle = window.getComputedStyle(container);
    const isVisible = computedStyle.display !== 'none';
    
    console.log('AI review logs panel current display:', computedStyle.display, 'isVisible:', isVisible);
    
    if (isVisible) {
        console.log('Hiding AI review logs panel');
        container.style.display = 'none';
        // Update parent card height after hiding
        updateParentCardHeight();
    } else {
        console.log('Showing AI review logs panel');
        container.style.display = 'block';
        loadAIReviewLogs();
        // Update parent card height after showing (with slight delay for content to render)
        setTimeout(() => updateParentCardHeight(), 100);
    }
}

/**
 * Update the parent card's max-height to accommodate new content
 */
function updateParentCardHeight() {
    const cardContent = document.getElementById('recommendations-content');
    if (!cardContent) return;
    
    // Don't update if card is collapsed
    if (cardContent.classList.contains('collapsed')) return;
    
    // Update max-height to current scroll height
    cardContent.style.maxHeight = cardContent.scrollHeight + 'px';
    console.log('Updated recommendations-content max-height to:', cardContent.scrollHeight + 'px');
}
