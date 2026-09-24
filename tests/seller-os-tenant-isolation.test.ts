import { describe, expect, it, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  Tenant,
  Store,
  User,
  Email,
  PasswordHash,
  TenantMembership,
  SellerProfile,
  SellerListing,
  Product,
  ProductVariant,
  SKU,
  Weight,
  GoldPurity,
  MaterialSpecification,
  JewelrySpecification,
  InventoryLocation,
  InventoryItem,
  createEntityId,
  type TenantId,
  type StoreId,
  type ProductId,
  type ProductVariantId,
  ActorReference,
  Session,
} from '@v-gold/core';
import { getDefaultAuthService } from '../apps/web/lib/auth/auth.service.js';
import { getCatalogContainer } from '../apps/web/lib/catalog/catalog-container.js';
import { getInventoryContainer } from '../apps/web/lib/inventory/inventory-container.js';
import { getMarketplaceContainer } from '../apps/web/lib/marketplace/marketplace-container.js';
import { getSellerOsContainer } from '../apps/web/lib/seller-os/seller-os-container.js';

import { GET as getOverviewApi } from '../apps/web/app/api/v1/seller-os/overview/route.js';
import {
  GET as getWorkspaceApi,
  POST as createWorkspaceApi,
  PATCH as updateWorkspaceApi,
} from '../apps/web/app/api/v1/seller-os/workspace/route.js';
import { POST as transitionWorkspaceApi } from '../apps/web/app/api/v1/seller-os/workspace/transition/route.js';
import { PATCH as updateStaffApi } from '../apps/web/app/api/v1/seller-os/staff/[id]/route.js';
import { POST as transferInventoryApi } from '../apps/web/app/api/v1/seller-os/inventory/[itemId]/transfer/route.js';
import { PATCH as updateListingApi } from '../apps/web/app/api/v1/seller-os/listings/[id]/route.js';

describe('Seller OS Multi-Tenant Isolation & IDOR Security', () => {
  const victimTenantId = 'tenant_victim_isfahan';
  const victimStoreId = 'store_naqsh_e_jahan';

  const attackerTenantId = 'tenant_attacker_malicious';
  const attackerStoreId = 'store_attacker_den';

  let victimSessionToken: string;
  let attackerSessionToken: string;

  let victimSellerProfileId: string;
  let victimWorkspaceId: string;
  let victimInventoryItemId: string;
  let victimListingId: string;
  let victimStaffMembershipId: string;

  let attackerSellerProfileId: string;
  let attackerWorkspaceId: string;
  let attackerLocId: string;

  beforeAll(async () => {
    const authService = getDefaultAuthService();
    const catalogContainer = getCatalogContainer();
    const inventoryContainer = getInventoryContainer();
    const marketplaceContainer = getMarketplaceContainer();
    const sellerOsContainer = getSellerOsContainer();

    const tVictim = createEntityId<TenantId>(victimTenantId);
    const sVictim = createEntityId<StoreId>(victimStoreId);

    const tAttacker = createEntityId<TenantId>(attackerTenantId);
    const sAttacker = createEntityId<StoreId>(attackerStoreId);

    // 1. Seed Victim Tenant, Store, User & Session
    await authService.tenantRepository.save(
      Tenant.create({ id: tVictim, name: 'Isfahan Artisans', slug: 'isfahan-artisans' }).unwrap()
    );
    await catalogContainer.storeRepo.save(
      tVictim,
      Store.create({ id: sVictim, tenantId: tVictim, name: 'Naqsh-e Jahan Bazaar', code: 'ISF-01' }).unwrap()
    );
    const uVictim = User.create({
      email: Email.create('master@isfahanart.ir').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'Victim Master',
    }).unwrap();
    await authService.userRepository.save(uVictim);
    const memVictim = TenantMembership.create({ tenantId: tVictim, userId: uVictim.id, role: 'OWNER' }).unwrap();
    await authService.membershipRepository.save(memVictim);
    victimStaffMembershipId = memVictim.id;
    const sessVictim = Session.create({
      id: crypto.randomBytes(32).toString('hex'),
      userId: uVictim.id,
    }).unwrap();
    await authService.sessionRepository.save(sessVictim);
    victimSessionToken = sessVictim.id;

    // 2. Seed Attacker Tenant, Store, User & Session
    await authService.tenantRepository.save(
      Tenant.create({ id: tAttacker, name: 'Attacker Corp', slug: 'attacker-corp' }).unwrap()
    );
    await catalogContainer.storeRepo.save(
      tAttacker,
      Store.create({ id: sAttacker, tenantId: tAttacker, name: 'Attacker Store', code: 'ATK-01' }).unwrap()
    );
    const uAttacker = User.create({
      email: Email.create('attacker@darknet.io').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'Attacker User',
    }).unwrap();
    await authService.userRepository.save(uAttacker);
    const memAttacker = TenantMembership.create({ tenantId: tAttacker, userId: uAttacker.id, role: 'OWNER' }).unwrap();
    await authService.membershipRepository.save(memAttacker);
    const sessAttacker = Session.create({
      id: crypto.randomBytes(32).toString('hex'),
      userId: uAttacker.id,
    }).unwrap();
    await authService.sessionRepository.save(sessAttacker);
    attackerSessionToken = sessAttacker.id;

    // 3. Seed Victim Seller Profile & Workspace
    const sellerVictim = SellerProfile.create({
      tenantId: tVictim,
      storeId: sVictim,
      displayName: 'Isfahan Royal Gold',
      slug: 'isfahan-royal-gold',
      initialStatus: 'ACTIVE',
    }).unwrap();
    await marketplaceContainer.sellerRepo.save(sellerVictim);
    victimSellerProfileId = sellerVictim.id;

    const wsVictim = (
      await sellerOsContainer.sellerOsService.createWorkspace({
        tenantId: victimTenantId,
        sellerProfileId: victimSellerProfileId,
        storeId: victimStoreId,
        name: 'Isfahan Main Workspace',
      })
    ).unwrap();
    victimWorkspaceId = wsVictim.id;

    // 4. Seed Attacker Seller Profile & Workspace
    const sellerAttacker = SellerProfile.create({
      tenantId: tAttacker,
      storeId: sAttacker,
      displayName: 'Attacker Shadow Gold',
      slug: 'attacker-shadow-gold',
      initialStatus: 'ACTIVE',
    }).unwrap();
    await marketplaceContainer.sellerRepo.save(sellerAttacker);
    attackerSellerProfileId = sellerAttacker.id;

    const wsAttacker = (
      await sellerOsContainer.sellerOsService.createWorkspace({
        tenantId: attackerTenantId,
        sellerProfileId: attackerSellerProfileId,
        storeId: attackerStoreId,
        name: 'Attacker Workspace',
      })
    ).unwrap();
    attackerWorkspaceId = wsAttacker.id;

    // 5. Seed Locations
    const locVictimVault = InventoryLocation.create({
      tenantId: tVictim,
      storeId: sVictim,
      name: 'Isfahan Vault',
      code: 'ISF-VAULT',
      type: 'VAULT',
    }).unwrap();
    await inventoryContainer.locationRepo.save(locVictimVault);

    const locAttackerVault = InventoryLocation.create({
      tenantId: tAttacker,
      storeId: sAttacker,
      name: 'Attacker Vault',
      code: 'ATK-VAULT',
      type: 'VAULT',
    }).unwrap();
    await inventoryContainer.locationRepo.save(locAttackerVault);
    attackerLocId = locAttackerVault.id;

    // 6. Seed Victim Inventory Item & Listing
    const pId = createEntityId<ProductId>('prod_isfahan_ring');
    const product = Product.create({
      id: pId,
      tenantId: tVictim,
      name: 'Isfahan Filigree Ring',
      description: 'Traditional gold ring',
      productType: 'RING',
    }).unwrap();
    await catalogContainer.productRepo.save(product);

    const vId = createEntityId<ProductVariantId>('var_isfahan_ring_18k');
    const goldWeight = Weight.fromGrams('5.0').unwrap();
    const metal = MaterialSpecification.gold(GoldPurity.K18, goldWeight).unwrap();
    const spec = JewelrySpecification.create({
      jewelryType: 'RING',
      metal,
      grossWeight: goldWeight,
    }).unwrap();

    const variant = ProductVariant.create({
      id: vId,
      tenantId: tVictim,
      productId: pId,
      name: 'Filigree Ring Size 7',
      sku: SKU.create('ISF-RNG-18K-07').unwrap(),
      specification: spec,
    }).unwrap();
    await catalogContainer.variantRepo.save(variant);

    const item = InventoryItem.intake({
      tenantId: tVictim,
      storeId: sVictim,
      productVariantId: vId,
      sku: SKU.create('ISF-RNG-18K-07').unwrap(),
      serialNumber: 'SN-ISF-1001',
      locationId: locVictimVault.id,
      grossWeight: Weight.fromGrams('5.0').unwrap(),
      goldWeight: Weight.fromGrams('3.75').unwrap(),
      purity: GoldPurity.K18,
      actor: ActorReference.system(),
    }).unwrap().item;
    await inventoryContainer.itemRepo.save(item);
    victimInventoryItemId = item.id;

    const listing = SellerListing.create({
      tenantId: tVictim,
      sellerProfileId: sellerVictim.id,
      productId: pId,
      productVariantId: vId,
      title: 'Isfahan Royal Ring',
      slug: 'isfahan-royal-ring',
      initialStatus: 'ACTIVE',
      sellerStatus: 'ACTIVE',
    }).unwrap();
    await marketplaceContainer.listingRepo.save(listing);
    victimListingId = listing.id;
  });

  describe('Cross-Tenant IDOR Attack Mitigation', () => {
    it('strictly forbids Attacker from reading Victim operational overview', async () => {
      // Attacker attempts to query victimWorkspaceId using their own session and claiming victimTenantId
      const reqWithSpoofedTenant = new NextRequest(
        `http://localhost:3000/api/v1/seller-os/overview?workspaceId=${victimWorkspaceId}`,
        {
          headers: {
            'x-tenant-id': victimTenantId,
            Authorization: `Bearer ${attackerSessionToken}`,
          },
        }
      );

      const res1 = await getOverviewApi(reqWithSpoofedTenant);
      expect(res1.status).toBe(403);

      // Attacker attempts to query victimWorkspaceId under their own tenantId
      const reqUnderAttackerTenant = new NextRequest(
        `http://localhost:3000/api/v1/seller-os/overview?workspaceId=${victimWorkspaceId}`,
        {
          headers: {
            'x-tenant-id': attackerTenantId,
            Authorization: `Bearer ${attackerSessionToken}`,
          },
        }
      );

      const res2 = await getOverviewApi(reqUnderAttackerTenant);
      expect([403, 404]).toContain(res2.status);
    });

    it('strictly forbids Attacker from reading or mutating Victim workspace', async () => {
      // 1. Read attempt
      const readReq = new NextRequest(
        `http://localhost:3000/api/v1/seller-os/workspace?workspaceId=${victimWorkspaceId}`,
        {
          headers: {
            'x-tenant-id': attackerTenantId,
            Authorization: `Bearer ${attackerSessionToken}`,
          },
        }
      );
      const readRes = await getWorkspaceApi(readReq);
      expect([403, 404]).toContain(readRes.status);

      // 2. Patch attempt
      const patchReq = new NextRequest('http://localhost:3000/api/v1/seller-os/workspace', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': attackerTenantId,
          Authorization: `Bearer ${attackerSessionToken}`,
        },
        body: JSON.stringify({
          workspaceId: victimWorkspaceId,
          name: 'Hacked Workspace Name',
        }),
      });
      const patchRes = await updateWorkspaceApi(patchReq);
      expect([403, 404]).toContain(patchRes.status);

      // 3. Suspend attempt
      const suspReq = new NextRequest(
        'http://localhost:3000/api/v1/seller-os/workspace/transition',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': attackerTenantId,
            Authorization: `Bearer ${attackerSessionToken}`,
          },
          body: JSON.stringify({
            workspaceId: victimWorkspaceId,
            targetStatus: 'SUSPENDED',
            reason: 'Malicious shutdown',
          }),
        }
      );
      const suspRes = await transitionWorkspaceApi(suspReq);
      expect([403, 404]).toContain(suspRes.status);
    });

    it('strictly forbids Attacker from modifying Victim staff members', async () => {
      const patchReq = new NextRequest(
        `http://localhost:3000/api/v1/seller-os/staff/${victimStaffMembershipId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': attackerTenantId,
            Authorization: `Bearer ${attackerSessionToken}`,
          },
          body: JSON.stringify({
            role: 'MEMBER',
            status: 'SUSPENDED',
          }),
        }
      );

      const patchRes = await updateStaffApi(patchReq, {
        params: Promise.resolve({ id: victimStaffMembershipId }),
      });
      expect([403, 404]).toContain(patchRes.status);
    });

    it('strictly forbids Attacker from transferring Victim inventory items', async () => {
      // Attacker attempts to transfer victim's item to attacker's location
      const transReq = new NextRequest(
        `http://localhost:3000/api/v1/seller-os/inventory/${victimInventoryItemId}/transfer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': attackerTenantId,
            Authorization: `Bearer ${attackerSessionToken}`,
          },
          body: JSON.stringify({
            workspaceId: attackerWorkspaceId,
            toLocationId: attackerLocId,
            reference: 'HEIST-01',
          }),
        }
      );

      const transRes = await transferInventoryApi(transReq, {
        params: Promise.resolve({ itemId: victimInventoryItemId }),
      });
      expect([403, 404]).toContain(transRes.status);
    });

    it('strictly forbids Attacker from modifying Victim listings', async () => {
      const patchReq = new NextRequest(
        `http://localhost:3000/api/v1/seller-os/listings/${victimListingId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': attackerTenantId,
            Authorization: `Bearer ${attackerSessionToken}`,
          },
          body: JSON.stringify({
            workspaceId: attackerWorkspaceId,
            targetStatus: 'ARCHIVED',
            title: 'Defaced Listing Title',
          }),
        }
      );

      const patchRes = await updateListingApi(patchReq, {
        params: Promise.resolve({ id: victimListingId }),
      });
      expect([403, 404]).toContain(patchRes.status);
    });
  });
});
