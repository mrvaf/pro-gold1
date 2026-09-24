import type { TenantId } from '../domain/tenant/tenant.js';
import type { Store, StoreId } from '../domain/tenant/store.js';

/**
 * Tenant-Scoped Store Repository Port.
 * Crucial Security Invariant: Every method requires explicit `tenantId`.
 * Cross-tenant retrieval or mutation is forbidden at the port level.
 */
export interface StoreRepositoryPort {
  findById(tenantId: TenantId, id: StoreId): Promise<Store | null>;
  findByCode(tenantId: TenantId, code: string): Promise<Store | null>;
  findAllByTenant(tenantId: TenantId): Promise<readonly Store[]>;
  save(tenantId: TenantId, store: Store): Promise<void>;
  delete(tenantId: TenantId, id: StoreId): Promise<void>;
}
