import { FxRate, type FxRateRepositoryPort } from '@v-gold/core';
import { createPersistence, type Persistence, type PersistenceMode } from '@v-gold/database';

class FinanceContainer {
  readonly fxRateRepo: FxRateRepositoryPort;
  private readonly persistenceMode: PersistenceMode;
  private isInitialized = false;

  constructor(persistence: Persistence = createPersistence()) {
    this.fxRateRepo = persistence.fxRateRepository;
    this.persistenceMode = persistence.mode;
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
        if (this.persistenceMode === 'postgres') {
          // Stage 8.3 (ADR-0047): idempotent bootstrap on durable storage —
          // reference pairs are seeded only when the repository has no rate yet.
          void this.fxRateRepo
            .findLatest(res.value.baseCurrency, res.value.quoteCurrency)
            .then((existing) => (existing ? undefined : this.fxRateRepo.save(res.value)));
        } else {
          this.fxRateRepo.save(res.value);
        }
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
