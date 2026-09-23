import {
  InMemoryInventoryLocationRepository,
  InMemoryInventoryItemRepository,
  InMemoryInventoryMovementRepository,
  InMemoryInventoryUnitOfWork,
} from '@v-gold/database';
import { getCatalogContainer } from '../catalog/catalog-container';
import { InventoryService } from './inventory-service';

class InventoryContainer {
  readonly locationRepo = new InMemoryInventoryLocationRepository();
  readonly itemRepo = new InMemoryInventoryItemRepository();
  readonly movementRepo = new InMemoryInventoryMovementRepository();
  readonly uow: InMemoryInventoryUnitOfWork;
  readonly inventoryService: InventoryService;

  constructor() {
    const catalog = getCatalogContainer();
    this.uow = new InMemoryInventoryUnitOfWork(this.itemRepo, this.movementRepo);
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
