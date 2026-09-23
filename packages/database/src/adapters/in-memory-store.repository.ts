import type { StoreRepositoryPort, Store, StoreId, TenantId } from '@v-gold/core';
import { InMemoryTenantScopedRepository } from '../in-memory-store.js';

export class InMemoryStoreRepository
  extends InMemoryTenantScopedRepository<Store, StoreId, TenantId>
  implements StoreRepositoryPort
{
  async findByCode(tenantId: TenantId, code: string): Promise<Store | null> {
    const stores = await this.findAll(tenantId);
    const normalized = code.trim().toUpperCase();
    return stores.find((s) => s.code === normalized) ?? null;
  }

  async findAllByTenant(tenantId: TenantId): Promise<readonly Store[]> {
    return this.findAll(tenantId);
  }
}
