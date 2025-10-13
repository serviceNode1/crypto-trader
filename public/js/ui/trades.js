/**
 * Trades UI Module
 * Handles displaying trade history with pagination
 */

/* global document */
/* eslint-disable no-console */
import { fetchTrades } from '../api/trades.js';
import { PAGINATION } from '../config.js';

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
                            const tradeType = trade.tradeType || trade.trade_type || 'manual';
                            const typeLabel = tradeType === 'auto' ? '🤖 Auto' : 
                                            tradeType === 'discovery' ? '🔍 Discovery' : '👤 Manual';
                            
                            return `
                            <tr>
                                <td style="font-size: 13px;">${new Date(trade.timestamp).toLocaleString()}</td>
                                <td><strong>${trade.symbol}</strong></td>
                                <td>
                                    <span class="badge badge-${trade.side.toLowerCase()}">
                                        ${trade.side}
                                    </span>
                                </td>
                                <td style="font-size: 12px;">${typeLabel}</td>
                                <td>${parseFloat(trade.quantity).toFixed(4)}</td>
                                <td>$${parseFloat(trade.price).toFixed(2)}</td>
                                <td>$${parseFloat(trade.total).toFixed(2)}</td>
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
                        <span style="color: #6b7280; font-size: 14px;">
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
    } catch (error) {
        console.error('Failed to load trades:', error);
    }
}
