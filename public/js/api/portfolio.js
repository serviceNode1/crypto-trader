/**
 * Portfolio API Client
 * Handles all portfolio-related API calls
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
 * Fetch portfolio overview data
 */
export async function fetchPortfolio() {
    const response = await window.auth.fetch(`${API_BASE}/portfolio`);
    return handleResponse(response, 'portfolio');
}

/**
 * Fetch portfolio performance metrics
 */
export async function fetchPerformance() {
    const response = await window.auth.fetch(`${API_BASE}/portfolio/performance`);
    return handleResponse(response, 'performance');
}

/**
 * Fetch portfolio risk metrics
 */
export async function fetchRisk() {
    const response = await window.auth.fetch(`${API_BASE}/portfolio/risk`);
    return handleResponse(response, 'risk');
}

/**
 * Fetch portfolio history for charting
 */
export async function fetchPortfolioHistory() {
    const response = await window.auth.fetch(`${API_BASE}/portfolio/history`);
    return handleResponse(response, 'portfolio chart');
}
