import type { RfqRepositoryPort } from '@v-gold/core';
import { createPersistence, type Persistence } from '@v-gold/database';
import { RfqService } from './rfq-service';

class RfqContainer {
  readonly rfqRepo: RfqRepositoryPort;
  readonly rfqService: RfqService;

  constructor(persistence: Persistence = createPersistence()) {
    this.rfqRepo = persistence.rfqRepository;
    this.rfqService = new RfqService(this.rfqRepo);
  }
}

let rfqContainerInstance: RfqContainer | null = null;

export function getRfqContainer(): RfqContainer {
  if (!rfqContainerInstance) {
    rfqContainerInstance = new RfqContainer();
  }
  return rfqContainerInstance;
}

export function setRfqContainer(container: RfqContainer): void {
  rfqContainerInstance = container;
}
