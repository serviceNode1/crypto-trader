import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS, TRADE_ACTIONS, RISK_LEVELS } from '../../config/constants';
import { withRetryJitter } from '../../utils/retry';
import { withRateLimit, rateLimiters } from '../../utils/rateLimiter';
import { aiLogger as logger } from '../../utils/logger';

// Initialize OpenAI
let openai: OpenAI | null = null;
try {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not configured');
  } else {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    logger.info('OpenAI client initialized');
  }
} catch (error) {
  logger.error('Failed to initialize OpenAI client', { error });
}

// Initialize Anthropic
let anthropic: Anthropic | null = null;
try {
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn('ANTHROPIC_API_KEY not configured');
  } else {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    logger.info('Anthropic client initialized');
  }
} catch (error) {
  logger.error('Failed to initialize Anthropic client', { error });
}

export interface TradeRecommendation {
  id?: number;  // Database ID (added after insert)
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-100
  reasoning: {
    bullCase: string;
    bearCase: string;
    conclusion: string;
  };
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfitLevels: number[];
  positionSize: number; // Percentage of portfolio
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  keyFactors: string[];
  sources: string[];
  timeframe: string;
}

export interface AnalysisInput {
  symbol: string;
  currentPrice: number;
  technicalIndicators: any;
  sentiment: any;
  news: any[];
  marketContext: any;
  correlations?: any;
}

/**
 * Generate trade recommendation using OpenAI
 */
async function getOpenAIRecommendation(
  input: AnalysisInput
): Promise<TradeRecommendation> {
  if (!openai) {
    throw new Error('OpenAI client not initialized - check OPENAI_API_KEY');
  }

  return withRateLimit(
    rateLimiters.openai,
    async () => {
      return withRetryJitter(async () => {
        const prompt = buildAnalysisPrompt(input);

        logger.debug('Requesting OpenAI analysis', { symbol: input.symbol });

        const response = await openai!.chat.completions.create({
          model: AI_MODELS.OPENAI.MODEL,
          messages: [
            {
              role: 'system',
              content:
                'You are a professional cryptocurrency trading analyst. Provide structured, data-driven analysis in JSON format. Be realistic about risks and uncertainties.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: AI_MODELS.OPENAI.TEMPERATURE,
          max_tokens: AI_MODELS.OPENAI.MAX_TOKENS,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from OpenAI');
        }

        const recommendation = JSON.parse(content);

        logger.info('OpenAI recommendation received', {
          symbol: input.symbol,
          action: recommendation.action,
          confidence: recommendation.confidence,
        });

        return recommendation;
      });
    },
    'OpenAI'
  );
}

/**
 * Generate trade recommendation using Anthropic Claude
 */
async function getClaudeRecommendation(
  input: AnalysisInput
): Promise<TradeRecommendation> {
  if (!anthropic) {
    throw new Error('Anthropic client not initialized - check ANTHROPIC_API_KEY');
  }

  return withRateLimit(
    rateLimiters.anthropic,
    async () => {
      return withRetryJitter(async () => {
        const prompt = buildAnalysisPrompt(input);

        logger.info('Requesting Claude analysis', { symbol: input.symbol });

        try {
          const response = await anthropic!.messages.create({
            model: AI_MODELS.ANTHROPIC.MODEL,
            max_tokens: AI_MODELS.ANTHROPIC.MAX_TOKENS,
            temperature: AI_MODELS.ANTHROPIC.TEMPERATURE,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          });

          const content = response.content[0];
          if (content.type !== 'text') {
            throw new Error('Unexpected response type from Claude');
          }

          const recommendation = JSON.parse(content.text);

          logger.info('Claude recommendation received', {
            symbol: input.symbol,
            action: recommendation.action,
            confidence: recommendation.confidence,
          });

          return recommendation;
        } catch (error: any) {
          logger.error('Claude API request failed', {
            symbol: input.symbol,
            error: error.message,
            statusCode: error.status,
            details: error.error?.message || error.toString(),
          });
          throw error;
        }
      });
    },
    'Anthropic'
  );
}

/**
 * Build analysis prompt for AI models
 */
function buildAnalysisPrompt(input: AnalysisInput): string {
  const {
    symbol,
    currentPrice,
    technicalIndicators,
    sentiment,
    news,
    marketContext,
  } = input;

  return `You are a cryptocurrency trading analyst. Analyze the following data for ${symbol} and provide a trading recommendation.

**Current Price**: $${currentPrice.toFixed(2)}

**Technical Indicators**:
- RSI: ${technicalIndicators.rsi?.toFixed(2) || 'N/A'}
- MACD: ${technicalIndicators.macd?.macd?.toFixed(4) || 'N/A'} (Signal: ${technicalIndicators.macd?.signal?.toFixed(4) || 'N/A'})
- Bollinger Bands: Upper ${technicalIndicators.bollingerBands?.upper?.toFixed(2) || 'N/A'}, Middle ${technicalIndicators.bollingerBands?.middle?.toFixed(2) || 'N/A'}, Lower ${technicalIndicators.bollingerBands?.lower?.toFixed(2) || 'N/A'}
- EMA (9/21/50): ${technicalIndicators.ema?.short?.toFixed(2) || 'N/A'} / ${technicalIndicators.ema?.medium?.toFixed(2) || 'N/A'} / ${technicalIndicators.ema?.long?.toFixed(2) || 'N/A'}
- Volume Ratio: ${technicalIndicators.volume?.ratio?.toFixed(2) || 'N/A'}x average
- Support Levels: ${technicalIndicators.supportResistance?.support?.map((s: number) => '$' + s.toFixed(2)).join(', ') || 'None'}
- Resistance Levels: ${technicalIndicators.supportResistance?.resistance?.map((r: number) => '$' + r.toFixed(2)).join(', ') || 'None'}

**Sentiment Analysis**:
- Overall Score: ${sentiment.overall?.score?.toFixed(3) || 'N/A'} (${sentiment.overall?.classification || 'neutral'})
- Reddit Sentiment: ${sentiment.reddit?.score?.toFixed(3) || 'N/A'}
- News Sentiment: ${sentiment.news?.score?.toFixed(3) || 'N/A'}
- Mention Volume: ${sentiment.mentionVolume || 0} posts/articles
- Sentiment Velocity: ${sentiment.velocity?.toFixed(3) || 'N/A'}

**Recent News Headlines** (top 5):
${news.slice(0, 5).map((n: any, i: number) => `${i + 1}. ${n.title}`).join('\n')}

**Market Context**:
- BTC Dominance: ${marketContext.btcDominance?.toFixed(2) || 'N/A'}%
- Market Regime: ${marketContext.marketRegime || 'unknown'}
- Risk Sentiment: ${marketContext.riskSentiment || 'neutral'}
- S&P 500 Change: ${marketContext.traditionalMarkets?.sp500Change?.toFixed(2) || 'N/A'}%
- VIX: ${marketContext.traditionalMarkets?.vix?.toFixed(2) || 'N/A'}

**Instructions**:
Provide a JSON response with the following structure:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": 0-100,
  "reasoning": {
    "bullCase": "Detailed bullish arguments",
    "bearCase": "Detailed bearish arguments",
    "conclusion": "Final conclusion with primary reasoning"
  },
  "entryPrice": recommended entry price in USD (or null),
  "stopLoss": recommended stop loss price (or null),
  "takeProfitLevels": [target1, target2],
  "positionSize": 0.01-0.05 (1%-5% of portfolio),
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "keyFactors": ["factor1", "factor2", ...],
  "sources": ["technical", "sentiment", "news", "market_context"],
  "timeframe": "short-term (1-3 days)" | "medium-term (1-2 weeks)" | "long-term (1+ months)"
}

**Important Guidelines**:
1. Be conservative - only recommend BUY/SELL with strong conviction
2. Consider all data sources - technical, sentiment, news, and market context
3. Account for current market regime and risk sentiment
4. Stop loss is MANDATORY for any BUY recommendation
5. Position size should reflect risk level (lower for higher risk)
6. Be explicit about uncertainties and risks in reasoning
7. Confidence should be realistic (rarely above 80)`;
}

export type AIModel = 'local' | 'anthropic' | 'openai' | 'both';

/**
 * Get AI recommendation with configurable model selection
 */
export async function getAIRecommendation(
  input: AnalysisInput,
  modelChoice: AIModel = 'anthropic'
): Promise<TradeRecommendation> {
  try {
    logger.info('Getting AI recommendation', { symbol: input.symbol, modelChoice });

    // Local fallback (no AI)
    if (modelChoice === 'local') {
      return getLocalRecommendation(input);
    }

    // Both models (consensus)
    if (modelChoice === 'both') {
      // Get recommendations from both models
      const [openaiRec, claudeRec] = await Promise.allSettled([
        getOpenAIRecommendation(input),
        getClaudeRecommendation(input),
      ]);

      // Combine recommendations if both succeeded
      if (openaiRec.status === 'fulfilled' && claudeRec.status === 'fulfilled') {
        return combineRecommendations(openaiRec.value, claudeRec.value, input);
      }

      // Use whichever succeeded
      if (openaiRec.status === 'fulfilled') {
        logger.warn('Claude failed, using OpenAI only');
        return openaiRec.value;
      }
      if (claudeRec.status === 'fulfilled') {
        logger.warn('OpenAI failed, using Claude only');
        return claudeRec.value;
      }

      throw new Error('Both AI models failed');
    }

    // Use specific model
    if (modelChoice === 'openai') {
      return await getOpenAIRecommendation(input);
    }

    // Default to Anthropic (faster and cheaper for structured outputs)
    return await getClaudeRecommendation(input);
    
  } catch (error) {
    logger.error('AI recommendation failed', { 
      symbol: input.symbol, 
      modelChoice,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw error;
  }
}

/**
 * Combine recommendations from multiple models
 */
function combineRecommendations(
  rec1: TradeRecommendation,
  rec2: TradeRecommendation,
  input: AnalysisInput
): TradeRecommendation {
  logger.info('Combining recommendations from multiple models');

  // If both agree, use the one with higher confidence
  if (rec1.action === rec2.action) {
    return rec1.confidence > rec2.confidence ? rec1 : rec2;
  }

  // If they disagree, be conservative (HOLD)
  logger.warn('AI models disagree on action', {
    model1: rec1.action,
    model2: rec2.action,
  });

  return {
    action: TRADE_ACTIONS.HOLD,
    confidence: 50,
    reasoning: {
      bullCase: `Model 1 (${rec1.action}): ${rec1.reasoning.bullCase}`,
      bearCase: `Model 2 (${rec2.action}): ${rec2.reasoning.bearCase}`,
      conclusion:
        'AI models disagree on direction. Recommending HOLD until consensus emerges.',
    },
    entryPrice: null,
    stopLoss: null,
    takeProfitLevels: [],
    positionSize: 0,
    riskLevel: RISK_LEVELS.MEDIUM,
    keyFactors: ['Model disagreement', 'Uncertainty'],
    sources: ['ai_consensus'],
    timeframe: 'short-term (1-3 days)',
  };
}

/**
 * Simplified recommendation using local analysis (fallback when AI is unavailable)
 */
export function getLocalRecommendation(input: AnalysisInput): TradeRecommendation {
  logger.info('Generating local recommendation (AI unavailable)', {
    symbol: input.symbol,
  });

  const { technicalIndicators, sentiment, currentPrice } = input;

  let bullishSignals = 0;
  let bearishSignals = 0;
  const keyFactors: string[] = [];

  // Technical analysis
  if (technicalIndicators.rsi && technicalIndicators.rsi < 30) {
    bullishSignals++;
    keyFactors.push('RSI oversold');
  } else if (technicalIndicators.rsi && technicalIndicators.rsi > 70) {
    bearishSignals++;
    keyFactors.push('RSI overbought');
  }

  // Sentiment
  if (sentiment.overall?.score > 0.3) {
    bullishSignals++;
    keyFactors.push('Positive sentiment');
  } else if (sentiment.overall?.score < -0.3) {
    bearishSignals++;
    keyFactors.push('Negative sentiment');
  }

  // Determine action
  let action: 'BUY' | 'SELL' | 'HOLD' = TRADE_ACTIONS.HOLD;
  if (bullishSignals > bearishSignals + 1) {
    action = TRADE_ACTIONS.BUY;
  } else if (bearishSignals > bullishSignals + 1) {
    action = TRADE_ACTIONS.SELL;
  }

  const confidence = Math.min(
    60,
    Math.abs(bullishSignals - bearishSignals) * 15
  );

  return {
    action,
    confidence,
    reasoning: {
      bullCase: `Bullish signals: ${bullishSignals}`,
      bearCase: `Bearish signals: ${bearishSignals}`,
      conclusion: 'Local analysis (AI unavailable)',
    },
    entryPrice: action === TRADE_ACTIONS.BUY ? currentPrice : null,
    stopLoss:
      action === TRADE_ACTIONS.BUY ? currentPrice * 0.95 : null,
    takeProfitLevels:
      action === TRADE_ACTIONS.BUY
        ? [currentPrice * 1.05, currentPrice * 1.1]
        : [],
    positionSize: 0.02,
    riskLevel: RISK_LEVELS.MEDIUM,
    keyFactors,
    sources: ['local_analysis'],
    timeframe: 'short-term (1-3 days)',
  };
}
