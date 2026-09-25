import {
  PricingRule,
  MarketDataFreshnessPolicy,
  createEntityId,
  type PricingRuleId,
} from '@v-gold/core';
import type {
  PricingResultRepositoryPort,
  PricingRuleRepositoryPort,
} from '@v-gold/core';
import { createPersistence, type Persistence } from '@v-gold/database';
import { getMarketDataContainer } from '@/lib/market-data/market-data-container';
import { getFinanceContainer } from '@/lib/finance/finance-container';
import { PricingService } from './pricing-service';

class PricingContainer {
  readonly ruleRepo: PricingRuleRepositoryPort;
  readonly resultRepo: PricingResultRepositoryPort;
  readonly freshnessPolicy = new MarketDataFreshnessPolicy();
  readonly pricingService: PricingService;

  private isInitialized = false;

  constructor(persistence: Persistence = createPersistence()) {
    this.ruleRepo = persistence.pricingRuleRepository;
    this.resultRepo = persistence.pricingResultRepository;
    const marketData = getMarketDataContainer();
    const finance = getFinanceContainer();

    this.pricingService = new PricingService(
      this.ruleRepo,
      this.resultRepo,
      marketData.observationRepo,
      marketData.instrumentRepo,
      finance.fxRateRepo,
      this.freshnessPolicy
    );

    this.initializeReferenceRules();
  }

  private initializeReferenceRules() {
    if (this.isInitialized) return;

    // 1. Reference Sample: Iranian Bazaar 18K Model (NON-AUTHORITATIVE REFERENCE SAMPLE)
    // NOTE: Making 15% and margin 7% are commercial bazaar conventions for certain jewelry items,
    // NOT legal mandates. 9% VAT on ojrat + margin is statutory under Article 26 of VAT Law 1400.
    const iranBazaarSampleRule = PricingRule.create({
      id: 'rule_iran_bazaar_18k_v1',
      name: '[REFERENCE_SAMPLE_ONLY] Tehran Gold Bazaar 18K Sample Model (Ojrat 15%, Margin 7%, VAT 9% on Ojrat+Margin)',
      version: '1',
      isReferenceSample: true,
      specificationSource: 'REFERENCE_SAMPLE_NON_AUTHORITATIVE',
      effectiveFrom: new Date('2024-01-01T00:00:00Z'),
      config: {
        makingCharge: {
          type: 'PERCENTAGE',
          rate: '0.15',
        },
        margin: {
          type: 'PERCENTAGE',
          rate: '0.07',
        },
        tax: {
          taxableBase: 'MARGIN_AND_FEE_ONLY', // Article 26 VAT Law 1400
          rate: '0.09',
        },
        roundingMode: 'HALF_UP',
        roundingScale: 0,
      },
    });

    if (iranBazaarSampleRule.isOk) {
      this.ruleRepo.save(iranBazaarSampleRule.value);
    }

    // 2. Reference Sample: Iranian Raw Bullion / Melt (Abshodeh) Sample
    // NOTE: Raw bullion is exempt from VAT under Art. 26; workshop assay/melting service fees are taxable if billed separately.
    const abshodehSampleRule = PricingRule.create({
      id: 'rule_iran_bullion_melt_v1',
      name: '[REFERENCE_SAMPLE_ONLY] Iranian Raw Melt / Bullion Sample (طلای آبشده)',
      version: '1',
      isReferenceSample: true,
      specificationSource: 'REFERENCE_SAMPLE_NON_AUTHORITATIVE',
      effectiveFrom: new Date('2024-01-01T00:00:00Z'),
      config: {
        makingCharge: {
          type: 'ZERO',
          rate: '0.00',
        },
        margin: {
          type: 'PERCENTAGE',
          rate: '0.01',
        },
        tax: {
          taxableBase: 'EXEMPT',
          rate: '0.00',
        },
        roundingMode: 'HALF_UP',
        roundingScale: 0,
      },
    });

    if (abshodehSampleRule.isOk) {
      this.ruleRepo.save(abshodehSampleRule.value);
    }

    // 3. Reference Sample: International Retail Sample Model (NON-AUTHORITATIVE REFERENCE SAMPLE)
    const globalRetailSampleRule = PricingRule.create({
      id: 'rule_global_retail_18k_v1',
      name: '[REFERENCE_SAMPLE_ONLY] Global Retail Jewelry 18K Sample Model',
      version: '1',
      isReferenceSample: true,
      specificationSource: 'REFERENCE_SAMPLE_NON_AUTHORITATIVE',
      effectiveFrom: new Date('2024-01-01T00:00:00Z'),
      config: {
        makingCharge: {
          type: 'PERCENTAGE',
          rate: '0.18',
        },
        margin: {
          type: 'PERCENTAGE',
          rate: '0.10',
        },
        tax: {
          taxableBase: 'TOTAL_VALUE',
          rate: '0.00',
        },
        roundingMode: 'HALF_UP',
        roundingScale: 2,
      },
    });

    if (globalRetailSampleRule.isOk) {
      this.ruleRepo.save(globalRetailSampleRule.value);
    }

    this.isInitialized = true;
  }
}

let pricingContainerInstance: PricingContainer | null = null;

export function getPricingContainer(): PricingContainer {
  if (!pricingContainerInstance) {
    pricingContainerInstance = new PricingContainer();
  }
  return pricingContainerInstance;
}
