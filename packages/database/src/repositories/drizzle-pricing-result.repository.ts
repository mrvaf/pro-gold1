import { and, desc, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type PricingResultRepositoryPort,
  PricingResult,
  type PricingResultId,
  type TenantId,
  type StoreId,
  createEntityId,
  Money,
  type CurrencyCode,
  PricingBreakdown,
  type MarketDataStatus,
  type RoundingModeKey,
  type RuleReferenceSnapshot,
} from '@v-gold/core';
import { Decimal } from 'decimal.js';
import {
  pricingResultsTable,
  type PricingResultRecord,
  type InsertPricingResultRecord,
} from '../schema/pricing-results.js';

export const toDomainPricingResult = (record: PricingResultRecord): PricingResult => {
  const parsedBreakdown = JSON.parse(record.breakdownJson);
  const parsedInputs = JSON.parse(record.inputsJson);

  const currency = record.currency as CurrencyCode;

  const breakdown = new PricingBreakdown({
    currency,
    itemWeightGrams: new Decimal(parsedBreakdown.baseMetal.itemWeightGrams),
    purityFineness: new Decimal(parsedBreakdown.baseMetal.purityFineness),
    pureGrams: new Decimal(parsedBreakdown.baseMetal.pureGrams),
    pureGoldMarketRatePerGram: Money.create(
      parsedBreakdown.baseMetal.pureGoldMarketRatePerGram,
      currency
    ).unwrap(),
    baseMetalValue: Money.create(parsedBreakdown.baseMetal.amount, currency).unwrap(),
    makingChargeType: parsedBreakdown.makingCharge.type,
    makingChargeRate: new Decimal(parsedBreakdown.makingCharge.rate),
    makingChargeAmount: Money.create(parsedBreakdown.makingCharge.amount, currency).unwrap(),
    sellerMarginType: parsedBreakdown.sellerMargin.type,
    sellerMarginRate: new Decimal(parsedBreakdown.sellerMargin.rate),
    sellerMarginAmount: Money.create(parsedBreakdown.sellerMargin.amount, currency).unwrap(),
    stoneValueAmount: Money.create(parsedBreakdown.stoneValue.amount, currency).unwrap(),
    taxableBase: parsedBreakdown.tax.taxableBase,
    taxableAmount: Money.create(parsedBreakdown.tax.taxableAmount, currency).unwrap(),
    taxRate: new Decimal(parsedBreakdown.tax.rate),
    taxAmount: Money.create(parsedBreakdown.tax.amount, currency).unwrap(),
    subtotal: Money.create(parsedBreakdown.subtotal, currency).unwrap(),
    unroundedTotal: Money.create(parsedBreakdown.unroundedTotal, currency).unwrap(),
    roundingAdjustment: Money.create(parsedBreakdown.roundingAdjustment, currency).unwrap(),
    finalAmount: Money.create(parsedBreakdown.finalAmount, currency).unwrap(),
  });

  let ruleReference: RuleReferenceSnapshot;
  if (record.ruleReferenceJson) {
    ruleReference = JSON.parse(record.ruleReferenceJson);
  } else {
    ruleReference = {
      ruleId: record.ruleId,
      ruleName: record.ruleName,
      ruleVersion: record.ruleVersion,
      isReferenceSample: false,
      effectiveConfig: {
        makingCharge: {
          type: parsedBreakdown.makingCharge.type,
          rate: parsedBreakdown.makingCharge.rate,
        },
        margin: {
          type: parsedBreakdown.sellerMargin.type,
          rate: parsedBreakdown.sellerMargin.rate,
        },
        tax: {
          taxableBase: parsedBreakdown.tax.taxableBase,
          rate: parsedBreakdown.tax.rate,
        },
        roundingMode: record.roundingMode as RoundingModeKey,
        roundingScale: record.roundingScale,
      },
    };
  }

  return new PricingResult(createEntityId<PricingResultId>(record.id), {
    tenantId: record.tenantId ? createEntityId<TenantId>(record.tenantId) : undefined,
    storeId: record.storeId ? createEntityId<StoreId>(record.storeId) : undefined,
    finalPrice: Money.create(record.finalAmount, currency).unwrap(),
    currency,
    breakdown,
    inputs: parsedInputs,
    marketReference: {
      observationId: record.marketObservationId,
      instrumentSymbol: record.instrumentSymbol,
      marketPrice: record.marketPrice,
      marketUnit: record.marketUnit,
      marketCurrency: record.marketCurrency as CurrencyCode,
      observedAt: record.marketObservedAt,
      freshnessStatus: record.freshnessStatus as MarketDataStatus,
    },
    ruleReference,
    rounding: {
      mode: record.roundingMode as RoundingModeKey,
      scale: record.roundingScale,
    },
    calculatedAt: record.calculatedAt,
    isStaleMarketData: record.isStaleMarketData === 'true',
    createdAt: record.createdAt,
  });
};

export const toDatabasePricingResult = (result: PricingResult): InsertPricingResultRecord => ({
  id: result.id,
  tenantId: result.tenantId ?? null,
  storeId: result.storeId ?? null,
  finalAmount: result.finalPrice.amount.toString(),
  currency: result.currency,
  ruleId: result.ruleReference.ruleId,
  ruleName: result.ruleReference.ruleName,
  ruleVersion: result.ruleReference.ruleVersion,
  marketObservationId: result.marketReference.observationId,
  instrumentSymbol: result.marketReference.instrumentSymbol,
  marketPrice: result.marketReference.marketPrice,
  marketUnit: result.marketReference.marketUnit,
  marketCurrency: result.marketReference.marketCurrency,
  marketObservedAt: result.marketReference.observedAt,
  freshnessStatus: result.marketReference.freshnessStatus,
  isStaleMarketData: result.isStaleMarketData ? 'true' : 'false',
  weightGrams: result.inputs.weightGrams,
  purityFineness: result.inputs.purityFineness,
  breakdownJson: JSON.stringify(result.breakdown.rawProps),
  inputsJson: JSON.stringify(result.inputs),
  ruleReferenceJson: JSON.stringify(result.ruleReference),
  roundingMode: result.rounding.mode,
  roundingScale: result.rounding.scale,
  calculatedAt: result.calculatedAt,
  createdAt: result.createdAt,
});

export class DrizzlePricingResultRepository implements PricingResultRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async save(result: PricingResult): Promise<void> {
    const record = toDatabasePricingResult(result);
    await this.db
      .insert(pricingResultsTable)
      .values(record)
      .onConflictDoNothing();
  }

  async findById(id: PricingResultId, tenantId?: TenantId): Promise<PricingResult | null> {
    const conditions = [eq(pricingResultsTable.id, id)];

    if (tenantId !== undefined) {
      conditions.push(eq(pricingResultsTable.tenantId, tenantId));
    }

    const records = await this.db
      .select()
      .from(pricingResultsTable)
      .where(and(...conditions))
      .limit(1);

    const record = records[0];
    return record ? toDomainPricingResult(record) : null;
  }

  async findByTenant(tenantId: TenantId, limit: number = 50): Promise<PricingResult[]> {
    const records = await this.db
      .select()
      .from(pricingResultsTable)
      .where(eq(pricingResultsTable.tenantId, tenantId))
      .orderBy(desc(pricingResultsTable.calculatedAt))
      .limit(limit);

    return records.map(toDomainPricingResult);
  }

  async count(): Promise<number> {
    const records = await this.db.select().from(pricingResultsTable);
    return records.length;
  }
}
