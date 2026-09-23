import { and, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type StoreRepositoryPort,
  Store,
  createEntityId,
  type StoreId,
  type TenantId,
  type StoreStatus,
  AuditMetadata,
} from '@v-gold/core';
import { storesTable, type StoreRecord } from '../schema/stores.js';

export const toDomainStore = (record: StoreRecord): Store => {
  return Store.reconstitute(
    createEntityId<StoreId>(record.id),
    createEntityId<TenantId>(record.tenantId),
    record.name,
    record.code,
    record.status as StoreStatus,
    AuditMetadata.fromDates(record.createdAt, record.updatedAt)
  );
};

export const toDatabaseStore = (store: Store): StoreRecord => {
  return {
    id: store.id,
    tenantId: store.tenantId,
    name: store.name,
    code: store.code,
    status: store.status,
    createdAt: store.audit.createdAt,
    updatedAt: store.audit.updatedAt,
  };
};

export class DrizzleStoreRepository implements StoreRepositoryPort {
  constructor(private readonly db: PgDatabase<any>) {}

  async findById(tenantId: TenantId, id: StoreId): Promise<Store | null> {
    const results = await this.db
      .select()
      .from(storesTable)
      .where(and(eq(storesTable.tenantId, tenantId), eq(storesTable.id, id)))
      .limit(1);

    const record = results[0];
    return record ? toDomainStore(record) : null;
  }

  async findByCode(tenantId: TenantId, code: string): Promise<Store | null> {
    const results = await this.db
      .select()
      .from(storesTable)
      .where(and(eq(storesTable.tenantId, tenantId), eq(storesTable.code, code)))
      .limit(1);

    const record = results[0];
    return record ? toDomainStore(record) : null;
  }

  async findAllByTenant(tenantId: TenantId): Promise<readonly Store[]> {
    const records = await this.db
      .select()
      .from(storesTable)
      .where(eq(storesTable.tenantId, tenantId));

    return records.map(toDomainStore);
  }

  async save(tenantId: TenantId, store: Store): Promise<void> {
    if (store.tenantId !== tenantId) {
      throw new Error(`Tenant mismatch: Store tenantId (${store.tenantId}) does not match required tenantId (${tenantId})`);
    }

    const record = toDatabaseStore(store);
    await this.db
      .insert(storesTable)
      .values(record)
      .onConflictDoUpdate({
        target: storesTable.id,
        set: {
          name: record.name,
          code: record.code,
          status: record.status,
          updatedAt: record.updatedAt,
        },
      });
  }

  async delete(tenantId: TenantId, id: StoreId): Promise<void> {
    await this.db
      .delete(storesTable)
      .where(and(eq(storesTable.tenantId, tenantId), eq(storesTable.id, id)));
  }
}
