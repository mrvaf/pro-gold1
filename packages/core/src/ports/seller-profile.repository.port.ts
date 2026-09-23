import type { SellerProfile, SellerProfileId } from '../domain/marketplace/seller-profile.js';
import type { SellerStatus } from '../domain/marketplace/seller-status.js';
import type { TenantId } from '../domain/tenant/tenant.js';
import type { StoreId } from '../domain/tenant/store.js';

export interface SellerProfileFilter {
  status?: SellerStatus | undefined;
  storeId?: StoreId | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface PublicSellerFilter {
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface SellerProfileRepositoryPort {
  save(seller: SellerProfile): Promise<void>;
  findById(id: SellerProfileId, tenantId?: TenantId): Promise<SellerProfile | null>;
  findBySlug(slug: string): Promise<SellerProfile | null>;
  findByStoreId(storeId: StoreId, tenantId: TenantId): Promise<SellerProfile | null>;
  listByTenant(tenantId: TenantId, filter?: SellerProfileFilter): Promise<SellerProfile[]>;
  listPublicSellers(filter?: PublicSellerFilter): Promise<SellerProfile[]>;
  count(tenantId?: TenantId): Promise<number>;
}
