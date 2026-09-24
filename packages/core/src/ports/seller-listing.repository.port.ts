import type { SellerListing, SellerListingId } from '../domain/marketplace/seller-listing.js';
import type { ListingStatus, ListingVisibility } from '../domain/marketplace/listing-status.js';
import type { SellerProfileId } from '../domain/marketplace/seller-profile.js';
import type { ProductVariantId } from '../domain/catalog/product-variant.js';
import type { ProductId } from '../domain/catalog/product.js';
import type { TenantId } from '../domain/tenant/tenant.js';

export interface SellerListingFilter {
  status?: ListingStatus | undefined;
  visibility?: ListingVisibility | undefined;
  productId?: ProductId | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface PublicListingFilter {
  sellerProfileId?: SellerProfileId | undefined;
  tag?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface SellerListingRepositoryPort {
  save(listing: SellerListing): Promise<void>;
  findById(id: SellerListingId, tenantId?: TenantId): Promise<SellerListing | null>;
  findBySellerAndVariant(
    sellerProfileId: SellerProfileId,
    variantId: ProductVariantId,
    tenantId: TenantId
  ): Promise<SellerListing | null>;
  listBySeller(
    sellerProfileId: SellerProfileId,
    tenantId: TenantId,
    filter?: SellerListingFilter
  ): Promise<SellerListing[]>;
  listByTenant(tenantId: TenantId, filter?: SellerListingFilter): Promise<SellerListing[]>;
  listPublicListings(filter?: PublicListingFilter): Promise<SellerListing[]>;
  count(tenantId?: TenantId): Promise<number>;
}
