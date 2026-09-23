import {
  InMemoryInventoryLocationRepository,
  InMemoryInventoryItemRepository,
  InMemoryInventoryMovementRepository,
} from '@v-gold/database';
import { getCatalogContainer } from '../catalog/catalog-container';
import { InventoryService } from './inventory-service';

class InventoryContainer {
  readonly locationRepo = new InMemoryInventoryLocationRepository();
  readonly itemRepo = new InMemoryInventoryItemRepository();
  readonly movementRepo = new InMemoryInventoryMovementRepository();
  readonly inventoryService: InventoryService;

  constructor() {
    const catalog = getCatalogContainer();
    this.inventoryService = new InventoryService(
      this.locationRepo,
      this.itemRepo,
      this.movementRepo,
      catalog.variantRepo
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
