import { and, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type TryOnSessionRepositoryPort,
  TryOnSession,
  type TryOnSessionId,
  type TenantId,
  type ProductId,
  type Studio3DAssetId,
  BodyPartAnchoring,
  createEntityId,
} from '@v-gold/core';
import {
  tryOnSessionsTable,
  type InsertTryOnSessionRecord,
} from '../schema/try-on-sessions.js';

export class DrizzleTryOnSessionRepository implements TryOnSessionRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async save(session: TryOnSession): Promise<void> {
    const record: InsertTryOnSessionRecord = {
      id: session.id,
      tenantId: session.tenantId,
      productId: session.productId,
      variantId: session.variantId ?? null,
      asset3dId: session.asset3dId,
      anchoringJson: JSON.stringify(session.anchoring.toDto()),
      status: session.status,
      signedAssetUrl: session.signedAssetUrl,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };

    await this.db
      .insert(tryOnSessionsTable)
      .values(record)
      .onConflictDoUpdate({
        target: tryOnSessionsTable.id,
        set: {
          variantId: record.variantId,
          anchoringJson: record.anchoringJson,
          status: record.status,
          signedAssetUrl: record.signedAssetUrl,
          expiresAt: record.expiresAt,
          updatedAt: new Date(),
        },
      });
  }

  async findById(id: TryOnSessionId, tenantId?: TenantId): Promise<TryOnSession | null> {
    const conditions = [eq(tryOnSessionsTable.id, id)];
    if (tenantId) {
      conditions.push(eq(tryOnSessionsTable.tenantId, tenantId));
    }

    const rows = await this.db
      .select()
      .from(tryOnSessionsTable)
      .where(and(...conditions))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return this.mapToDomain(row);
  }

  async listActiveByProduct(productId: ProductId, tenantId: TenantId): Promise<TryOnSession[]> {
    const rows = await this.db
      .select()
      .from(tryOnSessionsTable)
      .where(
        and(
          eq(tryOnSessionsTable.productId, productId),
          eq(tryOnSessionsTable.tenantId, tenantId),
          eq(tryOnSessionsTable.status, 'ACTIVE')
        )
      );

    const now = new Date();
    return rows
      .map((r) => this.mapToDomain(r))
      .filter((s) => !s.isExpired(now));
  }

  async delete(id: TryOnSessionId, tenantId?: TenantId): Promise<void> {
    const conditions = [eq(tryOnSessionsTable.id, id)];
    if (tenantId) {
      conditions.push(eq(tryOnSessionsTable.tenantId, tenantId));
    }
    await this.db.delete(tryOnSessionsTable).where(and(...conditions));
  }

  async count(tenantId?: TenantId): Promise<number> {
    const rows = tenantId
      ? await this.db
          .select()
          .from(tryOnSessionsTable)
          .where(eq(tryOnSessionsTable.tenantId, tenantId))
      : await this.db.select().from(tryOnSessionsTable);
    return rows.length;
  }

  private mapToDomain(row: typeof tryOnSessionsTable.$inferSelect): TryOnSession {
    const anchoringData = JSON.parse(row.anchoringJson);

    return TryOnSession.reconstitute(createEntityId<TryOnSessionId>(row.id), {
      tenantId: createEntityId<TenantId>(row.tenantId),
      productId: createEntityId<ProductId>(row.productId),
      variantId: row.variantId ? createEntityId<any>(row.variantId) : undefined,
      asset3dId: createEntityId<Studio3DAssetId>(row.asset3dId),
      anchoring: BodyPartAnchoring.create(anchoringData).unwrap(),
      status: row.status as any,
      signedAssetUrl: row.signedAssetUrl,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
