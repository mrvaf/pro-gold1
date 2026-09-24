import type { PgDatabase } from 'drizzle-orm/pg-core';
import type {
  InventoryUnitOfWorkPort,
  InventoryItem,
  InventoryMovement,
} from '@v-gold/core';
import { toDatabaseInventoryItem } from './drizzle-inventory-item.repository.js';
import { toDatabaseInventoryMovement } from './drizzle-inventory-movement.repository.js';
import { inventoryItemsTable } from '../schema/inventory-items.js';
import { inventoryMovementsTable } from '../schema/inventory-movements.js';

/**
 * Production Drizzle PostgreSQL Unit of Work implementation.
 * Wraps item persistence and movement recording in a genuine PostgreSQL database transaction.
 */
export class DrizzleInventoryUnitOfWork implements InventoryUnitOfWorkPort {
  constructor(private readonly db: PgDatabase<any>) {}

  async saveItemWithMovement(item: InventoryItem, movement: InventoryMovement): Promise<void> {
    const itemRecord = toDatabaseInventoryItem(item);
    const movementRecord = toDatabaseInventoryMovement(movement);

    await this.db.transaction(async (tx) => {
      // 1. Upsert InventoryItem within transaction
      await tx
        .insert(inventoryItemsTable)
        .values(itemRecord)
        .onConflictDoUpdate({
          target: inventoryItemsTable.id,
          set: {
            locationId: itemRecord.locationId,
            status: itemRecord.status,
            quantity: itemRecord.quantity,
            updatedAt: itemRecord.updatedAt,
            updatedByActorId: itemRecord.updatedByActorId,
          },
        });

      // 2. Append-only insert of InventoryMovement within same transaction
      await tx.insert(inventoryMovementsTable).values(movementRecord);
    });
  }
}
