import type { DesignConcept, DesignConceptId } from '../domain/ai-designer/design-concept.js';
import type { DesignSessionId } from '../domain/ai-designer/design-session.js';
import type { TenantId } from '../domain/tenant/tenant.js';

export interface DesignConceptRepositoryPort {
  save(concept: DesignConcept): Promise<void>;
  findById(id: DesignConceptId, tenantId?: TenantId): Promise<DesignConcept | null>;
  findByIdempotencyKey(
    tenantId: TenantId,
    sessionId: DesignSessionId,
    idempotencyKey: string
  ): Promise<DesignConcept | null>;
  listBySession(sessionId: DesignSessionId, tenantId: TenantId): Promise<DesignConcept[]>;
  delete(id: DesignConceptId, tenantId?: TenantId): Promise<void>;
  count(tenantId?: TenantId): Promise<number>;
}
