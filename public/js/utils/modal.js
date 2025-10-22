/**
 * Custom Modal System
 * Provides a better UX than browser's native alert() and confirm()
 */

/* global document */
/* eslint-disable no-console */

let modalResolveCallback = null;

/**
 * Base modal function - shows a customizable modal dialog
 * @param {Object} options - Modal configuration
 * @returns {Promise<boolean>} Resolves with true/false for confirm, or true for alerts
 */
export function showModal(options) {
    return new Promise((resolve) => {
        modalResolveCallback = resolve;
        
        const modal = document.getElementById('customModal');
        const header = document.getElementById('modalHeader');
        const body = document.getElementById('modalBody');
        const footer = document.getElementById('modalFooter');
        
        if (!modal || !header || !body || !footer) {
            console.error('Modal elements not found in DOM');
            // Fallback to native alert
            if (options.type === 'confirm') {
                resolve(window.confirm(options.message));
            } else {
                window.alert(options.message);
                resolve(true);
            }
            return;
        }
        
        // Set icon and title
        header.innerHTML = `<h3>${options.icon || ''} ${options.title || 'Notification'}</h3>`;
        
        // Set body content
        body.innerHTML = options.message || '';
        
        // Clear and set footer buttons
        footer.innerHTML = '';
        
        if (options.type === 'confirm') {
            // Confirm dialog with Yes/No
            footer.innerHTML = `
                <button class="button button-secondary" onclick="window.modalResponse(false)">
                    ${options.cancelText || 'Cancel'}
                </button>
                <button class="button" onclick="window.modalResponse(true)" style="background: ${options.confirmColor || '#667eea'};">
                    ${options.confirmText || 'Confirm'}
                </button>
            `;
        } else {
            // Alert dialog with OK only
            footer.innerHTML = `
                <button class="button" onclick="window.modalResponse(true)" style="background: ${options.confirmColor || '#667eea'};">
                    ${options.confirmText || 'OK'}
                </button>
            `;
        }
        
        // Show modal
        modal.classList.add('active');
    });
}

/**
 * Handle modal button response
 * @param {boolean} result - User's choice (true/false)
 */
export function modalResponse(result) {
    closeCustomModal();
    if (modalResolveCallback) {
        modalResolveCallback(result);
        modalResolveCallback = null;
    }
}

/**
 * Close the custom modal
 */
export function closeCustomModal() {
    const modal = document.getElementById('customModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ==============================================
// CONVENIENCE FUNCTIONS
// ==============================================

/**
 * Show an alert modal (info/notification)
 * @param {string} title - Modal title
 * @param {string} message - Modal message (can include HTML)
 * @param {Object} options - Optional settings
 * @returns {Promise<boolean>}
 */
export async function showAlert(title, message, options = {}) {
    return await showModal({
        type: 'alert',
        icon: options.icon || '💡',
        title,
        message,
        confirmText: options.confirmText || 'OK',
        confirmColor: options.confirmColor
    });
}

/**
 * Show a confirmation modal (Yes/No)
 * @param {string} title - Modal title
 * @param {string} message - Modal message (can include HTML)
 * @param {Object} options - Optional settings
 * @returns {Promise<boolean>} True if confirmed, false if cancelled
 */
export async function showConfirm(title, message, options = {}) {
    return await showModal({
        type: 'confirm',
        icon: options.icon || '❓',
        title,
        message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        confirmColor: options.confirmColor
    });
}

/**
 * Show a warning modal with a list of issues
 * @param {string} title - Modal title
 * @param {Array<string>} warnings - Array of warning messages
 * @param {Object} options - Optional settings
 * @returns {Promise<boolean>} True if user proceeds, false if cancelled
 */
export async function showWarning(title, warnings, options = {}) {
    const warningList = warnings.map((w) => `<li>${w}</li>`).join('');
    const message = `
        <div class="modal-warning-list">
            <ol style="margin: 0; padding-left: 20px;">
                ${warningList}
            </ol>
        </div>
        <p class="modal-description">
            ${options.description || 'These conditions exceed automated trading guidelines.'}
        </p>
    `;
    
    return await showModal({
        type: 'confirm',
        icon: '⚠️',
        title,
        message,
        confirmText: options.confirmText || 'Proceed Anyway',
        cancelText: options.cancelText || 'Cancel',
        confirmColor: '#f59e0b'
    });
}

/**
 * Show a success modal
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @param {Object} options - Optional settings
 * @returns {Promise<boolean>}
 */
export async function showSuccess(title, message, options = {}) {
    return await showModal({
        type: 'alert',
        icon: '✅',
        title,
        message,
        confirmText: options.confirmText || 'OK',
        confirmColor: '#10b981'
    });
}

/**
 * Show an error modal
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @param {Object} options - Optional settings
 * @returns {Promise<boolean>}
 */
export async function showError(title, message, options = {}) {
    return await showModal({
        type: 'alert',
        icon: '❌',
        title,
        message,
        confirmText: options.confirmText || 'OK',
        confirmColor: '#ef4444'
    });
}

// Make modalResponse available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.modalResponse = modalResponse;
}
