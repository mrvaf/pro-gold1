import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type TenantRepositoryPort,
  Tenant,
  createEntityId,
  type TenantId,
  type TenantStatus,
  AuditMetadata,
} from '@v-gold/core';
import { tenantsTable, type TenantRecord } from '../schema/tenants.js';

export const toDomainTenant = (record: TenantRecord): Tenant => {
  return Tenant.reconstitute(
    createEntityId<TenantId>(record.id),
    record.name,
    record.slug,
    record.status as TenantStatus,
    AuditMetadata.fromDates(record.createdAt, record.updatedAt)
  );
};

export const toDatabaseTenant = (tenant: Tenant): TenantRecord => {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    createdAt: tenant.audit.createdAt,
    updatedAt: tenant.audit.updatedAt,
  };
};

export class DrizzleTenantRepository implements TenantRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async findById(id: TenantId): Promise<Tenant | null> {
    const results = await this.db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, id))
      .limit(1);

    const record = results[0];
    return record ? toDomainTenant(record) : null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const results = await this.db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, slug))
      .limit(1);

    const record = results[0];
    return record ? toDomainTenant(record) : null;
  }

  async findAll(): Promise<readonly Tenant[]> {
    const records = await this.db.select().from(tenantsTable);
    return records.map(toDomainTenant);
  }

  async save(tenant: Tenant): Promise<void> {
    const record = toDatabaseTenant(tenant);
    await this.db
      .insert(tenantsTable)
      .values(record)
      .onConflictDoUpdate({
        target: tenantsTable.id,
        set: {
          name: record.name,
          slug: record.slug,
          status: record.status,
          updatedAt: record.updatedAt,
        },
      });
  }

  async delete(id: TenantId): Promise<void> {
    await this.db.delete(tenantsTable).where(eq(tenantsTable.id, id));
  }
}
