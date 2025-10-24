/**
 * Trades API Client
 * Handles all trade-related API calls
 */

import { API_BASE, PAGINATION } from '../config.js';

/**
 * Handle API response with rate limiting
 */
async function handleResponse(response, resourceName) {
    if (!response) return null; // Auth redirect happened
    if (!response.ok) {
        if (response.status === 429) {
            console.warn(`Rate limited - ${resourceName} will refresh on next interval`);
            return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Fetch trades with pagination
 */
export async function fetchTrades(page = 1) {
    const offset = (page - 1) * PAGINATION.TRADES_PER_PAGE;
    const response = await window.auth.fetch(
        `${API_BASE}/trades?limit=${PAGINATION.TRADES_PER_PAGE}&offset=${offset}`
    );
    return handleResponse(response, 'trades');
}

/**
 * Execute a manual trade
 */
export async function executeTrade(tradeData) {
    const response = await window.auth.fetch(`${API_BASE}/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeData),
    });
    
    if (!response) return null; // Auth redirect happened
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Trade execution failed');
    }
    
    return response.json();
}

/**
 * Sell a position
 */
export async function sellPosition(symbol, quantity) {
    return executeTrade({
        symbol,
        side: 'SELL',
        quantity,
        type: 'manual',
    });
}
