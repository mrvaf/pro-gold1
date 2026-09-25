import type {
  PricingRuleRepositoryPort,
  MarketObservationRepositoryPort,
  MarketInstrumentRepositoryPort,
  FxRateRepositoryPort,
} from '@v-gold/core';
import { createPersistence, type Persistence } from '@v-gold/database';
import { BudgetEngineService } from './budget-engine-service';

class BudgetEngineContainer {
  readonly pricingRuleRepo: PricingRuleRepositoryPort;
  readonly marketObservationRepo: MarketObservationRepositoryPort;
  readonly marketInstrumentRepo: MarketInstrumentRepositoryPort;
  readonly fxRateRepo: FxRateRepositoryPort;
  readonly budgetEngineService: BudgetEngineService;

  constructor(persistence: Persistence = createPersistence()) {
    this.pricingRuleRepo = persistence.pricingRuleRepository;
    this.marketObservationRepo = persistence.marketObservationRepository;
    this.marketInstrumentRepo = persistence.marketInstrumentRepository;
    this.fxRateRepo = persistence.fxRateRepository;
    this.budgetEngineService = new BudgetEngineService(
      this.pricingRuleRepo,
      this.marketObservationRepo,
      this.marketInstrumentRepo,
      this.fxRateRepo
    );
  }
}

let budgetEngineContainerInstance: BudgetEngineContainer | null = null;

export function getBudgetEngineContainer(): BudgetEngineContainer {
  if (!budgetEngineContainerInstance) {
    budgetEngineContainerInstance = new BudgetEngineContainer();
  }
  return budgetEngineContainerInstance;
}

export function setBudgetEngineContainer(container: BudgetEngineContainer): void {
  budgetEngineContainerInstance = container;
}
