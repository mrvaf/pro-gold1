import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type InventoryLocationRepositoryPort,
  type InventoryLocationListFilter,
  InventoryLocation,
  type InventoryLocationId,
  type InventoryLocationType,
  type InventoryLocationStatus,
  type TenantId,
  type StoreId,
  createEntityId,
  AuditMetadata,
} from '@v-gold/core';
import {
  inventoryLocationsTable,
  type InventoryLocationRecord,
  type InsertInventoryLocationRecord,
} from '../schema/inventory-locations.js';

export const toDomainInventoryLocation = (
  record: InventoryLocationRecord
): InventoryLocation => {
  const audit = AuditMetadata.fromDates(record.createdAt, record.updatedAt);

  return InventoryLocation.reconstitute(
    createEntityId<InventoryLocationId>(record.id),
    createEntityId<TenantId>(record.tenantId),
    record.storeId ? createEntityId<StoreId>(record.storeId) : undefined,
    record.name,
    record.code,
    record.type as InventoryLocationType,
    record.status as InventoryLocationStatus,
    audit
  );
};

export const toDatabaseInventoryLocation = (
  location: InventoryLocation
): InsertInventoryLocationRecord => ({
  id: location.id,
  tenantId: location.tenantId,
  storeId: location.storeId ?? null,
  name: location.name,
  code: location.code,
  type: location.type,
  status: location.status,
  createdAt: location.audit.createdAt,
  updatedAt: location.audit.updatedAt,
});

export class DrizzleInventoryLocationRepository implements InventoryLocationRepositoryPort {
  constructor(private readonly db: PgDatabase<any>) {}

  async save(location: InventoryLocation): Promise<void> {
    const record = toDatabaseInventoryLocation(location);
    await this.db
      .insert(inventoryLocationsTable)
      .values(record)
      .onConflictDoUpdate({
        target: inventoryLocationsTable.id,
        set: {
          name: record.name,
          type: record.type,
          status: record.status,
          updatedAt: record.updatedAt,
        },
      });
  }

  async findById(id: InventoryLocationId, tenantId?: TenantId): Promise<InventoryLocation | null> {
    const conditions = [eq(inventoryLocationsTable.id, id)];
    if (tenantId !== undefined) {
      conditions.push(eq(inventoryLocationsTable.tenantId, tenantId));
    }

    const records = await this.db
      .select()
      .from(inventoryLocationsTable)
      .where(and(...conditions))
      .limit(1);

    const record = records[0];
    return record ? toDomainInventoryLocation(record) : null;
  }

  async findByCode(code: string, tenantId: TenantId): Promise<InventoryLocation | null> {
    const trimmed = code.trim().toUpperCase();
    const records = await this.db
      .select()
      .from(inventoryLocationsTable)
      .where(
        and(
          eq(inventoryLocationsTable.tenantId, tenantId),
          eq(inventoryLocationsTable.code, trimmed)
        )
      )
      .limit(1);

    const record = records[0];
    return record ? toDomainInventoryLocation(record) : null;
  }

  async listByTenant(
    tenantId: TenantId,
    filter?: InventoryLocationListFilter
  ): Promise<InventoryLocation[]> {
    const conditions = [eq(inventoryLocationsTable.tenantId, tenantId)];

    if (filter?.storeId) {
      conditions.push(eq(inventoryLocationsTable.storeId, filter.storeId));
    }
    if (filter?.status) {
      conditions.push(eq(inventoryLocationsTable.status, filter.status));
    }

    const records = await this.db
      .select()
      .from(inventoryLocationsTable)
      .where(and(...conditions))
      .orderBy(desc(inventoryLocationsTable.createdAt));

    return records.map(toDomainInventoryLocation);
  }

  async count(tenantId?: TenantId): Promise<number> {
    const conditions = tenantId ? [eq(inventoryLocationsTable.tenantId, tenantId)] : [];
    const records = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryLocationsTable)
      .where(and(...conditions));

    return Number(records[0]?.count ?? 0);
  }
}
