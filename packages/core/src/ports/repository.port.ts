import type { Entity } from '../common/entity.js';
import type { EntityId } from '../common/id.js';

/**
 * Base Repository Port.
 * Repositories in the domain layer define only the interface.
 * Infrastructure layer implements the repository via PostgreSQL/Drizzle or In-Memory adapters.
 */
export interface RepositoryPort<TEntity extends Entity<TId>, TId extends EntityId<string>> {
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<void>;
  delete(id: TId): Promise<void>;
}

/**
 * Tenant-scoped Repository Port.
 * Enforces mandatory tenant isolation (storeId) for all seller-scoped operations.
 */
export interface TenantScopedRepositoryPort<
  TEntity extends Entity<TId>,
  TId extends EntityId<string>,
  TStoreId extends EntityId<string> = EntityId<'Store'>,
> {
  findById(storeId: TStoreId, id: TId): Promise<TEntity | null>;
  findAll(storeId: TStoreId): Promise<readonly TEntity[]>;
  save(storeId: TStoreId, entity: TEntity): Promise<void>;
  delete(storeId: TStoreId, id: TId): Promise<void>;
}

/**
 * Unit of Work Port for atomic transactional operations.
 */
export interface UnitOfWorkPort {
  withTransaction<T>(work: () => Promise<T>): Promise<T>;
}
