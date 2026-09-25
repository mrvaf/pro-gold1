import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type DesignConceptRepositoryPort,
  DesignConcept,
  ExtractedDesignAttributes,
  TokenAccounting,
  type DesignConceptId,
  type DesignConceptStatus,
  type DesignSessionId,
  type TenantId,
  createEntityId,
  AuditMetadata,
  ActorReference,
  type ActorType,
} from '@v-gold/core';
import {
  designConceptsTable,
  type DesignConceptRecord,
  type InsertDesignConceptRecord,
} from '../schema/design-concepts.js';

export const toDomainDesignConcept = (record: DesignConceptRecord): DesignConcept => {
  const createdBy = record.createdByActorId
    ? ActorReference.create(
        record.createdByActorId,
        (record.createdByActorType as ActorType) || 'USER'
      ).unwrapOr(undefined as any)
    : undefined;

  const updatedBy = record.updatedByActorId
    ? ActorReference.create(
        record.updatedByActorId,
        (record.updatedByActorType as ActorType) || 'USER'
      ).unwrapOr(undefined as any)
    : undefined;

  const audit = AuditMetadata.fromDates(
    record.createdAt,
    record.updatedAt,
    createdBy,
    updatedBy
  );

  let groundedAttributes = ExtractedDesignAttributes.empty();
  if (record.groundedAttributesJson) {
    try {
      const parsed = JSON.parse(record.groundedAttributesJson);
      groundedAttributes = ExtractedDesignAttributes.create(parsed).unwrapOr(
        ExtractedDesignAttributes.empty()
      );
    } catch {
      groundedAttributes = ExtractedDesignAttributes.empty();
    }
  }

  let tokenAccounting = TokenAccounting.zero();
  if (record.tokenAccountingJson) {
    try {
      const parsed = JSON.parse(record.tokenAccountingJson);
      tokenAccounting = TokenAccounting.create(parsed).unwrapOr(TokenAccounting.zero());
    } catch {
      tokenAccounting = TokenAccounting.zero();
    }
  }

  return DesignConcept.reconstitute(
    createEntityId<DesignConceptId>(record.id),
    createEntityId<DesignSessionId>(record.sessionId),
    createEntityId<TenantId>(record.tenantId),
    record.idempotencyKey,
    record.title,
    record.description,
    record.promptRefinement,
    record.visualPrompt,
    groundedAttributes,
    tokenAccounting,
    record.status as DesignConceptStatus,
    audit
  );
};

export const toDatabaseDesignConcept = (concept: DesignConcept): InsertDesignConceptRecord => ({
  id: concept.id,
  sessionId: concept.sessionId,
  tenantId: concept.tenantId,
  idempotencyKey: concept.idempotencyKey,
  title: concept.title,
  description: concept.description,
  promptRefinement: concept.promptRefinement,
  visualPrompt: concept.visualPrompt,
  groundedAttributesJson: JSON.stringify(concept.groundedAttributes.toDto()),
  tokenAccountingJson: JSON.stringify(concept.tokenAccounting.toDto()),
  status: concept.status,
  createdAt: concept.audit.createdAt,
  updatedAt: concept.audit.updatedAt,
  createdByActorType: concept.audit.createdBy?.actorType ?? 'SYSTEM',
  createdByActorId: concept.audit.createdBy?.actorId ?? 'system',
  updatedByActorType: concept.audit.updatedBy?.actorType ?? 'SYSTEM',
  updatedByActorId: concept.audit.updatedBy?.actorId ?? 'system',
});

export class DrizzleDesignConceptRepository implements DesignConceptRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async save(concept: DesignConcept): Promise<void> {
    const record = toDatabaseDesignConcept(concept);
    await this.db
      .insert(designConceptsTable)
      .values(record)
      .onConflictDoUpdate({
        target: designConceptsTable.id,
        set: {
          title: record.title,
          description: record.description,
          promptRefinement: record.promptRefinement,
          visualPrompt: record.visualPrompt,
          groundedAttributesJson: record.groundedAttributesJson,
          tokenAccountingJson: record.tokenAccountingJson,
          status: record.status,
          updatedAt: record.updatedAt,
          updatedByActorType: record.updatedByActorType,
          updatedByActorId: record.updatedByActorId,
        },
      });
  }

  async findById(id: DesignConceptId, tenantId?: TenantId): Promise<DesignConcept | null> {
    const conditions = [eq(designConceptsTable.id, id)];
    if (tenantId !== undefined) {
      conditions.push(eq(designConceptsTable.tenantId, tenantId));
    }

    const records = await this.db
      .select()
      .from(designConceptsTable)
      .where(and(...conditions))
      .limit(1);

    const record = records[0];
    return record ? toDomainDesignConcept(record) : null;
  }

  async findByIdempotencyKey(
    tenantId: TenantId,
    sessionId: DesignSessionId,
    idempotencyKey: string
  ): Promise<DesignConcept | null> {
    const records = await this.db
      .select()
      .from(designConceptsTable)
      .where(
        and(
          eq(designConceptsTable.tenantId, tenantId),
          eq(designConceptsTable.sessionId, sessionId),
          eq(designConceptsTable.idempotencyKey, idempotencyKey)
        )
      )
      .limit(1);

    const record = records[0];
    return record ? toDomainDesignConcept(record) : null;
  }

  async listBySession(sessionId: DesignSessionId, tenantId: TenantId): Promise<DesignConcept[]> {
    const records = await this.db
      .select()
      .from(designConceptsTable)
      .where(
        and(
          eq(designConceptsTable.sessionId, sessionId),
          eq(designConceptsTable.tenantId, tenantId)
        )
      )
      .orderBy(desc(designConceptsTable.createdAt));

    return records.map(toDomainDesignConcept);
  }

  async delete(id: DesignConceptId, tenantId?: TenantId): Promise<void> {
    const conditions = [eq(designConceptsTable.id, id)];
    if (tenantId !== undefined) {
      conditions.push(eq(designConceptsTable.tenantId, tenantId));
    }
    await this.db.delete(designConceptsTable).where(and(...conditions));
  }

  async count(tenantId?: TenantId): Promise<number> {
    const conditions = tenantId ? [eq(designConceptsTable.tenantId, tenantId)] : [];
    const records = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(designConceptsTable)
      .where(and(...conditions));

    return Number(records[0]?.count ?? 0);
  }
}
