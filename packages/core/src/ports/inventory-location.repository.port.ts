import type {
  InventoryLocation,
  InventoryLocationId,
  InventoryLocationStatus,
} from '../domain/inventory/inventory-location.js';
import type { TenantId } from '../domain/tenant/tenant.js';
import type { StoreId } from '../domain/tenant/store.js';

export interface InventoryLocationListFilter {
  storeId?: StoreId | undefined;
  status?: InventoryLocationStatus | undefined;
}

export interface InventoryLocationRepositoryPort {
  save(location: InventoryLocation): Promise<void>;
  findById(id: InventoryLocationId, tenantId?: TenantId): Promise<InventoryLocation | null>;
  findByCode(code: string, tenantId: TenantId): Promise<InventoryLocation | null>;
  listByTenant(tenantId: TenantId, filter?: InventoryLocationListFilter): Promise<InventoryLocation[]>;
  count(tenantId?: TenantId): Promise<number>;
}
