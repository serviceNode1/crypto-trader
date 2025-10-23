/**
 * Cards UI Module
 * Handles card collapse/expand functionality
 */

/* global document, localStorage */

/**
 * Toggle card collapse state
 */
export function toggleCardCollapse(cardId) {
    const content = document.getElementById(cardId);
    if (!content) return;
    
    const button = content.previousElementSibling?.querySelector('.collapse-btn');
    if (!button) return;
    
    const isCollapsed = content.classList.contains('collapsed');
    
    if (isCollapsed) {
        // Expand
        content.classList.remove('collapsed');
        content.style.maxHeight = content.scrollHeight + 'px';
        button.classList.remove('collapsed');
        button.textContent = '▼';
        localStorage.setItem(`card-${cardId}-collapsed`, 'false');
    } else {
        // Collapse
        content.classList.add('collapsed');
        content.style.maxHeight = '0';
        button.classList.add('collapsed');
        button.textContent = '▼';
        localStorage.setItem(`card-${cardId}-collapsed`, 'true');
    }
}

/**
 * Update card max-height to fit content (for dynamic content updates)
 */
export function updateCardHeight(cardId) {
    const content = document.getElementById(cardId);
    if (content && !content.classList.contains('collapsed')) {
        content.style.maxHeight = content.scrollHeight + 'px';
    }
}

/**
 * Initialize card collapse states from localStorage
 */
export function initializeCardStates() {
    document.querySelectorAll('.card-content').forEach(content => {
        const cardId = content.id;
        const isCollapsed = localStorage.getItem(`card-${cardId}-collapsed`) === 'true';
        
        if (isCollapsed) {
            content.classList.add('collapsed');
            content.style.maxHeight = '0';
            const button = content.previousElementSibling?.querySelector('.collapse-btn');
            if (button) {
                button.classList.add('collapsed');
            }
        } else {
            // Set max-height to content height for smooth transitions
            content.style.maxHeight = content.scrollHeight + 'px';
        }
    });
}
