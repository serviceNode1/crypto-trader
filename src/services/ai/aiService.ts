import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS, TRADE_ACTIONS, RISK_LEVELS } from '../../config/constants';
import { withRetryJitter } from '../../utils/retry';
import { withRateLimit, rateLimiters } from '../../utils/rateLimiter';
import { aiLogger as logger } from '../../utils/logger';
import { TechnicalIndicators } from '../analysis/technicalAnalysis';
import { AggregatedSentiment } from '../analysis/sentimentAnalysis';
import { MarketContext } from '../analysis/marketContext';

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
  symbol: string;  // Coin symbol (e.g., 'BTC', 'ETH')
  currentPrice?: number;  // Current price at analysis time
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
  technicalIndicators: TechnicalIndicators;
  sentiment: AggregatedSentiment;
  news: Array<{ title: string; sentiment?: number; url?: string }>;
  marketContext: MarketContext;
  correlations?: Record<string, number>;
}

/**
 * Generate trade recommendation using OpenAI
 */
async function getOpenAIRecommendation(
  input: AnalysisInput,
  debugMode: boolean = false,
  strategy: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
): Promise<TradeRecommendation> {
  if (!openai) {
    throw new Error('OpenAI client not initialized - check OPENAI_API_KEY');
  }

  return withRateLimit(
    rateLimiters.openai,
    async () => {
      return withRetryJitter(async () => {
        const prompt = buildAnalysisPrompt(input, debugMode, strategy);

        logger.debug('Requesting OpenAI analysis', { symbol: input.symbol });
        logger.debug('2B: Debug mode:',debugMode, ' Prompt:', prompt);

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
        
        // Add symbol and currentPrice from input
        recommendation.symbol = input.symbol;
        recommendation.currentPrice = input.currentPrice;

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
async function getAnthropicRecommendation(
  input: AnalysisInput,
  debugMode: boolean = false,
  strategy: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
): Promise<TradeRecommendation> {
  if (!anthropic) {
    throw new Error('Anthropic client not initialized - check ANTHROPIC_API_KEY');
  }

  return withRateLimit(
    rateLimiters.anthropic,
    async () => {
      return withRetryJitter(async () => {
        const prompt = buildAnalysisPrompt(input, debugMode, strategy);

        logger.info('Requesting Claude analysis', { symbol: input.symbol });
        logger.debug('1a: Debug mode:',debugMode, ' Prompt:', prompt);

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
          
          // Add symbol and currentPrice from input
          recommendation.symbol = input.symbol;
          recommendation.currentPrice = input.currentPrice;

          logger.info('Claude recommendation received', {
            symbol: input.symbol,
            action: recommendation.action,
            confidence: recommendation.confidence,
          });

          return recommendation;
        } catch (error: unknown) {
          const err = error as { message?: string; status?: number; error?: { message?: string }; toString: () => string };
          logger.error('Claude API request failed', {
            symbol: input.symbol,
            error: err.message,
            statusCode: err.status,
            details: err.error?.message || err.toString(),
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
function buildAnalysisPrompt(
  input: AnalysisInput, 
  debugMode: boolean = false,
  strategy: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
): string {
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
${news.slice(0, 5).map((n, i) => `${i + 1}. ${n.title}`).join('\n')}

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

**Trading Strategy**: ${strategy.toUpperCase()}
${strategy === 'conservative' ? `
**Conservative Strategy Guidelines**:
- ONLY recommend BUY with VERY strong conviction (80%+ confidence)
- Require multiple confirming signals across technical, sentiment, AND news
- Prefer established coins with strong fundamentals
- Position sizes should be smaller (1-2% max)
- Stop losses must be tight (5-8% maximum)
- Risk level should typically be LOW, rarely MEDIUM
- Favor longer timeframes (medium to long-term holds)
- Be extra cautious in bear markets or high volatility
- Reject opportunities with ANY significant red flags
` : strategy === 'aggressive' ? `
**Aggressive Strategy Guidelines**:
- More willing to recommend BUY with moderate conviction (65%+ confidence)
- Can act on strong signals from 1-2 sources (don't need all to align)
- Open to higher volatility and emerging opportunities
- Position sizes can be larger (3-5% of portfolio)
- Stop losses can be wider (10-15% to allow for volatility)
- Risk level can be MEDIUM or HIGH
- Favor shorter timeframes (short to medium-term trades)
- Willing to take calculated risks in volatile markets
- Look for asymmetric risk/reward opportunities
` : `
**Moderate Strategy Guidelines**:
- Recommend BUY with solid conviction (70%+ confidence)
- Prefer 2-3 confirming signals across different data sources
- Balance between established and emerging opportunities
- Position sizes should be moderate (2-3% of portfolio)
- Stop losses should be reasonable (8-12%)
- Risk level typically MEDIUM, can be LOW or HIGH with justification
- Flexible timeframes based on opportunity
- Consider market regime but don't be overly cautious
- Balanced approach to risk/reward
`}

**Important Guidelines**:
${debugMode ? `
⚠️ **DEBUG/TESTING MODE - AGGRESSIVE ANALYSIS** ⚠️
1. Be AGGRESSIVE and OPPORTUNISTIC - lean toward BUY recommendations when there's ANY positive signal
2. Lower your standards - even mixed signals can be a BUY if there's upside potential
3. Ignore market regime concerns - we're testing the system, not making real trades
4. Confidence can be high (70-90%) even with moderate conviction
5. Focus on the UPSIDE - emphasize bull case over bear case
6. Any combination of: rising volume, positive sentiment, OR technical setup = potential BUY
7. We WANT to find opportunities - be optimistic about price action
8. Stop loss is still required, but be generous with risk tolerance
9. Use larger position sizes (4-5% is fine for testing)
**Remember: This is for TESTING AUTO-TRADING LOGIC, not real investment decisions!**
` : `
1. Follow the ${strategy} strategy guidelines above
2. Consider all data sources - technical, sentiment, news, and market context
3. Account for current market regime and risk sentiment
4. Stop loss is MANDATORY for any BUY recommendation
5. Position size should reflect risk level and strategy
6. Be explicit about uncertainties and risks in reasoning
7. Confidence should be realistic based on strategy (conservative higher bar, aggressive lower bar)
`}`;
}

export type AIModel = 'local' | 'anthropic' | 'openai' | 'both';

/**
 * Get AI recommendation with configurable model selection
 */
export async function getAIRecommendation(
  input: AnalysisInput,
  modelChoice: AIModel = 'anthropic',
  debugMode: boolean = false,
  strategy: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
): Promise<TradeRecommendation> {
  try {
    if (debugMode) {
      logger.warn('⚠️ DEBUG MODE - Using aggressive/risky AI prompts');
    }
    logger.info('Getting AI recommendation', { symbol: input.symbol, modelChoice, debugMode });

    // Local fallback (no AI)
    if (modelChoice === 'local') {
      return getLocalRecommendation(input);
    }

    // Both models (return both for comparison)
    if (modelChoice === 'both') {
      // Get recommendations from both models
      const [openaiRec, claudeRec] = await Promise.allSettled([
        getOpenAIRecommendation(input, debugMode, strategy),
        getAnthropicRecommendation(input, debugMode, strategy),
      ]);

      // Return both recommendations if both succeeded
      if (openaiRec.status === 'fulfilled' && claudeRec.status === 'fulfilled') {
        // Mark each with their source
        const combined: any = combineRecommendations(openaiRec.value, claudeRec.value, input);
        combined.multiModel = {
          openai: { ...openaiRec.value, modelName: 'OpenAI GPT-4o-mini' },
          anthropic: { ...claudeRec.value, modelName: 'Anthropic Claude Haiku' }
        };
        return combined;
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
      return await getOpenAIRecommendation(input, debugMode, strategy);
    }

    // Default to Anthropic (faster and cheaper for structured outputs)
    return await getAnthropicRecommendation(input, debugMode, strategy);
    
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
  _input: AnalysisInput
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
    symbol: _input.symbol,
    currentPrice: _input.currentPrice,
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
    symbol: input.symbol,
    currentPrice: input.currentPrice,
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
