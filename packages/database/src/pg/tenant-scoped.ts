import type {
  InventoryItem,
  InventoryItemId,
  InventoryItemListFilter,
  InventoryLocation,
  InventoryLocationId,
  InventoryLocationListFilter,
  InventoryMovement,
  InventoryMovementId,
  InventoryMovementListFilter,
  InventoryUnitOfWorkPort,
  MembershipId,
  PricingResult,
  PricingResultId,
  PricingRule,
  PricingRuleId,
  Product,
  ProductId,
  ProductListFilter,
  ProductVariant,
  ProductVariantId,
  ProductVariantListFilter,
  PublicListingFilter,
  PublicSellerFilter,
  SKU,
  SellerListing,
  SellerListingFilter,
  SellerListingId,
  SellerProfile,
  SellerProfileFilter,
  SellerProfileId,
  SellerWorkspace,
  SellerWorkspaceFilter,
  SellerWorkspaceId,
  Store,
  StoreId,
  TenantId,
  TenantMembership,
  TenantMembershipRepositoryPort,
  InventoryItemRepositoryPort,
  InventoryLocationRepositoryPort,
  InventoryMovementRepositoryPort,
  PricingResultRepositoryPort,
  PricingRuleRepositoryPort,
  ProductRepositoryPort,
  ProductVariantRepositoryPort,
  SellerListingRepositoryPort,
  SellerProfileRepositoryPort,
  SellerWorkspaceRepositoryPort,
  StoreRepositoryPort,
  UserId,
  DesignSession,
  DesignSessionId,
  DesignSessionRepositoryPort,
} from '@v-gold/core';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { withTenantContext } from './tenant-context.js';

type TenantDb = PgDatabase<any, any, any>;

/**
 * Stage 8.3 — ADR-0049: tenant-context decorators for the 12 tenant-scoped
 * repositories (+ the inventory unit of work).
 *
 * In PostgreSQL mode every call executes under `withTenantContext` bound to the
 * call's own tenant (or the entity's tenant on writes). Methods whose port
 * contract is deliberately un-scoped (public discovery, cross-tenant existence
 * probes, login membership discovery, global counts) run without a context and
 * use the policy's un-scoped branch — matching in-memory semantics 1:1.
 */

const tenantOf = (value: { readonly tenantId: TenantId | string | null | undefined }): string | undefined =>
  value.tenantId ?? undefined;

export class TenantScopedStoreRepository implements StoreRepositoryPort {
  constructor(
    private readonly inner: StoreRepositoryPort,
    private readonly db: TenantDb
  ) {}

  findById(tenantId: TenantId, id: StoreId): Promise<Store | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findById(tenantId, id));
  }

  findByCode(tenantId: TenantId, code: string): Promise<Store | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findByCode(tenantId, code));
  }

  findAllByTenant(tenantId: TenantId): Promise<readonly Store[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.findAllByTenant(tenantId));
  }

  save(tenantId: TenantId, store: Store): Promise<void> {
    return withTenantContext(this.db, tenantId, () => this.inner.save(tenantId, store));
  }

  delete(tenantId: TenantId, id: StoreId): Promise<void> {
    return withTenantContext(this.db, tenantId, () => this.inner.delete(tenantId, id));
  }
}

export class TenantScopedTenantMembershipRepository implements TenantMembershipRepositoryPort {
  constructor(
    private readonly inner: TenantMembershipRepositoryPort,
    private readonly db: TenantDb
  ) {}

  findById(id: MembershipId): Promise<TenantMembership | null> {
    return withTenantContext(this.db, undefined, () => this.inner.findById(id));
  }

  findByUserAndTenant(userId: UserId, tenantId: TenantId): Promise<TenantMembership | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findByUserAndTenant(userId, tenantId));
  }

  findAllByUser(userId: UserId): Promise<readonly TenantMembership[]> {
    return withTenantContext(this.db, undefined, () => this.inner.findAllByUser(userId));
  }

  findAllByTenant(tenantId: TenantId): Promise<readonly TenantMembership[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.findAllByTenant(tenantId));
  }

  save(membership: TenantMembership): Promise<void> {
    return withTenantContext(this.db, tenantOf(membership), () => this.inner.save(membership));
  }

  delete(id: MembershipId): Promise<void> {
    return withTenantContext(this.db, undefined, () => this.inner.delete(id));
  }
}

export class TenantScopedProductRepository implements ProductRepositoryPort {
  constructor(
    private readonly inner: ProductRepositoryPort,
    private readonly db: TenantDb
  ) {}

  save(product: Product): Promise<void> {
    return withTenantContext(this.db, tenantOf(product), () => this.inner.save(product));
  }

  findById(id: ProductId, tenantId?: TenantId): Promise<Product | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findById(id, tenantId));
  }

  listByTenant(tenantId: TenantId, filter?: ProductListFilter): Promise<Product[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.listByTenant(tenantId, filter));
  }

  count(tenantId?: TenantId): Promise<number> {
    return withTenantContext(this.db, tenantId, () => this.inner.count(tenantId));
  }
}

export class TenantScopedProductVariantRepository implements ProductVariantRepositoryPort {
  constructor(
    private readonly inner: ProductVariantRepositoryPort,
    private readonly db: TenantDb
  ) {}

  save(variant: ProductVariant): Promise<void> {
    return withTenantContext(this.db, tenantOf(variant), () => this.inner.save(variant));
  }

  findById(id: ProductVariantId, tenantId?: TenantId): Promise<ProductVariant | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findById(id, tenantId));
  }

  findBySku(sku: SKU | string, tenantId: TenantId): Promise<ProductVariant | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findBySku(sku, tenantId));
  }

  listByProductId(productId: ProductId, tenantId: TenantId): Promise<ProductVariant[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.listByProductId(productId, tenantId));
  }

  listByTenant(tenantId: TenantId, filter?: ProductVariantListFilter): Promise<ProductVariant[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.listByTenant(tenantId, filter));
  }

  count(tenantId?: TenantId): Promise<number> {
    return withTenantContext(this.db, tenantId, () => this.inner.count(tenantId));
  }
}

export class TenantScopedInventoryLocationRepository implements InventoryLocationRepositoryPort {
  constructor(
    private readonly inner: InventoryLocationRepositoryPort,
    private readonly db: TenantDb
  ) {}

  save(location: InventoryLocation): Promise<void> {
    return withTenantContext(this.db, tenantOf(location), () => this.inner.save(location));
  }

  findById(id: InventoryLocationId, tenantId?: TenantId): Promise<InventoryLocation | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findById(id, tenantId));
  }

  findByCode(code: string, tenantId: TenantId): Promise<InventoryLocation | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findByCode(code, tenantId));
  }

  listByTenant(tenantId: TenantId, filter?: InventoryLocationListFilter): Promise<InventoryLocation[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.listByTenant(tenantId, filter));
  }

  count(tenantId?: TenantId): Promise<number> {
    return withTenantContext(this.db, tenantId, () => this.inner.count(tenantId));
  }
}

export class TenantScopedInventoryItemRepository implements InventoryItemRepositoryPort {
  constructor(
    private readonly inner: InventoryItemRepositoryPort,
    private readonly db: TenantDb
  ) {}

  save(item: InventoryItem): Promise<void> {
    return withTenantContext(this.db, tenantOf(item), () => this.inner.save(item));
  }

  findById(id: InventoryItemId, tenantId?: TenantId): Promise<InventoryItem | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findById(id, tenantId));
  }

  findBySerialNumber(serial: string, tenantId: TenantId): Promise<InventoryItem | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findBySerialNumber(serial, tenantId));
  }

  listByVariantId(variantId: ProductVariantId, tenantId: TenantId): Promise<InventoryItem[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.listByVariantId(variantId, tenantId));
  }

  listByLocation(locationId: InventoryLocationId, tenantId: TenantId): Promise<InventoryItem[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.listByLocation(locationId, tenantId));
  }

  listByTenant(tenantId: TenantId, filter?: InventoryItemListFilter): Promise<InventoryItem[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.listByTenant(tenantId, filter));
  }

  count(tenantId?: TenantId): Promise<number> {
    return withTenantContext(this.db, tenantId, () => this.inner.count(tenantId));
  }
}

export class TenantScopedInventoryMovementRepository implements InventoryMovementRepositoryPort {
  constructor(
    private readonly inner: InventoryMovementRepositoryPort,
    private readonly db: TenantDb
  ) {}

  record(movement: InventoryMovement): Promise<void> {
    return withTenantContext(this.db, tenantOf(movement), () => this.inner.record(movement));
  }

  findById(id: InventoryMovementId, tenantId?: TenantId): Promise<InventoryMovement | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findById(id, tenantId));
  }

  listByItemId(itemId: InventoryItemId, tenantId: TenantId): Promise<InventoryMovement[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.listByItemId(itemId, tenantId));
  }

  listByTenant(tenantId: TenantId, filter?: InventoryMovementListFilter): Promise<InventoryMovement[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.listByTenant(tenantId, filter));
  }

  count(tenantId?: TenantId): Promise<number> {
    return withTenantContext(this.db, tenantId, () => this.inner.count(tenantId));
  }
}

export class TenantScopedPricingRuleRepository implements PricingRuleRepositoryPort {
  constructor(
    private readonly inner: PricingRuleRepositoryPort,
    private readonly db: TenantDb
  ) {}

  save(rule: PricingRule): Promise<void> {
    return withTenantContext(this.db, tenantOf(rule), () => this.inner.save(rule));
  }

  findById(id: PricingRuleId, tenantId?: TenantId): Promise<PricingRule | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findById(id, tenantId));
  }

  findEffective(params: {
    atDate: Date;
    tenantId?: TenantId | undefined;
    ruleId?: PricingRuleId | undefined;
    includeReferenceSamples?: boolean | undefined;
  }): Promise<PricingRule | null> {
    return withTenantContext(this.db, params.tenantId, () => this.inner.findEffective(params));
  }

  listByTenant(tenantId?: TenantId, includeReferenceSamples?: boolean | undefined): Promise<PricingRule[]> {
    return withTenantContext(this.db, tenantId, () =>
      this.inner.listByTenant(tenantId, includeReferenceSamples)
    );
  }

  count(): Promise<number> {
    return withTenantContext(this.db, undefined, () => this.inner.count());
  }
}

export class TenantScopedPricingResultRepository implements PricingResultRepositoryPort {
  constructor(
    private readonly inner: PricingResultRepositoryPort,
    private readonly db: TenantDb
  ) {}

  save(result: PricingResult): Promise<void> {
    return withTenantContext(this.db, tenantOf(result), () => this.inner.save(result));
  }

  findById(id: PricingResultId, tenantId?: TenantId): Promise<PricingResult | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findById(id, tenantId));
  }

  findByTenant(tenantId: TenantId, limit?: number): Promise<PricingResult[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.findByTenant(tenantId, limit));
  }

  count(): Promise<number> {
    return withTenantContext(this.db, undefined, () => this.inner.count());
  }
}

export class TenantScopedSellerProfileRepository implements SellerProfileRepositoryPort {
  constructor(
    private readonly inner: SellerProfileRepositoryPort,
    private readonly db: TenantDb
  ) {}

  save(seller: SellerProfile): Promise<void> {
    return withTenantContext(this.db, tenantOf(seller), () => this.inner.save(seller));
  }

  findById(id: SellerProfileId, tenantId?: TenantId): Promise<SellerProfile | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findById(id, tenantId));
  }

  findBySlug(slug: string): Promise<SellerProfile | null> {
    return withTenantContext(this.db, undefined, () => this.inner.findBySlug(slug));
  }

  findByStoreId(storeId: StoreId, tenantId: TenantId): Promise<SellerProfile | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findByStoreId(storeId, tenantId));
  }

  listByTenant(tenantId: TenantId, filter?: SellerProfileFilter): Promise<SellerProfile[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.listByTenant(tenantId, filter));
  }

  listPublicSellers(filter?: PublicSellerFilter): Promise<SellerProfile[]> {
    return withTenantContext(this.db, undefined, () => this.inner.listPublicSellers(filter));
  }

  count(tenantId?: TenantId): Promise<number> {
    return withTenantContext(this.db, tenantId, () => this.inner.count(tenantId));
  }
}

export class TenantScopedSellerListingRepository implements SellerListingRepositoryPort {
  constructor(
    private readonly inner: SellerListingRepositoryPort,
    private readonly db: TenantDb
  ) {}

  save(listing: SellerListing): Promise<void> {
    return withTenantContext(this.db, tenantOf(listing), () => this.inner.save(listing));
  }

  findById(id: SellerListingId, tenantId?: TenantId): Promise<SellerListing | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findById(id, tenantId));
  }

  findBySellerAndVariant(
    sellerProfileId: SellerProfileId,
    variantId: ProductVariantId,
    tenantId: TenantId
  ): Promise<SellerListing | null> {
    return withTenantContext(this.db, tenantId, () =>
      this.inner.findBySellerAndVariant(sellerProfileId, variantId, tenantId)
    );
  }

  listBySeller(
    sellerProfileId: SellerProfileId,
    tenantId: TenantId,
    filter?: SellerListingFilter
  ): Promise<SellerListing[]> {
    return withTenantContext(this.db, tenantId, () =>
      this.inner.listBySeller(sellerProfileId, tenantId, filter)
    );
  }

  listByTenant(tenantId: TenantId, filter?: SellerListingFilter): Promise<SellerListing[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.listByTenant(tenantId, filter));
  }

  listPublicListings(filter?: PublicListingFilter): Promise<SellerListing[]> {
    return withTenantContext(this.db, undefined, () => this.inner.listPublicListings(filter));
  }

  count(tenantId?: TenantId): Promise<number> {
    return withTenantContext(this.db, tenantId, () => this.inner.count(tenantId));
  }
}

export class TenantScopedSellerWorkspaceRepository implements SellerWorkspaceRepositoryPort {
  constructor(
    private readonly inner: SellerWorkspaceRepositoryPort,
    private readonly db: TenantDb
  ) {}

  save(workspace: SellerWorkspace): Promise<void> {
    return withTenantContext(this.db, tenantOf(workspace), () => this.inner.save(workspace));
  }

  findById(id: SellerWorkspaceId, tenantId?: TenantId): Promise<SellerWorkspace | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findById(id, tenantId));
  }

  findBySellerProfileId(sellerProfileId: SellerProfileId, tenantId: TenantId): Promise<SellerWorkspace | null> {
    return withTenantContext(this.db, tenantId, () =>
      this.inner.findBySellerProfileId(sellerProfileId, tenantId)
    );
  }

  listByTenant(tenantId: TenantId, filter?: SellerWorkspaceFilter): Promise<SellerWorkspace[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.listByTenant(tenantId, filter));
  }

  count(tenantId?: TenantId): Promise<number> {
    return withTenantContext(this.db, tenantId, () => this.inner.count(tenantId));
  }
}

export class TenantScopedInventoryUnitOfWork implements InventoryUnitOfWorkPort {
  constructor(
    private readonly inner: InventoryUnitOfWorkPort,
    private readonly db: TenantDb
  ) {}

  saveItemWithMovement(item: InventoryItem, movement: InventoryMovement): Promise<void> {
    return withTenantContext(this.db, tenantOf(item), () => this.inner.saveItemWithMovement(item, movement));
  }
}

export class TenantScopedDesignSessionRepository implements DesignSessionRepositoryPort {
  constructor(
    private readonly inner: DesignSessionRepositoryPort,
    private readonly db: TenantDb
  ) {}

  save(session: DesignSession): Promise<void> {
    return withTenantContext(this.db, tenantOf(session), () => this.inner.save(session));
  }

  findById(id: DesignSessionId, tenantId?: TenantId): Promise<DesignSession | null> {
    return withTenantContext(this.db, tenantId, () => this.inner.findById(id, tenantId));
  }

  listByTenant(tenantId: TenantId, limit?: number): Promise<DesignSession[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.listByTenant(tenantId, limit));
  }

  findByUser(tenantId: TenantId, userId: string): Promise<DesignSession[]> {
    return withTenantContext(this.db, tenantId, () => this.inner.findByUser(tenantId, userId));
  }

  delete(id: DesignSessionId, tenantId?: TenantId): Promise<void> {
    return withTenantContext(this.db, tenantId, () => this.inner.delete(id, tenantId));
  }

  count(tenantId?: TenantId): Promise<number> {
    return withTenantContext(this.db, tenantId, () => this.inner.count(tenantId));
  }
}
