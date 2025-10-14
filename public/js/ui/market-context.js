/**
 * Market Context UI Module
 * Handles market indicators and AI analysis triggers
 */

/* global document, window */
/* eslint-disable no-console */
import { API_BASE } from '../config.js';

/**
 * Get color for market regime
 */
function getMarketRegimeColor(regime) {
    const colors = {
        'bull': '#10b981',
        'bear': '#ef4444',
        'sideways': '#6b7280',
        'high_volatility': '#f59e0b'
    };
    return colors[regime.toLowerCase()] || '#6b7280';
}

/**
 * Get color for risk sentiment
 */
function getRiskSentimentColor(sentiment) {
    const colors = {
        'risk-on': '#10b981',
        'risk-off': '#ef4444',
        'neutral': '#6b7280'
    };
    return colors[sentiment.toLowerCase()] || '#6b7280';
}

/**
 * Get color for VIX level
 */
function getVIXColor(vix) {
    if (vix < 15) return '#10b981'; // Low fear
    if (vix < 20) return '#6b7280'; // Normal
    if (vix < 30) return '#f59e0b'; // Elevated
    return '#ef4444'; // High panic
}

/**
 * Load and display market context
 */
export async function loadMarketContext() {
    try {
        const response = await fetch(`${API_BASE}/market-context`);
        const data = await response.json();

        const regimeColor = getMarketRegimeColor(data.context.marketRegime);
        const sentimentColor = getRiskSentimentColor(data.context.riskSentiment);
        const vixColor = getVIXColor(data.context.traditionalMarkets.vix);

        // Detailed view for modal
        const modalHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid ${regimeColor};">
                    <div style="color: #6b7280; font-size: 13px; margin-bottom: 5px;">Market Regime</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${regimeColor};">
                        ${data.context.marketRegime.toUpperCase()}
                    </div>
                </div>
                <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid ${sentimentColor};">
                    <div style="color: #6b7280; font-size: 13px; margin-bottom: 5px;">Risk Sentiment</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${sentimentColor};">
                        ${data.context.riskSentiment.toUpperCase()}
                    </div>
                </div>
                <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6;">
                    <div style="color: #6b7280; font-size: 13px; margin-bottom: 5px;">BTC Dominance</div>
                    <div style="font-size: 20px; font-weight: 700; color: #1f2937;">
                        ${data.context.btcDominance.toFixed(2)}%
                    </div>
                </div>
                <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid ${vixColor};">
                    <div style="color: #6b7280; font-size: 13px; margin-bottom: 5px;">VIX (Fear Index)</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${vixColor};">
                        ${data.context.traditionalMarkets.vix.toFixed(2)}
                    </div>
                </div>
            </div>
            <div style="margin-top: 15px; padding: 12px; background: white; border-radius: 6px; font-size: 13px; color: #6b7280;">
                <strong>💡 Interpretation:</strong> 
                ${data.context.marketRegime === 'bull' ? '📈 Bull market - favorable for long positions.' : ''}
                ${data.context.marketRegime === 'bear' ? '📉 Bear market - consider defensive strategies.' : ''}
                ${data.context.marketRegime === 'sideways' ? '↔️ Sideways - range trading or wait for breakout.' : ''}
                ${data.context.riskSentiment === 'risk-on' ? ' Investors are buying risky assets (good for crypto).' : ''}
                ${data.context.riskSentiment === 'risk-off' ? ' Investors are seeking safety (caution in crypto).' : ''}
            </div>
        `;

        // Load into modal
        const modalDiv = document.getElementById('live-market-context');
        if (modalDiv) {
            modalDiv.innerHTML = modalHTML;
        }

        // Also load into old div if it exists (backwards compatibility)
        const oldDiv = document.getElementById('market-context');
        if (oldDiv) {
            const contextHTML = `
                <div class="metric">
                    <span class="metric-label">BTC Dominance</span>
                    <span class="metric-value">${data.context.btcDominance.toFixed(2)}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Market Regime</span>
                    <span class="metric-value" style="color: ${regimeColor};">${data.context.marketRegime.toUpperCase()}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Risk Sentiment</span>
                    <span class="metric-value" style="color: ${sentimentColor};">${data.context.riskSentiment.toUpperCase()}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">VIX</span>
                    <span class="metric-value" style="color: ${vixColor};">${data.context.traditionalMarkets.vix.toFixed(2)}</span>
                </div>
            `;
            oldDiv.innerHTML = contextHTML;
        }
    } catch (error) {
        console.error('Failed to load market context:', error);
    }
}

/**
 * Run AI analysis now (force recommendation generation)
 */
export async function runAIAnalysisNow(event) {
    const button = event?.target || document.getElementById('runAnalysisBtn');
    const originalText = button?.textContent || '🤖 Run AI Analysis Now';
    
    try {
        // Disable button and show loading
        if (button) {
            button.disabled = true;
            button.textContent = '⏳ Running Analysis...';
            button.style.opacity = '0.6';
        }
        
        // Trigger recommendation job via API
        const response = await fetch(`${API_BASE}/recommendations/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maxBuy: 5, maxSell: 5 })
        });
        
        if (!response.ok) {
            throw new Error('Failed to trigger AI analysis');
        }
        
        const result = await response.json();
        
        // Check if recommendations were generated
        const hasRecommendations = result.recommendations && result.recommendations.length > 0;
        
        if (hasRecommendations) {
            // Show success message with results coming
            document.getElementById('recommendations-list').innerHTML = `
                <div style="padding: 20px; text-align: center; background: #d1fae5; border-radius: 6px; border: 1px solid #10b981;">
                    <div style="color: #065f46; font-weight: 600; margin-bottom: 8px;">✅ Analysis Complete!</div>
                    <p style="color: #047857; margin-bottom: 10px; font-size: 14px;">
                        ${result.message || 'Generated recommendations'}
                    </p>
                    <p style="color: #6b7280; font-size: 13px;">
                        Refreshing to show results...
                    </p>
                </div>
            `;
            
            // Reload recommendations immediately
            setTimeout(() => {
                // loadRecommendations() is exposed globally by main.js
                if (window.loadRecommendations) {
                    window.loadRecommendations();
                }
            }, 2000); // 2 seconds
        } else {
            // No recommendations generated
            document.getElementById('recommendations-list').innerHTML = `
                <div style="padding: 20px; text-align: center; background: #fef3c7; border-radius: 6px; border: 1px solid #f59e0b;">
                    <div style="color: #92400e; font-weight: 600; margin-bottom: 8px;">⚠️ Analysis Complete</div>
                    <p style="color: #78350f; margin-bottom: 10px; font-size: 14px;">
                        ${result.message || 'No trading opportunities found at this time'}
                    </p>
                    <p style="color: #6b7280; font-size: 13px; margin-bottom: 15px;">
                        Current market conditions don't meet the AI's criteria for safe trades.
                    </p>
                    <button 
                        onclick="loadRecommendations()" 
                        class="button" 
                        style="padding: 8px 16px; font-size: 13px;">
                        ← Back
                    </button>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Failed to trigger AI analysis:', error);
        
        // Show error
        document.getElementById('recommendations-list').innerHTML = `
            <div style="padding: 30px; text-align: center; background: #fee2e2; border-radius: 8px; border: 2px solid #ef4444;">
                <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
                <h3 style="color: #991b1b; margin-bottom: 10px;">Analysis Failed</h3>
                <p style="color: #7f1d1d; margin-bottom: 20px;">
                    ${error.message}
                </p>
                <button 
                    onclick="loadRecommendations()" 
                    class="button" 
                    style="background: #667eea;">
                    ← Back
                </button>
            </div>
        `;
    } finally {
        // Re-enable button
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
            button.style.opacity = '1';
        }
    }
}
