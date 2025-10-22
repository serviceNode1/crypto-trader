/**
 * Formatters Utility Module
 * Provides formatting functions for prices, colors, etc.
 */

/**
 * Format price based on its value
 */
export function formatPrice(price) {
    if (price >= 1000) return price.toFixed(0);
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    if (price >= 0.0001) return price.toFixed(6);
    return price.toFixed(8);
}

/**
 * Get color for market regime
 */
export function getMarketRegimeColor(regime) {
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
export function getRiskSentimentColor(sentiment) {
    const colors = {
        'risk-on': '#10b981',
        'risk-off': '#ef4444',
        'neutral': '#6b7280'
    };
    return colors[sentiment.toLowerCase()] || '#6b7280';
}

/**
 * Format large numbers with K/M/B suffix
 */
export function formatNumber(num) {
    // Convert to number if it's a string
    const value = Number(num);
    
    // Handle invalid numbers
    if (isNaN(value)) return '0';
    if (value === null || value === undefined) return '0';
    
    if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
    return value.toFixed(2);
}

/**
 * Get color based on score (0-100)
 */
export function getScoreColor(score) {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#f59e0b'; // Orange
    return '#6b7280'; // Gray
}

/**
 * Render sparkline SVG (uses last 48 data points)
 */
export function renderSparkline(sparkline, priceChange) {
    if (!sparkline || sparkline.length === 0) {
        return '<span class="text-muted" style="font-size: 12px;">No data</span>';
    }

    // Take last 48 hours
    const data = sparkline.slice(-48);
    
    const width = 80;
    const height = 30;
    const padding = 2;
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
        const y = height - padding - ((value - min) / range) * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');
    
    const color = priceChange >= 0 ? '#10b981' : '#ef4444';
    
    return `
        <svg width="${width}" height="${height}" style="display: inline-block;">
            <polyline
                points="${points}"
                fill="none"
                stroke="${color}"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `;
}
