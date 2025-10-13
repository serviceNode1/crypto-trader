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
        button.classList.remove('collapsed');
        button.textContent = '▼';
        localStorage.setItem(`card-${cardId}-collapsed`, 'false');
    } else {
        // Collapse
        content.classList.add('collapsed');
        button.classList.add('collapsed');
        button.textContent = '▼';
        localStorage.setItem(`card-${cardId}-collapsed`, 'true');
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
            const button = content.previousElementSibling?.querySelector('.collapse-btn');
            if (button) {
                button.classList.add('collapsed');
            }
        }
    });
}
