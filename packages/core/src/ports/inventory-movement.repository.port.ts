import type {
  InventoryMovement,
  InventoryMovementId,
} from '../domain/inventory/inventory-movement.js';
import type { InventoryItemId } from '../domain/inventory/inventory-item.js';
import type { TenantId } from '../domain/tenant/tenant.js';

export interface InventoryMovementListFilter {
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface InventoryMovementRepositoryPort {
  record(movement: InventoryMovement): Promise<void>;
  findById(id: InventoryMovementId, tenantId?: TenantId): Promise<InventoryMovement | null>;
  listByItemId(itemId: InventoryItemId, tenantId: TenantId): Promise<InventoryMovement[]>;
  listByTenant(tenantId: TenantId, filter?: InventoryMovementListFilter): Promise<InventoryMovement[]>;
  count(tenantId?: TenantId): Promise<number>;
}
