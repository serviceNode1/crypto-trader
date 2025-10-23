/**
 * Trades UI Module
 * Handles displaying trade history with pagination
 */

/* global document */
/* eslint-disable no-console */
import { fetchTrades } from '../api/trades.js';
import { PAGINATION } from '../config.js';
import { formatNumber } from '../utils/formatters.js';
import { formatPrice } from '../utils/formatters.js';
import { updateCardHeight } from './cards.js';

let currentTradePage = 1;

/**
 * Load and display trade history
 */
export async function loadTrades(page = 1) {
    try {
        currentTradePage = page;
        const result = await fetchTrades(page);
        if (!result) return; // Rate limited

        const data = result.trades || result;
        const totalTrades = result.total || data.length;
        const totalPages = Math.ceil(totalTrades / PAGINATION.TRADES_PER_PAGE);

        if (data.length > 0) {
            const tradesHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Symbol</th>
                            <th>Side</th>
                            <th>Type</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(trade => {
                            // Check multiple possible field names for trade type
                            const tradeType = trade.tradeType || trade.trade_type || trade.type || 'manual';
                            
                            // Check if this was a protection execution
                            const reasoning = trade.reasoning || '';
                            const isStopLoss = reasoning.includes('Stop loss') || reasoning.includes('stop-loss');
                            const isTakeProfit = reasoning.includes('Take profit') || reasoning.includes('take-profit');
                            
                            // Determine the label
                            let typeLabel;
                            if (isStopLoss) {
                                typeLabel = '🛑 Stop Loss';
                            } else if (isTakeProfit) {
                                typeLabel = '🎯 Take Profit';
                            } else if (tradeType === 'auto' || tradeType === 'automated') {
                                typeLabel = '🤖 Auto';
                            } else if (tradeType === 'discovery') {
                                typeLabel = '🔍 Discovery';
                            } else if (tradeType === 'recommendation') {
                                typeLabel = '💡 AI Rec';
                            } else {
                                typeLabel = '👤 Manual';
                            }
                            
                            // Calculate total if not provided
                            const total = trade.total || (Number(trade.quantity) * Number(trade.price));
                            
                            // Format timestamp safely (PostgreSQL returns snake_case)
                            const timestamp = trade.executed_at || trade.timestamp || trade.created_at;
                            const dateStr = timestamp ? new Date(timestamp).toLocaleString() : 'N/A';
                            
                            return `
                            <tr>
                                <td style="font-size: 13px;">${dateStr}</td>
                                <td><strong>${trade.symbol}</strong></td>
                                <td>
                                    <span class="badge badge-${trade.side.toLowerCase()}">
                                        ${trade.side}
                                    </span>
                                </td>
                                <td style="font-size: 12px;">${typeLabel}</td>
                                <td>${formatNumber(trade.quantity)}</td>
                                <td>$${formatPrice(Number(trade.price))}</td>
                                <td>$${formatPrice(Number(total))}</td>
                            </tr>
                        `;}).join('')}
                    </tbody>
                </table>
                
                ${totalPages > 1 ? `
                    <div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 20px;">
                        <button 
                            class="button" 
                            onclick="window.loadTrades(${page - 1})"
                            ${page === 1 ? 'disabled' : ''}
                            style="padding: 8px 16px; font-size: 14px;">
                            ← Previous
                        </button>
                        <span class="text-muted" style="font-size: 14px;">
                            Page ${page} of ${totalPages}
                        </span>
                        <button 
                            class="button" 
                            onclick="window.loadTrades(${page + 1})"
                            ${page === totalPages ? 'disabled' : ''}
                            style="padding: 8px 16px; font-size: 14px;">
                            Next →
                        </button>
                    </div>
                ` : ''}
            `;
            document.getElementById('trades-list').innerHTML = tradesHTML;
        } else {
            document.getElementById('trades-list').innerHTML = '<p>No trades yet</p>';
        }
        
        // Update card max-height to accommodate new content
        updateCardHeight('trades-content');
    } catch (error) {
        console.error('Failed to load trades:', error);
    }
}
