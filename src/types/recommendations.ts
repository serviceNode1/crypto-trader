/**
 * Type definitions for AI Efficiency Optimization
 * Phase 1: Split BUY/SELL recommendations
 */

import type { UserSettings } from '../services/settings/settingsService';

// ============================================================================
// User Tier System
// ============================================================================

export type UserTier = 'free' | 'premium';

export interface UserTierInfo {
  tier: UserTier;
  portfolioMonitoring: boolean;
  onDemandLimit: number;
  customAlerts: boolean;
  tierUpdatedAt: Date;
}

// ============================================================================
// Discovery Recommendations (Global BUY)
// ============================================================================

// Reuse types from UserSettings to avoid duplication
export type DiscoveryStrategy = UserSettings['discoveryStrategy'];
export type CoinUniverse = UserSettings['coinUniverse'];
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DiscoveryRecommendation {
  id: number;
  symbol: string;
  strategy: DiscoveryStrategy;
  coinUniverse: CoinUniverse;
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfitLevels: [number, number];
  positionSize: number;
  riskLevel: RiskLevel;
  reasoning: {
    technical?: string;
    sentiment?: string;
    marketContext?: string;
    risk?: string;
  };
  sources: string[];
  discoveryScore: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface CreateDiscoveryRecommendation {
  symbol: string;
  strategy: DiscoveryStrategy;
  coinUniverse: CoinUniverse;
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfitLevels: [number, number];
  positionSize: number;
  riskLevel: RiskLevel;
  reasoning: object;
  sources: string[];
  discoveryScore: number;
}

// ============================================================================
// Portfolio Recommendations (User-specific SELL)
// ============================================================================

export type SellReason = 'profit_target' | 'risk_management' | 'momentum_loss' | 'resistance';

export interface PortfolioRecommendation {
  id: number;
  userId: number;
  symbol: string;
  confidence: number;
  currentPrice: number;
  entryPrice: number;
  stopLoss: number;
  takeProfitLevels: [number, number];
  unrealizedPnL: number;
  percentGain: number;
  sellReason: SellReason;
  riskLevel: RiskLevel;
  reasoning: {
    technical?: string;
    sentiment?: string;
    marketContext?: string;
    risk?: string;
  };
  createdAt: Date;
  expiresAt: Date;
}

export interface CreatePortfolioRecommendation {
  userId: number;
  symbol: string;
  confidence: number;
  currentPrice: number;
  entryPrice: number;
  stopLoss: number;
  takeProfitLevels: [number, number];
  unrealizedPnL: number;
  percentGain: number;
  sellReason: SellReason;
  riskLevel: RiskLevel;
  reasoning: object;
}

// ============================================================================
// Market Conditions
// ============================================================================

export type VolatilityLevel = 'low' | 'medium' | 'high' | 'extreme';
export type MarketRegime = 'bull' | 'bear' | 'sideways' | 'volatile';

export interface MarketConditions {
  id?: number;
  volatilityLevel: VolatilityLevel;
  volumeChange: number;           // % change from 24h average
  priceMovements: number;         // % of top coins with >5% moves
  newsActivity: number;           // News articles per hour
  btcDominance: number;           // Bitcoin market dominance %
  marketRegime: MarketRegime;
  reviewIntervalMinutes: number;  // Calculated review interval
  metadata?: {
    topMovers?: string[];
    significantNews?: string[];
    [key: string]: any;
  };
  createdAt?: Date;
}

// ============================================================================
// Unified Recommendation Response (for API)
// ============================================================================

export interface UnifiedRecommendation {
  id: number;
  symbol: string;
  action: 'BUY' | 'SELL';
  strategy?: DiscoveryStrategy;
  coinUniverse?: CoinUniverse;
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfitLevels: [number, number];
  positionSize?: number;
  riskLevel: RiskLevel;
  reasoning: object;
  sources?: string[];
  createdAt: Date;
  expiresAt: Date;
  userId?: number;
  discoveryScore?: number;
  sellReason?: SellReason;
  percentGain?: number;
}

// ============================================================================
// Service Response Types
// ============================================================================

export interface GenerateRecommendationsResult {
  buyRecommendations: DiscoveryRecommendation[];
  sellRecommendations: PortfolioRecommendation[];
  skipped: {
    buy: number;
    sell: number;
  };
  metadata: {
    totalAnalyzed: number;
    totalOpportunities: number;
    aiRejected: {
      buy: number;
      sell: number;
    };
    strategy: DiscoveryStrategy;
    coinUniverse: CoinUniverse;
  };
}

export interface GetRecommendationsOptions {
  strategy?: DiscoveryStrategy;
  coinUniverse?: CoinUniverse;
  userId?: number;
  limit?: number;
  includeExpired?: boolean;
}
