import axios from 'axios';
import { cacheAside } from '../../config/redis';
import { CACHE_TTL, TIMEFRAMES } from '../../config/constants';
import { withRetryJitter, isRetryableError } from '../../utils/retry';
import { withRateLimit, rateLimiters } from '../../utils/rateLimiter';
import { dataLogger as logger } from '../../utils/logger';

// Use Binance.US for US users, global Binance otherwise
const BASE_URL = process.env.BINANCE_REGION === 'US'
  ? 'https://api.binance.us/api/v3'
  : 'https://api.binance.com/api/v3';

logger.info(`Using Binance API: ${BASE_URL}`);

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

interface OrderBookDepth {
  lastUpdateId: number;
  bids: Array<[string, string]>;
  asks: Array<[string, string]>;
}

interface Ticker24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

/**
 * Get candlestick data (OHLCV)
 */
export async function getCandlesticks(
  symbol: string,
  interval: string = '1h',
  limit: number = 100
): Promise<Candlestick[]> {
  const binanceSymbol = `${symbol.toUpperCase()}USDT`;
  const cacheKey = `candles:${binanceSymbol}:${interval}:${limit}`;

  return cacheAside(cacheKey, CACHE_TTL.PRICE, async () => {
    return withRateLimit(
      rateLimiters.binance,
      async () => {
        return withRetryJitter(
          async () => {
            const url = `${BASE_URL}/klines`;

            logger.debug('Fetching candlesticks from Binance', {
              symbol: binanceSymbol,
              interval,
              limit,
            });

            const response = await axios.get(url, {
              params: {
                symbol: binanceSymbol,
                interval: mapTimeframeToInterval(interval),
                limit,
              },
            });

            const candlesticks: Candlestick[] = response.data.map(
              (candle: any[]) => ({
                openTime: candle[0],
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5]),
                closeTime: candle[6],
                quoteAssetVolume: parseFloat(candle[7]),
                trades: candle[8],
              })
            );

            logger.info('Candlesticks fetched', {
              symbol: binanceSymbol,
              count: candlesticks.length,
            });
            return candlesticks;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'Binance'
    );
  });
}

/**
 * Get order book depth
 */
export async function getOrderBookDepth(
  symbol: string,
  limit: number = 100
): Promise<OrderBookDepth> {
  const binanceSymbol = `${symbol.toUpperCase()}USDT`;

  return withRateLimit(
    rateLimiters.binance,
    async () => {
      return withRetryJitter(
        async () => {
          const url = `${BASE_URL}/depth`;

          logger.debug('Fetching order book depth from Binance', {
            symbol: binanceSymbol,
            limit,
          });

          const response = await axios.get(url, {
            params: {
              symbol: binanceSymbol,
              limit,
            },
          });

          logger.info('Order book depth fetched', {
            symbol: binanceSymbol,
            bids: response.data.bids.length,
            asks: response.data.asks.length,
          });

          return response.data;
        },
        { shouldRetry: isRetryableError }
      );
    },
    'Binance'
  );
}

/**
 * Get 24-hour ticker statistics
 */
export async function get24hrTicker(symbol: string): Promise<Ticker24hr> {
  const binanceSymbol = `${symbol.toUpperCase()}USDT`;
  const cacheKey = `ticker24hr:${binanceSymbol}`;

  return cacheAside(cacheKey, CACHE_TTL.PRICE, async () => {
    return withRateLimit(
      rateLimiters.binance,
      async () => {
        return withRetryJitter(
          async () => {
            const url = `${BASE_URL}/ticker/24hr`;

            logger.debug('Fetching 24hr ticker from Binance', {
              symbol: binanceSymbol,
            });

            const response = await axios.get(url, {
              params: {
                symbol: binanceSymbol,
              },
            });

            logger.info('24hr ticker fetched', {
              symbol: binanceSymbol,
              price: response.data.lastPrice,
            });
            return response.data;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'Binance'
    );
  });
}

/**
 * Get current average price
 */
export async function getAveragePrice(symbol: string): Promise<number> {
  const binanceSymbol = `${symbol.toUpperCase()}USDT`;

  return withRateLimit(
    rateLimiters.binance,
    async () => {
      return withRetryJitter(
        async () => {
          const url = `${BASE_URL}/avgPrice`;

          logger.debug('Fetching average price from Binance', {
            symbol: binanceSymbol,
          });

          const response = await axios.get(url, {
            params: {
              symbol: binanceSymbol,
            },
          });

          const price = parseFloat(response.data.price);
          logger.info('Average price fetched', {
            symbol: binanceSymbol,
            price,
          });
          return price;
        },
        { shouldRetry: isRetryableError }
      );
    },
    'Binance'
  );
}

/**
 * Get recent trades
 */
export async function getRecentTrades(
  symbol: string,
  limit: number = 100
): Promise<any[]> {
  const binanceSymbol = `${symbol.toUpperCase()}USDT`;

  return withRateLimit(
    rateLimiters.binance,
    async () => {
      return withRetryJitter(
        async () => {
          const url = `${BASE_URL}/trades`;

          logger.debug('Fetching recent trades from Binance', {
            symbol: binanceSymbol,
            limit,
          });

          const response = await axios.get(url, {
            params: {
              symbol: binanceSymbol,
              limit,
            },
          });

          logger.info('Recent trades fetched', {
            symbol: binanceSymbol,
            count: response.data.length,
          });
          return response.data;
        },
        { shouldRetry: isRetryableError }
      );
    },
    'Binance'
  );
}

/**
 * Get exchange info (trading rules, symbol info)
 */
export async function getExchangeInfo(symbol?: string): Promise<any> {
  const cacheKey = symbol
    ? `exchange:info:${symbol.toUpperCase()}`
    : 'exchange:info:all';

  return cacheAside(cacheKey, CACHE_TTL.HISTORICAL, async () => {
    return withRateLimit(
      rateLimiters.binance,
      async () => {
        return withRetryJitter(
          async () => {
            const url = `${BASE_URL}/exchangeInfo`;
            const params: any = {};

            if (symbol) {
              params.symbol = `${symbol.toUpperCase()}USDT`;
            }

            logger.debug('Fetching exchange info from Binance', { symbol });

            const response = await axios.get(url, { params });

            logger.info('Exchange info fetched');
            return response.data;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'Binance'
    );
  });
}

/**
 * Calculate estimated slippage based on order book
 */
export async function estimateSlippage(
  symbol: string,
  side: 'BUY' | 'SELL',
  usdAmount: number
): Promise<number> {
  try {
    const orderBook = await getOrderBookDepth(symbol, 100);
    const orders = side === 'BUY' ? orderBook.asks : orderBook.bids;

    let remainingAmount = usdAmount;
    let totalCost = 0;
    let totalQuantity = 0;

    for (const [priceStr, quantityStr] of orders) {
      const price = parseFloat(priceStr);
      const quantity = parseFloat(quantityStr);
      const orderValue = price * quantity;

      if (remainingAmount <= orderValue) {
        const neededQuantity = remainingAmount / price;
        totalCost += remainingAmount;
        totalQuantity += neededQuantity;
        break;
      }

      totalCost += orderValue;
      totalQuantity += quantity;
      remainingAmount -= orderValue;
    }

    if (totalQuantity === 0) {
      logger.warn('Insufficient liquidity in order book', { symbol, usdAmount });
      return 0.003; // Return max slippage
    }

    const averagePrice = totalCost / totalQuantity;
    const marketPrice = parseFloat(orders[0][0]);
    const slippage = Math.abs(averagePrice - marketPrice) / marketPrice;

    logger.debug('Slippage estimated', {
      symbol,
      side,
      usdAmount,
      slippage: slippage.toFixed(4),
    });

    return slippage;
  } catch (error) {
    logger.error('Failed to estimate slippage', { symbol, error });
    return 0.002; // Return default slippage on error
  }
}

/**
 * Map internal timeframe to Binance interval
 */
function mapTimeframeToInterval(timeframe: string): string {
  const intervalMap: Record<string, string> = {
    [TIMEFRAMES.MINUTE_5]: '5m',
    [TIMEFRAMES.MINUTE_15]: '15m',
    [TIMEFRAMES.HOUR_1]: '1h',
    [TIMEFRAMES.HOUR_4]: '4h',
    [TIMEFRAMES.DAY_1]: '1d',
  };

  return intervalMap[timeframe] || timeframe;
}

export { Candlestick, OrderBookDepth, Ticker24hr };
