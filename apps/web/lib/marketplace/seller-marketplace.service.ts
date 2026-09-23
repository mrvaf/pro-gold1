import {
  type SellerProfileRepositoryPort,
  type SellerListingRepositoryPort,
  type StoreRepositoryPort,
  type ProductRepositoryPort,
  type ProductVariantRepositoryPort,
  type SellerProfileFilter,
  type PublicSellerFilter,
  type SellerListingFilter,
  type PublicListingFilter,
  SellerProfile,
  SellerListing,
  type SellerProfileId,
  type SellerListingId,
  type SellerStatus,
  type ListingStatus,
  type ListingVisibility,
  type TenantId,
  type StoreId,
  type ProductId,
  type ProductVariantId,
  createEntityId,
  ActorReference,
  ValidationError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BusinessRuleViolationError,
  type Result,
  ok,
  err,
  SellerSuspendedError,
  InvalidSellerStateError,
  InvalidListingStateError,
} from '@v-gold/core';

export interface CreateSellerProfileInput {
  tenantId: string;
  storeId?: string | undefined;
  displayName: string;
  slug: string;
  bio?: string | undefined;
  logoUrl?: string | undefined;
  bannerUrl?: string | undefined;
  isPubliclyVisible?: boolean | undefined;
  businessRegistrationNumber?: string | undefined;
  taxId?: string | undefined;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  initialStatus?: SellerStatus | undefined;
  actorId?: string | undefined;
}

export interface UpdateSellerProfileInput {
  id: string;
  tenantId: string;
  storeId?: string | undefined;
  displayName?: string | undefined;
  bio?: string | undefined;
  logoUrl?: string | undefined;
  bannerUrl?: string | undefined;
  isPubliclyVisible?: boolean | undefined;
  businessRegistrationNumber?: string | undefined;
  taxId?: string | undefined;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
  actorId?: string | undefined;
}

export interface TransitionSellerStatusInput {
  id: string;
  tenantId: string;
  targetStatus: SellerStatus;
  reason?: string | undefined;
  actorId?: string | undefined;
}

export interface CreateListingInput {
  tenantId: string;
  sellerProfileId: string;
  productId: string;
  productVariantId: string;
  title: string;
  slug?: string | undefined;
  description?: string | undefined;
  initialStatus?: ListingStatus | undefined;
  visibility?: ListingVisibility | undefined;
  tags?: string[] | undefined;
  actorId?: string | undefined;
}

export interface UpdateListingInput {
  id: string;
  tenantId: string;
  title?: string | undefined;
  description?: string | undefined;
  tags?: string[] | undefined;
  visibility?: ListingVisibility | undefined;
  actorId?: string | undefined;
}

export interface TransitionListingStatusInput {
  id: string;
  tenantId: string;
  targetStatus: ListingStatus;
  reason?: string | undefined;
  actorId?: string | undefined;
}

export class SellerMarketplaceService {
  constructor(
    private readonly sellerRepo: SellerProfileRepositoryPort,
    private readonly listingRepo: SellerListingRepositoryPort,
    private readonly storeRepo?: StoreRepositoryPort,
    private readonly productRepo?: ProductRepositoryPort,
    private readonly variantRepo?: ProductVariantRepositoryPort
  ) {}

  async createSellerProfile(
    input: CreateSellerProfileInput
  ): Promise<Result<SellerProfile, ValidationError | ConflictError | ForbiddenError>> {
    const tenantId = createEntityId<TenantId>(input.tenantId);
    const storeId = input.storeId ? createEntityId<StoreId>(input.storeId) : undefined;
    const actor = input.actorId
      ? ActorReference.user(input.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    // 1. Verify store ownership: if storeId is provided, store must belong to the tenant
    if (storeId && this.storeRepo) {
      const store = await this.storeRepo.findById(tenantId, storeId);
      if (!store) {
        return err(
          new ForbiddenError(
            `Store "${input.storeId}" does not exist or does not belong to tenant "${input.tenantId}".`
          )
        );
      }
    }

    // 2. Verify global slug uniqueness across all marketplace seller storefronts
    const existingSellerWithSlug = await this.sellerRepo.findBySlug(input.slug);
    if (existingSellerWithSlug) {
      return err(
        new ConflictError(`Marketplace slug "${input.slug}" is already taken by another seller profile.`)
      );
    }

    // 3. Create SellerProfile domain entity
    const profileRes = SellerProfile.create({
      tenantId,
      storeId,
      displayName: input.displayName,
      slug: input.slug,
      bio: input.bio,
      logoUrl: input.logoUrl,
      bannerUrl: input.bannerUrl,
      isPubliclyVisible: input.isPubliclyVisible,
      businessRegistrationNumber: input.businessRegistrationNumber,
      taxId: input.taxId,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      metadata: input.metadata,
      initialStatus: input.initialStatus ?? 'DRAFT',
      actor,
    });

    if (profileRes.isErr) {
      return err(profileRes.error);
    }

    const profile = profileRes.value;
    await this.sellerRepo.save(profile);
    return ok(profile);
  }

  async getSellerProfile(
    id: string,
    tenantId: string
  ): Promise<Result<SellerProfile, NotFoundError | ForbiddenError>> {
    const sellerId = createEntityId<SellerProfileId>(id);
    const tenId = createEntityId<TenantId>(tenantId);

    const profile = await this.sellerRepo.findById(sellerId, tenId);
    if (!profile) {
      const anyProfile = await this.sellerRepo.findById(sellerId);
      if (anyProfile && anyProfile.tenantId !== tenId) {
        return err(new ForbiddenError('Access to seller profile from a different tenant is denied.'));
      }
      return err(new NotFoundError(`Seller profile "${id}" not found.`));
    }

    return ok(profile);
  }

  async getPublicSellerBySlug(slug: string): Promise<Result<SellerProfile, NotFoundError>> {
    const profile = await this.sellerRepo.findBySlug(slug);
    if (!profile || profile.status !== 'ACTIVE' || !profile.presence.isPubliclyVisible) {
      return err(new NotFoundError(`Public seller profile "${slug}" not found or inactive.`));
    }
    return ok(profile);
  }

  async listSellerProfiles(
    tenantId: string,
    filter?: SellerProfileFilter
  ): Promise<SellerProfile[]> {
    const tenId = createEntityId<TenantId>(tenantId);
    return this.sellerRepo.listByTenant(tenId, filter);
  }

  async listPublicSellers(filter?: PublicSellerFilter): Promise<SellerProfile[]> {
    return this.sellerRepo.listPublicSellers(filter);
  }

  async updateSellerProfile(
    input: UpdateSellerProfileInput
  ): Promise<Result<SellerProfile, NotFoundError | ForbiddenError | ValidationError>> {
    const fetchRes = await this.getSellerProfile(input.id, input.tenantId);
    if (fetchRes.isErr) return err(fetchRes.error);

    const profile = fetchRes.value;
    const actor = input.actorId
      ? ActorReference.user(input.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    // Store update verification
    if (input.storeId !== undefined) {
      if (input.storeId === null || input.storeId === '') {
        profile.setStoreId(undefined, actor);
      } else {
        const storeId = createEntityId<StoreId>(input.storeId);
        if (this.storeRepo) {
          const store = await this.storeRepo.findById(profile.tenantId, storeId);
          if (!store) {
            return err(
              new ForbiddenError(
                `Store "${input.storeId}" does not exist or does not belong to tenant "${input.tenantId}".`
              )
            );
          }
        }
        profile.setStoreId(storeId, actor);
      }
    }

    // Presence update
    if (
      input.displayName !== undefined ||
      input.bio !== undefined ||
      input.logoUrl !== undefined ||
      input.bannerUrl !== undefined ||
      input.isPubliclyVisible !== undefined
    ) {
      const presenceRes = profile.updatePresence(
        input.displayName ?? profile.displayName,
        input.bio !== undefined ? input.bio : profile.presence.bio,
        input.logoUrl !== undefined ? input.logoUrl : profile.presence.logoUrl,
        input.bannerUrl !== undefined ? input.bannerUrl : profile.presence.bannerUrl,
        input.isPubliclyVisible !== undefined ? input.isPubliclyVisible : profile.presence.isPubliclyVisible,
        actor
      );
      if (presenceRes.isErr) return err(presenceRes.error);
    }

    // Contact info update
    profile.updateContactInfo(
      {
        businessRegistrationNumber: input.businessRegistrationNumber,
        taxId: input.taxId,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
      },
      actor
    );

    await this.sellerRepo.save(profile);
    return ok(profile);
  }

  async transitionSellerStatus(
    input: TransitionSellerStatusInput
  ): Promise<Result<SellerProfile, NotFoundError | ForbiddenError | InvalidSellerStateError>> {
    const fetchRes = await this.getSellerProfile(input.id, input.tenantId);
    if (fetchRes.isErr) return err(fetchRes.error);

    const profile = fetchRes.value;
    const actor = input.actorId
      ? ActorReference.user(input.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    let transitionRes: Result<void, InvalidSellerStateError>;
    switch (input.targetStatus) {
      case 'ACTIVE':
        transitionRes = profile.status === 'SUSPENDED' ? profile.reinstate(actor) : profile.activate(actor);
        break;
      case 'SUSPENDED':
        transitionRes = profile.suspend(actor, input.reason);
        break;
      case 'ARCHIVED':
        transitionRes = profile.archive(actor, input.reason);
        break;
      default:
        return err(
          new InvalidSellerStateError(`Unsupported direct status transition target: "${input.targetStatus}".`)
        );
    }

    if (transitionRes.isErr) return err(transitionRes.error);

    await this.sellerRepo.save(profile);
    return ok(profile);
  }

  async createListing(
    input: CreateListingInput
  ): Promise<
    Result<
      SellerListing,
      | ValidationError
      | ConflictError
      | NotFoundError
      | ForbiddenError
      | SellerSuspendedError
      | InvalidListingStateError
      | BusinessRuleViolationError
    >
  > {
    const tenId = createEntityId<TenantId>(input.tenantId);
    const sellerId = createEntityId<SellerProfileId>(input.sellerProfileId);
    const prodId = createEntityId<ProductId>(input.productId);
    const varId = createEntityId<ProductVariantId>(input.productVariantId);

    // 1. Verify SellerProfile exists and belongs to same tenant
    const sellerRes = await this.getSellerProfile(input.sellerProfileId, input.tenantId);
    if (sellerRes.isErr) return err(sellerRes.error);
    const seller = sellerRes.value;

    // 2. Verify parent Product exists and belongs to same tenant
    if (this.productRepo) {
      const product = await this.productRepo.findById(prodId, tenId);
      if (!product) {
        const anyProd = await this.productRepo.findById(prodId);
        if (anyProd && anyProd.tenantId !== tenId) {
          return err(new ForbiddenError('Access to product from a different tenant is denied.'));
        }
        return err(new NotFoundError(`Product "${input.productId}" not found.`));
      }
    }

    // 3. Verify ProductVariant exists, belongs to same tenant, and belongs to parent Product
    if (this.variantRepo) {
      const variant = await this.variantRepo.findById(varId, tenId);
      if (!variant) {
        const anyVar = await this.variantRepo.findById(varId);
        if (anyVar && anyVar.tenantId !== tenId) {
          return err(new ForbiddenError('Access to variant from a different tenant is denied.'));
        }
        return err(new NotFoundError(`Variant "${input.productVariantId}" not found.`));
      }
      if (variant.productId !== prodId) {
        return err(
          new BusinessRuleViolationError(
            `Variant "${input.productVariantId}" belongs to product "${variant.productId}", not "${input.productId}".`
          )
        );
      }
    }

    // 4. Verify no active duplicate listing exists for this seller and variant
    const existingListing = await this.listingRepo.findBySellerAndVariant(sellerId, varId, tenId);
    if (existingListing && existingListing.status !== 'ARCHIVED') {
      return err(
        new ConflictError(
          `Seller profile "${input.sellerProfileId}" already has an active or draft listing for variant "${input.productVariantId}".`
        )
      );
    }

    // 5. Build entity
    const actor = input.actorId
      ? ActorReference.user(input.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    const listingRes = SellerListing.create({
      tenantId: tenId,
      sellerProfileId: sellerId,
      productId: prodId,
      productVariantId: varId,
      title: input.title,
      slug: input.slug,
      description: input.description,
      initialStatus: input.initialStatus ?? 'DRAFT',
      visibility: input.visibility ?? 'PUBLIC',
      tags: input.tags,
      sellerStatus: seller.status,
      actor,
    });

    if (listingRes.isErr) return err(listingRes.error);

    const listing = listingRes.value;
    await this.listingRepo.save(listing);
    return ok(listing);
  }

  async getListing(
    id: string,
    tenantId: string
  ): Promise<Result<SellerListing, NotFoundError | ForbiddenError>> {
    const listId = createEntityId<SellerListingId>(id);
    const tenId = createEntityId<TenantId>(tenantId);

    const listing = await this.listingRepo.findById(listId, tenId);
    if (!listing) {
      const anyListing = await this.listingRepo.findById(listId);
      if (anyListing && anyListing.tenantId !== tenId) {
        return err(new ForbiddenError('Access to listing from a different tenant is denied.'));
      }
      return err(new NotFoundError(`Listing "${id}" not found.`));
    }

    return ok(listing);
  }

  async listListingsBySeller(
    sellerProfileId: string,
    tenantId: string,
    filter?: SellerListingFilter
  ): Promise<Result<SellerListing[], NotFoundError | ForbiddenError>> {
    const sellerRes = await this.getSellerProfile(sellerProfileId, tenantId);
    if (sellerRes.isErr) return err(sellerRes.error);

    const list = await this.listingRepo.listBySeller(
      createEntityId<SellerProfileId>(sellerProfileId),
      createEntityId<TenantId>(tenantId),
      filter
    );
    return ok(list);
  }

  async listListingsByTenant(tenantId: string, filter?: SellerListingFilter): Promise<SellerListing[]> {
    const tenId = createEntityId<TenantId>(tenantId);
    return this.listingRepo.listByTenant(tenId, filter);
  }

  async listPublicListings(filter?: PublicListingFilter): Promise<SellerListing[]> {
    return this.listingRepo.listPublicListings(filter);
  }

  async updateListing(
    input: UpdateListingInput
  ): Promise<Result<SellerListing, NotFoundError | ForbiddenError | ValidationError>> {
    const fetchRes = await this.getListing(input.id, input.tenantId);
    if (fetchRes.isErr) return err(fetchRes.error);

    const listing = fetchRes.value;
    const actor = input.actorId
      ? ActorReference.user(input.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    const updateRes = listing.updateDisplay(
      input.title ?? listing.title,
      input.description !== undefined ? input.description : listing.description,
      input.tags !== undefined ? input.tags : [...listing.tags],
      input.visibility !== undefined ? input.visibility : listing.visibility,
      actor
    );

    if (updateRes.isErr) return err(updateRes.error);

    await this.listingRepo.save(listing);
    return ok(listing);
  }

  async transitionListingStatus(
    input: TransitionListingStatusInput
  ): Promise<
    Result<
      SellerListing,
      NotFoundError | ForbiddenError | InvalidListingStateError | SellerSuspendedError
    >
  > {
    const fetchRes = await this.getListing(input.id, input.tenantId);
    if (fetchRes.isErr) return err(fetchRes.error);

    const listing = fetchRes.value;
    const actor = input.actorId
      ? ActorReference.user(input.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    // Fetch parent seller profile to verify its status for activation/resumption
    const sellerRes = await this.getSellerProfile(listing.sellerProfileId, input.tenantId);
    if (sellerRes.isErr) return err(sellerRes.error);
    const seller = sellerRes.value;

    let transitionRes: Result<void, InvalidListingStateError | SellerSuspendedError>;
    switch (input.targetStatus) {
      case 'ACTIVE':
        transitionRes = listing.status === 'PAUSED'
          ? listing.resume(seller.status, actor)
          : listing.activate(seller.status, actor);
        break;
      case 'PAUSED':
        transitionRes = listing.pause(actor, input.reason);
        break;
      case 'ARCHIVED':
        transitionRes = listing.archive(actor, input.reason);
        break;
      default:
        return err(
          new InvalidListingStateError(
            `Unsupported direct listing status transition target: "${input.targetStatus}".`
          )
        );
    }

    if (transitionRes.isErr) return err(transitionRes.error);

    await this.listingRepo.save(listing);
    return ok(listing);
  }
}
