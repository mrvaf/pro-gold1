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
import {
  GET as listStaffApi,
  POST as addStaffApi,
} from '../apps/web/app/api/v1/seller-os/staff/route.js';
import { PATCH as updateStaffApi } from '../apps/web/app/api/v1/seller-os/staff/[id]/route.js';
import { GET as listInventoryApi } from '../apps/web/app/api/v1/seller-os/inventory/route.js';
import { POST as transferInventoryApi } from '../apps/web/app/api/v1/seller-os/inventory/[itemId]/transfer/route.js';
import { GET as listListingsApi } from '../apps/web/app/api/v1/seller-os/listings/route.js';
import { PATCH as updateListingApi } from '../apps/web/app/api/v1/seller-os/listings/[id]/route.js';

describe('Seller OS Web API Routes & RBAC Invariants', () => {
  const tenantId = 'tenant_shiraz_gold';
  const storeId = 'store_vakil_bazaar';

  let ownerSessionToken: string;
  let operatorSessionToken: string;
  let memberSessionToken: string;

  let sellerProfileId: string;
  let workspaceId: string;
  let inventoryItemId: string;
  let showroomLocId: string;
  let listingId: string;
  let newStaffUserId: string;
  let newStaffMembershipId: string;

  beforeAll(async () => {
    const authService = getDefaultAuthService();
    const catalogContainer = getCatalogContainer();
    const inventoryContainer = getInventoryContainer();
    const marketplaceContainer = getMarketplaceContainer();

    // 1. Seed Tenant & Store
    const tId = createEntityId<TenantId>(tenantId);
    const sId = createEntityId<StoreId>(storeId);

    const tenant = Tenant.create({ id: tId, name: 'Shiraz Gold Goldsmiths', slug: 'shiraz-gold' }).unwrap();
    await authService.tenantRepository.save(tenant);

    const store = Store.create({ id: sId, tenantId: tId, name: 'Vakil Bazaar Boutique', code: 'VAKIL-01' }).unwrap();
    await catalogContainer.storeRepo.save(tId, store);

    // 2. Seed Users & Memberships
    // User 1: OWNER
    const uOwner = User.create({
      email: Email.create('owner@shirazgold.ir').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'Shiraz Owner',
    }).unwrap();
    await authService.userRepository.save(uOwner);
    const memOwner = TenantMembership.create({ tenantId: tId, userId: uOwner.id, role: 'OWNER' }).unwrap();
    await authService.membershipRepository.save(memOwner);
    const sessOwner = Session.create({
      id: crypto.randomBytes(32).toString('hex'),
      userId: uOwner.id,
    }).unwrap();
    await authService.sessionRepository.save(sessOwner);
    ownerSessionToken = sessOwner.id;

    // User 2: OPERATOR
    const uOp = User.create({
      email: Email.create('operator@shirazgold.ir').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'Shiraz Operator',
    }).unwrap();
    await authService.userRepository.save(uOp);
    const memOp = TenantMembership.create({ tenantId: tId, userId: uOp.id, role: 'OPERATOR' }).unwrap();
    await authService.membershipRepository.save(memOp);
    const sessOp = Session.create({
      id: crypto.randomBytes(32).toString('hex'),
      userId: uOp.id,
    }).unwrap();
    await authService.sessionRepository.save(sessOp);
    operatorSessionToken = sessOp.id;

    // User 3: MEMBER (Read-only on inventory/listings manage)
    const uMember = User.create({
      email: Email.create('member@shirazgold.ir').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'Shiraz Member',
    }).unwrap();
    await authService.userRepository.save(uMember);
    const memMember = TenantMembership.create({ tenantId: tId, userId: uMember.id, role: 'MEMBER' }).unwrap();
    await authService.membershipRepository.save(memMember);
    const sessMember = Session.create({
      id: crypto.randomBytes(32).toString('hex'),
      userId: uMember.id,
    }).unwrap();
    await authService.sessionRepository.save(sessMember);
    memberSessionToken = sessMember.id;

    // User 4: Candidate for staff addition
    const uNew = User.create({
      email: Email.create('newstaff@shirazgold.ir').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'New Staff Candidate',
    }).unwrap();
    await authService.userRepository.save(uNew);
    newStaffUserId = uNew.id;

    // 3. Seed Seller Profile
    const seller = SellerProfile.create({
      tenantId: tId,
      storeId: sId,
      displayName: 'Shiraz Royal Goldsmiths',
      slug: 'shiraz-royal-goldsmiths',
      initialStatus: 'ACTIVE',
    }).unwrap();
    await marketplaceContainer.sellerRepo.save(seller);
    sellerProfileId = seller.id;

    // 4. Seed Inventory Locations
    const locVault = InventoryLocation.create({
      tenantId: tId,
      storeId: sId,
      name: 'Shiraz Safe Vault',
      code: 'SHZ-VAULT',
      type: 'VAULT',
    }).unwrap();
    await inventoryContainer.locationRepo.save(locVault);

    const locShowroom = InventoryLocation.create({
      tenantId: tId,
      storeId: sId,
      name: 'Vakil Window Display',
      code: 'SHZ-DISP',
      type: 'DISPLAY',
    }).unwrap();
    await inventoryContainer.locationRepo.save(locShowroom);
    showroomLocId = locShowroom.id;

    // 5. Seed Product & Variant & Inventory Item
    const pId = createEntityId<ProductId>('prod_shiraz_pendant');
    const product = Product.create({
      id: pId,
      tenantId: tId,
      name: 'Hafez Persian Pendant',
      description: 'Engraved 18k gold pendant',
      productType: 'PENDANT',
    }).unwrap();
    await catalogContainer.productRepo.save(product);

    const vId = createEntityId<ProductVariantId>('var_shiraz_pendant_18k');
    const goldWeight = Weight.fromGrams('8.5').unwrap();
    const metal = MaterialSpecification.gold(GoldPurity.K18, goldWeight).unwrap();
    const spec = JewelrySpecification.create({
      jewelryType: 'PENDANT',
      metal,
      grossWeight: goldWeight,
    }).unwrap();

    const variant = ProductVariant.create({
      id: vId,
      tenantId: tId,
      productId: pId,
      name: 'Hafez Pendant 18K',
      sku: SKU.create('SHZ-PEN-18K-01').unwrap(),
      specification: spec,
    }).unwrap();
    await catalogContainer.variantRepo.save(variant);

    const item = InventoryItem.intake({
      tenantId: tId,
      storeId: sId,
      productVariantId: vId,
      sku: SKU.create('SHZ-PEN-18K-01').unwrap(),
      serialNumber: 'SN-SHZ-001',
      locationId: locVault.id,
      grossWeight: Weight.fromGrams('8.5').unwrap(),
      goldWeight: Weight.fromGrams('6.375').unwrap(),
      purity: GoldPurity.K18,
      actor: ActorReference.system(),
    }).unwrap().item;
    await inventoryContainer.itemRepo.save(item);
    inventoryItemId = item.id;

    // 6. Seed Listing
    const listing = SellerListing.create({
      tenantId: tId,
      sellerProfileId: seller.id,
      productId: pId,
      productVariantId: vId,
      title: 'Hafez Poetry Gold Pendant 18K',
      slug: 'hafez-poetry-gold-pendant-18k',
      initialStatus: 'ACTIVE',
      sellerStatus: 'ACTIVE',
    }).unwrap();
    await marketplaceContainer.listingRepo.save(listing);
    listingId = listing.id;
  });

  describe('Authentication & Authorization Gate', () => {
    it('returns 401 Unauthorized when session token is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/seller-os/overview', {
        headers: { 'x-tenant-id': tenantId },
      });

      const res = await getOverviewApi(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 Forbidden when MEMBER attempts manage operation (RBAC)', async () => {
      // MEMBER lacks seller.inventory.manage
      const req = new NextRequest(
        `http://localhost:3000/api/v1/seller-os/inventory/${inventoryItemId}/transfer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId,
            Authorization: `Bearer ${memberSessionToken}`,
          },
          body: JSON.stringify({
            workspaceId: 'ws_dummy',
            toLocationId: showroomLocId,
          }),
        }
      );

      const res = await transferInventoryApi(req, {
        params: Promise.resolve({ itemId: inventoryItemId }),
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Workspace Lifecycle Endpoints', () => {
    it('creates workspace via POST /api/v1/seller-os/workspace', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/seller-os/workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
          Authorization: `Bearer ${ownerSessionToken}`,
        },
        body: JSON.stringify({
          sellerProfileId,
          storeId,
          name: 'Shiraz Main Workspace',
          settings: { allowTransfers: true },
        }),
      });

      const res = await createWorkspaceApi(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBeDefined();
      expect(json.data.name).toBe('Shiraz Main Workspace');
      expect(json.data.status).toBe('ACTIVE');

      workspaceId = json.data.id;
    });

    it('retrieves workspace via GET /api/v1/seller-os/workspace', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/seller-os/workspace?workspaceId=${workspaceId}`,
        {
          headers: {
            'x-tenant-id': tenantId,
            Authorization: `Bearer ${operatorSessionToken}`,
          },
        }
      );

      const res = await getWorkspaceApi(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(workspaceId);
      expect(json.data.name).toBe('Shiraz Main Workspace');
    });

    it('updates workspace via PATCH /api/v1/seller-os/workspace', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/seller-os/workspace', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
          Authorization: `Bearer ${ownerSessionToken}`,
        },
        body: JSON.stringify({
          workspaceId,
          name: 'Shiraz Updated Workspace',
        }),
      });

      const res = await updateWorkspaceApi(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Shiraz Updated Workspace');
    });

    it('suspends and reinstates workspace via POST /api/v1/seller-os/workspace/transition', async () => {
      // 1. Suspend
      const suspReq = new NextRequest(
        'http://localhost:3000/api/v1/seller-os/workspace/transition',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId,
            Authorization: `Bearer ${ownerSessionToken}`,
          },
          body: JSON.stringify({
            workspaceId,
            targetStatus: 'SUSPENDED',
            reason: 'Audit',
          }),
        }
      );

      const suspRes = await transitionWorkspaceApi(suspReq);
      expect(suspRes.status).toBe(200);
      expect((await suspRes.json()).data.status).toBe('SUSPENDED');

      // 2. Reinstate
      const reinReq = new NextRequest(
        'http://localhost:3000/api/v1/seller-os/workspace/transition',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId,
            Authorization: `Bearer ${ownerSessionToken}`,
          },
          body: JSON.stringify({
            workspaceId,
            targetStatus: 'ACTIVE',
          }),
        }
      );

      const reinRes = await transitionWorkspaceApi(reinReq);
      expect(reinRes.status).toBe(200);
      expect((await reinRes.json()).data.status).toBe('ACTIVE');
    });
  });

  describe('Seller Operational Overview Endpoint', () => {
    it('returns authentic operational overview via GET /api/v1/seller-os/overview', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/seller-os/overview?workspaceId=${workspaceId}`,
        {
          headers: {
            'x-tenant-id': tenantId,
            Authorization: `Bearer ${operatorSessionToken}`,
          },
        }
      );

      const res = await getOverviewApi(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      const data = json.data;

      expect(data.workspaceId).toBe(workspaceId);
      expect(data.sellerProfile.displayName).toBe('Shiraz Royal Goldsmiths');
      expect(data.store.name).toBe('Vakil Bazaar Boutique');

      // Exact genuine counts
      expect(data.inventorySummary.totalItems).toBe(1);
      expect(data.inventorySummary.availableItems).toBe(1);
      expect(data.listingSummary.totalListings).toBe(1);
      expect(data.listingSummary.activeListings).toBe(1);
      expect(data.staffSummary.totalMembers).toBe(3);
      expect(data.staffSummary.operatorsCount).toBe(1);
    });
  });

  describe('Staff Management Endpoints', () => {
    it('lists staff via GET /api/v1/seller-os/staff', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/seller-os/staff', {
        headers: {
          'x-tenant-id': tenantId,
          Authorization: `Bearer ${operatorSessionToken}`,
        },
      });

      const res = await listStaffApi(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(3);
    });

    it('adds staff member via POST /api/v1/seller-os/staff and modifies role via PATCH /api/v1/seller-os/staff/:id', async () => {
      // 1. Add new staff
      const addReq = new NextRequest('http://localhost:3000/api/v1/seller-os/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
          Authorization: `Bearer ${ownerSessionToken}`,
        },
        body: JSON.stringify({
          userId: newStaffUserId,
          role: 'MEMBER',
        }),
      });

      const addRes = await addStaffApi(addReq);
      expect(addRes.status).toBe(201);
      const addJson = await addRes.json();
      expect(addJson.success).toBe(true);
      expect(addJson.data.role).toBe('MEMBER');
      newStaffMembershipId = addJson.data.id;

      // 2. Elevate to OPERATOR via PATCH
      const patchReq = new NextRequest(
        `http://localhost:3000/api/v1/seller-os/staff/${newStaffMembershipId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId,
            Authorization: `Bearer ${ownerSessionToken}`,
          },
          body: JSON.stringify({
            role: 'OPERATOR',
          }),
        }
      );

      const patchRes = await updateStaffApi(patchReq, {
        params: Promise.resolve({ id: newStaffMembershipId }),
      });
      expect(patchRes.status).toBe(200);
      const patchJson = await patchRes.json();
      expect(patchJson.success).toBe(true);
      expect(patchJson.data.role).toBe('OPERATOR');
    });
  });

  describe('Inventory & Listings Orchestration Endpoints', () => {
    it('lists inventory via GET /api/v1/seller-os/inventory', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/seller-os/inventory?workspaceId=${workspaceId}`,
        {
          headers: {
            'x-tenant-id': tenantId,
            Authorization: `Bearer ${operatorSessionToken}`,
          },
        }
      );

      const res = await listInventoryApi(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.data[0].id).toBe(inventoryItemId);
    });

    it('transfers inventory item via POST /api/v1/seller-os/inventory/:itemId/transfer', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/seller-os/inventory/${inventoryItemId}/transfer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId,
            Authorization: `Bearer ${operatorSessionToken}`,
          },
          body: JSON.stringify({
            workspaceId,
            toLocationId: showroomLocId,
            reference: 'REST-TRANS-01',
            reason: 'Boutique Display',
          }),
        }
      );

      const res = await transferInventoryApi(req, {
        params: Promise.resolve({ itemId: inventoryItemId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.item.locationId).toBe(showroomLocId);
      expect(json.data.movement.movementType).toBe('TRANSFER');
    });

    it('lists and updates listings via /api/v1/seller-os/listings endpoints', async () => {
      // 1. List
      const listReq = new NextRequest(
        `http://localhost:3000/api/v1/seller-os/listings?workspaceId=${workspaceId}`,
        {
          headers: {
            'x-tenant-id': tenantId,
            Authorization: `Bearer ${operatorSessionToken}`,
          },
        }
      );

      const listRes = await listListingsApi(listReq);
      expect(listRes.status).toBe(200);
      const listJson = await listRes.json();
      expect(listJson.success).toBe(true);
      expect(listJson.data.length).toBe(1);

      // 2. Update via PATCH
      const patchReq = new NextRequest(
        `http://localhost:3000/api/v1/seller-os/listings/${listingId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId,
            Authorization: `Bearer ${operatorSessionToken}`,
          },
          body: JSON.stringify({
            workspaceId,
            targetStatus: 'PAUSED',
            title: 'Hafez Poetry Pendant (Temporarily Reserved)',
          }),
        }
      );

      const patchRes = await updateListingApi(patchReq, {
        params: Promise.resolve({ id: listingId }),
      });
      expect(patchRes.status).toBe(200);
      const patchJson = await patchRes.json();
      expect(patchJson.success).toBe(true);
      expect(patchJson.data.status).toBe('PAUSED');
      expect(patchJson.data.title).toBe('Hafez Poetry Pendant (Temporarily Reserved)');
    });
  });
});
