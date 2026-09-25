import type { TenantId } from '../domain/tenant/tenant.js';
import type { ProductId } from '../domain/catalog/product.js';
import type { TryOnSession, TryOnSessionId } from '../domain/try-on/try-on-session.js';

export interface TryOnSessionRepositoryPort {
  save(session: TryOnSession): Promise<void>;
  findById(id: TryOnSessionId, tenantId?: TenantId): Promise<TryOnSession | null>;
  listActiveByProduct(productId: ProductId, tenantId: TenantId): Promise<TryOnSession[]>;
  delete(id: TryOnSessionId, tenantId?: TenantId): Promise<void>;
  count(tenantId?: TenantId): Promise<number>;
}
