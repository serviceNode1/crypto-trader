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
            const coinId = await symbolToCoinIdAsync(symbol);
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
  const coinIds = symbols.map(symbolToCoinIdSync).join(',');
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
            const coinId = await symbolToCoinIdAsync(symbol);
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
 * Get OHLC candlestick data from CoinGecko (fallback when Binance is unavailable)
 */
export async function getCandlesticksFromCoinGecko(
  symbol: string,
  days: number = 7
): Promise<any[]> {
  const cacheKey = `coingecko:ohlc:${symbol}:${days}`;

  return cacheAside(cacheKey, CACHE_TTL.PRICE, async () => {
    return withRateLimit(
      rateLimiters.coinGecko,
      async () => {
        return withRetryJitter(
          async () => {
            const coinId = await symbolToCoinIdAsync(symbol);
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

// Cache for dynamically discovered coin IDs
const dynamicCoinIdCache: Record<string, string> = {};

/**
 * Convert symbol to CoinGecko coin ID
 * First checks static mapping, then uses search API as fallback
 */
async function symbolToCoinIdAsync(symbol: string): Promise<string> {
  // Try static mapping first
  const staticId = symbolToCoinIdSync(symbol);
  if (staticId !== symbol.toLowerCase()) {
    return staticId; // Found in static map
  }

  // Check dynamic cache
  if (dynamicCoinIdCache[symbol.toUpperCase()]) {
    logger.info('Using cached coin ID from dynamic search', { 
      symbol, 
      coinId: dynamicCoinIdCache[symbol.toUpperCase()] 
    });
    return dynamicCoinIdCache[symbol.toUpperCase()];
  }

  // Try dynamic search as last resort
  try {
    logger.info('Searching for coin ID dynamically', { symbol });
    const searchResults = await searchCoins(symbol);
    
    if (searchResults && searchResults.length > 0) {
      // Find exact symbol match
      const exactMatch = searchResults.find(
        (coin: any) => coin.symbol.toUpperCase() === symbol.toUpperCase()
      );
      
      if (exactMatch) {
        const coinId = exactMatch.id;
        dynamicCoinIdCache[symbol.toUpperCase()] = coinId;
        logger.info('Found coin ID via dynamic search', { symbol, coinId });
        return coinId;
      }
    }
  } catch (error) {
    logger.warn('Dynamic coin ID search failed', { symbol, error });
  }

  // Last resort: use lowercase symbol
  logger.warn('Could not find coin ID, using lowercase symbol', { symbol });
  return symbol.toLowerCase();
}

/**
 * Synchronous version - only checks static mapping
 */
function symbolToCoinIdSync(symbol: string): string {
  const symbolMap: Record<string, string> = {
    // Top 20
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
    
    // Top 21-50
    TRX: 'tron',
    FIL: 'filecoin',
    APT: 'aptos',
    NEAR: 'near',
    ARB: 'arbitrum',
    OP: 'optimism',
    MKR: 'maker',
    AAVE: 'aave',
    GRT: 'the-graph',
    SNX: 'synthetix-network-token',
    CRV: 'curve-dao-token',
    COMP: 'compound-governance-token',
    FTM: 'fantom',
    SAND: 'the-sandbox',
    MANA: 'decentraland',
    AXS: 'axie-infinity',
    THETA: 'theta-token',
    XTZ: 'tezos',
    EOS: 'eos',
    FLOW: 'flow',
    
    // Popular altcoins
    ZEC: 'zcash',  // FIX for your ZEC issue!
    XMR: 'monero',
    DASH: 'dash',
    ZRX: '0x',
    BAT: 'basic-attention-token',
    ENJ: 'enjincoin',
    CHZ: 'chiliz',
    SUSHI: 'sushi',
    YFI: 'yearn-finance',
    '1INCH': '1inch',  // Property names starting with numbers must be quoted
    LRC: 'loopring',
    GALA: 'gala',
    IMX: 'immutable-x',
    APE: 'apecoin',
    LDO: 'lido-dao',
    QNT: 'quant-network',
    FET: 'fetch-ai',
    RNDR: 'render-token',
    INJ: 'injective-protocol',
    RUNE: 'thorchain',
    TAO: 'bittensor',
    SEI: 'sei-network',
    SUI: 'sui',
    TIA: 'celestia',
    
    // Stablecoins
    USDT: 'tether',
    USDC: 'usd-coin',
    DAI: 'dai',
    BUSD: 'binance-usd',
    TUSD: 'true-usd',
  };

  const coinId = symbolMap[symbol.toUpperCase()];
  if (!coinId) {
    logger.warn('Unknown symbol, using as-is (may cause API errors)', { symbol });
    return symbol.toLowerCase();
  }

  return coinId;
}

export { CoinPrice, CoinMarketData, HistoricalPrice };
