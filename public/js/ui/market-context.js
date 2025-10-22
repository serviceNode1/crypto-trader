/**
 * Market Context UI Module
 * Handles market indicators and AI analysis triggers
 */

/* global window, document */
/* eslint-disable no-console */
import { API_BASE } from '../config.js';
import { recordAnalysisRun } from './recommendations.js';

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
                    <div class="detail-item-label">Market Regime</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${regimeColor};">
                        ${data.context.marketRegime.toUpperCase()}
                    </div>
                </div>
                <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid ${sentimentColor};">
                    <div class="detail-item-label">Risk Sentiment</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${sentimentColor};">
                        ${data.context.riskSentiment.toUpperCase()}
                    </div>
                </div>
                <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6;">
                    <div class="detail-item-label">BTC Dominance</div>
                    <div style="font-size: 20px; font-weight: 700;">
                        ${data.context.btcDominance.toFixed(2)}%
                    </div>
                </div>
                <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid ${vixColor};">
                    <div class="detail-item-label">VIX (Fear Index)</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${vixColor};">
                        ${data.context.traditionalMarkets.vix.toFixed(2)}
                    </div>
                </div>
            </div>
            <div class="detail-box" style="margin-top: 15px; font-size: 13px;">
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
 * Show AI analysis progress messages
 */
function showAnalysisProgress() {
    const messages = [
        { icon: '🔍', text: 'Gathering coins for review...', delay: 0 },
        { icon: '📊', text: 'Analyzing market data and trends...', delay: 2000 },
        { icon: '📰', text: 'Reviewing news sentiment...', delay: 4000 },
        { icon: '🤖', text: 'Anthropic AI is evaluating opportunities...', delay: 6000 },
        { icon: '💭', text: 'OpenAI is analyzing coin fundamentals...', delay: 8000 },
        { icon: '🔄', text: 'AI models are discussing possibilities...', delay: 10000 },
        { icon: '⚖️', text: 'Weighing risk vs. reward scenarios...', delay: 12000 },
        { icon: '✨', text: 'Finalizing recommendations...', delay: 14000 },
    ];
    
    const listDiv = document.getElementById('recommendations-list');
    let currentMessage = 0;
    
    const updateMessage = () => {
        if (currentMessage < messages.length) {
            const msg = messages[currentMessage];
            listDiv.innerHTML = `
                <div style="padding: 25px; text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 15px;">
                        <div class="spinner" style="width: 30px; height: 30px;"></div>
                        <div style="font-size: 32px;">${msg.icon}</div>
                    </div>
                    <h4 style="color: var(--text-color); margin-bottom: 8px; font-size: 16px;">AI Analysis in Progress</h4>
                    <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 15px;">
                        ${msg.text}
                    </p>
                    <div style="max-width: 250px; margin: 0 auto; background: var(--progress-bg, #e5e7eb); border-radius: 8px; height: 6px; overflow: hidden;">
                        <div style="height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); width: ${((currentMessage + 1) / messages.length * 100)}%; transition: width 0.5s ease;"></div>
                    </div>
                    <p style="color: var(--text-muted); font-size: 12px; margin-top: 8px;">
                        Step ${currentMessage + 1} of ${messages.length}
                    </p>
                </div>
            `;
            currentMessage++;
            
            // Trigger card resize to fit content
            setTimeout(() => {
                const cardContent = document.getElementById('recommendations-content');
                if (cardContent && !cardContent.classList.contains('collapsed')) {
                    cardContent.style.maxHeight = cardContent.scrollHeight + 'px';
                }
            }, 50);
        }
    };
    
    // Show first message immediately
    updateMessage();
    
    // Schedule remaining messages
    const interval = setInterval(updateMessage, 2000);
    
    return () => clearInterval(interval);
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
        
        // Start progress animation
        const stopProgress = showAnalysisProgress();
        
        // Trigger recommendation job via API
        const response = await fetch(`${API_BASE}/recommendations/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maxBuy: 5, maxSell: 5 })
        });
        
        // Stop progress animation
        stopProgress();
        
        if (!response.ok) {
            throw new Error('Failed to trigger AI analysis');
        }
        
        const result = await response.json();
        
        console.log('AI Analysis result:', result);
        
        // Record analysis run time for scheduling
        recordAnalysisRun();
        
        // Check if recommendations were generated
        const hasRecommendations = result.recommendations && result.recommendations.length > 0;
        
        // Count buy and sell recommendations
        const buyCount = result.recommendations?.filter(r => r.action === 'BUY').length || 0;
        const sellCount = result.recommendations?.filter(r => r.action === 'SELL').length || 0;
        
        if (hasRecommendations) {
            // Show success message with results coming
            document.getElementById('recommendations-list').innerHTML = `
                <div style="padding: 20px; text-align: center; background: var(--success-bg, #d1fae5); border-radius: 6px; border: 1px solid var(--success-border, #10b981);">
                    <div style="font-size: 36px; margin-bottom: 10px;">✅</div>
                    <h4 style="color: var(--success-text, #065f46); margin-bottom: 8px; font-size: 16px;">Analysis Complete!</h4>
                    <p style="color: var(--success-text-secondary, #047857); margin-bottom: 10px; font-size: 15px; font-weight: 600;">
                        Generated ${buyCount} BUY and ${sellCount} SELL recommendation${(buyCount + sellCount) !== 1 ? 's' : ''}
                    </p>
                    <div class="spinner" style="width: 30px; height: 30px; margin: 15px auto;"></div>
                    <p style="color: var(--text-muted); font-size: 13px;">
                        Loading recommendations...
                    </p>
                </div>
            `;
            
            // Trigger card resize
            setTimeout(() => {
                const cardContent = document.getElementById('recommendations-content');
                if (cardContent && !cardContent.classList.contains('collapsed')) {
                    cardContent.style.maxHeight = cardContent.scrollHeight + 'px';
                }
            }, 50);
            
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
                <div style="padding: 20px; text-align: center; background: var(--warning-bg, #fef3c7); border-radius: 6px; border: 1px solid var(--warning-border, #f59e0b);">
                    <div style="font-size: 36px; margin-bottom: 10px;">⚠️</div>
                    <h4 style="color: var(--warning-text, #92400e); margin-bottom: 8px; font-size: 16px;">Analysis Complete</h4>
                    <p style="color: var(--warning-text-secondary, #78350f); margin-bottom: 8px; font-size: 15px; font-weight: 600;">
                        Generated 0 BUY and 0 SELL recommendations
                    </p>
                    <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 15px;">
                        ${result.message || 'No trading opportunities found at this time'}
                    </p>
                    <div style="background: var(--card-bg-secondary); border-radius: 4px; padding: 12px; margin: 15px 0; text-align: left;">
                        <strong style="color: var(--text-color); font-size: 13px;">💡 Why no recommendations?</strong>
                        <ul style="margin: 8px 0 0 20px; color: var(--text-muted); font-size: 12px; line-height: 1.5;">
                            <li>Market conditions may not meet AI safety criteria</li>
                            <li>Current prices may not offer favorable risk/reward</li>
                            <li>Market volatility may be too high for safe entries</li>
                            <li>Portfolio may already have optimal positions</li>
                        </ul>
                    </div>
                    <button 
                        onclick="loadRecommendations()" 
                        class="button" 
                        style="padding: 8px 16px; font-size: 13px;">
                        ← Back to Recommendations
                    </button>
                </div>
            `;
            
            // Trigger card resize
            setTimeout(() => {
                const cardContent = document.getElementById('recommendations-content');
                if (cardContent && !cardContent.classList.contains('collapsed')) {
                    cardContent.style.maxHeight = cardContent.scrollHeight + 'px';
                }
            }, 50);
        }
        
    } catch (error) {
        console.error('Failed to trigger AI analysis:', error);
        
        // Show error
        document.getElementById('recommendations-list').innerHTML = `
            <div class="alert alert-error" style="padding: 20px; text-align: center;">
                <div style="font-size: 36px; margin-bottom: 10px;">❌</div>
                <h4 style="margin-bottom: 8px; font-size: 16px;">Analysis Failed</h4>
                <p style="margin-bottom: 15px; font-size: 13px;">
                    ${error.message}
                </p>
                <button 
                    onclick="loadRecommendations()" 
                    class="button" 
                    style="background: #667eea; padding: 8px 16px; font-size: 13px;">
                    ← Back to Recommendations
                </button>
            </div>
        `;
        
        // Trigger card resize
        setTimeout(() => {
            const cardContent = document.getElementById('recommendations-content');
            if (cardContent && !cardContent.classList.contains('collapsed')) {
                cardContent.style.maxHeight = cardContent.scrollHeight + 'px';
            }
        }, 50);
    } finally {
        // Re-enable button
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
            button.style.opacity = '1';
        }
    }
}
