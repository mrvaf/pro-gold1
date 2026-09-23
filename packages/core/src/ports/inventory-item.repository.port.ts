import type {
  InventoryItem,
  InventoryItemId,
} from '../domain/inventory/inventory-item.js';
import type { InventoryStatus } from '../domain/inventory/inventory-status.js';
import type { InventoryLocationId } from '../domain/inventory/inventory-location.js';
import type { ProductVariantId } from '../domain/catalog/product-variant.js';
import type { TenantId } from '../domain/tenant/tenant.js';

export interface InventoryItemListFilter {
  status?: InventoryStatus | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface InventoryItemRepositoryPort {
  save(item: InventoryItem): Promise<void>;
  findById(id: InventoryItemId, tenantId?: TenantId): Promise<InventoryItem | null>;
  findBySerialNumber(serial: string, tenantId: TenantId): Promise<InventoryItem | null>;
  listByVariantId(variantId: ProductVariantId, tenantId: TenantId): Promise<InventoryItem[]>;
  listByLocation(locationId: InventoryLocationId, tenantId: TenantId): Promise<InventoryItem[]>;
  listByTenant(tenantId: TenantId, filter?: InventoryItemListFilter): Promise<InventoryItem[]>;
  count(tenantId?: TenantId): Promise<number>;
}
