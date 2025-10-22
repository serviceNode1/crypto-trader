/**
 * Analysis UI Module
 * Handles cryptocurrency analysis display
 */

/* global document, fetch */
/* eslint-disable no-console */
import { API_BASE } from '../config.js';
import { formatPrice } from '../utils/formatters.js';
import { showAlert } from '../utils/modal.js';

/**
 * Select a crypto and trigger analysis
 */
export function selectCrypto(symbol) {
    document.getElementById('cryptoSearch').value = symbol.toUpperCase();
    analyzeCrypto();
}

/**
 * Analyze a cryptocurrency
 */
export async function analyzeCrypto() {
    const symbol = document.getElementById('cryptoSearch').value.trim().toUpperCase();
    const aiModel = document.getElementById('aiModelSelect').value;
    
    if (!symbol) {
        await showAlert('Symbol Required', 'Please enter a cryptocurrency symbol', { icon: '⚠️' });
        return;
    }

    const resultDiv = document.getElementById('analysisResult');
    const contentDiv = document.getElementById('analysisContent');
    const titleDiv = document.getElementById('analysisTitle');
    
    // Get model display name
    const modelNames = {
        'local': 'Local Analysis',
        'anthropic': 'Anthropic Claude',
        'openai': 'OpenAI GPT-4',
        'both': 'AI Consensus'
    };
    const modelName = modelNames[aiModel] || aiModel;
    
    // Show loading state
    resultDiv.style.display = 'block';
    titleDiv.textContent = `Analyzing ${symbol} with ${modelName}...`;
    contentDiv.innerHTML = `
        <div class="analysis-loading">
            <div class="spinner"></div>
            <div>
                <strong>Fetching comprehensive analysis...</strong><br>
                <span style="font-size: 14px;">Using ${modelName} • This may take ${aiModel === 'both' ? '30-60' : '10-30'} seconds</span>
            </div>
        </div>
    `;
    
    // Scroll to results
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
        // Call the analysis endpoint with model parameter
        const response = await fetch(`${API_BASE}/analyze/${symbol}?model=${aiModel}`);
        
        if (!response.ok) {
            throw new Error(`Analysis failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Display results
        titleDiv.textContent = `✅ Analysis Complete: ${symbol}`;
        contentDiv.innerHTML = formatAnalysisResults(data);
        
        // Force layout recalculation and scroll to ensure panel resizes
        requestAnimationFrame(() => {
            resultDiv.style.height = 'auto';
            resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            // Update parent card height to accommodate the analysis content
            updateParentCardHeight();
        });
        
    } catch (error) {
        console.error('Analysis error:', error);
        titleDiv.textContent = `❌ Analysis Failed`;
        contentDiv.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #ef4444;">
                <strong>Unable to analyze ${symbol}</strong><br>
                <span style="font-size: 14px;">${error.message}</span><br><br>
                <p style="font-size: 14px; color: #6b7280;">
                    Make sure the symbol is correct and try again. Popular symbols: BTC, ETH, SOL, ADA, AVAX, DOT, MATIC, LINK
                </p>
            </div>
        `;
        
        // Force layout recalculation for error display
        requestAnimationFrame(() => {
            resultDiv.style.height = 'auto';
            resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            // Update parent card height for error display
            updateParentCardHeight();
        });
    }
}

/**
 * Close analysis panel
 */
export function closeAnalysis() {
    document.getElementById('analysisResult').style.display = 'none';
    
    // Update parent card height after closing
    setTimeout(() => updateParentCardHeight(), 50);
}

/**
 * Create candlestick chart SVG
 */
function createCandlestickChart(candlesticks, currentPrice) {
    if (!candlesticks || candlesticks.length === 0) return '<p>No chart data available</p>';
    
    // Find min and max prices for scaling
    const prices = candlesticks.flatMap(c => [c.high, c.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const padding = priceRange * 0.1; // 10% padding
    
    // Calculate dimensions
    const chartWidth = 100; // percentage
    const chartHeight = 220; // pixels
    const candleWidth = chartWidth / candlesticks.length * 0.7; // 70% of available space
    const candleGap = chartWidth / candlesticks.length * 0.3; // 30% gap
    
    // Generate candlesticks
    const candles = candlesticks.map((candle, index) => {
        const isGreen = candle.close >= candle.open;
        const color = isGreen ? '#10b981' : '#ef4444';
        
        // Calculate positions (inverted Y axis for SVG)
        const high = ((maxPrice + padding - candle.high) / (priceRange + 2 * padding)) * 100;
        const low = ((maxPrice + padding - candle.low) / (priceRange + 2 * padding)) * 100;
        const open = ((maxPrice + padding - candle.open) / (priceRange + 2 * padding)) * 100;
        const close = ((maxPrice + padding - candle.close) / (priceRange + 2 * padding)) * 100;
        
        const bodyTop = Math.min(open, close);
        const bodyBottom = Math.max(open, close);
        const bodyHeight = Math.abs(close - open);
        
        const x = (index / candlesticks.length) * 100 + candleGap / 2;
        
        return `
            <g>
                <!-- Wick -->
                <line x1="${x + candleWidth/2}%" y1="${high}%" 
                      x2="${x + candleWidth/2}%" y2="${low}%" 
                      stroke="${color}" stroke-width="1"/>
                <!-- Body -->
                <rect x="${x}%" y="${bodyTop}%" 
                      width="${candleWidth}%" height="${bodyHeight || 0.5}%" 
                      fill="${color}" stroke="${color}"/>
            </g>
        `;
    }).join('');
    
    // Current price line
    const currentPriceY = ((maxPrice + padding - currentPrice) / (priceRange + 2 * padding)) * 100;
    
    return `
        <svg width="100%" height="${chartHeight}px" style="display: block;">
            ${candles}
            <!-- Current Price Line -->
            <line x1="0%" y1="${currentPriceY}%" x2="100%" y2="${currentPriceY}%" 
                  stroke="#667eea" stroke-width="2" stroke-dasharray="5,5" opacity="0.7"/>
            <text x="2" y="${currentPriceY - 2}%" fill="#667eea" font-size="10" font-weight="bold">
                Current: $${currentPrice.toLocaleString()}
            </text>
            
            <!-- Price labels -->
            <text x="2" y="8" fill="#6b7280" font-size="10">
                $${maxPrice.toLocaleString()}
            </text>
            <text x="2" y="${chartHeight - 2}" fill="#6b7280" font-size="10">
                $${minPrice.toLocaleString()}
            </text>
        </svg>
    `;
}

/**
 * Format analysis results into HTML
 */
function formatAnalysisResults(data) {
    const recommendation = data.recommendation || {};
    const technical = data.technical || {};
    const sentiment = data.sentiment || {};
    
    // Check if we have multi-model analysis
    const hasMultiModel = recommendation.multiModel && recommendation.multiModel.openai && recommendation.multiModel.anthropic;
    
    let recommendationHTML = '';
    
    if (hasMultiModel) {
        // Show both model analyses side-by-side
        const openai = recommendation.multiModel.openai;
        const anthropic = recommendation.multiModel.anthropic;
        
        recommendationHTML = `
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border: 2px solid #3b82f6; margin-bottom: 20px;">
                <h4 style="margin: 0 0 15px 0; color: #1e40af; text-align: center;">🔬 Multi-Model Analysis (Consensus)</h4>
                <div style="display: grid; gap: 15px; margin-bottom: 15px;">
                    <div style="padding: 15px; background: white; border-radius: 6px; border-left: 4px solid ${
                        recommendation.action === 'BUY' ? '#10b981' : 
                        recommendation.action === 'SELL' ? '#ef4444' : '#6b7280'
                    };">
                        <div style="font-weight: 600; color: #374151; margin-bottom: 8px;">Final Consensus:</div>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <span style="padding: 8px 16px; background: ${
                                recommendation.action === 'BUY' ? '#10b981' : 
                                recommendation.action === 'SELL' ? '#ef4444' : '#6b7280'
                            }; color: white; border-radius: 6px; font-weight: 600; font-size: 16px;">
                                ${recommendation.action}
                            </span>
                            <span style="color: #6b7280; font-size: 14px;">
                                Confidence: <strong>${recommendation.confidence}%</strong>
                            </span>
                        </div>
                        <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 14px;">
                            ${recommendation.reasoning?.conclusion}
                        </p>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <!-- OpenAI Analysis -->
                    <div style="padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #10a37f;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                            <strong style="color: #10a37f;">🤖 OpenAI GPT-4o-mini</strong>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <span style="padding: 6px 12px; background: ${
                                openai.action === 'BUY' ? '#10b981' : 
                                openai.action === 'SELL' ? '#ef4444' : '#6b7280'
                            }; color: white; border-radius: 4px; font-weight: 600; font-size: 14px;">
                                ${openai.action}
                            </span>
                            <span style="color: #6b7280; font-size: 13px; margin-left: 8px;">
                                ${openai.confidence}% confidence
                            </span>
                        </div>
                        <p style="color: #6b7280; margin: 0; font-size: 13px; line-height: 1.5;">
                            ${openai.reasoning?.conclusion || 'No conclusion provided'}
                        </p>
                    </div>
                    
                    <!-- Anthropic Analysis -->
                    <div style="padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #d4732f;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                            <strong style="color: #d4732f;">🧠 Anthropic Claude Haiku</strong>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <span style="padding: 6px 12px; background: ${
                                anthropic.action === 'BUY' ? '#10b981' : 
                                anthropic.action === 'SELL' ? '#ef4444' : '#6b7280'
                            }; color: white; border-radius: 4px; font-weight: 600; font-size: 14px;">
                                ${anthropic.action}
                            </span>
                            <span style="color: #6b7280; font-size: 13px; margin-left: 8px;">
                                ${anthropic.confidence}% confidence
                            </span>
                        </div>
                        <p style="color: #6b7280; margin: 0; font-size: 13px; line-height: 1.5;">
                            ${anthropic.reasoning?.conclusion || 'No conclusion provided'}
                        </p>
                    </div>
                </div>
                
                <div style="margin-top: 15px; padding: 10px; background: white; border-radius: 4px; font-size: 12px; color: #6b7280; text-align: center;">
                    ${openai.action === anthropic.action ? 
                        `✅ <strong>Models Agree</strong> - Both models recommend ${openai.action}` : 
                        `⚠️ <strong>Models Disagree</strong> - OpenAI: ${openai.action} vs Claude: ${anthropic.action}`
                    }
                </div>
            </div>
        `;
    } else {
        // Single model display (existing)
        recommendationHTML = `
            <div style="padding: 20px; background: white; border-radius: 8px; border-left: 4px solid ${
                recommendation.action === 'BUY' ? '#10b981' : 
                recommendation.action === 'SELL' ? '#ef4444' : '#6b7280'
            };">
                <h4 style="margin: 0 0 10px 0; color: #1f2937;">AI Recommendation</h4>
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <span style="padding: 8px 16px; background: ${
                        recommendation.action === 'BUY' ? '#10b981' : 
                        recommendation.action === 'SELL' ? '#ef4444' : '#6b7280'
                    }; color: white; border-radius: 6px; font-weight: 600; font-size: 18px;">
                        ${recommendation.action || 'HOLD'}
                    </span>
                    <span style="font-size: 16px; color: #6b7280;">
                        Confidence: <strong style="color: #1f2937;">${recommendation.confidence || 0}%</strong>
                    </span>
                </div>
                <p style="color: #6b7280; margin: 0; line-height: 1.6;">
                    ${recommendation.reasoning?.conclusion || 'Analysis in progress...'}
                </p>
            </div>
        `;
    }
    
    return `
        <div style="display: grid; gap: 20px;">
            ${recommendationHTML}

            <!-- Price Chart -->
            ${data.candlesticks && data.candlesticks.length > 0 ? `
            <div style="background: white; border-radius: 8px; padding: 20px;">
                <h4 style="margin: 0 0 15px 0; color: #1f2937;">📈 Price Chart (Last 30 Periods)</h4>
                <div style="position: relative; height: 250px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px;">
                    ${createCandlestickChart(data.candlesticks, data.currentPrice)}
                </div>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280; text-align: center;">
                    Each bar represents ${data.candlesticks.length > 0 ? '~4 hours' : 'N/A'} • 
                    Source: ${data.symbol} OHLC data
                </p>
            </div>
            ` : ''}

            <!-- Price & Technical -->
            <div style="background: white; border-radius: 8px; padding: 20px;">
                <h4 style="margin: 0 0 15px 0; color: #1f2937;">📊 Technical Analysis</h4>
                <div style="display: grid; gap: 10px;">
                    <div class="analysis-stat">
                        <span class="analysis-stat-label">Current Price</span>
                        <span class="analysis-stat-value">$${data.currentPrice ? formatPrice(data.currentPrice) : 'N/A'}</span>
                    </div>
                    <div class="analysis-stat">
                        <span class="analysis-stat-label">Trend</span>
                        <span class="analysis-stat-value">${technical.trend?.trend?.toUpperCase() || 'N/A'}</span>
                    </div>
                    <div class="analysis-stat">
                        <span class="analysis-stat-label">RSI (14)</span>
                        <span class="analysis-stat-value" style="color: ${
                            technical.indicators?.rsi > 70 ? '#ef4444' : 
                            technical.indicators?.rsi < 30 ? '#10b981' : '#1f2937'
                        }">${technical.indicators?.rsi?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div class="analysis-stat">
                        <span class="analysis-stat-label">MACD Signal</span>
                        <span class="analysis-stat-value">${
                            technical.indicators?.macd?.histogram > 0 ? '📈 Bullish' : '📉 Bearish'
                        }</span>
                    </div>
                </div>
            </div>

            <!-- Sentiment -->
            <div style="background: white; border-radius: 8px; padding: 20px;">
                <h4 style="margin: 0 0 15px 0; color: #1f2937;">💭 Market Sentiment</h4>
                <div style="display: grid; gap: 10px;">
                    <div class="analysis-stat">
                        <span class="analysis-stat-label">Overall</span>
                        <span class="analysis-stat-value" style="color: ${
                            sentiment.overall?.classification === 'bullish' ? '#10b981' : 
                            sentiment.overall?.classification === 'bearish' ? '#ef4444' : '#6b7280'
                        }">
                            ${sentiment.overall?.classification?.toUpperCase() || 'NEUTRAL'}
                        </span>
                    </div>
                    <div class="analysis-stat">
                        <span class="analysis-stat-label">Sentiment Score</span>
                        <span class="analysis-stat-value">${sentiment.overall?.score?.toFixed(3) || '0.000'}</span>
                    </div>
                    <div class="analysis-stat">
                        <span class="analysis-stat-label">Mention Volume</span>
                        <span class="analysis-stat-value">${sentiment.mentionVolume || 0} posts</span>
                    </div>
                </div>
            </div>

            <!-- Trade Setup -->
            ${recommendation.entryPrice ? `
            <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; border: 2px solid #10b981;">
                <h4 style="margin: 0 0 15px 0; color: #1f2937;">🎯 Trade Setup</h4>
                <div style="display: grid; gap: 10px;">
                    <div class="analysis-stat">
                        <span class="analysis-stat-label">Entry Price</span>
                        <span class="analysis-stat-value">$${recommendation.entryPrice?.toLocaleString()}</span>
                    </div>
                    <div class="analysis-stat">
                        <span class="analysis-stat-label">Stop Loss</span>
                        <span class="analysis-stat-value" style="color: #ef4444;">$${recommendation.stopLoss?.toLocaleString()}</span>
                    </div>
                    <div class="analysis-stat">
                        <span class="analysis-stat-label">Take Profit Levels</span>
                        <span class="analysis-stat-value" style="color: #10b981;">
                            ${recommendation.takeProfitLevels?.map(tp => '$' + tp.toLocaleString()).join(', ') || 'N/A'}
                        </span>
                    </div>
                    <div class="analysis-stat">
                        <span class="analysis-stat-label">Position Size</span>
                        <span class="analysis-stat-value">${recommendation.positionSize}% of portfolio</span>
                    </div>
                    <div class="analysis-stat">
                        <span class="analysis-stat-label">Risk Level</span>
                        <span class="analysis-stat-value" style="color: ${
                            recommendation.riskLevel === 'HIGH' ? '#ef4444' : 
                            recommendation.riskLevel === 'MEDIUM' ? '#f59e0b' : '#10b981'
                        }">${recommendation.riskLevel}</span>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Key Factors -->
            ${recommendation.keyFactors?.length ? `
            <div style="background: white; border-radius: 8px; padding: 20px;">
                <h4 style="margin: 0 0 15px 0; color: #1f2937;">🔑 Key Factors</h4>
                <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
                    ${recommendation.keyFactors.map(factor => `<li>${factor}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
        </div>
    `;
}

/**
 * Update the parent card's max-height to accommodate new content
 */
function updateParentCardHeight() {
    const cardContent = document.getElementById('crypto-selector-content');
    if (!cardContent) {
        console.warn('crypto-selector-content not found');
        return;
    }
    
    // Don't update if card is collapsed
    if (cardContent.classList.contains('collapsed')) {
        return;
    }
    
    // Update max-height to current scroll height
    const newHeight = cardContent.scrollHeight + 'px';
    cardContent.style.maxHeight = newHeight;
    console.log('Updated crypto-selector-content max-height to:', newHeight);
}
