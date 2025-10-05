import axios from 'axios';
import { cacheAside } from '../../config/redis';
import { CACHE_TTL } from '../../config/constants';
import { withRetryJitter, isRetryableError } from '../../utils/retry';
import { withRateLimit, rateLimiters } from '../../utils/rateLimiter';
import { dataLogger as logger } from '../../utils/logger';

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

/**
 * Get current price for a cryptocurrency
 */
export async function getCurrentPrice(symbol: string): Promise<number> {
  const cacheKey = `price:${symbol.toUpperCase()}`;

  return cacheAside(cacheKey, CACHE_TTL.PRICE, async () => {
    return withRateLimit(
      rateLimiters.coinGecko,
      async () => {
        return withRetryJitter(
          async () => {
            const coinId = symbolToCoinId(symbol);
            const url = `${BASE_URL}/simple/price`;

            logger.debug('Fetching current price from CoinGecko', {
              symbol,
              coinId,
            });

            const response = await axios.get(url, {
              params: {
                ids: coinId,
                vs_currencies: 'usd',
              },
              headers: {
                'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
              },
            });

            const price = response.data[coinId]?.usd;
            if (!price) {
              throw new Error(`Price not found for ${symbol}`);
            }

            logger.info('Current price fetched', { symbol, price });
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
  const coinIds = symbols.map(symbolToCoinId).join(',');
  const cacheKey = `marketcap:${coinIds}`;

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
            const coinId = symbolToCoinId(symbol);
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
export async function getTrendingCoins(): Promise<any[]> {
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
 * Get global market data (total market cap, BTC dominance, etc.)
 */
export async function getGlobalMarketData(): Promise<any> {
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
export async function searchCoins(query: string): Promise<any[]> {
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
 * Convert symbol to CoinGecko coin ID
 * This is a simplified mapping - in production, you'd want a more comprehensive database
 */
function symbolToCoinId(symbol: string): string {
  const symbolMap: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    BNB: 'binancecoin',
    XRP: 'ripple',
    ADA: 'cardano',
    SOL: 'solana',
    DOT: 'polkadot',
    MATIC: 'matic-network',
    AVAX: 'avalanche-2',
    LINK: 'chainlink',
    DOGE: 'dogecoin',
    SHIB: 'shiba-inu',
    UNI: 'uniswap',
    ATOM: 'cosmos',
    LTC: 'litecoin',
    ETC: 'ethereum-classic',
    XLM: 'stellar',
    BCH: 'bitcoin-cash',
    ALGO: 'algorand',
    VET: 'vechain',
  };

  const coinId = symbolMap[symbol.toUpperCase()];
  if (!coinId) {
    logger.warn('Unknown symbol, using as-is', { symbol });
    return symbol.toLowerCase();
  }

  return coinId;
}

export { CoinPrice, CoinMarketData, HistoricalPrice };
