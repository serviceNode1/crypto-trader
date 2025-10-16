import axios from 'axios';
import { cacheAside } from '../../config/redis';
import { CACHE_TTL } from '../../config/constants';
import { withRetryJitter, isRetryableError } from '../../utils/retry';
import { withRateLimit, rateLimiters } from '../../utils/rateLimiter';
import { dataLogger as logger } from '../../utils/logger';

const BASE_URL = 'https://api.exchange.coinbase.com';

// Symbols not available on Coinbase (exchange-specific coins)
const COINBASE_UNSUPPORTED = [
  'BNB',  // Binance Coin (exclusive to Binance)
  'FTT',  // FTX Token (FTX exchange)
  'HT',   // Huobi Token (Huobi exchange)
  'OKB',  // OKEx Token (OKEx exchange)
  'LEO',  // UNUS SED LEO (Bitfinex exchange)
  'CRO',  // Crypto.com Coin (Crypto.com exchange)
  'KCS',  // KuCoin Shares (KuCoin exchange)
];

// API Keys (optional - public endpoints work without auth)
const API_KEY = process.env.COINBASE_API_KEY || '';
const API_SECRET = process.env.COINBASE_API_SECRET || '';
const API_KEY_TRADING = process.env.COINBASE_API_KEY_TRADING || '';
const API_SECRET_TRADING = process.env.COINBASE_API_SECRET_TRADING || '';

logger.info(`Using Coinbase API: ${BASE_URL}`, {
  authenticated: !!(API_KEY && API_SECRET),
  tradingEnabled: !!(API_KEY_TRADING && API_SECRET_TRADING)
});

// NOTE: Authentication function available when needed for private endpoints (orders, accounts, etc.)
// All current endpoints are public and work without authentication

interface CoinbaseCandle {
  time: number;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
}

interface CoinbaseTicker {
  trade_id: number;
  price: string;
  size: string;
  time: string;
  bid: string;
  ask: string;
  volume: string;
}

interface CoinbaseProduct {
  id: string;
  base_currency: string;
  quote_currency: string;
  base_min_size: string;
  base_max_size: string;
  quote_increment: string;
  base_increment: string;
  display_name: string;
  min_market_funds: string;
  max_market_funds: string;
  margin_enabled: boolean;
  post_only: boolean;
  limit_only: boolean;
  cancel_only: boolean;
  status: string;
  status_message: string;
}

interface Candlestick {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteAssetVolume: number;
  trades: number;
}

/**
 * Get candlestick/OHLC data from Coinbase
 */
export async function getCandlesticks(
  symbol: string,
  interval: string = '1h',
  limit: number = 100
): Promise<Candlestick[]> {
  const symbolUpper = symbol.toUpperCase();
  
  // Check if symbol is supported on Coinbase
  if (COINBASE_UNSUPPORTED.includes(symbolUpper)) {
    logger.warn(`${symbolUpper} not available on Coinbase (exchange-specific token), returning empty data`);
    return [];
  }
  
  const productId = `${symbolUpper}-USD`;
  const cacheKey = `coinbase:candles:${productId}:${interval}:${limit}`;

  return cacheAside(cacheKey, CACHE_TTL.PRICE, async () => {
    return withRateLimit(
      rateLimiters.coinbase,
      async () => {
        return withRetryJitter(
          async () => {
            const granularity = intervalToGranularity(interval);
            const url = `${BASE_URL}/products/${productId}/candles`;

            logger.debug('Fetching candlesticks from Coinbase', {
              productId,
              interval,
              granularity,
              limit,
            });

            // Coinbase returns candles in reverse chronological order
            const response = await axios.get(url, {
              params: {
                granularity,
              },
            });

            const candles: CoinbaseCandle[] = response.data
              .slice(0, limit)
              .reverse()
              .map((c: any) => ({
                time: c[0],
                low: parseFloat(c[1]),
                high: parseFloat(c[2]),
                open: parseFloat(c[3]),
                close: parseFloat(c[4]),
                volume: parseFloat(c[5]),
              }));

            logger.info('Candlesticks fetched from Coinbase', {
              productId,
              count: candles.length,
            });

            // Convert to standardized format
            return candles.map((candle) => ({
              openTime: candle.time * 1000,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
              closeTime: (candle.time + granularity) * 1000,
              quoteAssetVolume: candle.volume * candle.close,
              trades: 0, // Coinbase doesn't provide this
            }));
          },
          { shouldRetry: isRetryableError }
        );
      },
      'Coinbase'
    );
  });
}

/**
 * Get 24-hour ticker statistics from Coinbase
 */
export async function get24hrTicker(symbol: string): Promise<any> {
  const productId = `${symbol.toUpperCase()}-USD`;
  const cacheKey = `coinbase:ticker24hr:${productId}`;

  return cacheAside(cacheKey, CACHE_TTL.PRICE, async () => {
    return withRateLimit(
      rateLimiters.coinbase,
      async () => {
        return withRetryJitter(
          async () => {
            const url = `${BASE_URL}/products/${productId}/ticker`;

            logger.debug('Fetching 24hr ticker from Coinbase', { productId });

            const response = await axios.get<CoinbaseTicker>(url);

            // Get 24hr stats
            const statsUrl = `${BASE_URL}/products/${productId}/stats`;
            const statsResponse = await axios.get(statsUrl);

            const ticker = {
              symbol: productId,
              lastPrice: response.data.price,
              bidPrice: response.data.bid,
              askPrice: response.data.ask,
              volume: response.data.volume,
              priceChange: statsResponse.data.last
                ? (parseFloat(response.data.price) - parseFloat(statsResponse.data.open)).toString()
                : '0',
              priceChangePercent: statsResponse.data.open
                ? (
                    ((parseFloat(response.data.price) - parseFloat(statsResponse.data.open)) /
                      parseFloat(statsResponse.data.open)) *
                    100
                  ).toFixed(2)
                : '0',
              high: statsResponse.data.high,
              low: statsResponse.data.low,
              openPrice: statsResponse.data.open,
            };

            logger.info('24hr ticker fetched from Coinbase', {
              productId,
              price: ticker.lastPrice,
            });

            return ticker;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'Coinbase'
    );
  });
}

/**
 * Get order book depth from Coinbase
 */
export async function getOrderBookDepth(
  symbol: string,
  limit: number = 100
): Promise<any> {
  const productId = `${symbol.toUpperCase()}-USD`;
  const cacheKey = `coinbase:depth:${productId}:${limit}`;

  return cacheAside(cacheKey, CACHE_TTL.PRICE, async () => {
    return withRateLimit(
      rateLimiters.coinbase,
      async () => {
        return withRetryJitter(
          async () => {
            const url = `${BASE_URL}/products/${productId}/book`;

            logger.debug('Fetching order book from Coinbase', { productId, limit });

            const response = await axios.get(url, {
              params: {
                level: 2, // Best 50 bids/asks
              },
            });

            logger.info('Order book fetched from Coinbase', {
              productId,
              bids: response.data.bids.length,
              asks: response.data.asks.length,
            });

            return {
              lastUpdateId: Date.now(),
              bids: response.data.bids.slice(0, limit),
              asks: response.data.asks.slice(0, limit),
            };
          },
          { shouldRetry: isRetryableError }
        );
      },
      'Coinbase'
    );
  });
}

/**
 * Get current average price from Coinbase
 */
export async function getAveragePrice(symbol: string): Promise<number> {
  const productId = `${symbol.toUpperCase()}-USD`;

  return withRateLimit(
    rateLimiters.coinbase,
    async () => {
      return withRetryJitter(
        async () => {
          const url = `${BASE_URL}/products/${productId}/ticker`;

          const response = await axios.get<CoinbaseTicker>(url);

          return parseFloat(response.data.price);
        },
        { shouldRetry: isRetryableError }
      );
    },
    'Coinbase'
  );
}

/**
 * Get all available products/trading pairs
 */
export async function getProducts(): Promise<CoinbaseProduct[]> {
  const cacheKey = 'coinbase:products:all';

  return cacheAside(cacheKey, 3600, async () => {
    const url = `${BASE_URL}/products`;

    logger.debug('Fetching products from Coinbase');

    const response = await axios.get<CoinbaseProduct[]>(url);

    logger.info('Products fetched from Coinbase', {
      count: response.data.length,
    });

    return response.data;
  });
}

/**
 * Estimate slippage based on order book
 */
export async function estimateSlippage(
  symbol: string,
  side: 'BUY' | 'SELL',
  usdAmount: number
): Promise<number> {
  try {
    const orderBook = await getOrderBookDepth(symbol, 50);

    const orders = side === 'BUY' ? orderBook.asks : orderBook.bids;

    let remainingAmount = usdAmount;
    let totalCost = 0;
    let totalQuantity = 0;

    for (const [price, size] of orders) {
      const priceNum = parseFloat(price);
      const sizeNum = parseFloat(size);
      const orderValue = priceNum * sizeNum;

      if (orderValue >= remainingAmount) {
        const partialQuantity = remainingAmount / priceNum;
        totalCost += remainingAmount;
        totalQuantity += partialQuantity;
        break;
      } else {
        totalCost += orderValue;
        totalQuantity += sizeNum;
        remainingAmount -= orderValue;
      }
    }

    if (remainingAmount > 0) {
      logger.warn('Order book depth insufficient for amount', {
        symbol,
        usdAmount,
        remainingAmount,
      });
    }

    const avgPrice = totalCost / totalQuantity;
    const marketPrice = parseFloat(orders[0][0]);
    const slippage = Math.abs((avgPrice - marketPrice) / marketPrice);

    return slippage;
  } catch (error) {
    // If coin not available on Coinbase (404), use default slippage estimate
    logger.warn('Could not get Coinbase order book, using default slippage estimate', {
      symbol,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Default slippage for less liquid coins: 0.75% (0.0075)
    // This is conservative for paper trading
    return 0.0075;
  }
}

/**
 * Convert interval string to Coinbase granularity (seconds)
 */
function intervalToGranularity(interval: string): number {
  const intervalMap: { [key: string]: number } = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '6h': 21600,
    '1d': 86400,
  };

  return intervalMap[interval] || 3600; // Default to 1 hour
}

export { Candlestick, CoinbaseTicker, CoinbaseProduct };
