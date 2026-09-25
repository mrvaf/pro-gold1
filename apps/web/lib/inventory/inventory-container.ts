import type {
  InventoryItemRepositoryPort,
  InventoryLocationRepositoryPort,
  InventoryMovementRepositoryPort,
  InventoryUnitOfWorkPort,
} from '@v-gold/core';
import { createPersistence, type Persistence } from '@v-gold/database';
import { getCatalogContainer } from '../catalog/catalog-container';
import { InventoryService } from './inventory-service';

class InventoryContainer {
  readonly locationRepo: InventoryLocationRepositoryPort;
  readonly itemRepo: InventoryItemRepositoryPort;
  readonly movementRepo: InventoryMovementRepositoryPort;
  readonly uow: InventoryUnitOfWorkPort;
  readonly inventoryService: InventoryService;

  constructor(persistence: Persistence = createPersistence()) {
    const catalog = getCatalogContainer();
    this.locationRepo = persistence.inventoryLocationRepository;
    this.itemRepo = persistence.inventoryItemRepository;
    this.movementRepo = persistence.inventoryMovementRepository;
    this.uow = persistence.inventoryUnitOfWork;
    this.inventoryService = new InventoryService(
      this.locationRepo,
      this.itemRepo,
      this.movementRepo,
      catalog.variantRepo,
      this.uow,
      catalog.storeRepo
    );
  }
}

let inventoryContainerInstance: InventoryContainer | null = null;

export function getInventoryContainer(): InventoryContainer {
  if (!inventoryContainerInstance) {
    inventoryContainerInstance = new InventoryContainer();
  }
  return inventoryContainerInstance;
}
