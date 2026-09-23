import {
  PricingRule,
  MarketDataFreshnessPolicy,
  createEntityId,
  type PricingRuleId,
} from '@v-gold/core';
import {
  InMemoryPricingRuleRepository,
  InMemoryPricingResultRepository,
} from '@v-gold/database';
import { getMarketDataContainer } from '@/lib/market-data/market-data-container';
import { getFinanceContainer } from '@/lib/finance/finance-container';
import { PricingService } from './pricing-service';

class PricingContainer {
  readonly ruleRepo = new InMemoryPricingRuleRepository();
  readonly resultRepo = new InMemoryPricingResultRepository();
  readonly freshnessPolicy = new MarketDataFreshnessPolicy();
  readonly pricingService: PricingService;

  private isInitialized = false;

  constructor() {
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

    // 1. Iranian Bazaar 18K Standard Rule (Statutory: VAT only on ojrat + sood)
    const iranBazaarRule = PricingRule.create({
      id: 'rule_iran_bazaar_18k_v1',
      name: 'Tehran Gold Bazaar 18K Standard (اجرت ۱۵٪، سود ۷٪، مالیات ۹٪ بر اجرت و سود)',
      version: '1',
      effectiveFrom: new Date('2024-01-01T00:00:00Z'),
      config: {
        makingCharge: {
          type: 'PERCENTAGE',
          rate: '0.15', // 15% ojrat
        },
        margin: {
          type: 'PERCENTAGE',
          rate: '0.07', // 7% seller margin
        },
        tax: {
          taxableBase: 'MARGIN_AND_FEE_ONLY', // Iranian gold tax reform 1400
          rate: '0.09', // 9% VAT
        },
        roundingMode: 'HALF_UP',
        roundingScale: 0,
      },
    });

    if (iranBazaarRule.isOk) {
      this.ruleRepo.save(iranBazaarRule.value);
    }

    // 2. Iranian Raw Bullion / Melt (Abshodeh) Rule
    const abshodehRule = PricingRule.create({
      id: 'rule_iran_bullion_melt_v1',
      name: 'Iranian Raw Melt / Bullion (طلای آبشده)',
      version: '1',
      effectiveFrom: new Date('2024-01-01T00:00:00Z'),
      config: {
        makingCharge: {
          type: 'ZERO',
          rate: '0.00',
        },
        margin: {
          type: 'PERCENTAGE',
          rate: '0.01', // 1% wholesale margin
        },
        tax: {
          taxableBase: 'EXEMPT',
          rate: '0.00',
        },
        roundingMode: 'HALF_UP',
        roundingScale: 0,
      },
    });

    if (abshodehRule.isOk) {
      this.ruleRepo.save(abshodehRule.value);
    }

    // 3. International Retail 18K Standard Rule (USD/EUR, cents rounding)
    const globalRetailRule = PricingRule.create({
      id: 'rule_global_retail_18k_v1',
      name: 'Global Retail Jewelry 18K Standard',
      version: '1',
      effectiveFrom: new Date('2024-01-01T00:00:00Z'),
      config: {
        makingCharge: {
          type: 'PERCENTAGE',
          rate: '0.18', // 18% making fee
        },
        margin: {
          type: 'PERCENTAGE',
          rate: '0.10', // 10% retail margin
        },
        tax: {
          taxableBase: 'TOTAL_VALUE',
          rate: '0.00', // Pre-tax retail quote
        },
        roundingMode: 'HALF_UP',
        roundingScale: 2, // Cents
      },
    });

    if (globalRetailRule.isOk) {
      this.ruleRepo.save(globalRetailRule.value);
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
