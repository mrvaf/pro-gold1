import type { TenantRepositoryPort, Tenant, TenantId } from '@v-gold/core';
import { InMemoryRepository } from '../in-memory-store.js';

export class InMemoryTenantRepository extends InMemoryRepository<Tenant, TenantId> implements TenantRepositoryPort {
  async findBySlug(slug: string): Promise<Tenant | null> {
    const normalized = slug.trim().toLowerCase();
    for (const item of this.items.values()) {
      if (item.slug === normalized) {
        return item;
      }
    }
    return null;
  }

  async findAll(): Promise<readonly Tenant[]> {
    return Array.from(this.items.values());
  }
}
