import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type SellerListingRepositoryPort,
  type SellerListingFilter,
  type PublicListingFilter,
  SellerListing,
  type SellerListingId,
  type ListingStatus,
  type ListingVisibility,
  type SellerProfileId,
  type ProductId,
  type ProductVariantId,
  type TenantId,
  createEntityId,
  AuditMetadata,
  ActorReference,
  type ActorType,
} from '@v-gold/core';
import {
  sellerListingsTable,
  type SellerListingRecord,
  type InsertSellerListingRecord,
} from '../schema/seller-listings.js';

export const toDomainSellerListing = (record: SellerListingRecord): SellerListing => {
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

  let tags: string[] = [];
  if (record.tagsJson) {
    try {
      tags = JSON.parse(record.tagsJson);
    } catch {
      tags = [];
    }
  }

  return SellerListing.reconstitute(
    createEntityId<SellerListingId>(record.id),
    createEntityId<TenantId>(record.tenantId),
    createEntityId<SellerProfileId>(record.sellerProfileId),
    createEntityId<ProductId>(record.productId),
    createEntityId<ProductVariantId>(record.productVariantId),
    record.title,
    record.slug,
    record.description ?? undefined,
    record.status as ListingStatus,
    record.visibility as ListingVisibility,
    tags,
    audit
  );
};

export const toDatabaseSellerListing = (listing: SellerListing): InsertSellerListingRecord => ({
  id: listing.id,
  tenantId: listing.tenantId,
  sellerProfileId: listing.sellerProfileId,
  productId: listing.productId,
  productVariantId: listing.productVariantId,
  title: listing.title,
  slug: listing.slug,
  description: listing.description ?? null,
  status: listing.status,
  visibility: listing.visibility,
  tagsJson: JSON.stringify(listing.tags),
  createdAt: listing.audit.createdAt,
  updatedAt: listing.audit.updatedAt,
  createdByActorType: listing.audit.createdBy?.actorType ?? 'SYSTEM',
  createdByActorId: listing.audit.createdBy?.actorId ?? 'system',
  updatedByActorType: listing.audit.updatedBy?.actorType ?? 'SYSTEM',
  updatedByActorId: listing.audit.updatedBy?.actorId ?? 'system',
});

export class DrizzleSellerListingRepository implements SellerListingRepositoryPort {
  constructor(private readonly db: PgDatabase<any>) {}

  async save(listing: SellerListing): Promise<void> {
    const record = toDatabaseSellerListing(listing);
    await this.db
      .insert(sellerListingsTable)
      .values(record)
      .onConflictDoUpdate({
        target: sellerListingsTable.id,
        set: {
          title: record.title,
          slug: record.slug,
          description: record.description,
          status: record.status,
          visibility: record.visibility,
          tagsJson: record.tagsJson,
          updatedAt: record.updatedAt,
          updatedByActorType: record.updatedByActorType,
          updatedByActorId: record.updatedByActorId,
        },
      });
  }

  async findById(id: SellerListingId, tenantId?: TenantId): Promise<SellerListing | null> {
    const conditions = [eq(sellerListingsTable.id, id)];
    if (tenantId !== undefined) {
      conditions.push(eq(sellerListingsTable.tenantId, tenantId));
    }

    const records = await this.db
      .select()
      .from(sellerListingsTable)
      .where(and(...conditions))
      .limit(1);

    const record = records[0];
    return record ? toDomainSellerListing(record) : null;
  }

  async findBySellerAndVariant(
    sellerProfileId: SellerProfileId,
    variantId: ProductVariantId,
    tenantId: TenantId
  ): Promise<SellerListing | null> {
    const records = await this.db
      .select()
      .from(sellerListingsTable)
      .where(
        and(
          eq(sellerListingsTable.sellerProfileId, sellerProfileId),
          eq(sellerListingsTable.productVariantId, variantId),
          eq(sellerListingsTable.tenantId, tenantId)
        )
      )
      .orderBy(
        sql`CASE WHEN "status" != 'ARCHIVED' THEN 0 ELSE 1 END`,
        desc(sellerListingsTable.createdAt)
      )
      .limit(1);

    const record = records[0];
    return record ? toDomainSellerListing(record) : null;
  }

  async listBySeller(
    sellerProfileId: SellerProfileId,
    tenantId: TenantId,
    filter?: SellerListingFilter
  ): Promise<SellerListing[]> {
    const conditions = [
      eq(sellerListingsTable.tenantId, tenantId),
      eq(sellerListingsTable.sellerProfileId, sellerProfileId),
    ];

    if (filter?.status) {
      conditions.push(eq(sellerListingsTable.status, filter.status));
    }
    if (filter?.visibility) {
      conditions.push(eq(sellerListingsTable.visibility, filter.visibility));
    }
    if (filter?.productId) {
      conditions.push(eq(sellerListingsTable.productId, filter.productId));
    }

    let query = this.db
      .select()
      .from(sellerListingsTable)
      .where(and(...conditions))
      .orderBy(desc(sellerListingsTable.createdAt));

    if (filter?.limit !== undefined) {
      query = query.limit(filter.limit) as any;
    }
    if (filter?.offset !== undefined) {
      query = query.offset(filter.offset) as any;
    }

    const records = await query;
    return records.map(toDomainSellerListing);
  }

  async listByTenant(tenantId: TenantId, filter?: SellerListingFilter): Promise<SellerListing[]> {
    const conditions = [eq(sellerListingsTable.tenantId, tenantId)];

    if (filter?.status) {
      conditions.push(eq(sellerListingsTable.status, filter.status));
    }
    if (filter?.visibility) {
      conditions.push(eq(sellerListingsTable.visibility, filter.visibility));
    }
    if (filter?.productId) {
      conditions.push(eq(sellerListingsTable.productId, filter.productId));
    }

    let query = this.db
      .select()
      .from(sellerListingsTable)
      .where(and(...conditions))
      .orderBy(desc(sellerListingsTable.createdAt));

    if (filter?.limit !== undefined) {
      query = query.limit(filter.limit) as any;
    }
    if (filter?.offset !== undefined) {
      query = query.offset(filter.offset) as any;
    }

    const records = await query;
    return records.map(toDomainSellerListing);
  }

  async listPublicListings(filter?: PublicListingFilter): Promise<SellerListing[]> {
    const conditions = [
      eq(sellerListingsTable.status, 'ACTIVE'),
      eq(sellerListingsTable.visibility, 'PUBLIC'),
    ];

    if (filter?.sellerProfileId) {
      conditions.push(eq(sellerListingsTable.sellerProfileId, filter.sellerProfileId));
    }

    let query = this.db
      .select()
      .from(sellerListingsTable)
      .where(and(...conditions))
      .orderBy(desc(sellerListingsTable.createdAt));

    if (filter?.limit !== undefined) {
      query = query.limit(filter.limit) as any;
    }
    if (filter?.offset !== undefined) {
      query = query.offset(filter.offset) as any;
    }

    const records = await query;
    let listings = records.map(toDomainSellerListing);

    if (filter?.tag) {
      const tagLower = filter.tag.trim().toLowerCase();
      listings = listings.filter((l) => l.tags.includes(tagLower));
    }

    return listings;
  }

  async count(tenantId?: TenantId): Promise<number> {
    const conditions = tenantId ? [eq(sellerListingsTable.tenantId, tenantId)] : [];
    const records = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(sellerListingsTable)
      .where(and(...conditions));

    return Number(records[0]?.count ?? 0);
  }
}
