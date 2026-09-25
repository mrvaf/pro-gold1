import type { DesignSession, DesignSessionId } from '../domain/ai-designer/design-session.js';
import type { TenantId } from '../domain/tenant/tenant.js';

export interface DesignSessionRepositoryPort {
  save(session: DesignSession): Promise<void>;
  findById(id: DesignSessionId, tenantId?: TenantId): Promise<DesignSession | null>;
  listByTenant(tenantId: TenantId, limit?: number): Promise<DesignSession[]>;
  findByUser(tenantId: TenantId, userId: string): Promise<DesignSession[]>;
  delete(id: DesignSessionId, tenantId?: TenantId): Promise<void>;
  count(tenantId?: TenantId): Promise<number>;
}
