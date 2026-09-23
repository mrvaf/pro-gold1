import { describe, expect, it } from 'vitest';
import {
  Product,
  ProductVariant,
  SKU,
  Weight,
  GoldPurity,
  MaterialSpecification,
  JewelrySpecification,
  Store,
  createEntityId,
  type TenantId,
  type StoreId,
  ForbiddenError,
  ConflictError,
  NotFoundError,
  BusinessRuleViolationError,
  SellerSuspendedError,
} from '@v-gold/core';
import {
  InMemorySellerProfileRepository,
  InMemorySellerListingRepository,
  InMemoryProductRepository,
  InMemoryProductVariantRepository,
  InMemoryStoreRepository,
} from '@v-gold/database';
import { SellerMarketplaceService } from '../apps/web/lib/marketplace/seller-marketplace.service.js';

describe('Stage 7: Marketplace Service, Invariants & Multi-Tenant Isolation', () => {
  const tenantA = createEntityId<TenantId>('tenant_alpha_goldsmith');
  const tenantB = createEntityId<TenantId>('tenant_beta_jeweler');

  const createFixtures = async () => {
    const sellerRepo = new InMemorySellerProfileRepository();
    const listingRepo = new InMemorySellerListingRepository();
    const storeRepo = new InMemoryStoreRepository();
    const productRepo = new InMemoryProductRepository();
    const variantRepo = new InMemoryProductVariantRepository();

    const service = new SellerMarketplaceService(
      sellerRepo,
      listingRepo,
      storeRepo,
      productRepo,
      variantRepo
    );

    // Seed Stores
    const storeA = Store.create({
      tenantId: tenantA,
      name: 'Alpha Grand Bazaar Store',
      code: 'ALPHA_BAZAAR_01',
    }).unwrap();
    await storeRepo.save(tenantA, storeA);

    const storeB = Store.create({
      tenantId: tenantB,
      name: 'Beta Boutique Store',
      code: 'BETA_BOUTIQUE_01',
    }).unwrap();
    await storeRepo.save(tenantB, storeB);

    // Seed Product & Variant for Tenant A
    const productA = Product.create({
      tenantId: tenantA,
      name: 'Royal Filigree Ring',
      productType: 'RING',
    }).unwrap();
    await productRepo.save(productA);

    const goldWeight = Weight.fromGrams('8.500000').unwrap();
    const metal = MaterialSpecification.gold(GoldPurity.K18, goldWeight).unwrap();
    const spec = JewelrySpecification.create({
      jewelryType: 'RING',
      metal,
      grossWeight: goldWeight,
    }).unwrap();

    const variantA = ProductVariant.create({
      productId: productA.id,
      tenantId: tenantA,
      sku: SKU.create('ALPHA-RING-18K-01').unwrap(),
      name: 'Royal Ring Size 54',
      specification: spec,
    }).unwrap();
    await variantRepo.save(variantA);

    // Seed Product & Variant for Tenant B
    const productB = Product.create({
      tenantId: tenantB,
      name: 'Beta Solitaire Pendant',
      productType: 'PENDANT',
    }).unwrap();
    await productRepo.save(productB);

    const variantB = ProductVariant.create({
      productId: productB.id,
      tenantId: tenantB,
      sku: SKU.create('BETA-PND-18K-01').unwrap(),
      name: 'Beta Pendant 18K',
      specification: spec,
    }).unwrap();
    await variantRepo.save(variantB);

    return {
      service,
      sellerRepo,
      listingRepo,
      storeRepo,
      productRepo,
      variantRepo,
      storeA,
      storeB,
      productA,
      productB,
      variantA,
      variantB,
    };
  };

  describe('Store Ownership Verification', () => {
    it('rejects seller creation if storeId belongs to a different tenant', async () => {
      const { service, storeB } = await createFixtures();

      // Tenant A attempts to link their seller profile to Tenant B's store
      const res = await service.createSellerProfile({
        tenantId: tenantA,
        storeId: storeB.id,
        displayName: 'Alpha Artisan House',
        slug: 'alpha-artisan-house',
      });

      expect(res.isErr).toBe(true);
      if (res.isErr) {
        expect(res.error).toBeInstanceOf(ForbiddenError);
        expect(res.error.message).toContain('does not belong to tenant');
      }
    });

    it('rejects updating seller profile storeId to a different tenant store', async () => {
      const { service, storeA, storeB } = await createFixtures();

      const seller = (
        await service.createSellerProfile({
          tenantId: tenantA,
          storeId: storeA.id,
          displayName: 'Alpha Artisan House',
          slug: 'alpha-artisan-house',
        })
      ).unwrap();

      // Tenant A attempts to update storeId to Tenant B's store
      const updateRes = await service.updateSellerProfile({
        id: seller.id,
        tenantId: tenantA,
        storeId: storeB.id,
      });

      expect(updateRes.isErr).toBe(true);
      if (updateRes.isErr) {
        expect(updateRes.error).toBeInstanceOf(ForbiddenError);
      }
    });
  });

  describe('Global Marketplace Slug Uniqueness', () => {
    it('rejects seller profile creation when slug is already taken by another merchant', async () => {
      const { service, storeA } = await createFixtures();

      // Tenant A registers 'royal-goldsmiths'
      const first = await service.createSellerProfile({
        tenantId: tenantA,
        storeId: storeA.id,
        displayName: 'Royal Goldsmiths Alpha',
        slug: 'royal-goldsmiths',
      });
      expect(first.isOk).toBe(true);

      // Tenant B attempts to also register 'royal-goldsmiths'
      const duplicate = await service.createSellerProfile({
        tenantId: tenantB,
        displayName: 'Royal Goldsmiths Beta',
        slug: 'royal-goldsmiths',
      });

      expect(duplicate.isErr).toBe(true);
      if (duplicate.isErr) {
        expect(duplicate.error).toBeInstanceOf(ConflictError);
        expect(duplicate.error.message).toContain('already taken');
      }
    });
  });

  describe('Listing Catalog Ownership & Integrity', () => {
    it('rejects listing creation if Product belongs to a different tenant', async () => {
      const { service, storeA, productB, variantA } = await createFixtures();

      const seller = (
        await service.createSellerProfile({
          tenantId: tenantA,
          storeId: storeA.id,
          displayName: 'Alpha Artisan House',
          slug: 'alpha-artisan-house',
          initialStatus: 'ACTIVE',
        })
      ).unwrap();

      // Tenant A attempts to list Product B (belongs to Tenant B)
      const res = await service.createListing({
        tenantId: tenantA,
        sellerProfileId: seller.id,
        productId: productB.id, // Tenant B product!
        productVariantId: variantA.id,
        title: 'Unauthorized Cross-Tenant Listing',
      });

      expect(res.isErr).toBe(true);
      if (res.isErr) {
        expect(res.error).toBeInstanceOf(ForbiddenError);
      }
    });

    it('rejects listing creation if ProductVariant belongs to a different tenant', async () => {
      const { service, storeA, productA, variantB } = await createFixtures();

      const seller = (
        await service.createSellerProfile({
          tenantId: tenantA,
          storeId: storeA.id,
          displayName: 'Alpha Artisan House',
          slug: 'alpha-artisan-house',
          initialStatus: 'ACTIVE',
        })
      ).unwrap();

      // Tenant A attempts to list ProductVariant B (belongs to Tenant B)
      const res = await service.createListing({
        tenantId: tenantA,
        sellerProfileId: seller.id,
        productId: productA.id,
        productVariantId: variantB.id, // Tenant B variant!
        title: 'Unauthorized Cross-Tenant Variant Listing',
      });

      expect(res.isErr).toBe(true);
      if (res.isErr) {
        expect(res.error).toBeInstanceOf(ForbiddenError);
      }
    });

    it('rejects listing creation if variant does not belong to specified product', async () => {
      const { service, storeA, productA, productRepo, variantRepo } = await createFixtures();

      // Create a second product under Tenant A
      const secondProductA = Product.create({
        tenantId: tenantA,
        name: 'Second Ring Model',
        productType: 'RING',
      }).unwrap();
      await productRepo.save(secondProductA);

      // Variant belongs to productA, not secondProductA
      const goldWeight = Weight.fromGrams('5.0').unwrap();
      const spec = JewelrySpecification.create({
        jewelryType: 'RING',
        metal: MaterialSpecification.gold(GoldPurity.K18, goldWeight).unwrap(),
        grossWeight: goldWeight,
      }).unwrap();

      const variantA = ProductVariant.create({
        productId: productA.id,
        tenantId: tenantA,
        sku: SKU.create('SPEC-RING-01').unwrap(),
        name: 'Spec Ring',
        specification: spec,
      }).unwrap();
      await variantRepo.save(variantA);

      const seller = (
        await service.createSellerProfile({
          tenantId: tenantA,
          storeId: storeA.id,
          displayName: 'Alpha Artisan House',
          slug: 'alpha-artisan-house',
          initialStatus: 'ACTIVE',
        })
      ).unwrap();

      // Mismatch: passing secondProductA.id with variantA.id
      const res = await service.createListing({
        tenantId: tenantA,
        sellerProfileId: seller.id,
        productId: secondProductA.id,
        productVariantId: variantA.id,
        title: 'Mismatched Product and Variant',
      });

      expect(res.isErr).toBe(true);
      if (res.isErr) {
        expect(res.error).toBeInstanceOf(BusinessRuleViolationError);
        expect(res.error.message).toContain('belongs to product');
      }
    });

    it('rejects duplicate active listing for the same seller and product variant', async () => {
      const { service, storeA, productA, variantA } = await createFixtures();

      const seller = (
        await service.createSellerProfile({
          tenantId: tenantA,
          storeId: storeA.id,
          displayName: 'Alpha Artisan House',
          slug: 'alpha-artisan-house',
          initialStatus: 'ACTIVE',
        })
      ).unwrap();

      const firstListing = await service.createListing({
        tenantId: tenantA,
        sellerProfileId: seller.id,
        productId: productA.id,
        productVariantId: variantA.id,
        title: 'First Active Listing',
        initialStatus: 'ACTIVE',
      });
      expect(firstListing.isOk).toBe(true);

      // Attempt to create duplicate listing for same seller and variant
      const duplicateListing = await service.createListing({
        tenantId: tenantA,
        sellerProfileId: seller.id,
        productId: productA.id,
        productVariantId: variantA.id,
        title: 'Second Listing for same Variant',
      });

      expect(duplicateListing.isErr).toBe(true);
      if (duplicateListing.isErr) {
        expect(duplicateListing.error).toBeInstanceOf(ConflictError);
        expect(duplicateListing.error.message).toContain('already has an active or draft listing');
      }
    });
  });

  describe('Seller Suspension Cascading Invariants', () => {
    it('blocks activating a listing if seller profile is suspended', async () => {
      const { service, storeA, productA, variantA } = await createFixtures();

      const seller = (
        await service.createSellerProfile({
          tenantId: tenantA,
          storeId: storeA.id,
          displayName: 'Alpha Artisan House',
          slug: 'alpha-artisan-house',
          initialStatus: 'ACTIVE',
        })
      ).unwrap();

      // Create draft listing
      const listing = (
        await service.createListing({
          tenantId: tenantA,
          sellerProfileId: seller.id,
          productId: productA.id,
          productVariantId: variantA.id,
          title: 'Draft Ring Listing',
          initialStatus: 'DRAFT',
        })
      ).unwrap();

      // Suspend seller
      await service.transitionSellerStatus({
        id: seller.id,
        tenantId: tenantA,
        targetStatus: 'SUSPENDED',
        reason: 'Compliance check',
      });

      // Attempt to activate listing while seller is suspended
      const activateRes = await service.transitionListingStatus({
        id: listing.id,
        tenantId: tenantA,
        targetStatus: 'ACTIVE',
      });

      expect(activateRes.isErr).toBe(true);
      if (activateRes.isErr) {
        expect(activateRes.error.code).toBe('SELLER_SUSPENDED');
      }
    });
  });

  describe('IDOR & Cross-Tenant Access Prevention', () => {
    it('prevents Tenant B from retrieving or modifying Tenant A seller profile', async () => {
      const { service, storeA } = await createFixtures();

      const sellerA = (
        await service.createSellerProfile({
          tenantId: tenantA,
          storeId: storeA.id,
          displayName: 'Alpha Artisan House',
          slug: 'alpha-artisan-house',
        })
      ).unwrap();

      // Tenant B attempts to read Tenant A seller profile
      const readRes = await service.getSellerProfile(sellerA.id, tenantB);
      expect(readRes.isErr).toBe(true);
      if (readRes.isErr) {
        expect(readRes.error).toBeInstanceOf(ForbiddenError);
      }

      // Tenant B attempts to update Tenant A seller profile
      const updateRes = await service.updateSellerProfile({
        id: sellerA.id,
        tenantId: tenantB,
        displayName: 'Hacked by Beta',
      });
      expect(updateRes.isErr).toBe(true);
      if (updateRes.isErr) {
        expect(updateRes.error).toBeInstanceOf(ForbiddenError);
      }
    });

    it('prevents Tenant B from retrieving or modifying Tenant A listing', async () => {
      const { service, storeA, productA, variantA } = await createFixtures();

      const sellerA = (
        await service.createSellerProfile({
          tenantId: tenantA,
          storeId: storeA.id,
          displayName: 'Alpha Artisan House',
          slug: 'alpha-artisan-house',
          initialStatus: 'ACTIVE',
        })
      ).unwrap();

      const listingA = (
        await service.createListing({
          tenantId: tenantA,
          sellerProfileId: sellerA.id,
          productId: productA.id,
          productVariantId: variantA.id,
          title: 'Alpha Exclusive Ring',
        })
      ).unwrap();

      // Tenant B attempts to read listing
      const readRes = await service.getListing(listingA.id, tenantB);
      expect(readRes.isErr).toBe(true);
      if (readRes.isErr) {
        expect(readRes.error).toBeInstanceOf(ForbiddenError);
      }

      // Tenant B attempts to update listing
      const updateRes = await service.updateListing({
        id: listingA.id,
        tenantId: tenantB,
        title: 'Hijacked Title',
      });
      expect(updateRes.isErr).toBe(true);
      if (updateRes.isErr) {
        expect(updateRes.error).toBeInstanceOf(ForbiddenError);
      }
    });
  });

  describe('Suspension Cascading into Public Discovery', () => {
    it('instantly suppresses active listings from public discovery when seller is suspended or unlisted', async () => {
      const { service, storeA, productA, variantA } = await createFixtures();

      const seller = (
        await service.createSellerProfile({
          tenantId: tenantA,
          storeId: storeA.id,
          displayName: 'Alpha Artisan House',
          slug: 'alpha-artisan-house',
          initialStatus: 'ACTIVE',
          isPubliclyVisible: true,
        })
      ).unwrap();

      const listing = (
        await service.createListing({
          tenantId: tenantA,
          sellerProfileId: seller.id,
          productId: productA.id,
          productVariantId: variantA.id,
          title: 'Discoverable 18K Ring',
          initialStatus: 'ACTIVE',
          visibility: 'PUBLIC',
        })
      ).unwrap();

      // 1. Initial State: Seller is ACTIVE, Listing is ACTIVE -> Must be in public feed
      let publicFeed = await service.listPublicListings();
      expect(publicFeed.length).toBe(1);
      expect(publicFeed[0].id).toBe(listing.id);

      // 2. Suspend the seller
      await service.transitionSellerStatus({
        id: seller.id,
        tenantId: tenantA,
        targetStatus: 'SUSPENDED',
        reason: 'Compliance audit pending',
      });

      // Public feed MUST exclude listing even though listing.status is still ACTIVE!
      publicFeed = await service.listPublicListings();
      expect(publicFeed.length).toBe(0);

      // Public seller profile MUST return 404
      const sellerProfileRes = await service.getPublicSellerBySlug('alpha-artisan-house');
      expect(sellerProfileRes.isErr).toBe(true);
      if (sellerProfileRes.isErr) {
        expect(sellerProfileRes.error).toBeInstanceOf(NotFoundError);
      }

      // 3. Reinstate the seller: Seller becomes ACTIVE again -> Listing is discoverable again!
      await service.transitionSellerStatus({
        id: seller.id,
        tenantId: tenantA,
        targetStatus: 'ACTIVE',
      });

      publicFeed = await service.listPublicListings();
      expect(publicFeed.length).toBe(1);
      expect(publicFeed[0].id).toBe(listing.id);

      // 4. Seller toggles isPubliclyVisible to false -> Excluded from public discovery
      await service.updateSellerProfile({
        id: seller.id,
        tenantId: tenantA,
        isPubliclyVisible: false,
      });

      publicFeed = await service.listPublicListings();
      expect(publicFeed.length).toBe(0);
    });
  });

  describe('Non-Archived Listing Uniqueness Semantics', () => {
    it('permits creating a new listing for a variant if the previous listing was ARCHIVED', async () => {
      const { service, storeA, productA, variantA } = await createFixtures();

      const seller = (
        await service.createSellerProfile({
          tenantId: tenantA,
          storeId: storeA.id,
          displayName: 'Alpha Artisan House',
          slug: 'alpha-artisan-house',
          initialStatus: 'ACTIVE',
        })
      ).unwrap();

      // 1. Create first listing
      const firstListing = (
        await service.createListing({
          tenantId: tenantA,
          sellerProfileId: seller.id,
          productId: productA.id,
          productVariantId: variantA.id,
          title: 'First Active Listing',
          initialStatus: 'ACTIVE',
        })
      ).unwrap();

      // 2. Attempt duplicate non-archived listing -> Rejected with ConflictError
      const duplicateRes = await service.createListing({
        tenantId: tenantA,
        sellerProfileId: seller.id,
        productId: productA.id,
        productVariantId: variantA.id,
        title: 'Attempt Duplicate Non-Archived Listing',
      });
      expect(duplicateRes.isErr).toBe(true);
      if (duplicateRes.isErr) {
        expect(duplicateRes.error).toBeInstanceOf(ConflictError);
      }

      // 3. Archive the first listing
      await service.transitionListingStatus({
        id: firstListing.id,
        tenantId: tenantA,
        targetStatus: 'ARCHIVED',
        reason: 'End of seasonal collection',
      });

      // 4. Create new listing for the same variant -> SUCCEEDS because old listing is ARCHIVED!
      const replacementListingRes = await service.createListing({
        tenantId: tenantA,
        sellerProfileId: seller.id,
        productId: productA.id,
        productVariantId: variantA.id,
        title: 'Replacement Seasonal Listing',
        initialStatus: 'ACTIVE',
      });

      expect(replacementListingRes.isOk).toBe(true);
      if (replacementListingRes.isOk) {
        expect(replacementListingRes.value.id).not.toBe(firstListing.id);
        expect(replacementListingRes.value.status).toBe('ACTIVE');
      }
    });
  });
});
