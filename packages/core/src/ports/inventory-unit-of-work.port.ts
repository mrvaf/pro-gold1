import type { InventoryItem } from '../domain/inventory/inventory-item.js';
import type { InventoryMovement } from '../domain/inventory/inventory-movement.js';

/**
 * Inventory Unit of Work Port.
 * Application-level abstraction defining the transactional boundary
 * for persisting inventory mutations and their corresponding audit movements atomically.
 * Framework-independent: zero coupling to Drizzle or PostgreSQL.
 */
export interface InventoryUnitOfWorkPort {
  /**
   * Atomically persist an InventoryItem mutation together with its corresponding InventoryMovement record.
   * If either operation fails, neither change must remain committed.
   */
  saveItemWithMovement(item: InventoryItem, movement: InventoryMovement): Promise<void>;
}
