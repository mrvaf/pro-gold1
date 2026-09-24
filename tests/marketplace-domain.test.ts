import { describe, expect, it } from 'vitest';
import {
  SellerSlug,
  SellerProfile,
  SellerListing,
  SellerMarketplacePresence,
  SellerStateMachine,
  ListingStateMachine,
  createEntityId,
  type TenantId,
  type StoreId,
  type ProductId,
  type ProductVariantId,
  ActorReference,
  ValidationError,
  ROLE_PERMISSIONS,
  hasPermission,
} from '@v-gold/core';

describe('Stage 7: Marketplace Domain & State Invariants', () => {
  const tenantA = createEntityId<TenantId>('tenant_alpha_goldsmith');
  const actorUser = ActorReference.user('user_artisan_01').unwrap();

  describe('SellerSlug Value Object', () => {
    it('accepts valid, normalized URL-safe slugs', () => {
      const slugRes = SellerSlug.create('royal-persian-gold');
      expect(slugRes.isOk).toBe(true);
      if (slugRes.isOk) {
        expect(slugRes.value.value).toBe('royal-persian-gold');
        expect(slugRes.value.toString()).toBe('royal-persian-gold');
      }
    });

    it('normalizes uppercase and trims whitespace', () => {
      const slugRes = SellerSlug.create('  Tehran-Bazaar-Goldsmith  ');
      expect(slugRes.isOk).toBe(true);
      if (slugRes.isOk) {
        expect(slugRes.value.value).toBe('tehran-bazaar-goldsmith');
      }
    });

    it('rejects slugs that are too short or too long', () => {
      const tooShort = SellerSlug.create('ab');
      expect(tooShort.isErr).toBe(true);
      if (tooShort.isErr) {
        expect(tooShort.error).toBeInstanceOf(ValidationError);
        expect(tooShort.error.message).toContain('between 3 and 64');
      }

      const tooLong = SellerSlug.create('a'.repeat(65));
      expect(tooLong.isErr).toBe(true);
    });

    it('rejects slugs with invalid characters or consecutive hyphens', () => {
      const invalidChars = SellerSlug.create('royal_gold_#1');
      expect(invalidChars.isErr).toBe(true);

      const consecutiveHyphens = SellerSlug.create('royal--gold');
      expect(consecutiveHyphens.isErr).toBe(true);

      const leadingHyphen = SellerSlug.create('-royal-gold');
      expect(leadingHyphen.isErr).toBe(true);
    });

    it('rejects reserved system keywords', () => {
      const reserved = ['admin', 'api', 'auth', 'dashboard', 'marketplace', 'checkout', 'vgold'];
      for (const kw of reserved) {
        const res = SellerSlug.create(kw);
        expect(res.isErr).toBe(true);
        if (res.isErr) {
          expect(res.error.message).toContain('reserved by the platform');
        }
      }
    });

    it('creates slug from arbitrary string using fromString helper', () => {
      const res = SellerSlug.fromString('  Zargari & Javaheri Arya 18K!!  ');
      expect(res.isOk).toBe(true);
      if (res.isOk) {
        expect(res.value.value).toBe('zargari-javaheri-arya-18k');
      }
    });
  });

  describe('Seller Marketplace Presence', () => {
    it('creates presence with valid attributes', () => {
      const presenceRes = SellerMarketplacePresence.create({
        displayName: 'Arya Jewelry House',
        slug: 'arya-jewelry-house',
        bio: 'Master goldsmiths crafting 18K filigree jewelry since 1988.',
        logoUrl: 'https://cdn.v-gold.com/logos/arya.png',
        bannerUrl: 'https://cdn.v-gold.com/banners/arya.jpg',
        isPubliclyVisible: true,
      });

      expect(presenceRes.isOk).toBe(true);
      if (presenceRes.isOk) {
        const presence = presenceRes.value;
        expect(presence.displayName).toBe('Arya Jewelry House');
        expect(presence.slug.value).toBe('arya-jewelry-house');
        expect(presence.bio).toContain('Master goldsmiths');
        expect(presence.isPubliclyVisible).toBe(true);
      }
    });

    it('rejects empty display name or bio exceeding 2000 chars', () => {
      const emptyName = SellerMarketplacePresence.create({
        displayName: ' ',
        slug: 'valid-slug',
      });
      expect(emptyName.isErr).toBe(true);

      const hugeBio = SellerMarketplacePresence.create({
        displayName: 'Valid Name',
        slug: 'valid-slug',
        bio: 'x'.repeat(2001),
      });
      expect(hugeBio.isErr).toBe(true);
    });
  });

  describe('Seller State Machine & Lifecycle', () => {
    it('allows legal transitions: DRAFT -> ACTIVE -> SUSPENDED -> ACTIVE -> ARCHIVED', () => {
      expect(SellerStateMachine.canTransition('DRAFT', 'ACTIVE')).toBe(true);
      expect(SellerStateMachine.canTransition('ACTIVE', 'SUSPENDED')).toBe(true);
      expect(SellerStateMachine.canTransition('SUSPENDED', 'ACTIVE')).toBe(true);
      expect(SellerStateMachine.canTransition('ACTIVE', 'ARCHIVED')).toBe(true);
      expect(SellerStateMachine.canTransition('DRAFT', 'ARCHIVED')).toBe(true);
      expect(SellerStateMachine.canTransition('SUSPENDED', 'ARCHIVED')).toBe(true);
    });

    it('strictly forbids illegal transitions: ARCHIVED -> ACTIVE, DRAFT -> SUSPENDED', () => {
      expect(SellerStateMachine.canTransition('ARCHIVED', 'ACTIVE')).toBe(false);
      expect(SellerStateMachine.canTransition('ARCHIVED', 'DRAFT')).toBe(false);
      expect(SellerStateMachine.canTransition('DRAFT', 'SUSPENDED')).toBe(false);
    });

    it('enforces transitions on SellerProfile entity', () => {
      const seller = SellerProfile.create({
        tenantId: tenantA,
        displayName: 'Golestan Gold Atelier',
        slug: 'golestan-gold-atelier',
        actor: actorUser,
      }).unwrap();

      expect(seller.status).toBe('DRAFT');
      expect(seller.isActive).toBe(false);

      // DRAFT -> ACTIVE
      const actRes = seller.activate(actorUser);
      expect(actRes.isOk).toBe(true);
      expect(seller.status).toBe('ACTIVE');
      expect(seller.isActive).toBe(true);

      // ACTIVE -> SUSPENDED
      const suspRes = seller.suspend(actorUser, 'Audit inspection hold');
      expect(suspRes.isOk).toBe(true);
      expect(seller.status).toBe('SUSPENDED');
      expect(seller.isActive).toBe(false);

      // SUSPENDED -> ACTIVE (Reinstate)
      const reinRes = seller.reinstate(actorUser);
      expect(reinRes.isOk).toBe(true);
      expect(seller.status).toBe('ACTIVE');

      // ACTIVE -> ARCHIVED
      const archRes = seller.archive(actorUser, 'Merchant retired');
      expect(archRes.isOk).toBe(true);
      expect(seller.status).toBe('ARCHIVED');

      // ARCHIVED -> ACTIVE (Forbidden)
      const invalidAct = seller.activate(actorUser);
      expect(invalidAct.isErr).toBe(true);
      if (invalidAct.isErr) {
        expect(invalidAct.error.code).toBe('INVALID_SELLER_STATE');
      }
    });
  });

  describe('Seller Listing State Machine & Invariants', () => {
    const prodId = createEntityId<ProductId>('prod_royal_bangle');
    const varId = createEntityId<ProductVariantId>('var_royal_bangle_18k');

    it('allows legal listing transitions: DRAFT -> ACTIVE -> PAUSED -> ACTIVE -> ARCHIVED', () => {
      expect(ListingStateMachine.canTransition('DRAFT', 'ACTIVE')).toBe(true);
      expect(ListingStateMachine.canTransition('ACTIVE', 'PAUSED')).toBe(true);
      expect(ListingStateMachine.canTransition('PAUSED', 'ACTIVE')).toBe(true);
      expect(ListingStateMachine.canTransition('ACTIVE', 'ARCHIVED')).toBe(true);
      expect(ListingStateMachine.canTransition('DRAFT', 'ARCHIVED')).toBe(true);
      expect(ListingStateMachine.canTransition('PAUSED', 'ARCHIVED')).toBe(true);
    });

    it('forbids illegal listing transitions: ARCHIVED -> ACTIVE, DRAFT -> PAUSED', () => {
      expect(ListingStateMachine.canTransition('ARCHIVED', 'ACTIVE')).toBe(false);
      expect(ListingStateMachine.canTransition('DRAFT', 'PAUSED')).toBe(false);
    });

    it('forbids creating an ACTIVE listing if seller is SUSPENDED or DRAFT', () => {
      const resSuspended = SellerListing.create({
        tenantId: tenantA,
        sellerProfileId: createEntityId('seller_suspended_01'),
        productId: prodId,
        productVariantId: varId,
        title: 'Filigree Gold Bangle 18K',
        initialStatus: 'ACTIVE',
        sellerStatus: 'SUSPENDED',
      });

      expect(resSuspended.isErr).toBe(true);
      if (resSuspended.isErr) {
        expect(resSuspended.error.code).toBe('SELLER_SUSPENDED');
      }

      const resDraftSeller = SellerListing.create({
        tenantId: tenantA,
        sellerProfileId: createEntityId('seller_draft_01'),
        productId: prodId,
        productVariantId: varId,
        title: 'Filigree Gold Bangle 18K',
        initialStatus: 'ACTIVE',
        sellerStatus: 'DRAFT',
      });

      expect(resDraftSeller.isErr).toBe(true);
      if (resDraftSeller.isErr) {
        expect(resDraftSeller.error.code).toBe('INVALID_LISTING_STATE');
      }
    });

    it('allows activating listing when seller is ACTIVE, but blocks when seller is SUSPENDED', () => {
      const listing = SellerListing.create({
        tenantId: tenantA,
        sellerProfileId: createEntityId('seller_active_01'),
        productId: prodId,
        productVariantId: varId,
        title: 'Filigree Gold Bangle 18K',
        initialStatus: 'DRAFT',
      }).unwrap();

      expect(listing.status).toBe('DRAFT');

      // Attempt to activate with suspended seller -> Rejected!
      const blockedAct = listing.activate('SUSPENDED', actorUser);
      expect(blockedAct.isErr).toBe(true);
      if (blockedAct.isErr) {
        expect(blockedAct.error.code).toBe('SELLER_SUSPENDED');
      }

      // Activate with active seller -> Success!
      const validAct = listing.activate('ACTIVE', actorUser);
      expect(validAct.isOk).toBe(true);
      expect(listing.status).toBe('ACTIVE');
      expect(listing.isPubliclyVisible).toBe(true);

      // Pause listing
      const pauseRes = listing.pause(actorUser, 'Temporarily re-polishing');
      expect(pauseRes.isOk).toBe(true);
      expect(listing.status).toBe('PAUSED');
      expect(listing.isPubliclyVisible).toBe(false);

      // Resume listing with active seller
      const resumeRes = listing.resume('ACTIVE', actorUser);
      expect(resumeRes.isOk).toBe(true);
      expect(listing.status).toBe('ACTIVE');
    });
  });

  describe('IAM Permissions for Marketplace', () => {
    it('verifies marketplace permissions are properly assigned across roles', () => {
      // OWNER has all permissions
      expect(hasPermission('OWNER', 'marketplace.seller.read')).toBe(true);
      expect(hasPermission('OWNER', 'marketplace.seller.manage')).toBe(true);
      expect(hasPermission('OWNER', 'marketplace.listing.read')).toBe(true);
      expect(hasPermission('OWNER', 'marketplace.listing.manage')).toBe(true);

      // ADMIN has all marketplace permissions
      expect(hasPermission('ADMIN', 'marketplace.seller.read')).toBe(true);
      expect(hasPermission('ADMIN', 'marketplace.seller.manage')).toBe(true);
      expect(hasPermission('ADMIN', 'marketplace.listing.read')).toBe(true);
      expect(hasPermission('ADMIN', 'marketplace.listing.manage')).toBe(true);

      // MEMBER has read permissions only
      expect(hasPermission('MEMBER', 'marketplace.seller.read')).toBe(true);
      expect(hasPermission('MEMBER', 'marketplace.listing.read')).toBe(true);
      expect(hasPermission('MEMBER', 'marketplace.seller.manage')).toBe(false);
      expect(hasPermission('MEMBER', 'marketplace.listing.manage')).toBe(false);
    });
  });
});
