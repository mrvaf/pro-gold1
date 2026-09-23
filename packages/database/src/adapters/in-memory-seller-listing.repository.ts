import {
  SellerListing,
  type SellerListingId,
  type TenantId,
  type SellerProfileId,
  type ProductVariantId,
  type SellerListingRepositoryPort,
  type SellerListingFilter,
  type PublicListingFilter,
} from '@v-gold/core';

export class InMemorySellerListingRepository implements SellerListingRepositoryPort {
  private readonly listings = new Map<string, SellerListing>();

  private clone(listing: SellerListing): SellerListing {
    return SellerListing.reconstitute(
      listing.id,
      listing.tenantId,
      listing.sellerProfileId,
      listing.productId,
      listing.productVariantId,
      listing.title,
      listing.slug,
      listing.description,
      listing.status,
      listing.visibility,
      [...listing.tags],
      listing.audit
    );
  }

  async save(listing: SellerListing): Promise<void> {
    this.listings.set(listing.id, this.clone(listing));
  }

  async findById(id: SellerListingId, tenantId?: TenantId): Promise<SellerListing | null> {
    const listing = this.listings.get(id);
    if (!listing) return null;

    if (tenantId !== undefined && listing.tenantId !== tenantId) {
      return null;
    }

    return this.clone(listing);
  }

  async findBySellerAndVariant(
    sellerProfileId: SellerProfileId,
    variantId: ProductVariantId,
    tenantId: TenantId
  ): Promise<SellerListing | null> {
    for (const listing of this.listings.values()) {
      if (
        listing.tenantId === tenantId &&
        listing.sellerProfileId === sellerProfileId &&
        listing.productVariantId === variantId
      ) {
        return this.clone(listing);
      }
    }
    return null;
  }

  async listBySeller(
    sellerProfileId: SellerProfileId,
    tenantId: TenantId,
    filter?: SellerListingFilter
  ): Promise<SellerListing[]> {
    let result = Array.from(this.listings.values()).filter(
      (l) => l.tenantId === tenantId && l.sellerProfileId === sellerProfileId
    );

    if (filter?.status) {
      result = result.filter((l) => l.status === filter.status);
    }

    if (filter?.visibility) {
      result = result.filter((l) => l.visibility === filter.visibility);
    }

    if (filter?.productId) {
      result = result.filter((l) => l.productId === filter.productId);
    }

    result.sort((a, b) => b.audit.createdAt.getTime() - a.audit.createdAt.getTime());

    if (filter?.offset !== undefined) {
      result = result.slice(filter.offset);
    }

    if (filter?.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result.map((l) => this.clone(l));
  }

  async listByTenant(tenantId: TenantId, filter?: SellerListingFilter): Promise<SellerListing[]> {
    let result = Array.from(this.listings.values()).filter((l) => l.tenantId === tenantId);

    if (filter?.status) {
      result = result.filter((l) => l.status === filter.status);
    }

    if (filter?.visibility) {
      result = result.filter((l) => l.visibility === filter.visibility);
    }

    if (filter?.productId) {
      result = result.filter((l) => l.productId === filter.productId);
    }

    result.sort((a, b) => b.audit.createdAt.getTime() - a.audit.createdAt.getTime());

    if (filter?.offset !== undefined) {
      result = result.slice(filter.offset);
    }

    if (filter?.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result.map((l) => this.clone(l));
  }

  async listPublicListings(filter?: PublicListingFilter): Promise<SellerListing[]> {
    let result = Array.from(this.listings.values()).filter(
      (l) => l.status === 'ACTIVE' && l.visibility === 'PUBLIC'
    );

    if (filter?.sellerProfileId) {
      result = result.filter((l) => l.sellerProfileId === filter.sellerProfileId);
    }

    if (filter?.tag) {
      const tagLower = filter.tag.trim().toLowerCase();
      result = result.filter((l) => l.tags.includes(tagLower));
    }

    result.sort((a, b) => b.audit.createdAt.getTime() - a.audit.createdAt.getTime());

    if (filter?.offset !== undefined) {
      result = result.slice(filter.offset);
    }

    if (filter?.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result.map((l) => this.clone(l));
  }

  async count(tenantId?: TenantId): Promise<number> {
    if (!tenantId) return this.listings.size;
    return Array.from(this.listings.values()).filter((l) => l.tenantId === tenantId).length;
  }

  clear(): void {
    this.listings.clear();
  }
}
