import type {
  InventoryUnitOfWorkPort,
  InventoryItem,
  InventoryMovement,
} from '@v-gold/core';
import type { InMemoryInventoryItemRepository } from './in-memory-inventory-item.repository.js';
import type { InMemoryInventoryMovementRepository } from './in-memory-inventory-movement.repository.js';

export class InMemoryInventoryUnitOfWork implements InventoryUnitOfWorkPort {
  private simulateFailureDuringMovement = false;
  private simulateFailureDuringItem = false;

  constructor(
    private readonly itemRepo: InMemoryInventoryItemRepository,
    private readonly movementRepo: InMemoryInventoryMovementRepository
  ) {}

  setSimulateFailureDuringMovement(fail: boolean): void {
    this.simulateFailureDuringMovement = fail;
  }

  setSimulateFailureDuringItem(fail: boolean): void {
    this.simulateFailureDuringItem = fail;
  }

  async saveItemWithMovement(item: InventoryItem, movement: InventoryMovement): Promise<void> {
    if (this.simulateFailureDuringItem) {
      throw new Error('Simulated database error during InventoryItem persistence');
    }

    // 1. Snapshot previous item state for rollback in case movement recording fails
    const existingItem = await this.itemRepo.findById(item.id, item.tenantId);

    // 2. Attempt item persistence
    await this.itemRepo.save(item);

    // 3. Test failure injection for movement
    if (this.simulateFailureDuringMovement) {
      // ROLLBACK: Revert item to prior state or delete if newly created
      if (existingItem) {
        await this.itemRepo.save(existingItem);
      } else {
        this.itemRepo.deleteById(item.id);
      }
      throw new Error('Simulated database error during InventoryMovement recording');
    }

    // 4. Attempt movement recording
    await this.movementRepo.record(movement);
  }
}
