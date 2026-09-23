import type { MarketDataQuality, MarketDataStatus } from './market-data-types.js';
import type { MarketObservation } from './market-observation.js';

export interface FreshnessPolicyOptions {
  realTimeMaxAgeMs?: number;  // Default: 5 minutes (300,000 ms)
  delayedMaxAgeMs?: number;   // Default: 30 minutes (1,800,000 ms)
  indicativeMaxAgeMs?: number;// Default: 2 hours (7,200,000 ms)
  closeMaxAgeMs?: number;     // Default: 24 hours (86,400,000 ms)
  instrumentOverrides?: Record<string, number>;
}

export const DEFAULT_FRESHNESS_CONFIG = {
  REAL_TIME_MAX_AGE_MS: 5 * 60 * 1000,       // 5 minutes
  DELAYED_MAX_AGE_MS: 30 * 60 * 1000,        // 30 minutes
  INDICATIVE_MAX_AGE_MS: 2 * 60 * 60 * 1000, // 2 hours
  CLOSE_MAX_AGE_MS: 24 * 60 * 60 * 1000,     // 24 hours
} as const;

/**
 * MarketDataFreshnessPolicy.
 * Determines whether an observation is FRESH or STALE.
 * Ensures freshness rules are centralized and never hardcoded in UI components.
 */
export class MarketDataFreshnessPolicy {
  private readonly realTimeMaxAgeMs: number;
  private readonly delayedMaxAgeMs: number;
  private readonly indicativeMaxAgeMs: number;
  private readonly closeMaxAgeMs: number;
  private readonly instrumentOverrides: Map<string, number>;

  constructor(options: FreshnessPolicyOptions = {}) {
    this.realTimeMaxAgeMs = options.realTimeMaxAgeMs ?? DEFAULT_FRESHNESS_CONFIG.REAL_TIME_MAX_AGE_MS;
    this.delayedMaxAgeMs = options.delayedMaxAgeMs ?? DEFAULT_FRESHNESS_CONFIG.DELAYED_MAX_AGE_MS;
    this.indicativeMaxAgeMs = options.indicativeMaxAgeMs ?? DEFAULT_FRESHNESS_CONFIG.INDICATIVE_MAX_AGE_MS;
    this.closeMaxAgeMs = options.closeMaxAgeMs ?? DEFAULT_FRESHNESS_CONFIG.CLOSE_MAX_AGE_MS;
    this.instrumentOverrides = new Map(Object.entries(options.instrumentOverrides ?? {}));
  }

  getMaxAgeForQuality(quality: MarketDataQuality): number {
    switch (quality) {
      case 'REAL_TIME':
        return this.realTimeMaxAgeMs;
      case 'DELAYED':
        return this.delayedMaxAgeMs;
      case 'INDICATIVE':
        return this.indicativeMaxAgeMs;
      case 'CLOSE':
        return this.closeMaxAgeMs;
    }
  }

  getMaxAgeForInstrument(instrumentSymbolOrId: string, quality: MarketDataQuality): number {
    const override = this.instrumentOverrides.get(instrumentSymbolOrId);
    if (override !== undefined) {
      return override;
    }
    return this.getMaxAgeForQuality(quality);
  }

  evaluate(observation: MarketObservation, now: Date = new Date()): MarketDataStatus {
    const maxAgeMs = this.getMaxAgeForQuality(observation.quality);
    return observation.determineStatus(maxAgeMs, now);
  }

  getAgeMs(observation: MarketObservation, now: Date = new Date()): number {
    return Math.max(0, now.getTime() - observation.observedAt.getTime());
  }
}
