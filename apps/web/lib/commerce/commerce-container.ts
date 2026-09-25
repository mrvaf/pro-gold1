import { createPersistence, type Persistence } from '@v-gold/database';
import { CommerceService } from './commerce-service';

export class CommerceContainer {
  readonly commerceService: CommerceService;

  constructor(persistence: Persistence = createPersistence()) {
    this.commerceService = new CommerceService(
      persistence.orderRepository,
      persistence.cartRepository,
      persistence.stockReservationRepository
    );
  }
}

let commerceContainerInstance: CommerceContainer | null = null;

export function getCommerceContainer(): CommerceContainer {
  if (!commerceContainerInstance) {
    commerceContainerInstance = new CommerceContainer();
  }
  return commerceContainerInstance;
}

export function getCommerceService(): CommerceService {
  return getCommerceContainer().commerceService;
}
