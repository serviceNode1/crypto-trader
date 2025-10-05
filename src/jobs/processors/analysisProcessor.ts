import { Job } from 'bull';
import { getCandlesticks } from '../../services/dataCollection/binanceService';
import { calculateAllIndicators, analyzeTrend } from '../../services/analysis/technicalAnalysis';
import { query } from '../../config/database';
import { SUPPORTED_SYMBOLS } from '../../config/constants';
import { logger } from '../../utils/logger';

interface AnalysisJobData {
  symbol?: string;
  timeframe?: string;
}

/**
 * Perform technical analysis on a symbol
 */
async function analyzeSymbol(symbol: string): Promise<void> {
  logger.info(`Analyzing ${symbol}...`);
  
  try {
    // Get candlestick data
    const candlesticks = await getCandlesticks(symbol, '1h', 100);
    
    if (candlesticks.length === 0) {
      logger.warn(`No candlestick data for ${symbol}, skipping analysis`);
      return;
    }
    
    // Calculate technical indicators
    const indicators = calculateAllIndicators(candlesticks);
    const currentPrice = candlesticks[candlesticks.length - 1].close;
    const trend = analyzeTrend(indicators, currentPrice);
    
    // Store analysis results (you might want to create a separate table for this)
    logger.info(`${symbol} analysis complete - Trend: ${trend.trend}, Strength: ${trend.strength.toFixed(2)}`);
    logger.debug(`${symbol} indicators:`, {
      rsi: indicators.rsi.toFixed(2),
      macd: indicators.macd.histogram.toFixed(2),
      bbPosition: indicators.bollingerBands.position.toFixed(3),
    });
    
  } catch (error) {
    logger.error(`Failed to analyze ${symbol}`, { error });
    throw error;
  }
}

/**
 * Process analysis jobs
 */
export async function processAnalysis(job: Job<AnalysisJobData>): Promise<void> {
  const { symbol } = job.data;
  
  logger.info('Processing analysis job', { symbol });
  
  try {
    if (symbol) {
      // Analyze specific symbol
      await analyzeSymbol(symbol);
    } else {
      // Analyze all supported symbols
      for (const sym of SUPPORTED_SYMBOLS) {
        await analyzeSymbol(sym);
        
        // Add delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    
    logger.info('Analysis job completed', { symbol });
  } catch (error) {
    logger.error('Analysis job failed', { error, symbol });
    throw error;
  }
}
