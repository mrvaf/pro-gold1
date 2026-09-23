import type { Entity, EntityId, RepositoryPort, TenantScopedRepositoryPort } from '@v-gold/core';

/**
 * Generic In-Memory Repository for unit tests and local isolation.
 */
export class InMemoryRepository<TEntity extends Entity<TId>, TId extends EntityId<string>>
  implements RepositoryPort<TEntity, TId>
{
  protected readonly items = new Map<string, TEntity>();

  async findById(id: TId): Promise<TEntity | null> {
    return this.items.get(id) ?? null;
  }

  async save(entity: TEntity): Promise<void> {
    this.items.set(entity.id, entity);
  }

  async delete(id: TId): Promise<void> {
    this.items.delete(id);
  }

  clear(): void {
    this.items.clear();
  }

  get count(): number {
    return this.items.size;
  }
}

/**
 * Generic In-Memory Tenant-Scoped Repository.
 * Enforces storeId scoping during in-memory test execution.
 */
export class InMemoryTenantScopedRepository<
  TEntity extends Entity<TId>,
  TId extends EntityId<string>,
  TStoreId extends EntityId<string> = EntityId<'Store'>,
> implements TenantScopedRepositoryPort<TEntity, TId, TStoreId>
{
  // Map of storeId -> (Map of entityId -> TEntity)
  protected readonly stores = new Map<string, Map<string, TEntity>>();

  private getStoreMap(storeId: TStoreId): Map<string, TEntity> {
    let storeMap = this.stores.get(storeId);
    if (!storeMap) {
      storeMap = new Map<string, TEntity>();
      this.stores.set(storeId, storeMap);
    }
    return storeMap;
  }

  async findById(storeId: TStoreId, id: TId): Promise<TEntity | null> {
    const storeMap = this.getStoreMap(storeId);
    return storeMap.get(id) ?? null;
  }

  async findAll(storeId: TStoreId): Promise<readonly TEntity[]> {
    const storeMap = this.getStoreMap(storeId);
    return Array.from(storeMap.values());
  }

  async save(storeId: TStoreId, entity: TEntity): Promise<void> {
    const storeMap = this.getStoreMap(storeId);
    storeMap.set(entity.id, entity);
  }

  async delete(storeId: TStoreId, id: TId): Promise<void> {
    const storeMap = this.getStoreMap(storeId);
    storeMap.delete(id);
  }

  clear(): void {
    this.stores.clear();
  }
}
