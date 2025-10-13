/**
 * Modals UI Module
 * Handles modal open/close functionality
 */

/* global document */

/**
 * Open info modal
 */
export function openInfoModal() {
    document.getElementById('infoModal').classList.add('active');
}

/**
 * Close info modal
 */
export function closeInfoModal() {
    document.getElementById('infoModal').classList.remove('active');
}

/**
 * Switch between modal tabs
 */
export function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab content
    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Activate selected tab button
    const selectedButton = document.querySelector(`[onclick*="${tabName}"]`);
    if (selectedButton) {
        selectedButton.classList.add('active');
    }
}
