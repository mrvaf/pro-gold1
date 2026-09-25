import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type SellerProfileRepositoryPort,
  type SellerProfileFilter,
  type PublicSellerFilter,
  SellerProfile,
  type SellerProfileId,
  type SellerStatus,
  SellerMarketplacePresence,
  SellerSlug,
  type TenantId,
  type StoreId,
  createEntityId,
  AuditMetadata,
  ActorReference,
  type ActorType,
} from '@v-gold/core';
import {
  sellerProfilesTable,
  type SellerProfileRecord,
  type InsertSellerProfileRecord,
} from '../schema/seller-profiles.js';

export const toDomainSellerProfile = (record: SellerProfileRecord): SellerProfile => {
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

  const slugRes = SellerSlug.create(record.slug);
  const slug = slugRes.isOk ? slugRes.value : ({} as SellerSlug);

  const presenceRes = SellerMarketplacePresence.create({
    displayName: record.displayName,
    slug,
    bio: record.bio ?? undefined,
    logoUrl: record.logoUrl ?? undefined,
    bannerUrl: record.bannerUrl ?? undefined,
    isPubliclyVisible: record.isPubliclyVisible,
  });

  const presence = presenceRes.isOk ? presenceRes.value : ({} as SellerMarketplacePresence);

  let metadata: Record<string, unknown> | undefined;
  if (record.metadataJson) {
    try {
      metadata = JSON.parse(record.metadataJson);
    } catch {
      metadata = undefined;
    }
  }

  return SellerProfile.reconstitute(
    createEntityId<SellerProfileId>(record.id),
    createEntityId<TenantId>(record.tenantId),
    record.storeId ? createEntityId<StoreId>(record.storeId) : undefined,
    presence,
    record.status as SellerStatus,
    record.businessRegistrationNumber ?? undefined,
    record.taxId ?? undefined,
    record.contactEmail ?? undefined,
    record.contactPhone ?? undefined,
    metadata,
    audit
  );
};

export const toDatabaseSellerProfile = (seller: SellerProfile): InsertSellerProfileRecord => ({
  id: seller.id,
  tenantId: seller.tenantId,
  storeId: seller.storeId ?? null,
  displayName: seller.displayName,
  slug: seller.slug,
  bio: seller.presence.bio ?? null,
  logoUrl: seller.presence.logoUrl ?? null,
  bannerUrl: seller.presence.bannerUrl ?? null,
  isPubliclyVisible: seller.presence.isPubliclyVisible,
  status: seller.status,
  businessRegistrationNumber: seller.businessRegistrationNumber ?? null,
  taxId: seller.taxId ?? null,
  contactEmail: seller.contactEmail ?? null,
  contactPhone: seller.contactPhone ?? null,
  metadataJson: seller.metadata ? JSON.stringify(seller.metadata) : null,
  createdAt: seller.audit.createdAt,
  updatedAt: seller.audit.updatedAt,
  createdByActorType: seller.audit.createdBy?.actorType ?? 'SYSTEM',
  createdByActorId: seller.audit.createdBy?.actorId ?? 'system',
  updatedByActorType: seller.audit.updatedBy?.actorType ?? 'SYSTEM',
  updatedByActorId: seller.audit.updatedBy?.actorId ?? 'system',
});

export class DrizzleSellerProfileRepository implements SellerProfileRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async save(seller: SellerProfile): Promise<void> {
    const record = toDatabaseSellerProfile(seller);
    await this.db
      .insert(sellerProfilesTable)
      .values(record)
      .onConflictDoUpdate({
        target: sellerProfilesTable.id,
        set: {
          storeId: record.storeId,
          displayName: record.displayName,
          slug: record.slug,
          bio: record.bio,
          logoUrl: record.logoUrl,
          bannerUrl: record.bannerUrl,
          isPubliclyVisible: record.isPubliclyVisible,
          status: record.status,
          businessRegistrationNumber: record.businessRegistrationNumber,
          taxId: record.taxId,
          contactEmail: record.contactEmail,
          contactPhone: record.contactPhone,
          metadataJson: record.metadataJson,
          updatedAt: record.updatedAt,
          updatedByActorType: record.updatedByActorType,
          updatedByActorId: record.updatedByActorId,
        },
      });
  }

  async findById(id: SellerProfileId, tenantId?: TenantId): Promise<SellerProfile | null> {
    const conditions = [eq(sellerProfilesTable.id, id)];
    if (tenantId !== undefined) {
      conditions.push(eq(sellerProfilesTable.tenantId, tenantId));
    }

    const records = await this.db
      .select()
      .from(sellerProfilesTable)
      .where(and(...conditions))
      .limit(1);

    const record = records[0];
    return record ? toDomainSellerProfile(record) : null;
  }

  async findBySlug(slug: string): Promise<SellerProfile | null> {
    const normalized = slug.trim().toLowerCase();
    const records = await this.db
      .select()
      .from(sellerProfilesTable)
      .where(eq(sellerProfilesTable.slug, normalized))
      .limit(1);

    const record = records[0];
    return record ? toDomainSellerProfile(record) : null;
  }

  async findByStoreId(storeId: StoreId, tenantId: TenantId): Promise<SellerProfile | null> {
    const records = await this.db
      .select()
      .from(sellerProfilesTable)
      .where(and(eq(sellerProfilesTable.storeId, storeId), eq(sellerProfilesTable.tenantId, tenantId)))
      .limit(1);

    const record = records[0];
    return record ? toDomainSellerProfile(record) : null;
  }

  async listByTenant(tenantId: TenantId, filter?: SellerProfileFilter): Promise<SellerProfile[]> {
    const conditions = [eq(sellerProfilesTable.tenantId, tenantId)];

    if (filter?.status) {
      conditions.push(eq(sellerProfilesTable.status, filter.status));
    }
    if (filter?.storeId) {
      conditions.push(eq(sellerProfilesTable.storeId, filter.storeId));
    }

    let query = this.db
      .select()
      .from(sellerProfilesTable)
      .where(and(...conditions))
      .orderBy(desc(sellerProfilesTable.createdAt));

    if (filter?.limit !== undefined) {
      query = query.limit(filter.limit) as any;
    }
    if (filter?.offset !== undefined) {
      query = query.offset(filter.offset) as any;
    }

    const records = await query;
    return records.map(toDomainSellerProfile);
  }

  async listPublicSellers(filter?: PublicSellerFilter): Promise<SellerProfile[]> {
    const conditions = [
      eq(sellerProfilesTable.status, 'ACTIVE'),
      eq(sellerProfilesTable.isPubliclyVisible, true),
    ];

    let query = this.db
      .select()
      .from(sellerProfilesTable)
      .where(and(...conditions))
      .orderBy(sellerProfilesTable.displayName);

    if (filter?.limit !== undefined) {
      query = query.limit(filter.limit) as any;
    }
    if (filter?.offset !== undefined) {
      query = query.offset(filter.offset) as any;
    }

    const records = await query;
    return records.map(toDomainSellerProfile);
  }

  async count(tenantId?: TenantId): Promise<number> {
    const conditions = tenantId ? [eq(sellerProfilesTable.tenantId, tenantId)] : [];
    const records = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(sellerProfilesTable)
      .where(and(...conditions));

    return Number(records[0]?.count ?? 0);
  }
}
