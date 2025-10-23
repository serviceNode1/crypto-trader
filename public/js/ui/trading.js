/**
 * Trading UI Module
 * Handles manual trading, position management, and trade modals
 */

/* global document, window, localStorage, auth */
/* eslint-disable no-console */
import { API_BASE } from '../config.js';
import { formatPrice } from '../utils/formatters.js';

// ============================================
// ERROR HANDLING HELPERS
// ============================================

/**
 * Format trade error with helpful suggestions
 */
function formatTradeError(errorMessage) {
    const lowerMsg = errorMessage.toLowerCase();
    
    // Check for specific error patterns and provide helpful guidance
    if (lowerMsg.includes('404') || lowerMsg.includes('not available') || lowerMsg.includes('not found on exchange')) {
        return {
            title: 'Token Not Available',
            message: `<p><strong>${errorMessage}</strong></p>
                <p style="margin-top: 12px;">This token is not available for trading on Coinbase.</p>
                <div class="modal-warning-list" style="margin-top: 12px;">
                    <strong>💡 Try These Instead:</strong>
                    <ul style="margin: 8px 0 0 20px;">
                        <li>Trade popular coins like BTC, ETH, SOL, or ADA</li>
                        <li>Check the Discovery page for tradable coins</li>
                        <li>Look for coins with high 24h volume</li>
                    </ul>
                </div>`
        };
    }
    
    if (lowerMsg.includes('order book') || lowerMsg.includes('insufficient') || lowerMsg.includes('liquidity')) {
        return {
            title: 'Low Liquidity',
            message: `<p><strong>${errorMessage}</strong></p>
                <p style="margin-top: 12px;">This token doesn't have enough buyers/sellers at the current price.</p>
                <div class="modal-warning-list" style="margin-top: 12px;">
                    <strong>💡 Solutions:</strong>
                    <ul style="margin: 8px 0 0 20px;">
                        <li>Try a <strong>smaller trade amount</strong> (e.g., $25-$100)</li>
                        <li>Trade more liquid coins (higher 24h volume)</li>
                        <li>Check the Discovery page for recommended coins</li>
                    </ul>
                </div>`
        };
    }
    
    if (lowerMsg.includes('portfolio not found')) {
        return {
            title: 'Portfolio Error',
            message: `<p><strong>${errorMessage}</strong></p>
                <p style="margin-top: 12px;">Your portfolio data couldn't be loaded.</p>
                <div class="modal-warning-list" style="margin-top: 12px;">
                    <strong>🔄 Quick Fix:</strong>
                    <ul style="margin: 8px 0 0 20px;">
                        <li>Refresh the page (F5 or Ctrl+R)</li>
                        <li>Check your internet connection</li>
                        <li>Contact support if the issue persists</li>
                    </ul>
                </div>`
        };
    }
    
    // Default error format
    return {
        title: 'Trade Failed',
        message: errorMessage
    };
}

// ============================================
// SETTINGS HELPERS
// ============================================

export function loadSettings() {
    const saved = localStorage.getItem('tradingSettings');
    const defaults = {
        autoExecute: false,
        confidenceThreshold: 75,
        humanApproval: true,
        positionSizingStrategy: 'equal',
        maxPositionSize: 5,
        takeProfitStrategy: 'full',
        autoStopLoss: true,
        coinUniverse: 'top50',
        discoveryStrategy: 'moderate',
        analysisFrequency: 4
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
}

export function getSettings() {
    return loadSettings();
}

// ============================================
// MANUAL TRADING FUNCTIONS
// ============================================

export function toggleAdvancedOptions() {
    const checkbox = document.getElementById('addStopLoss');
    const options = document.getElementById('advancedOptions');
    options.style.display = checkbox.checked ? 'block' : 'none';
    
    // Update parent card height after toggling options
    setTimeout(() => updateManualTradingCardHeight(), 50);
}

export function updateQuantityPlaceholder() {
    const type = document.getElementById('quantityType').value;
    const input = document.getElementById('manualTradeQuantity');
    const helper = document.getElementById('quantityHelper');
    
    if (type === 'units') {
        input.placeholder = 'Enter number of coins';
        helper.textContent = 'Example: 0.5 BTC';
    } else if (type === 'usd') {
        input.placeholder = 'Enter dollar amount';
        helper.textContent = 'Example: $1000';
    } else if (type === 'percent') {
        input.placeholder = 'Enter percentage';
        helper.textContent = 'Example: 5 (for 5% of portfolio)';
    }
}

export async function previewTrade() {
    const symbol = document.getElementById('manualTradeSymbol').value.toUpperCase().trim();
    const quantity = parseFloat(document.getElementById('manualTradeQuantity').value);
    const quantityType = document.getElementById('quantityType').value;
    const addStopLoss = document.getElementById('addStopLoss').checked;
    const stopLossPrice = addStopLoss ? parseFloat(document.getElementById('stopLossPrice').value) : null;
    const takeProfitPrice = addStopLoss ? parseFloat(document.getElementById('takeProfitPrice').value) : null;
    
    const previewArea = document.getElementById('tradePreviewArea');
    
    if (!symbol || !quantity || quantity <= 0) {
        previewArea.style.display = 'block';
        previewArea.innerHTML = `
            <div class="alert alert-error">
                ⚠️ Please enter a valid symbol and quantity
            </div>
        `;
        setTimeout(() => updateManualTradingCardHeight(), 50);
        return;
    }

    // Get current portfolio
    const portfolioResponse = await fetch(`${API_BASE}/portfolio`);
    if (!portfolioResponse.ok) {
        previewArea.style.display = 'block';
        previewArea.innerHTML = `
            <div class="alert alert-error">
                ⚠️ Unable to fetch portfolio data
            </div>
        `;
        setTimeout(() => updateManualTradingCardHeight(), 50);
        return;
    }

    const portfolio = await portfolioResponse.json();
    const totalValue = portfolio.totalValue || 10000; // Fallback

    // Get current price for the symbol
    try {
        const priceResponse = await fetch(`${API_BASE}/price/${symbol}`);
        if (!priceResponse.ok) throw new Error('Price fetch failed');

        const priceData = await priceResponse.json();
        const currentPrice = priceData.price;

        // Calculate actual quantity based on type
        let actualQuantity = quantity;
        let totalCost = 0;

        if (quantityType === 'usd') {
            actualQuantity = quantity / currentPrice;
            totalCost = quantity;
        } else if (quantityType === 'percent') {
            totalCost = (quantity / 100) * totalValue;
            actualQuantity = totalCost / currentPrice;
        } else {
            // units
            totalCost = quantity * currentPrice;
        }

        // Validate against portfolio
        if (totalCost > totalValue) {
            previewArea.style.display = 'block';
            previewArea.innerHTML = `
                <div class="alert alert-error">
                    ⚠️ Insufficient funds! Trade cost: $${totalCost.toFixed(2)}, Portfolio value: $${totalValue.toFixed(2)}
                </div>
            `;
            setTimeout(() => updateManualTradingCardHeight(), 50);
            return;
        }

        // Calculate potential P&L with stop loss/take profit
        let stopLossInfo = '';
        let takeProfitInfo = '';

        if (addStopLoss && stopLossPrice) {
            const stopLossAmount = (stopLossPrice - currentPrice) * actualQuantity;
            const stopLossPercent = ((stopLossPrice - currentPrice) / currentPrice) * 100;
            stopLossInfo = `
                <div class="info-box-error">
                    <strong>Stop Loss:</strong> $${stopLossPrice.toFixed(2)}<br>
                    <span class="protection-label-stop" style="font-size: 13px;">
                        Loss if triggered: $${Math.abs(stopLossAmount).toFixed(2)} (${stopLossPercent.toFixed(2)}%)
                    </span>
                </div>
            `;
        }

        if (addStopLoss && takeProfitPrice) {
            const takeProfitAmount = (takeProfitPrice - currentPrice) * actualQuantity;
            const takeProfitPercent = ((takeProfitPrice - currentPrice) / currentPrice) * 100;
            takeProfitInfo = `
                <div class="info-box-success">
                    <strong>Take Profit:</strong> $${takeProfitPrice.toFixed(2)}<br>
                    <span class="protection-label-take" style="font-size: 13px;">
                        Gain if triggered: $${takeProfitAmount.toFixed(2)} (${takeProfitPercent.toFixed(2)}%)
                    </span>
                </div>
            `;
        }

        // Show preview
        previewArea.style.display = 'block';
        previewArea.innerHTML = `
            <div class="info-box-info">
                <h4 style="margin: 0 0 15px 0;">📋 Trade Preview</h4>
                <div style="display: grid; gap: 10px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Symbol:</span>
                        <strong>${symbol}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Current Price:</span>
                        <strong>$${currentPrice.toFixed(2)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Quantity:</span>
                        <strong>${actualQuantity.toFixed(6)} ${symbol}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--border-color);">
                        <span>Total Cost:</span>
                        <strong>$${totalCost.toFixed(2)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>% of Portfolio:</span>
                        <strong>${((totalCost / totalValue) * 100).toFixed(2)}%</strong>
                    </div>
                </div>
                ${stopLossInfo}
                ${takeProfitInfo}
                <button onclick="executeTrade()" class="button" style="width: 100%; margin-top: 15px;">
                    ✅ Confirm Trade
                </button>
            </div>
        `;
        
        // Update parent card height after preview is shown
        setTimeout(() => updateManualTradingCardHeight(), 50);

    } catch (error) {
        console.error('Preview error:', error);
        previewArea.style.display = 'block';
        previewArea.innerHTML = `
            <div class="alert alert-error">
                ⚠️ Unable to fetch price for ${symbol}. Please check the symbol and try again.
            </div>
        `;
        
        // Update parent card height after error is shown
        setTimeout(() => updateManualTradingCardHeight(), 50);
    }
}

export async function executeTrade() {
    const symbol = document.getElementById('manualTradeSymbol').value.toUpperCase().trim();
    const quantity = parseFloat(document.getElementById('manualTradeQuantity').value);
    const quantityType = document.getElementById('quantityType').value;
    const addStopLoss = document.getElementById('addStopLoss').checked;
    const stopLossPrice = addStopLoss ? parseFloat(document.getElementById('stopLossPrice').value) : null;
    const takeProfitPrice = addStopLoss ? parseFloat(document.getElementById('takeProfitPrice').value) : null;

    try {
        const priceResponse = await fetch(`${API_BASE}/price/${symbol}`);
        if (!priceResponse.ok) throw new Error('Price fetch failed');
        const priceData = await priceResponse.json();
        const currentPrice = priceData.price;

        // Get portfolio value for percent calculation
        const portfolioResponse = await fetch(`${API_BASE}/portfolio`);
        const portfolio = await portfolioResponse.json();
        const totalValue = portfolio.totalValue || 10000;

        let actualQuantity = quantity;
        if (quantityType === 'usd') {
            actualQuantity = quantity / currentPrice;
        } else if (quantityType === 'percent') {
            const costAmount = (quantity / 100) * totalValue;
            actualQuantity = costAmount / currentPrice;
        }

        // Execute trade
        const response = await auth.fetch(`${API_BASE}/trade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbol,
                quantity: actualQuantity,
                side: 'BUY',
                tradeType: 'manual',
                stopLoss: stopLossPrice,
                takeProfit: takeProfitPrice
            })
        });

        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            console.error('Failed to parse trade response:', parseError);
            throw new Error('Trade failed - invalid server response');
        }

        if (!response.ok) {
            throw new Error(result?.message || result?.error || 'Trade failed');
        }

        // Check if trade requires confirmation due to warnings
        if (result.requiresConfirmation) {
            const warningsList = result.warnings.map(w => `• ${w}`).join('<br>');
            const confirmed = await showConfirm(
                '⚠️ Trade Warnings',
                `<div style="margin-bottom: 15px;">${result.message}</div>
                <div style="background: #fef3c7; padding: 12px; border-radius: 6px; margin-bottom: 15px; text-align: left;">
                    ${warningsList}
                </div>
                <div>Do you want to proceed with this trade anyway?</div>`,
                { confirmText: 'Proceed Anyway', confirmColor: '#f59e0b' }
            );

            if (!confirmed) {
                return; // User canceled
            }

            // Re-submit with confirmWarnings flag
            const confirmedResponse = await auth.fetch(`${API_BASE}/trade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    quantity: actualQuantity,
                    side: 'BUY',
                    tradeType: 'manual',
                    stopLoss: stopLossPrice,
                    takeProfit: takeProfitPrice,
                    confirmWarnings: true
                })
            });

            let confirmedResult;
            try {
                confirmedResult = await confirmedResponse.json();
            } catch (parseError) {
                console.error('Failed to parse confirmation response:', parseError);
                throw new Error('Trade failed - invalid server response');
            }
            
            if (!confirmedResponse.ok) {
                throw new Error(confirmedResult?.message || confirmedResult?.error || 'Trade failed');
            }

            await showSuccess(
                'Trade Executed!',
                `Successfully bought ${actualQuantity.toFixed(6)} ${symbol} at $${currentPrice.toFixed(2)}`
            );
        } else {
            // No warnings, trade executed successfully
            await showSuccess(
                'Trade Executed!',
                `Successfully bought ${actualQuantity.toFixed(6)} ${symbol} at $${currentPrice.toFixed(2)}`
            );
        }

        // Clear form and refresh
        document.getElementById('manualTradeSymbol').value = '';
        document.getElementById('manualTradeQuantity').value = '';
        document.getElementById('tradePreviewArea').style.display = 'none';
        
        // Use global functions exposed by main.js
        if (window.loadPortfolio) window.loadPortfolio();
        if (window.loadTrades) window.loadTrades();

    } catch (error) {
        console.error('Trade error:', error);
        const formattedError = formatTradeError(error.message);
        await showError(formattedError.title, formattedError.message);
    }
}

// ============================================
// SELL POSITION FUNCTIONS
// ============================================

export async function sellPosition(symbol, quantity) {
    // Confirm sale
    const confirmed = await showConfirm(
        'Sell Position',
        `Sell entire <strong>${symbol}</strong> position?<br><br>` +
        `<div style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 12px 0;">` +
        `<strong>Quantity:</strong> ${quantity.toFixed(8)} ${symbol}` +
        `</div>` +
        `This will close your position and convert to cash.`,
        { confirmText: 'Sell Position', confirmColor: '#ef4444' }
    );
    if (!confirmed) return;

    try {
        // Get current price
        const priceResponse = await fetch(`${API_BASE}/price/${symbol}`);
        if (!priceResponse.ok) throw new Error('Failed to get price');

        const priceData = await priceResponse.json();
        const currentPrice = priceData.price;

        // Execute the sell
        const response = await auth.fetch(`${API_BASE}/trade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbol,
                quantity,
                side: 'SELL',
                tradeType: 'manual'
            })
        });

        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            console.error('Failed to parse sell response:', parseError);
            throw new Error('Sale failed - invalid server response');
        }

        if (!response.ok) {
            throw new Error(result?.message || result?.error || 'Sale failed');
        }

        await showSuccess(
            'Position Sold!',
            `Successfully sold ${quantity.toFixed(6)} ${symbol} at $${currentPrice.toFixed(2)}`
        );

        // Refresh displays
        if (window.loadPortfolio) window.loadPortfolio();
        if (window.loadTrades) window.loadTrades();

    } catch (error) {
        console.error('Sell error:', error);
        const formattedError = formatTradeError(error.message);
        await showError(formattedError.title, formattedError.message);
    }
}

// ============================================
// CUSTOM MODAL SYSTEM
// ============================================

let modalResolveCallback = null;

export function showConfirm(title, message, options = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const confirmBtn = document.getElementById('confirmButton');

        titleEl.textContent = title;
        messageEl.innerHTML = message;
        
        // Apply custom button text/colors if provided
        if (options.confirmText) confirmBtn.textContent = options.confirmText;
        else confirmBtn.textContent = 'Confirm';
        
        if (options.confirmColor) confirmBtn.style.background = options.confirmColor;
        else confirmBtn.style.background = '#667eea';

        modal.classList.add('active');
        document.body.classList.add('modal-open');
        modalResolveCallback = resolve;
    });
}

export function handleConfirmClick(result) {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    if (modalResolveCallback) {
        modalResolveCallback(result);
        modalResolveCallback = null;
    }
}

export function showSuccess(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('statusModal');
        const icon = document.getElementById('statusIcon');
        const titleEl = document.getElementById('statusTitle');
        const messageEl = document.getElementById('statusMessage');
        const okBtn = document.getElementById('statusOkButton');

        icon.textContent = '✅';
        icon.style.color = '#10b981';
        titleEl.textContent = title;
        titleEl.style.color = '#10b981';
        messageEl.innerHTML = message;

        modal.classList.add('active');
        document.body.classList.add('modal-open');

        okBtn.onclick = () => {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
            resolve();
        };
    });
}

export function showError(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('statusModal');
        const icon = document.getElementById('statusIcon');
        const titleEl = document.getElementById('statusTitle');
        const messageEl = document.getElementById('statusMessage');
        const okBtn = document.getElementById('statusOkButton');

        icon.textContent = '❌';
        icon.style.color = '#ef4444';
        titleEl.textContent = title;
        titleEl.style.color = '#ef4444';
        messageEl.innerHTML = message;

        modal.classList.add('active');
        document.body.classList.add('modal-open');

        okBtn.onclick = () => {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
            resolve();
        };
    });
}

// ============================================
// POSITION DETAILS & PROTECTION MANAGEMENT
// ============================================

export async function openPositionDetails(symbol) {
    try {
        // Fetch current portfolio and position data
        const portfolioResponse = await fetch(`${API_BASE}/portfolio`);
        const portfolio = await portfolioResponse.json();
        const position = portfolio.positions.find(p => p.symbol === symbol);

        if (!position) {
            await showError('Position Not Found', `Could not find position for ${symbol}`);
            return;
        }

        // Get current price
        const priceResponse = await fetch(`${API_BASE}/price/${symbol}`);
        const priceData = await priceResponse.json();
        const currentPrice = priceData.price;

        // Calculate percentages
        const priceChange = ((currentPrice - position.averagePrice) / position.averagePrice) * 100;
        const stopLossPercent = position.stopLoss ? (((currentPrice - position.stopLoss) / currentPrice) * 100).toFixed(1) : null;
        const takeProfitPercent = position.takeProfit ? (((position.takeProfit - currentPrice) / currentPrice) * 100).toFixed(1) : null;

        const message = `
            <div class="detail-box">
                <div class="detail-grid">
                    <div>
                        <div class="detail-item-label">Quantity</div>
                        <div style="font-weight: 600;">${position.quantity.toFixed(8)} ${symbol}</div>
                    </div>
                    <div>
                        <div class="detail-item-label">Current Value</div>
                        <div style="font-weight: 600;">$${(position.quantity * currentPrice).toFixed(2)}</div>
                    </div>
                    <div>
                        <div class="detail-item-label">Avg Buy Price</div>
                        <div style="font-weight: 600;">$${formatPrice(position.averagePrice)}</div>
                    </div>
                    <div>
                        <div class="detail-item-label">Current Price</div>
                        <div style="font-weight: 600;">$${formatPrice(currentPrice)}</div>
                    </div>
                    <div>
                        <div class="detail-item-label">Total P&L</div>
                        <div class="detail-item-value ${position.unrealizedPnL >= 0 ? 'positive' : 'negative'}">
                            ${position.unrealizedPnL >= 0 ? '+' : ''}$${position.unrealizedPnL.toFixed(2)} (${priceChange.toFixed(2)}%)
                        </div>
                    </div>
                    <div>
                        <div class="detail-item-label">Portfolio %</div>
                        <div style="font-weight: 600;">${((position.quantity * currentPrice) / portfolio.totalValue * 100).toFixed(1)}%</div>
                    </div>
                </div>
            </div>

            ${position.stopLoss || position.takeProfit ? `
            <div class="protection-box">
                <div class="protection-box-header">🛡️ Active Protections</div>
                <div style="display: grid; gap: 10px;">
                    ${position.stopLoss ? `
                        <div class="protection-item">
                            <div class="protection-label-stop">🛑 Stop Loss</div>
                            <div class="protection-value">
                                Price: <strong>$${formatPrice(position.stopLoss)}</strong> (-${stopLossPercent}%)
                            </div>
                        </div>
                    ` : ''}
                    ${position.takeProfit ? `
                        <div class="protection-item">
                            <div class="protection-label-take">🎯 Take Profit</div>
                            <div class="protection-value">
                                Price: <strong>$${formatPrice(position.takeProfit)}</strong> (+${takeProfitPercent}%)
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button onclick="sellPosition('${symbol}', ${position.quantity})" class="button button-danger" style="flex: 1;">
                    💰 Sell Position
                </button>
                <button onclick="openProtectionManager('${symbol}')" class="button button-primary" style="flex: 1;">
                    🛡️ Manage Protections
                </button>
            </div>
        `;

        await showConfirm(`Position: ${symbol}`, message, { 
            confirmText: 'Close', 
            confirmColor: '#6b7280' 
        });

    } catch (error) {
        console.error('Failed to load position details:', error);
        await showError('Error', 'Failed to load position details');
    }
}

export async function openProtectionManager(symbol) {
    try {
        const portfolioResponse = await fetch(`${API_BASE}/portfolio`);
        const portfolio = await portfolioResponse.json();
        const position = portfolio.positions.find(p => p.symbol === symbol);

        if (!position) {
            await showError('Position Not Found', `Could not find position for ${symbol}`);
            return;
        }

        const priceResponse = await fetch(`${API_BASE}/price/${symbol}`);
        const priceData = await priceResponse.json();
        const currentPrice = priceData.price;

        const message = `
            <div style="margin-bottom: 20px;">
                <div class="detail-box" style="margin-bottom: 16px;">
                    <div class="detail-item-label">Current Price</div>
                    <div style="font-size: 20px; font-weight: 600;">$${formatPrice(currentPrice)}</div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">🛑 Stop Loss Price</label>
                    <input type="number" id="stopLossInput" value="${position.stopLoss || ''}" 
                        placeholder="Enter stop loss price" 
                        style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                    <div class="text-muted" style="font-size: 12px; margin-top: 4px;">
                        Auto-sell if price drops to this level
                    </div>
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">🎯 Take Profit Price</label>
                    <input type="number" id="takeProfitInput" value="${position.takeProfit || ''}" 
                        placeholder="Enter take profit price" 
                        style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                    <div class="text-muted" style="font-size: 12px; margin-top: 4px;">
                        Auto-sell if price rises to this level
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 10px;">
                <button onclick="saveProtection('${symbol}', 'stopLoss')" class="button button-danger" style="flex: 1;">
                    Save Stop Loss
                </button>
                <button onclick="saveProtection('${symbol}', 'takeProfit')" class="button button-success" style="flex: 1;">
                    Save Take Profit
                </button>
            </div>
        `;

        await showConfirm(`Manage Protections: ${symbol}`, message, {
            confirmText: 'Done',
            confirmColor: '#6b7280'
        });

    } catch (error) {
        console.error('Failed to open protection manager:', error);
        await showError('Error', 'Failed to open protection manager');
    }
}

export async function saveProtection(symbol, type) {
    try {
        const input = document.getElementById(type === 'stopLoss' ? 'stopLossInput' : 'takeProfitInput');
        const price = parseFloat(input.value);

        const payload = {};
        if (price && price > 0) {
            payload[type] = price;
        } else {
            payload[type] = null; // Remove protection
        }

        const response = await auth.fetch(`${API_BASE}/portfolio/${symbol}/protection`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            console.error('Failed to parse protection response:', parseError);
            throw new Error('Failed to update protection - invalid server response');
        }

        if (!response.ok) {
            throw new Error(result?.message || result?.error || 'Failed to update protection');
        }

        await showSuccess(
            'Protection Updated',
            `${type === 'stopLoss' ? 'Stop loss' : 'Take profit'} ${price ? 'set to $' + price.toFixed(2) : 'removed'} for ${symbol}`
        );

        // Refresh portfolio to show updated data
        if (window.loadPortfolio) window.loadPortfolio();

    } catch (error) {
        console.error('Failed to save protection:', error);
        await showError('Update Failed', error.message);
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Update the manual trading card's max-height to accommodate new content
 */
function updateManualTradingCardHeight() {
    const cardContent = document.getElementById('manual-trading-content');
    if (!cardContent) {
        console.warn('manual-trading-content not found');
        return;
    }
    
    // Don't update if card is collapsed
    if (cardContent.classList.contains('collapsed')) {
        return;
    }
    
    // Update max-height to current scroll height
    const newHeight = cardContent.scrollHeight + 'px';
    cardContent.style.maxHeight = newHeight;
    console.log('Updated manual-trading-content max-height to:', newHeight);
}
