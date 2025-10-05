import axios from 'axios';
import { cacheAside } from '../../config/redis';
import { CACHE_TTL } from '../../config/constants';
import { withRetryJitter, isRetryableError } from '../../utils/retry';
import { withRateLimit, rateLimiters } from '../../utils/rateLimiter';
import { dataLogger as logger } from '../../utils/logger';

const BASE_URL = 'https://www.alphavantage.co/query';

interface QuoteData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

/**
 * Get stock quote (S&P 500, etc.)
 */
export async function getStockQuote(symbol: string): Promise<QuoteData> {
  const cacheKey = `stock:quote:${symbol}`;

  return cacheAside(cacheKey, CACHE_TTL.TRADITIONAL_MARKETS, async () => {
    return withRateLimit(
      rateLimiters.alphaVantage,
      async () => {
        return withRetryJitter(
          async () => {
            logger.debug('Fetching stock quote from Alpha Vantage', { symbol });

            const response = await axios.get(BASE_URL, {
              params: {
                function: 'GLOBAL_QUOTE',
                symbol,
                apikey: process.env.ALPHA_VANTAGE_API_KEY,
              },
            });

            if (response.data['Note']) {
              throw new Error('Alpha Vantage rate limit reached');
            }

            const quote = response.data['Global Quote'];
            if (!quote) {
              throw new Error(`No data found for ${symbol}`);
            }

            const data: QuoteData = {
              symbol: quote['01. symbol'],
              price: parseFloat(quote['05. price']),
              change: parseFloat(quote['09. change']),
              changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
              volume: parseInt(quote['06. volume']),
              timestamp: quote['07. latest trading day'],
            };

            logger.info('Stock quote fetched', { symbol, price: data.price });
            return data;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'AlphaVantage'
    );
  });
}

/**
 * Get forex rate (for DXY - US Dollar Index)
 */
export async function getForexRate(
  fromCurrency: string = 'USD',
  toCurrency: string = 'EUR'
): Promise<number> {
  const cacheKey = `forex:${fromCurrency}:${toCurrency}`;

  return cacheAside(cacheKey, CACHE_TTL.TRADITIONAL_MARKETS, async () => {
    return withRateLimit(
      rateLimiters.alphaVantage,
      async () => {
        return withRetryJitter(
          async () => {
            logger.debug('Fetching forex rate from Alpha Vantage', {
              fromCurrency,
              toCurrency,
            });

            const response = await axios.get(BASE_URL, {
              params: {
                function: 'CURRENCY_EXCHANGE_RATE',
                from_currency: fromCurrency,
                to_currency: toCurrency,
                apikey: process.env.ALPHA_VANTAGE_API_KEY,
              },
            });

            if (response.data['Note']) {
              throw new Error('Alpha Vantage rate limit reached');
            }

            const rateData = response.data['Realtime Currency Exchange Rate'];
            if (!rateData) {
              throw new Error(`No forex data found for ${fromCurrency}/${toCurrency}`);
            }

            const rate = parseFloat(rateData['5. Exchange Rate']);

            logger.info('Forex rate fetched', {
              fromCurrency,
              toCurrency,
              rate,
            });
            return rate;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'AlphaVantage'
    );
  });
}

/**
 * Get commodity price (Gold)
 */
export async function getCommodityPrice(commodity: string = 'GOLD'): Promise<number> {
  // Note: Alpha Vantage doesn't have direct commodity pricing in free tier
  // We'll use proxy ETFs: GLD for Gold, USO for Oil, etc.
  const etfMap: Record<string, string> = {
    GOLD: 'GLD',
    OIL: 'USO',
    SILVER: 'SLV',
  };

  const etfSymbol = etfMap[commodity.toUpperCase()] || commodity;

  try {
    const quote = await getStockQuote(etfSymbol);
    return quote.price;
  } catch (error) {
    logger.error('Failed to fetch commodity price', { commodity, error });
    throw error;
  }
}

/**
 * Get S&P 500 index value
 */
export async function getSP500(): Promise<QuoteData> {
  return getStockQuote('SPY'); // S&P 500 ETF as proxy
}

/**
 * Get VIX (Volatility Index)
 */
export async function getVIX(): Promise<number> {
  try {
    const quote = await getStockQuote('^VIX');
    return quote.price;
  } catch (error) {
    // VIX might not be available, try VXX ETF as proxy
    logger.warn('VIX not available, trying VXX ETF', { error });
    const vxxQuote = await getStockQuote('VXX');
    return vxxQuote.price;
  }
}

/**
 * Get traditional market overview (aggregated data)
 */
export async function getTraditionalMarketsOverview(): Promise<{
  sp500: QuoteData;
  gold: number;
  vix: number;
}> {
  const cacheKey = 'traditional:markets:overview';

  return cacheAside(cacheKey, CACHE_TTL.TRADITIONAL_MARKETS, async () => {
    logger.debug('Fetching traditional markets overview');

    // Execute requests sequentially due to strict rate limit
    const sp500 = await getSP500();
    
    // Add delay to respect rate limit
    await new Promise(resolve => setTimeout(resolve, 13000)); // 13 seconds between calls
    const gold = await getCommodityPrice('GOLD');
    
    await new Promise(resolve => setTimeout(resolve, 13000));
    const vix = await getVIX();

    const overview = { sp500, gold, vix };

    logger.info('Traditional markets overview fetched', {
      sp500Price: sp500.price,
      goldPrice: gold,
      vix,
    });

    return overview;
  });
}

/**
 * Calculate market sentiment based on traditional markets
 * Risk-on: S&P up, VIX down, commodities stable
 * Risk-off: S&P down, VIX up, flight to gold
 */
export function calculateMarketSentiment(data: {
  sp500: QuoteData;
  gold: number;
  vix: number;
}): 'risk-on' | 'risk-off' | 'neutral' {
  const sp500Change = data.sp500.changePercent;
  const vix = data.vix;

  // Simple heuristic
  if (sp500Change > 0.5 && vix < 20) {
    return 'risk-on';
  } else if (sp500Change < -0.5 || vix > 30) {
    return 'risk-off';
  }

  return 'neutral';
}

export { QuoteData };
