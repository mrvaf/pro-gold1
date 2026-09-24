import { FxRate } from '@v-gold/core';
import { InMemoryFxRateRepository } from '@v-gold/database';

class FinanceContainer {
  readonly fxRateRepo = new InMemoryFxRateRepository();
  private isInitialized = false;

  constructor() {
    this.initializeReferenceRates();
  }

  private initializeReferenceRates() {
    if (this.isInitialized) return;

    const referenceRates = [
      { baseCurrency: 'USD', quoteCurrency: 'IRR', rate: '600000', source: 'CBI_REFERENCE' },
      { baseCurrency: 'USD', quoteCurrency: 'TOMAN', rate: '60000', source: 'CBI_REFERENCE' },
      { baseCurrency: 'USD', quoteCurrency: 'EUR', rate: '0.92000000', source: 'ECB_REFERENCE' },
      { baseCurrency: 'EUR', quoteCurrency: 'USD', rate: '1.08695652', source: 'ECB_REFERENCE' },
      { baseCurrency: 'TOMAN', quoteCurrency: 'IRR', rate: '10', source: 'CANONICAL_STATUTORY' },
      { baseCurrency: 'IRR', quoteCurrency: 'TOMAN', rate: '0.1', source: 'CANONICAL_STATUTORY' },
    ];

    for (const r of referenceRates) {
      const res = FxRate.create({
        ...r,
        observedAt: new Date(),
      });
      if (res.isOk) {
        this.fxRateRepo.save(res.value);
      }
    }

    this.isInitialized = true;
  }
}

let instance: FinanceContainer | null = null;

export function getFinanceContainer(): FinanceContainer {
  if (!instance) {
    instance = new FinanceContainer();
  }
  return instance;
}
