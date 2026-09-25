import { and, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type TenantMembershipRepositoryPort,
  TenantMembership,
  createEntityId,
  type MembershipId,
  type TenantId,
  type UserId,
  type Role,
  type MembershipStatus,
  AuditMetadata,
} from '@v-gold/core';
import { tenantMembershipsTable, type TenantMembershipRecord } from '../schema/tenant-memberships.js';

export const toDomainMembership = (record: TenantMembershipRecord): TenantMembership => {
  return TenantMembership.reconstitute(
    createEntityId<MembershipId>(record.id),
    createEntityId<TenantId>(record.tenantId),
    createEntityId<UserId>(record.userId),
    record.role as Role,
    record.status as MembershipStatus,
    AuditMetadata.fromDates(record.createdAt, record.updatedAt)
  );
};

export const toDatabaseMembership = (membership: TenantMembership): TenantMembershipRecord => {
  return {
    id: membership.id,
    tenantId: membership.tenantId,
    userId: membership.userId,
    role: membership.role,
    status: membership.status,
    createdAt: membership.audit.createdAt,
    updatedAt: membership.audit.updatedAt,
  };
};

export class DrizzleTenantMembershipRepository implements TenantMembershipRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async findById(id: MembershipId): Promise<TenantMembership | null> {
    const results = await this.db
      .select()
      .from(tenantMembershipsTable)
      .where(eq(tenantMembershipsTable.id, id))
      .limit(1);
    const record = results[0];
    return record ? toDomainMembership(record) : null;
  }

  async findByUserAndTenant(userId: UserId, tenantId: TenantId): Promise<TenantMembership | null> {
    const results = await this.db
      .select()
      .from(tenantMembershipsTable)
      .where(
        and(
          eq(tenantMembershipsTable.userId, userId),
          eq(tenantMembershipsTable.tenantId, tenantId)
        )
      )
      .limit(1);
    const record = results[0];
    return record ? toDomainMembership(record) : null;
  }

  async findAllByUser(userId: UserId): Promise<readonly TenantMembership[]> {
    const records = await this.db
      .select()
      .from(tenantMembershipsTable)
      .where(eq(tenantMembershipsTable.userId, userId));
    return records.map(toDomainMembership);
  }

  async findAllByTenant(tenantId: TenantId): Promise<readonly TenantMembership[]> {
    const records = await this.db
      .select()
      .from(tenantMembershipsTable)
      .where(eq(tenantMembershipsTable.tenantId, tenantId));
    return records.map(toDomainMembership);
  }

  async save(membership: TenantMembership): Promise<void> {
    const record = toDatabaseMembership(membership);
    await this.db
      .insert(tenantMembershipsTable)
      .values(record)
      .onConflictDoUpdate({
        target: tenantMembershipsTable.id,
        set: {
          role: record.role,
          status: record.status,
          updatedAt: record.updatedAt,
        },
      });
  }

  async delete(id: MembershipId): Promise<void> {
    await this.db.delete(tenantMembershipsTable).where(eq(tenantMembershipsTable.id, id));
  }
}
