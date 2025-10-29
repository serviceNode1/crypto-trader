import axios from 'axios';
import { cacheAside } from '../../config/redis';
import { CACHE_TTL } from '../../config/constants';
import { withRetryJitter, isRetryableError } from '../../utils/retry';
import { withRateLimit, rateLimiters } from '../../utils/rateLimiter';
import { dataLogger as logger } from '../../utils/logger';
import { symbolToCoinId } from './coinListService';

const BASE_URL = 'https://api.coingecko.com/api/v3';

interface CoinPrice {
  symbol: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d: number;
}

interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
}

interface HistoricalPrice {
  timestamp: number;
  price: number;
}

interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number;
  thumb: string;
  score: number;
}

interface OHLCData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface SearchResult {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number | null;
  thumb: string;
}

/**
 * Get current price for a cryptocurrency
 * @param symbol - Cryptocurrency symbol (e.g., 'BTC', 'TRUMP')
 * @param coinId - Optional CoinGecko coin ID to prevent symbol collisions
 */
export async function getCurrentPrice(symbol: string, coinId?: string): Promise<number> {
  const cacheKey = coinId ? `price:${coinId}` : `price:${symbol.toUpperCase()}`;

  return cacheAside(cacheKey, CACHE_TTL.PRICE, async () => {
    return withRateLimit(
      rateLimiters.coinGecko,
      async () => {
        return withRetryJitter(
          async () => {
            const resolvedCoinId = coinId || await symbolToCoinId(symbol);
            const url = `${BASE_URL}/simple/price`;

            logger.debug('Fetching current price from CoinGecko', {
              symbol,
              coinId: resolvedCoinId,
            });

            const response = await axios.get(url, {
              params: {
                ids: resolvedCoinId,
                vs_currencies: 'usd',
              },
              headers: {
                'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
              },
            });

            const price = response.data[resolvedCoinId]?.usd;
            if (!price) {
              throw new Error(`Price not found for ${symbol} (${resolvedCoinId})`);
            }

            logger.info('Current price fetched', { symbol, coinId: resolvedCoinId, price });
            return price;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'CoinGecko'
    );
  });
}

/**
 * Get detailed market data for multiple cryptocurrencies
 */
export async function getMarketData(
  symbols: string[]
): Promise<CoinMarketData[]> {
  const coinIds = await Promise.all(symbols.map(s => symbolToCoinId(s)));
  const coinIdsStr = coinIds.join(',');
  const cacheKey = `marketcap:${coinIdsStr}`;

  return cacheAside(cacheKey, CACHE_TTL.MARKETCAP, async () => {
    return withRateLimit(
      rateLimiters.coinGecko,
      async () => {
        return withRetryJitter(
          async () => {
            const url = `${BASE_URL}/coins/markets`;

            logger.debug('Fetching market data from CoinGecko', {
              symbols,
              coinIds,
            });

            const response = await axios.get(url, {
              params: {
                vs_currency: 'usd',
                ids: coinIds,
                order: 'market_cap_desc',
                per_page: 250,
                page: 1,
                sparkline: false,
              },
              headers: {
                'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
              },
            });

            logger.info('Market data fetched', { count: response.data.length });
            return response.data;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'CoinGecko'
    );
  });
}

/**
 * Get historical prices for a cryptocurrency
 */
export async function getHistoricalPrices(
  symbol: string,
  days: number = 30
): Promise<HistoricalPrice[]> {
  const cacheKey = `historical:${symbol}:${days}`;

  return cacheAside(cacheKey, CACHE_TTL.HISTORICAL, async () => {
    return withRateLimit(
      rateLimiters.coinGecko,
      async () => {
        return withRetryJitter(
          async () => {
            const coinId = await symbolToCoinId(symbol);
            const url = `${BASE_URL}/coins/${coinId}/market_chart`;

            logger.debug('Fetching historical prices from CoinGecko', {
              symbol,
              days,
            });

            const response = await axios.get(url, {
              params: {
                vs_currency: 'usd',
                days: days.toString(),
                interval: days > 90 ? 'daily' : 'hourly',
              },
              headers: {
                'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
              },
            });

            const prices: HistoricalPrice[] = response.data.prices.map(
              ([timestamp, price]: [number, number]) => ({
                timestamp,
                price,
              })
            );

            logger.info('Historical prices fetched', {
              symbol,
              count: prices.length,
            });
            return prices;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'CoinGecko'
    );
  });
}

/**
 * Get trending coins
 */
export async function getTrendingCoins(): Promise<TrendingCoin[]> {
  const cacheKey = 'trending:coins';

  return cacheAside(cacheKey, CACHE_TTL.MARKETCAP, async () => {
    return withRateLimit(
      rateLimiters.coinGecko,
      async () => {
        return withRetryJitter(
          async () => {
            const url = `${BASE_URL}/search/trending`;

            logger.debug('Fetching trending coins from CoinGecko');

            const response = await axios.get(url, {
              headers: {
                'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
              },
            });

            const trending = response.data.coins || [];
            logger.info('Trending coins fetched', { count: trending.length });
            return trending;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'CoinGecko'
    );
  });
}

/**
 * Get OHLC candlestick data from CoinGecko (fallback when Binance is unavailable)
 */
export async function getOHLCData(
  symbol: string,
  days: number = 7
): Promise<OHLCData[]> {
  const cacheKey = `coingecko:ohlc:${symbol}:${days}`;

  return cacheAside(cacheKey, CACHE_TTL.PRICE, async () => {
    return withRateLimit(
      rateLimiters.coinGecko,
      async () => {
        return withRetryJitter(
          async () => {
            const coinId = await symbolToCoinId(symbol);
            const url = `${BASE_URL}/coins/${coinId}/ohlc`;

            logger.debug('Fetching OHLC data from CoinGecko', { symbol, days });

            const response = await axios.get(url, {
              params: {
                vs_currency: 'usd',
                days: days,
              },
              headers: {
                'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
              },
            });

            // CoinGecko returns: [timestamp, open, high, low, close]
            // Convert to Binance Candlestick format
            const candlesticks = response.data.map((ohlc: number[]) => ({
              openTime: ohlc[0],
              open: ohlc[1],
              high: ohlc[2],
              low: ohlc[3],
              close: ohlc[4],
              volume: 0, // CoinGecko OHLC doesn't include volume
              closeTime: ohlc[0] + 3600000, // Approximate 1h close
              quoteAssetVolume: 0,
              trades: 0,
            }));

            logger.info('OHLC data fetched from CoinGecko', {
              symbol,
              candles: candlesticks.length,
            });

            return candlesticks;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'CoinGecko'
    );
  });
}

/**
 * Get global market data (total market cap, BTC dominance, etc.)
 */
export async function getGlobalMarketData(): Promise<Record<string, unknown>> {
  const cacheKey = 'global:market:data';

  return cacheAside(cacheKey, CACHE_TTL.MARKETCAP, async () => {
    return withRateLimit(
      rateLimiters.coinGecko,
      async () => {
        return withRetryJitter(
          async () => {
            const url = `${BASE_URL}/global`;

            logger.debug('Fetching global market data from CoinGecko');

            const response = await axios.get(url, {
              headers: {
                'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
              },
            });

            logger.info('Global market data fetched');
            return response.data.data;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'CoinGecko'
    );
  });
}

/**
 * Search for coins by query
 */
export async function searchCoins(query: string): Promise<SearchResult[]> {
  return withRateLimit(
    rateLimiters.coinGecko,
    async () => {
      return withRetryJitter(
        async () => {
          const url = `${BASE_URL}/search`;

          logger.debug('Searching coins on CoinGecko', { query });

          const response = await axios.get(url, {
            params: { query },
            headers: {
              'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
            },
          });

          const results = response.data.coins || [];
          logger.info('Coin search completed', {
            query,
            count: results.length,
          });
          return results;
        },
        { shouldRetry: isRetryableError }
      );
    },
    'CoinGecko'
  );
}

/**
 * Search for all coins matching a symbol (for disambiguation)
 * Returns all matches with name, price, and market cap rank
 */
export async function searchCoinsBySymbol(symbol: string): Promise<Array<{
  coinId: string;
  symbol: string;
  name: string;
  price: number;
  marketCapRank: number | null;
}>> {
  const cacheKey = `coin-search:${symbol.toUpperCase()}`;
  
  return cacheAside(cacheKey, 300, async () => { // 5 min cache
    return withRateLimit(
      rateLimiters.coinGecko,
      async () => {
        return withRetryJitter(
          async () => {
            logger.info('Searching for coins by symbol', { symbol });
            
            // Use CoinGecko search API
            const searchUrl = `${BASE_URL}/search`;
            const searchResponse = await axios.get(searchUrl, {
              params: { query: symbol },
              headers: {
                'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
              },
            });

            const searchResults: SearchResult[] = searchResponse.data.coins || [];
            
            // Filter for exact symbol matches
            const exactMatches = searchResults.filter(
              (coin) => coin.symbol.toUpperCase() === symbol.toUpperCase()
            );

            if (exactMatches.length === 0) {
              return [];
            }

            // Get prices for all matches (batch request)
            const coinIds = exactMatches.map(c => c.id).join(',');
            const priceUrl = `${BASE_URL}/simple/price`;
            const priceResponse = await axios.get(priceUrl, {
              params: {
                ids: coinIds,
                vs_currencies: 'usd',
              },
              headers: {
                'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
              },
            });

            // Combine search results with prices
            const results = exactMatches.map(coin => ({
              coinId: coin.id,
              symbol: coin.symbol.toUpperCase(),
              name: coin.name,
              price: priceResponse.data[coin.id]?.usd || 0,
              marketCapRank: coin.market_cap_rank,
            }));

            // Sort by market cap rank (lower = more popular)
            results.sort((a, b) => {
              if (a.marketCapRank === null) return 1;
              if (b.marketCapRank === null) return -1;
              return a.marketCapRank - b.marketCapRank;
            });

            logger.info('Found coin matches', { symbol, count: results.length });
            return results;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'CoinGecko'
    );
  });
}

// Old hardcoded mapping functions removed - now using scalable coinListService
// See src/services/dataCollection/coinListService.ts for the new implementation

export { CoinPrice, CoinMarketData, HistoricalPrice };
