/**
 * Analysis API Client
 * Handles all AI analysis and recommendation API calls
 */

import { API_BASE } from '../config.js';

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
 * Fetch AI recommendations
 */
export async function fetchRecommendations(limit = 5) {
    const response = await window.auth.fetch(`${API_BASE}/recommendations?limit=${limit}`);
    return handleResponse(response, 'recommendations');
}

/**
 * Analyze a specific cryptocurrency
 */
export async function analyzeCrypto(symbol, aiModel = 'anthropic') {
    const response = await window.auth.fetch(`${API_BASE}/analyze/${symbol}?aiModel=${aiModel}`, {
        method: 'POST',
    });
    
    if (!response) return null; // Auth redirect happened
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Analysis failed');
    }
    
    return response.json();
}

/**
 * Run discovery to find trading opportunities
 */
export async function runDiscovery(universe, strategy, forceRefresh = false) {
    const response = await window.auth.fetch(
        `${API_BASE}/discovery?universe=${universe}&strategy=${strategy}&forceRefresh=${forceRefresh}`,
        { method: 'POST' }
    );
    
    if (!response) return null; // Auth redirect happened
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Discovery failed');
    }
    
    return response.json();
}

/**
 * Fetch current cryptocurrency price
 */
export async function fetchPrice(symbol) {
    const response = await window.auth.fetch(`${API_BASE}/price/${symbol}`);
    
    if (!response) return null; // Auth redirect happened
    if (!response.ok) {
        throw new Error(`Could not fetch price for ${symbol}`);
    }
    
    return response.json();
}
