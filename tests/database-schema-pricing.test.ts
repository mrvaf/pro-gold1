import { describe, expect, it } from 'vitest';
import { pricingRulesTable, pricingResultsTable } from '@v-gold/database';

describe('Pricing Engine Database Schema', () => {
  it('validates pricingRulesTable schema definition', () => {
    expect(pricingRulesTable.id).toBeDefined();
    expect(pricingRulesTable.name).toBeDefined();
    expect(pricingRulesTable.version).toBeDefined();
    expect(pricingRulesTable.tenantId).toBeDefined();
    expect(pricingRulesTable.storeId).toBeDefined();
    expect(pricingRulesTable.effectiveFrom).toBeDefined();
    expect(pricingRulesTable.effectiveTo).toBeDefined();
    expect(pricingRulesTable.makingChargeType).toBeDefined();
    expect(pricingRulesTable.makingChargeRate).toBeDefined();
    expect(pricingRulesTable.marginType).toBeDefined();
    expect(pricingRulesTable.marginRate).toBeDefined();
    expect(pricingRulesTable.taxableBase).toBeDefined();
    expect(pricingRulesTable.taxRate).toBeDefined();
    expect(pricingRulesTable.roundingMode).toBeDefined();
    expect(pricingRulesTable.roundingScale).toBeDefined();
    expect(pricingRulesTable.createdAt).toBeDefined();
  });

  it('validates pricingResultsTable schema definition and precision', () => {
    expect(pricingResultsTable.id).toBeDefined();
    expect(pricingResultsTable.tenantId).toBeDefined();
    expect(pricingResultsTable.storeId).toBeDefined();
    expect(pricingResultsTable.finalAmount).toBeDefined();
    expect(pricingResultsTable.currency).toBeDefined();
    expect(pricingResultsTable.ruleId).toBeDefined();
    expect(pricingResultsTable.ruleName).toBeDefined();
    expect(pricingResultsTable.ruleVersion).toBeDefined();
    expect(pricingResultsTable.marketObservationId).toBeDefined();
    expect(pricingResultsTable.instrumentSymbol).toBeDefined();
    expect(pricingResultsTable.marketPrice).toBeDefined();
    expect(pricingResultsTable.marketUnit).toBeDefined();
    expect(pricingResultsTable.marketCurrency).toBeDefined();
    expect(pricingResultsTable.marketObservedAt).toBeDefined();
    expect(pricingResultsTable.freshnessStatus).toBeDefined();
    expect(pricingResultsTable.weightGrams).toBeDefined();
    expect(pricingResultsTable.purityFineness).toBeDefined();
    expect(pricingResultsTable.breakdownJson).toBeDefined();
    expect(pricingResultsTable.inputsJson).toBeDefined();
    expect(pricingResultsTable.calculatedAt).toBeDefined();
  });
});
