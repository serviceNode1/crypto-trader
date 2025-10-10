/**
 * Scalable Coin Symbol → CoinGecko ID Mapping Service
 * Uses CoinGecko's /coins/list endpoint to maintain a dynamic mapping
 * of all 14,000+ coins without hardcoding
 */

import axios from 'axios';
import { cacheAside } from '../../config/redis';
import { withRetryJitter, isRetryableError } from '../../utils/retry';
import { withRateLimit, rateLimiters } from '../../utils/rateLimiter';
import { dataLogger as logger } from '../../utils/logger';
import { query } from '../../config/database';

const BASE_URL = 'https://api.coingecko.com/api/v3';
const CACHE_TTL_24H = 86400; // 24 hours

interface CoinListItem {
  id: string;
  symbol: string;
  name: string;
}

interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
  api_symbol?: string;
  market_cap_rank?: number;
  thumb?: string;
  large?: string;
}

// In-memory cache for fast lookups (rebuilt on server restart)
const symbolToIdMap: Map<string, string> = new Map();
let lastLoadTime: number = 0;

/**
 * Initialize the coin list on server startup
 * Loads ~14,000 coins from CoinGecko and builds in-memory index
 */
export async function initializeCoinList(): Promise<void> {
  try {
    logger.info('Initializing coin list from CoinGecko...');
    const startTime = Date.now();

    const coinList = await loadCoinList();
    buildSymbolIndex(coinList);

    const duration = Date.now() - startTime;
    logger.info('Coin list initialized successfully', {
      totalCoins: coinList.length,
      uniqueSymbols: symbolToIdMap.size,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('Failed to initialize coin list', { error });
    // Don't throw - server can still run with search fallback
  }
}

/**
 * Load complete coin list from CoinGecko (with caching)
 * Returns all ~14,000 coins with id, symbol, and name
 */
async function loadCoinList(): Promise<CoinListItem[]> {
  const cacheKey = 'coingecko:coin-list';

  return cacheAside(cacheKey, CACHE_TTL_24H, async () => {
    return withRateLimit(
      rateLimiters.coinGecko,
      async () => {
        return withRetryJitter(
          async () => {
            logger.info('Fetching complete coin list from CoinGecko API...');
            const url = `${BASE_URL}/coins/list`;

            const response = await axios.get<CoinListItem[]>(url, {
              headers: {
                'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
              },
            });

            const coins = response.data;
            logger.info('Coin list fetched from API', { count: coins.length });

            return coins;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'CoinGecko'
    );
  });
}

/**
 * Build in-memory symbol → id index for O(1) lookups
 * Handles duplicate symbols by preferring more popular coins
 */
function buildSymbolIndex(coinList: CoinListItem[]): void {
  symbolToIdMap.clear();

  for (const coin of coinList) {
    const symbol = coin.symbol.toUpperCase();

    // If symbol already exists, keep the first one (usually more popular)
    // CoinGecko returns coins sorted by popularity/market cap
    if (!symbolToIdMap.has(symbol)) {
      symbolToIdMap.set(symbol, coin.id);
    }
  }

  lastLoadTime = Date.now();
  logger.debug('Symbol index built', {
    uniqueSymbols: symbolToIdMap.size,
    totalCoins: coinList.length,
  });
}

/**
 * Convert symbol to CoinGecko coin ID (SCALABLE VERSION)
 * 
 * Lookup order:
 * 1. In-memory map (O(1), ~14K coins)
 * 2. Database cache (previously discovered coins)
 * 3. CoinGecko search API (for brand-new coins)
 * 4. Fallback to lowercase symbol
 */
export async function symbolToCoinId(symbol: string): Promise<string> {
  const upperSymbol = symbol.toUpperCase();

  // 1. Check in-memory map (fastest)
  if (symbolToIdMap.has(upperSymbol)) {
    const coinId = symbolToIdMap.get(upperSymbol)!;
    logger.debug('Symbol found in memory map', { symbol, coinId });
    return coinId;
  }

  // 2. Check database cache
  try {
    const dbResult = await query(
      'SELECT coin_id FROM coin_id_mappings WHERE symbol = $1',
      [upperSymbol]
    );

    if (dbResult.rows.length > 0) {
      const coinId = dbResult.rows[0].coin_id;
      logger.info('Symbol found in database cache', { symbol, coinId });
      
      // Add to memory map for future lookups
      symbolToIdMap.set(upperSymbol, coinId);
      
      return coinId;
    }
  } catch (error) {
    logger.debug('Database cache check failed', { symbol, error });
  }

  // 3. Search API (for brand-new coins not in list yet)
  try {
    logger.info('Symbol not found in cache, searching CoinGecko...', { symbol });
    const coinId = await searchForCoinId(symbol);
    
    if (coinId) {
      // Cache the discovery
      await cacheCoinIdMapping(upperSymbol, coinId);
      symbolToIdMap.set(upperSymbol, coinId);
      
      logger.info('Symbol discovered via search API', { symbol, coinId });
      return coinId;
    }
  } catch (error) {
    logger.warn('Search API failed', { symbol, error });
  }

  // 4. Fallback to lowercase symbol (last resort)
  logger.warn('Could not find coin ID, using lowercase symbol as fallback', { symbol });
  return symbol.toLowerCase();
}

/**
 * Search for a specific coin using CoinGecko's search API
 */
async function searchForCoinId(symbol: string): Promise<string | null> {
  return withRateLimit(
    rateLimiters.coinGecko,
    async () => {
      return withRetryJitter(
        async () => {
          const url = `${BASE_URL}/search`;
          const response = await axios.get(url, {
            params: { query: symbol },
            headers: {
              'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
            },
          });

          const coins: CoinSearchResult[] = response.data.coins || [];
          
          // Find exact symbol match
          const exactMatch = coins.find(
            (coin) => coin.symbol.toUpperCase() === symbol.toUpperCase()
          );

          return exactMatch ? exactMatch.id : null;
        },
        { shouldRetry: isRetryableError }
      );
    },
    'CoinGecko'
  );
}

/**
 * Cache discovered coin ID mapping in database
 */
async function cacheCoinIdMapping(symbol: string, coinId: string): Promise<void> {
  try {
    await query(
      `INSERT INTO coin_id_mappings (symbol, coin_id, discovered_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (symbol) DO UPDATE SET
         coin_id = EXCLUDED.coin_id,
         last_used_at = NOW()`,
      [symbol.toUpperCase(), coinId]
    );

    logger.debug('Cached coin ID mapping', { symbol, coinId });
  } catch (error) {
    logger.error('Failed to cache coin ID mapping', { symbol, coinId, error });
  }
}

/**
 * Refresh coin list (can be called periodically or manually)
 */
export async function refreshCoinList(): Promise<void> {
  logger.info('Refreshing coin list...');
  
  try {
    // Clear Redis cache to force fresh fetch
    const cacheKey = 'coingecko:coin-list';
    const redisClient = await import('../../config/redis').then(m => m.getRedisClient());
    await redisClient.del(cacheKey);
    
    await initializeCoinList();
    
    logger.info('Coin list refreshed successfully');
  } catch (error) {
    logger.error('Failed to refresh coin list', { error });
    throw error;
  }
}

/**
 * Get stats about the current coin list
 */
export function getCoinListStats(): {
  totalSymbols: number;
  lastLoadTime: number;
  ageMinutes: number;
} {
  const ageMs = Date.now() - lastLoadTime;
  const ageMinutes = Math.floor(ageMs / 60000);

  return {
    totalSymbols: symbolToIdMap.size,
    lastLoadTime,
    ageMinutes,
  };
}

/**
 * Check if symbol exists in the current index
 */
export function hasSymbol(symbol: string): boolean {
  return symbolToIdMap.has(symbol.toUpperCase());
}

export { CoinListItem };
