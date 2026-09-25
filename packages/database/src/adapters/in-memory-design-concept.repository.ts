import {
  DesignConcept,
  ExtractedDesignAttributes,
  TokenAccounting,
  type DesignConceptId,
  type DesignSessionId,
  type TenantId,
  type DesignConceptRepositoryPort,
} from '@v-gold/core';

export class InMemoryDesignConceptRepository implements DesignConceptRepositoryPort {
  private readonly concepts = new Map<string, DesignConcept>();

  private clone(concept: DesignConcept): DesignConcept {
    const rawAttributes = ExtractedDesignAttributes.create(
      concept.groundedAttributes.toDto()
    ).unwrap();

    const rawTokens = TokenAccounting.create(concept.tokenAccounting.toDto()).unwrap();

    return DesignConcept.reconstitute(
      concept.id,
      concept.sessionId,
      concept.tenantId,
      concept.idempotencyKey,
      concept.title,
      concept.description,
      concept.promptRefinement,
      concept.visualPrompt,
      rawAttributes,
      rawTokens,
      concept.status,
      concept.audit
    );
  }

  async save(concept: DesignConcept): Promise<void> {
    this.concepts.set(concept.id, this.clone(concept));
  }

  async findById(id: DesignConceptId, tenantId?: TenantId): Promise<DesignConcept | null> {
    const c = this.concepts.get(id);
    if (!c) return null;

    if (tenantId !== undefined && c.tenantId !== tenantId) {
      return null;
    }

    return this.clone(c);
  }

  async findByIdempotencyKey(
    tenantId: TenantId,
    sessionId: DesignSessionId,
    idempotencyKey: string
  ): Promise<DesignConcept | null> {
    for (const c of this.concepts.values()) {
      if (
        c.tenantId === tenantId &&
        c.sessionId === sessionId &&
        c.idempotencyKey === idempotencyKey
      ) {
        return this.clone(c);
      }
    }
    return null;
  }

  async listBySession(sessionId: DesignSessionId, tenantId: TenantId): Promise<DesignConcept[]> {
    const result = Array.from(this.concepts.values()).filter(
      (c) => c.sessionId === sessionId && c.tenantId === tenantId
    );

    result.sort((a, b) => b.audit.createdAt.getTime() - a.audit.createdAt.getTime());
    return result.map((c) => this.clone(c));
  }

  async delete(id: DesignConceptId, tenantId?: TenantId): Promise<void> {
    const c = this.concepts.get(id);
    if (!c) return;
    if (tenantId !== undefined && c.tenantId !== tenantId) return;
    this.concepts.delete(id);
  }

  async count(tenantId?: TenantId): Promise<number> {
    if (!tenantId) return this.concepts.size;
    return Array.from(this.concepts.values()).filter((c) => c.tenantId === tenantId).length;
  }

  clear(): void {
    this.concepts.clear();
  }
}
