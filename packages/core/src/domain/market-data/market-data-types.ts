/**
 * Quality classification of an external market observation.
 */
export const MARKET_DATA_QUALITIES = [
  'REAL_TIME',  // Live stream or direct instant tick
  'DELAYED',    // Provider delayed quote (e.g. 15-minute exchange delay)
  'INDICATIVE', // Non-firm indicative/reference benchmark rate
  'CLOSE',      // End-of-day official market close or fixing (e.g. LBMA Gold Price PM)
] as const;

export type MarketDataQuality = (typeof MARKET_DATA_QUALITIES)[number];

/**
 * Freshness status of market data relative to the current evaluation moment.
 */
export const MARKET_DATA_STATUSES = [
  'FRESH',       // Observation age is within acceptable freshness window
  'STALE',       // Observation age exceeds acceptable freshness window
  'UNAVAILABLE', // No observation exists or provider is offline
] as const;

export type MarketDataStatus = (typeof MARKET_DATA_STATUSES)[number];

/**
 * Underlying market asset category.
 */
export const MARKET_ASSET_TYPES = [
  'PRECIOUS_METAL', // Gold, Silver, Platinum, Palladium
  'CURRENCY',       // FX rates (USD, EUR, IRR, etc.)
  'COIN',           // Bullion / legal tender coins
] as const;

export type MarketAssetType = (typeof MARKET_ASSET_TYPES)[number];
