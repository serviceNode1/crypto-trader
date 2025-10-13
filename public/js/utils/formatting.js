/**
 * Formatting Utilities
 * Helper functions for formatting prices, numbers, dates, etc.
 */

/**
 * Format a price value with appropriate decimal places
 */
export function formatPrice(price, minDecimals = 2, maxDecimals = 8) {
    if (price === null || price === undefined) return 'N/A';
    return `$${price.toLocaleString(undefined, {
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals
    })}`;
}

/**
 * Format a percentage value
 */
export function formatPercent(value, decimals = 2) {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toFixed(decimals)}%`;
}

/**
 * Format a date/time string
 */
export function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
}

/**
 * Format a date to just the date part
 */
export function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

/**
 * Format a large number with K/M/B suffixes
 */
export function formatCompactNumber(num) {
    if (num === null || num === undefined) return 'N/A';
    
    const absNum = Math.abs(num);
    if (absNum >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (absNum >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (absNum >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

/**
 * Get CSS class for positive/negative/neutral values
 */
export function getValueClass(value) {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
}
