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
    document.body.classList.add('modal-open');
}

/**
 * Close info modal
 */
export function closeInfoModal() {
    document.getElementById('infoModal').classList.remove('active');
    document.body.classList.remove('modal-open');
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
    
    // Show selected tab content (ID matches tabName directly)
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    } else {
        console.error(`Tab content not found: ${tabName}`);
    }
    
    // Activate selected tab button (find by onclick attribute containing the tab name)
    const selectedButton = document.querySelector(`.tab-button[onclick="switchTab('${tabName}')"]`);
    if (selectedButton) {
        selectedButton.classList.add('active');
    } else {
        console.error(`Tab button not found for: ${tabName}`);
    }
}
