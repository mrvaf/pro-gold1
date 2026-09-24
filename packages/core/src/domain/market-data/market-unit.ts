import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { Decimal } from 'decimal.js';

/**
 * Market trading and observation units.
 * Market data feeds quote precious metals in specific international and regional units.
 *
 * Distinct from domain Weight canonical units:
 * `domain/material/Weight` canonically measures physical mass in grams.
 * Market observations preserve the exact quoted unit from external sources
 * (e.g., London Bullion Market quotes in TROY_OUNCE; Tehran Gold Bazar quotes in GRAM or MESGHAL).
 */
export const MARKET_UNITS = [
  'TROY_OUNCE', // Standard international bullion unit (31.1034768 g)
  'GRAM',       // Metric gram (1.0 g)
  'MESGHAL',    // Traditional Iranian gold bazaar unit (4.6083 g)
  'KILOGRAM',   // Metric kilogram (1000.0 g)
  'TOLA',       // South Asian gold unit (11.6638038 g)
  'UNIT',       // Discrete coins or contracts (e.g., Emami Gold Coin, Bahar Azadi)
] as const;

export type MarketUnitCode = (typeof MARKET_UNITS)[number];

export interface MarketUnitMetadata {
  readonly code: MarketUnitCode;
  readonly name: string;
  readonly symbol: string;
  readonly isMassUnit: boolean;
  /**
   * Grams equivalent factor for mass units, if fixed.
   * Undefined for discrete non-mass units (e.g. UNIT).
   */
  readonly gramsPerUnit?: Decimal | undefined;
}

export const MARKET_UNIT_METADATA: Record<MarketUnitCode, MarketUnitMetadata> = {
  TROY_OUNCE: {
    code: 'TROY_OUNCE',
    name: 'Troy Ounce',
    symbol: 'oz t',
    isMassUnit: true,
    gramsPerUnit: new Decimal('31.1034768'),
  },
  GRAM: {
    code: 'GRAM',
    name: 'Gram',
    symbol: 'g',
    isMassUnit: true,
    gramsPerUnit: new Decimal('1'),
  },
  MESGHAL: {
    code: 'MESGHAL',
    name: 'Mesghal',
    symbol: 'مثقال',
    isMassUnit: true,
    gramsPerUnit: new Decimal('4.6083'),
  },
  KILOGRAM: {
    code: 'KILOGRAM',
    name: 'Kilogram',
    symbol: 'kg',
    isMassUnit: true,
    gramsPerUnit: new Decimal('1000'),
  },
  TOLA: {
    code: 'TOLA',
    name: 'Tola',
    symbol: 'tola',
    isMassUnit: true,
    gramsPerUnit: new Decimal('11.6638038'),
  },
  UNIT: {
    code: 'UNIT',
    name: 'Discrete Unit',
    symbol: 'unit',
    isMassUnit: false,
    gramsPerUnit: undefined,
  },
};

export function parseMarketUnit(raw: string): Result<MarketUnitCode, ValidationError> {
  const normalized = raw.trim().toUpperCase();
  if (MARKET_UNITS.includes(normalized as MarketUnitCode)) {
    return ok(normalized as MarketUnitCode);
  }
  return err(
    new ValidationError(
      `Unsupported market unit: "${raw}". Supported units: ${MARKET_UNITS.join(', ')}`
    )
  );
}
