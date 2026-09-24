import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type SellerWorkspaceRepositoryPort,
  type SellerWorkspaceFilter,
  SellerWorkspace,
  type SellerWorkspaceId,
  type WorkspaceStatus,
  type TenantId,
  type StoreId,
  type SellerProfileId,
  createEntityId,
  AuditMetadata,
  ActorReference,
  type ActorType,
} from '@v-gold/core';
import {
  sellerWorkspacesTable,
  type SellerWorkspaceRecord,
  type InsertSellerWorkspaceRecord,
} from '../schema/seller-workspaces.js';

export const toDomainSellerWorkspace = (record: SellerWorkspaceRecord): SellerWorkspace => {
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

  let settings: Record<string, unknown> | undefined;
  if (record.settingsJson) {
    try {
      settings = JSON.parse(record.settingsJson);
    } catch {
      settings = undefined;
    }
  }

  return SellerWorkspace.reconstitute(
    createEntityId<SellerWorkspaceId>(record.id),
    createEntityId<TenantId>(record.tenantId),
    createEntityId<SellerProfileId>(record.sellerProfileId),
    record.storeId ? createEntityId<StoreId>(record.storeId) : undefined,
    record.name,
    record.status as WorkspaceStatus,
    settings,
    audit
  );
};

export const toDatabaseSellerWorkspace = (workspace: SellerWorkspace): InsertSellerWorkspaceRecord => ({
  id: workspace.id,
  tenantId: workspace.tenantId,
  sellerProfileId: workspace.sellerProfileId,
  storeId: workspace.storeId ?? null,
  name: workspace.name,
  status: workspace.status,
  settingsJson: workspace.settings ? JSON.stringify(workspace.settings) : null,
  createdAt: workspace.audit.createdAt,
  updatedAt: workspace.audit.updatedAt,
  createdByActorType: workspace.audit.createdBy?.actorType ?? 'SYSTEM',
  createdByActorId: workspace.audit.createdBy?.actorId ?? 'system',
  updatedByActorType: workspace.audit.updatedBy?.actorType ?? 'SYSTEM',
  updatedByActorId: workspace.audit.updatedBy?.actorId ?? 'system',
});

export class DrizzleSellerWorkspaceRepository implements SellerWorkspaceRepositoryPort {
  constructor(private readonly db: PgDatabase<any>) {}

  async save(workspace: SellerWorkspace): Promise<void> {
    const record = toDatabaseSellerWorkspace(workspace);
    await this.db
      .insert(sellerWorkspacesTable)
      .values(record)
      .onConflictDoUpdate({
        target: sellerWorkspacesTable.id,
        set: {
          storeId: record.storeId,
          name: record.name,
          status: record.status,
          settingsJson: record.settingsJson,
          updatedAt: record.updatedAt,
          updatedByActorType: record.updatedByActorType,
          updatedByActorId: record.updatedByActorId,
        },
      });
  }

  async findById(id: SellerWorkspaceId, tenantId?: TenantId): Promise<SellerWorkspace | null> {
    const conditions = [eq(sellerWorkspacesTable.id, id)];
    if (tenantId !== undefined) {
      conditions.push(eq(sellerWorkspacesTable.tenantId, tenantId));
    }

    const records = await this.db
      .select()
      .from(sellerWorkspacesTable)
      .where(and(...conditions))
      .limit(1);

    const record = records[0];
    return record ? toDomainSellerWorkspace(record) : null;
  }

  async findBySellerProfileId(
    sellerProfileId: SellerProfileId,
    tenantId: TenantId
  ): Promise<SellerWorkspace | null> {
    const records = await this.db
      .select()
      .from(sellerWorkspacesTable)
      .where(
        and(
          eq(sellerWorkspacesTable.sellerProfileId, sellerProfileId),
          eq(sellerWorkspacesTable.tenantId, tenantId)
        )
      )
      .limit(1);

    const record = records[0];
    return record ? toDomainSellerWorkspace(record) : null;
  }

  async listByTenant(
    tenantId: TenantId,
    filter?: SellerWorkspaceFilter
  ): Promise<SellerWorkspace[]> {
    const conditions = [eq(sellerWorkspacesTable.tenantId, tenantId)];

    if (filter?.status) {
      conditions.push(eq(sellerWorkspacesTable.status, filter.status));
    }

    let query = this.db
      .select()
      .from(sellerWorkspacesTable)
      .where(and(...conditions))
      .orderBy(desc(sellerWorkspacesTable.createdAt));

    if (filter?.limit !== undefined) {
      query = query.limit(filter.limit) as any;
    }
    if (filter?.offset !== undefined) {
      query = query.offset(filter.offset) as any;
    }

    const records = await query;
    return records.map(toDomainSellerWorkspace);
  }

  async count(tenantId?: TenantId): Promise<number> {
    const conditions = tenantId ? [eq(sellerWorkspacesTable.tenantId, tenantId)] : [];
    const records = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(sellerWorkspacesTable)
      .where(and(...conditions));

    return Number(records[0]?.count ?? 0);
  }
}
