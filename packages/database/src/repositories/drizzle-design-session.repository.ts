import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type DesignSessionRepositoryPort,
  DesignSession,
  DesignMessage,
  ExtractedDesignAttributes,
  type DesignSessionId,
  type DesignSessionStatus,
  type TenantId,
  createEntityId,
  AuditMetadata,
  ActorReference,
  type ActorType,
} from '@v-gold/core';
import {
  designSessionsTable,
  type DesignSessionRecord,
  type InsertDesignSessionRecord,
} from '../schema/design-sessions.js';

export const toDomainDesignSession = (record: DesignSessionRecord): DesignSession => {
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

  let messages: DesignMessage[] = [];
  if (record.messagesJson) {
    try {
      const parsed = JSON.parse(record.messagesJson);
      if (Array.isArray(parsed)) {
        messages = parsed
          .map((m: any) =>
            DesignMessage.create({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
            }).unwrapOr(null as any)
          )
          .filter(Boolean);
      }
    } catch {
      messages = [];
    }
  }

  let extractedAttributes = ExtractedDesignAttributes.empty();
  if (record.extractedAttributesJson) {
    try {
      const parsed = JSON.parse(record.extractedAttributesJson);
      extractedAttributes = ExtractedDesignAttributes.create(parsed).unwrapOr(
        ExtractedDesignAttributes.empty()
      );
    } catch {
      extractedAttributes = ExtractedDesignAttributes.empty();
    }
  }

  return DesignSession.reconstitute(
    createEntityId<DesignSessionId>(record.id),
    createEntityId<TenantId>(record.tenantId),
    record.userId ? createEntityId<any>(record.userId) : undefined,
    record.title,
    record.status as DesignSessionStatus,
    messages,
    extractedAttributes,
    audit
  );
};

export const toDatabaseDesignSession = (session: DesignSession): InsertDesignSessionRecord => ({
  id: session.id,
  tenantId: session.tenantId,
  userId: session.userId ?? null,
  title: session.title,
  status: session.status,
  messagesJson: JSON.stringify(session.messages.map((m) => m.toDto())),
  extractedAttributesJson: JSON.stringify(session.extractedAttributes.toDto()),
  createdAt: session.audit.createdAt,
  updatedAt: session.audit.updatedAt,
  createdByActorType: session.audit.createdBy?.actorType ?? 'SYSTEM',
  createdByActorId: session.audit.createdBy?.actorId ?? 'system',
  updatedByActorType: session.audit.updatedBy?.actorType ?? 'SYSTEM',
  updatedByActorId: session.audit.updatedBy?.actorId ?? 'system',
});

export class DrizzleDesignSessionRepository implements DesignSessionRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async save(session: DesignSession): Promise<void> {
    const record = toDatabaseDesignSession(session);
    await this.db
      .insert(designSessionsTable)
      .values(record)
      .onConflictDoUpdate({
        target: designSessionsTable.id,
        set: {
          userId: record.userId,
          title: record.title,
          status: record.status,
          messagesJson: record.messagesJson,
          extractedAttributesJson: record.extractedAttributesJson,
          updatedAt: record.updatedAt,
          updatedByActorType: record.updatedByActorType,
          updatedByActorId: record.updatedByActorId,
        },
      });
  }

  async findById(id: DesignSessionId, tenantId?: TenantId): Promise<DesignSession | null> {
    const conditions = [eq(designSessionsTable.id, id)];
    if (tenantId !== undefined) {
      conditions.push(eq(designSessionsTable.tenantId, tenantId));
    }

    const records = await this.db
      .select()
      .from(designSessionsTable)
      .where(and(...conditions))
      .limit(1);

    const record = records[0];
    return record ? toDomainDesignSession(record) : null;
  }

  async listByTenant(tenantId: TenantId, limit?: number): Promise<DesignSession[]> {
    let query = this.db
      .select()
      .from(designSessionsTable)
      .where(eq(designSessionsTable.tenantId, tenantId))
      .orderBy(desc(designSessionsTable.updatedAt));

    if (limit !== undefined && limit > 0) {
      query = query.limit(limit) as any;
    }

    const records = await query;
    return records.map(toDomainDesignSession);
  }

  async findByUser(tenantId: TenantId, userId: string): Promise<DesignSession[]> {
    const records = await this.db
      .select()
      .from(designSessionsTable)
      .where(
        and(
          eq(designSessionsTable.tenantId, tenantId),
          eq(designSessionsTable.userId, userId)
        )
      )
      .orderBy(desc(designSessionsTable.updatedAt));

    return records.map(toDomainDesignSession);
  }

  async delete(id: DesignSessionId, tenantId?: TenantId): Promise<void> {
    const conditions = [eq(designSessionsTable.id, id)];
    if (tenantId !== undefined) {
      conditions.push(eq(designSessionsTable.tenantId, tenantId));
    }
    await this.db.delete(designSessionsTable).where(and(...conditions));
  }

  async count(tenantId?: TenantId): Promise<number> {
    const conditions = tenantId ? [eq(designSessionsTable.tenantId, tenantId)] : [];
    const records = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(designSessionsTable)
      .where(and(...conditions));

    return Number(records[0]?.count ?? 0);
  }
}
