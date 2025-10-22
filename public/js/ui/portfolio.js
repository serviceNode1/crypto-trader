/**
 * Portfolio UI Module
 * Handles displaying portfolio data, performance, risk, and charts
 */

/* global document, Chart */
/* eslint-disable no-console */
import { fetchPortfolio, fetchPerformance, fetchRisk, fetchPortfolioHistory } from '../api/portfolio.js';

// Chart instance
let portfolioChart = null;

/**
 * Format price based on value
 */
function formatPrice(price) {
    if (price >= 1000) return price.toFixed(0);
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(8);
}

/**
 * Load and display portfolio overview
 */
export async function loadPortfolio() {
    try {
        const data = await fetchPortfolio();
        if (!data) return; // Rate limited

        const metricsHTML = `
            <div class="metric">
                <span class="metric-label">Total Value</span>
                <span class="metric-value">$${data.totalValue.toFixed(2)}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Cash Balance</span>
                <span class="metric-value">$${data.cash.toFixed(2)}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Total Return</span>
                <span class="metric-value ${data.totalReturn >= 0 ? 'positive' : 'negative'}">
                    ${data.totalReturn >= 0 ? '+' : ''}$${data.totalReturn.toFixed(2)}
                    (${data.totalReturnPercent.toFixed(2)}%)
                </span>
            </div>
            <div class="metric">
                <span class="metric-label">Open Positions</span>
                <span class="metric-value">${data.positions.length}</span>
            </div>
        `;

        document.getElementById('portfolio-metrics').innerHTML = metricsHTML;

        // Display holdings
        if (data.positions.length > 0) {
            const holdingsHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Quantity</th>
                            <th>Entry Price</th>
                            <th>Current Price</th>
                            <th>Current Value</th>
                            <th>P&L</th>
                            <th>Stop Loss</th>
                            <th>Take Profit</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.positions.map(pos => {
                            const currentPrice = pos.currentValue / pos.quantity;
                            const priceChange = ((currentPrice - pos.averagePrice) / pos.averagePrice) * 100;
                            return `
                            <tr>
                                <td><strong>${pos.symbol}</strong></td>
                                <td>${pos.quantity.toFixed(4)}</td>
                                <td>$${formatPrice(pos.averagePrice)}</td>
                                <td class="${priceChange >= 0 ? 'positive' : 'negative'}" style="font-weight: 600;">
                                    $${formatPrice(currentPrice)}
                                    <span style="font-size: 11px;">(${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(1)}%)</span>
                                </td>
                                <td>$${pos.currentValue.toFixed(2)}</td>
                                <td class="${pos.unrealizedPnL >= 0 ? 'positive' : 'negative'}">
                                    ${pos.unrealizedPnL >= 0 ? '+' : ''}$${pos.unrealizedPnL.toFixed(2)}
                                    (${pos.unrealizedPnLPercent.toFixed(2)}%)
                                </td>
                                <td class="${pos.stopLoss ? 'protection-label-stop' : 'text-muted'}" style="font-size: 13px;">
                                    ${pos.stopLoss ? '$' + pos.stopLoss.toFixed(2) : '—'}
                                </td>
                                <td class="${pos.takeProfit ? 'protection-label-take' : 'text-muted'}" style="font-size: 13px;">
                                    ${pos.takeProfit ? '$' + pos.takeProfit.toFixed(2) : '—'}
                                </td>
                                <td>
                                    <button 
                                        class="button button-primary" 
                                        onclick="window.openPositionDetails('${pos.symbol}')"
                                        style="padding: 6px 12px; font-size: 12px; white-space: nowrap; margin-right: 5px; min-width: 85px;">
                                        📋 Details
                                    </button>
                                    <button 
                                        class="button button-danger" 
                                        onclick="window.sellPosition('${pos.symbol}', ${pos.quantity})"
                                        style="padding: 6px 12px; font-size: 12px; white-space: nowrap; min-width: 85px;">
                                        📉 Sell
                                    </button>
                                </td>
                            </tr>
                        `;}).join('')}
                    </tbody>
                </table>
            `;
            document.getElementById('holdings-list').innerHTML = holdingsHTML;
        } else {
            document.getElementById('holdings-list').innerHTML = '<p>No open positions</p>';
        }
    } catch (error) {
        console.error('Failed to load portfolio:', error);
        document.getElementById('portfolio-metrics').innerHTML = '<p class="negative">Failed to load data</p>';
    }
}

/**
 * Load and display performance metrics
 */
export async function loadPerformance() {
    try {
        const data = await fetchPerformance();
        if (!data) return; // Rate limited

        const metricsHTML = `
            <div class="metric">
                <span class="metric-label">Sharpe Ratio</span>
                <span class="metric-value">${data.sharpeRatio.toFixed(2)}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Max Drawdown</span>
                <span class="metric-value negative">${(data.maxDrawdown * 100).toFixed(2)}%</span>
            </div>
            <div class="metric">
                <span class="metric-label">Win Rate</span>
                <span class="metric-value">${(data.winRate * 100).toFixed(1)}%</span>
            </div>
            <div class="metric" title="Number of completed sell transactions (buy-sell cycles)">
                <span class="metric-label">Closed Positions</span>
                <span class="metric-value">${data.totalTrades}</span>
            </div>
        `;

        document.getElementById('performance-metrics').innerHTML = metricsHTML;
    } catch (error) {
        console.error('Failed to load performance:', error);
    }
}

/**
 * Load and display risk metrics
 */
export async function loadRisk() {
    try {
        const data = await fetchRisk();
        if (!data) return; // Rate limited

        const metricsHTML = `
            <div class="metric">
                <span class="metric-label">Portfolio Risk</span>
                <span class="metric-value">${data.portfolioRisk.toFixed(2)}%</span>
            </div>
            <div class="metric">
                <span class="metric-label">Daily Loss</span>
                <span class="metric-value">${data.dailyLoss.toFixed(2)}%</span>
            </div>
            <div class="metric">
                <span class="metric-label">Capital Utilization</span>
                <span class="metric-value">${data.utilizationPercent.toFixed(1)}%</span>
            </div>
        `;

        document.getElementById('risk-metrics').innerHTML = metricsHTML;
    } catch (error) {
        console.error('Failed to load risk:', error);
    }
}

/**
 * Load and display portfolio chart
 */
export async function loadPortfolioChart() {
    try {
        const data = await fetchPortfolioHistory();
        if (!data) return; // Rate limited

        const ctx = document.getElementById('portfolioChart');
        if (!ctx) return;
        
        // Get the container dimensions
        const container = ctx.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Set canvas size to match container (native resolution, not CSS)
        const dpr = window.devicePixelRatio || 1;
        ctx.width = containerWidth * dpr;
        ctx.height = containerHeight * dpr;
        ctx.style.width = containerWidth + 'px';
        ctx.style.height = containerHeight + 'px';

        // Destroy existing chart if it exists
        if (portfolioChart) {
            portfolioChart.destroy();
        }

        portfolioChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => new Date(d.timestamp).toLocaleDateString()),
                datasets: [{
                    label: 'Portfolio Value',
                    data: data.map(d => d.totalValue),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
        
        // Handle window resize
        const resizeObserver = new ResizeObserver(() => {
            if (portfolioChart && container) {
                const newWidth = container.clientWidth;
                const newHeight = container.clientHeight;
                const dpr = window.devicePixelRatio || 1;
                
                ctx.width = newWidth * dpr;
                ctx.height = newHeight * dpr;
                ctx.style.width = newWidth + 'px';
                ctx.style.height = newHeight + 'px';
                
                portfolioChart.resize();
            }
        });
        
        resizeObserver.observe(container);
        
    } catch (error) {
        console.error('Failed to load portfolio chart:', error);
    }
}
