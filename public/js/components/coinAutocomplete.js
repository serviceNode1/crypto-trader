/**
 * Smart Coin Autocomplete Component
 * Handles symbol disambiguation with dropdown selection
 */

/* global document, window */
import { API_BASE } from '../config.js';
import { formatPrice } from '../utils/formatters.js';

/**
 * Create and attach autocomplete to an input field
 * @param {HTMLInputElement} inputElement - The symbol input field
 * @param {Function} onSelect - Callback when coin is selected: (coinId, symbol, name, price) => void
 * @returns {Object} - Controller object with destroy() method
 */
export function createCoinAutocomplete(inputElement, onSelect) {
    console.log('[Autocomplete] createCoinAutocomplete called with input:', inputElement?.id);
    let dropdownContainer = null;
    let selectedCoinId = null;
    let selectedCoinName = null;
    let selectedPrice = null;
    let debounceTimer = null;

    // Create dropdown container
    function createDropdown() {
        console.log('[Autocomplete] Creating dropdown container');
        const container = document.createElement('div');
        container.className = 'coin-autocomplete-dropdown';
        
        // Wrap input in relative positioned container
        const wrapper = inputElement.parentElement;
        console.log('[Autocomplete] Parent wrapper:', wrapper);
        if (!wrapper.classList.contains('coin-autocomplete-wrapper')) {
            wrapper.classList.add('coin-autocomplete-wrapper');
            wrapper.style.position = 'relative';
            console.log('[Autocomplete] Added wrapper class and relative position');
        }
        
        wrapper.appendChild(container);
        console.log('[Autocomplete] Dropdown container created and appended');
        return container;
    }

    // Show confirmation badge
    function showConfirmation(coinId, symbol, name, price) {
        // Remove old badge if exists
        const oldBadge = inputElement.parentElement.querySelector('.coin-confirmation-badge');
        if (oldBadge) oldBadge.remove();

        // Create new badge
        const badge = document.createElement('div');
        badge.className = 'coin-confirmation-badge';
        
        badge.innerHTML = `
            <div>
                <span class="coin-confirmation-symbol">${symbol}</span>
                <span class="coin-confirmation-arrow">→</span>
                <span class="coin-confirmation-name">${name}</span>
                <span class="coin-confirmation-price">$${formatPrice(price)}</span>
            </div>
            <button type="button" class="change-coin-btn">Change</button>
        `;

        // Change button reopens dropdown
        badge.querySelector('.change-coin-btn').addEventListener('click', () => {
            selectedCoinId = null;
            selectedCoinName = null;
            selectedPrice = null;
            badge.remove();
            inputElement.focus();
            handleInput(); // Trigger search
        });

        inputElement.parentElement.insertBefore(badge, inputElement.nextSibling);
    }

    // Handle input changes
    async function handleInput() {
        const symbol = inputElement.value.trim().toUpperCase();
        console.log('[Autocomplete] handleInput called for symbol:', symbol);
        
        // Clear previous selection when typing
        if (selectedCoinId && inputElement.value !== inputElement.dataset.lastConfirmedSymbol) {
            selectedCoinId = null;
            selectedCoinName = null;
            selectedPrice = null;
            const badge = inputElement.parentElement.querySelector('.coin-confirmation-badge');
            if (badge) badge.remove();
        }

        if (!symbol || symbol.length < 2) {
            console.log('[Autocomplete] Symbol too short, hiding dropdown');
            hideDropdown();
            return;
        }

        try {
            console.log('[Autocomplete] Fetching data for:', symbol);
            // Show loading
            dropdownContainer.innerHTML = '<div class="dropdown-loading">🔍 Searching...</div>';
            dropdownContainer.style.display = 'block';
            console.log('[Autocomplete] Loading state displayed');

            const response = await fetch(`${API_BASE}/coins/search/${symbol}`);
            if (!response.ok) throw new Error('Search failed');

            const data = await response.json();
            const coins = data.coins || [];
            console.log('[Autocomplete] Coins found:', coins);
            if (coins.length === 0) {
                dropdownContainer.innerHTML = '<div class="dropdown-empty">❌ No coins found</div>';
                return;
            }

            if (coins.length === 1) {
                // Single match - auto-select and show confirmation
                const coin = coins[0];
                selectCoin(coin.coinId, coin.symbol, coin.name, coin.price);
                hideDropdown();
            } else {
                // Multiple matches - show dropdown
                renderDropdown(coins);
            }
        } catch (error) {
            console.error('Autocomplete search failed:', error);
            dropdownContainer.innerHTML = '<div class="dropdown-empty">⚠️ Search error</div>';
        }
    }

    // Render dropdown with coin options
    function renderDropdown(coins) {
        console.log('[Autocomplete] Rendering dropdown with', coins.length, 'coins');
        dropdownContainer.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.className = 'dropdown-header';
        header.textContent = `${coins.length} coins found - Select one:`;
        dropdownContainer.appendChild(header);

        // Coin options
        coins.forEach((coin, index) => {
            const option = document.createElement('div');
            option.className = 'coin-option';
            if (index === coins.length - 1) {
                option.classList.add('last');
            }

            const rankBadge = coin.marketCapRank 
                ? `<span class="coin-rank-badge">#${coin.marketCapRank}</span>`
                : '<span class="coin-rank-unranked">Unranked</span>';

            option.innerHTML = `
                <div class="coin-option-content">
                    <div class="coin-option-left">
                        <div class="coin-option-symbol">${coin.symbol}</div>
                        <div class="coin-option-name">${coin.name}</div>
                    </div>
                    <div class="coin-option-right">
                        <div class="coin-option-price">$${formatPrice(coin.price)}</div>
                        <div class="coin-option-rank">${rankBadge}</div>
                    </div>
                </div>
            `;

            option.addEventListener('click', () => {
                selectCoin(coin.coinId, coin.symbol, coin.name, coin.price);
                hideDropdown();
            });

            dropdownContainer.appendChild(option);
        });

        dropdownContainer.style.display = 'block';
    }

    // Select a coin
    function selectCoin(coinId, symbol, name, price) {
        selectedCoinId = coinId;
        selectedCoinName = name;
        selectedPrice = price;
        inputElement.value = symbol;
        inputElement.dataset.lastConfirmedSymbol = symbol;
        
        showConfirmation(coinId, symbol, name, price);
        
        // Trigger callback
        if (onSelect) {
            onSelect(coinId, symbol, name, price);
        }
    }

    // Hide dropdown
    function hideDropdown() {
        if (dropdownContainer) {
            dropdownContainer.style.display = 'none';
        }
    }

    // Initialize
    dropdownContainer = createDropdown();

    // Event listeners
    inputElement.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(handleInput, 300); // Debounce 300ms
    });

    inputElement.addEventListener('focus', () => {
        if (inputElement.value.trim().length >= 2 && !selectedCoinId) {
            handleInput();
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!inputElement.contains(e.target) && !dropdownContainer.contains(e.target)) {
            hideDropdown();
        }
    });

    // Return controller
    return {
        destroy() {
            if (dropdownContainer) {
                dropdownContainer.remove();
            }
            clearTimeout(debounceTimer);
        },
        
        getSelectedCoin() {
            return selectedCoinId ? {
                coinId: selectedCoinId,
                symbol: inputElement.value.toUpperCase(),
                name: selectedCoinName,
                price: selectedPrice
            } : null;
        },

        clearSelection() {
            selectedCoinId = null;
            selectedCoinName = null;
            selectedPrice = null;
            const badge = inputElement.parentElement.querySelector('.coin-confirmation-badge');
            if (badge) badge.remove();
        }
    };
}
