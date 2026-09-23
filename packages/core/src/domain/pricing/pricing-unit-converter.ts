import { Decimal } from 'decimal.js';
import { err, ok, type Result } from '../../common/result.js';
import { MARKET_UNIT_METADATA, type MarketUnitCode } from '../market-data/market-unit.js';
import type { MarketPrice } from '../market-data/market-price.js';
import { PricingError } from './pricing-error.js';

export interface UnitConversionResult {
  readonly pricePerGram: Decimal;
  readonly marketUnit: MarketUnitCode;
  readonly gramsPerUnit: Decimal;
}

/**
 * PricingUnitConverter.
 * Safely converts market prices quoted in international or regional units (Troy Ounce, Mesghal, Tola, Kg)
 * to an exact price per canonical gram of precious metal.
 *
 * Rules:
 * - All calculations execute with arbitrary Decimal.js precision.
 * - Non-mass units (e.g. discrete coin contracts) cannot be converted to per-gram prices and produce explicit errors.
 */
export class PricingUnitConverter {
  /**
   * Calculates the exact price per gram from a given MarketPrice.
   */
  static getPricePerGram(marketPrice: MarketPrice): Result<UnitConversionResult, PricingError> {
    const unitMeta = MARKET_UNIT_METADATA[marketPrice.unit];

    if (!unitMeta || !unitMeta.isMassUnit || !unitMeta.gramsPerUnit) {
      return err(PricingError.unsupportedMarketUnit(marketPrice.unit));
    }

    const gramsPerUnit = unitMeta.gramsPerUnit;
    const pricePerGram = marketPrice.amount.dividedBy(gramsPerUnit);

    return ok({
      pricePerGram,
      marketUnit: marketPrice.unit,
      gramsPerUnit,
    });
  }
}
