import { describe, expect, it, beforeEach } from 'vitest';
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
  ActorReference,
  createEntityId,
  type TenantId,
  type StoreId,
  type SellerProfileId,
  type ProductId,
  type ProductVariantId,
} from '@v-gold/core';
import {
  InMemorySellerWorkspaceRepository,
  InMemorySellerProfileRepository,
  InMemorySellerListingRepository,
  InMemoryTenantRepository,
  InMemoryStoreRepository,
  InMemoryTenantMembershipRepository,
  InMemoryUserRepository,
  InMemoryInventoryItemRepository,
  InMemoryInventoryLocationRepository,
  InMemoryInventoryMovementRepository,
  InMemoryInventoryUnitOfWork,
  InMemoryProductRepository,
  InMemoryProductVariantRepository,
} from '@v-gold/database';
import { InventoryService } from '../apps/web/lib/inventory/inventory-service.js';
import { SellerMarketplaceService } from '../apps/web/lib/marketplace/seller-marketplace.service.js';
import { SellerOsService } from '../apps/web/lib/seller-os/seller-os.service.js';

describe('SellerOsService Application Logic & Orchestration', () => {
  const tenantId = createEntityId<TenantId>('tenant_damas_atelier');
  const storeId = createEntityId<StoreId>('store_damas_bazaar');
  let sellerProfileId: SellerProfileId;

  let workspaceRepo: InMemorySellerWorkspaceRepository;
  let sellerProfileRepo: InMemorySellerProfileRepository;
  let tenantRepo: InMemoryTenantRepository;
  let storeRepo: InMemoryStoreRepository;
  let membershipRepo: InMemoryTenantMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let itemRepo: InMemoryInventoryItemRepository;
  let locRepo: InMemoryInventoryLocationRepository;
  let moveRepo: InMemoryInventoryMovementRepository;
  let uow: InMemoryInventoryUnitOfWork;
  let listingRepo: InMemorySellerListingRepository;
  let productRepo: InMemoryProductRepository;
  let variantRepo: InMemoryProductVariantRepository;

  let inventoryService: InventoryService;
  let marketplaceService: SellerMarketplaceService;
  let sellerOsService: SellerOsService;

  let locVault: InventoryLocation;
  let locShowroom: InventoryLocation;
  let sampleVariantId: ProductVariantId;

  beforeEach(async () => {
    workspaceRepo = new InMemorySellerWorkspaceRepository();
    sellerProfileRepo = new InMemorySellerProfileRepository();
    tenantRepo = new InMemoryTenantRepository();
    storeRepo = new InMemoryStoreRepository();
    membershipRepo = new InMemoryTenantMembershipRepository();
    userRepo = new InMemoryUserRepository();
    itemRepo = new InMemoryInventoryItemRepository();
    locRepo = new InMemoryInventoryLocationRepository();
    moveRepo = new InMemoryInventoryMovementRepository();
    uow = new InMemoryInventoryUnitOfWork(itemRepo, moveRepo);
    listingRepo = new InMemorySellerListingRepository();
    productRepo = new InMemoryProductRepository();
    variantRepo = new InMemoryProductVariantRepository();

    inventoryService = new InventoryService(
      locRepo,
      itemRepo,
      moveRepo,
      variantRepo,
      uow,
      storeRepo
    );

    marketplaceService = new SellerMarketplaceService(
      sellerProfileRepo,
      listingRepo,
      storeRepo,
      productRepo,
      variantRepo
    );

    sellerOsService = new SellerOsService(
      workspaceRepo,
      sellerProfileRepo,
      tenantRepo,
      storeRepo,
      membershipRepo,
      userRepo,
      itemRepo,
      locRepo,
      uow,
      listingRepo,
      inventoryService,
      marketplaceService
    );

    // 1. Seed Tenant & Store
    const tenant = Tenant.create({
      id: tenantId,
      name: 'Damas Atelier Ltd',
      slug: 'damas-atelier',
    }).unwrap();
    await tenantRepo.save(tenant);

    const store = Store.create({
      id: storeId,
      tenantId,
      name: 'Grand Bazaar Showroom',
      code: 'GBZ-01',
    }).unwrap();
    await storeRepo.save(tenantId, store);

    // 2. Seed Seller Profile
    const seller = SellerProfile.create({
      tenantId,
      storeId,
      displayName: 'Damas Persian Jewelry',
      slug: 'damas-persian-jewelry',
      initialStatus: 'ACTIVE',
    }).unwrap();
    await sellerProfileRepo.save(seller);
    sellerProfileId = seller.id;

    // 3. Seed Inventory Locations
    locVault = InventoryLocation.create({
      tenantId,
      storeId,
      name: 'High Security Vault',
      code: 'VAULT-01',
      type: 'VAULT',
    }).unwrap();
    await locRepo.save(locVault);

    locShowroom = InventoryLocation.create({
      tenantId,
      storeId,
      name: 'Main Display Showcase',
      code: 'DISP-01',
      type: 'DISPLAY',
    }).unwrap();
    await locRepo.save(locShowroom);

    // 4. Seed Product and Variant
    const prodId = createEntityId<ProductId>('prod_bangle_24k');
    const product = Product.create({
      id: prodId,
      tenantId,
      name: 'Handcrafted Persian Bangle',
      description: 'Solid 24k gold bangle',
      productType: 'BRACELET',
    }).unwrap();
    await productRepo.save(product);

    sampleVariantId = createEntityId<ProductVariantId>('var_bangle_24k_std');
    const goldWeight = Weight.fromGrams('15').unwrap();
    const metal = MaterialSpecification.gold(GoldPurity.K24, goldWeight).unwrap();
    const spec = JewelrySpecification.create({
      jewelryType: 'BRACELET',
      metal,
      grossWeight: goldWeight,
    }).unwrap();

    const variant = ProductVariant.create({
      id: sampleVariantId,
      tenantId,
      productId: prodId,
      name: 'Standard 24K Bangle',
      sku: SKU.create('DAMAS-BAN-24K-01').unwrap(),
      specification: spec,
    }).unwrap();
    await variantRepo.save(variant);
  });

  describe('Workspace Management', () => {
    it('creates a workspace successfully linking Tenant, SellerProfile, and Store', async () => {
      const res = await sellerOsService.createWorkspace({
        tenantId,
        sellerProfileId,
        storeId,
        name: 'Damas Primary Operations',
        settings: { notifications: true },
      });

      expect(res.isOk).toBe(true);
      const ws = res.unwrap();
      expect(ws.id).toBeDefined();
      expect(ws.tenantId).toBe(tenantId);
      expect(ws.sellerProfileId).toBe(sellerProfileId);
      expect(ws.storeId).toBe(storeId);
      expect(ws.name).toBe('Damas Primary Operations');
      expect(ws.status).toBe('ACTIVE');

      const saved = await workspaceRepo.findById(ws.id, tenantId);
      expect(saved).not.toBeNull();
      expect(saved!.name).toBe('Damas Primary Operations');
    });

    it('enforces single workspace per seller profile invariant (rejects duplicate)', async () => {
      await sellerOsService.createWorkspace({
        tenantId,
        sellerProfileId,
        name: 'First Workspace',
      });

      const dupRes = await sellerOsService.createWorkspace({
        tenantId,
        sellerProfileId,
        name: 'Second Workspace Attempt',
      });

      expect(dupRes.isErr).toBe(true);
      expect((dupRes as any).error.code).toBe('CONFLICT');
      expect((dupRes as any).error.message).toContain('Single workspace per seller profile invariant violated');
    });

    it('rejects workspace creation when seller profile does not exist', async () => {
      const res = await sellerOsService.createWorkspace({
        tenantId,
        sellerProfileId: 'seller_nonexistent',
        name: 'Ghost Workspace',
      });

      expect(res.isErr).toBe(true);
      expect((res as any).error.code).toBe('NOT_FOUND');
    });

    it('updates workspace name and settings', async () => {
      const ws = (
        await sellerOsService.createWorkspace({
          tenantId,
          sellerProfileId,
          name: 'Original Operations',
        })
      ).unwrap();

      const updRes = await sellerOsService.updateWorkspace({
        workspaceId: ws.id,
        tenantId,
        name: 'Renamed Operations Hub',
        settings: { autoReorder: false },
      });

      expect(updRes.isOk).toBe(true);
      expect(updRes.unwrap().name).toBe('Renamed Operations Hub');
      expect(updRes.unwrap().settings).toEqual({ autoReorder: false });
    });

    it('transitions workspace lifecycle status', async () => {
      const ws = (
        await sellerOsService.createWorkspace({
          tenantId,
          sellerProfileId,
          name: 'Lifecycle Workspace',
        })
      ).unwrap();

      const suspRes = await sellerOsService.transitionWorkspaceStatus(
        ws.id,
        tenantId,
        'SUSPENDED',
        'admin_01',
        'Annual inventory audit'
      );
      expect(suspRes.isOk).toBe(true);
      expect(suspRes.unwrap().status).toBe('SUSPENDED');

      const reinRes = await sellerOsService.transitionWorkspaceStatus(
        ws.id,
        tenantId,
        'ACTIVE',
        'admin_01'
      );
      expect(reinRes.isOk).toBe(true);
      expect(reinRes.unwrap().status).toBe('ACTIVE');
    });
  });

  describe('Operational Overview Foundation (Real Data, Zero Fake Metrics)', () => {
    it('aggregates genuine operational overview counts accurately', async () => {
      // 1. Create workspace
      const ws = (
        await sellerOsService.createWorkspace({
          tenantId,
          sellerProfileId,
          storeId,
          name: 'Overview Test Workspace',
        })
      ).unwrap();

      // 2. Seed 3 real inventory items: 2 AVAILABLE, 1 RESERVED
      const item1 = InventoryItem.intake({
        tenantId,
        storeId,
        productVariantId: sampleVariantId,
        sku: SKU.create('SKU-001').unwrap(),
        serialNumber: 'SN-001',
        locationId: locVault.id,
        grossWeight: Weight.fromGrams('10').unwrap(),
        goldWeight: Weight.fromGrams('10').unwrap(),
        purity: GoldPurity.K24,
        actor: ActorReference.system(),
      }).unwrap().item;
      await itemRepo.save(item1);

      const item2 = InventoryItem.intake({
        tenantId,
        storeId,
        productVariantId: sampleVariantId,
        sku: SKU.create('SKU-002').unwrap(),
        serialNumber: 'SN-002',
        locationId: locVault.id,
        grossWeight: Weight.fromGrams('12').unwrap(),
        goldWeight: Weight.fromGrams('12').unwrap(),
        purity: GoldPurity.K24,
        actor: ActorReference.system(),
      }).unwrap().item;
      await itemRepo.save(item2);

      const item3 = InventoryItem.intake({
        tenantId,
        storeId,
        productVariantId: sampleVariantId,
        sku: SKU.create('SKU-003').unwrap(),
        serialNumber: 'SN-003',
        locationId: locVault.id,
        grossWeight: Weight.fromGrams('15').unwrap(),
        goldWeight: Weight.fromGrams('15').unwrap(),
        purity: GoldPurity.K24,
        actor: ActorReference.system(),
      }).unwrap().item;
      item3.reserve(ActorReference.system(), 'Customer Hold');
      await itemRepo.save(item3);

      // 3. Seed 2 real listings: 1 ACTIVE, 1 DRAFT
      const listing1 = SellerListing.create({
        tenantId,
        sellerProfileId,
        productId: createEntityId<ProductId>('prod_bangle_24k'),
        productVariantId: sampleVariantId,
        title: 'Persian Royal Bangle',
        slug: 'persian-royal-bangle',
        initialStatus: 'ACTIVE',
        sellerStatus: 'ACTIVE',
      }).unwrap();
      await listingRepo.save(listing1);

      const listing2 = SellerListing.create({
        tenantId,
        sellerProfileId,
        productId: createEntityId<ProductId>('prod_bangle_24k'),
        productVariantId: sampleVariantId,
        title: 'Draft Bangle Special',
        slug: 'draft-bangle-special',
        initialStatus: 'DRAFT',
        sellerStatus: 'ACTIVE',
      }).unwrap();
      await listingRepo.save(listing2);

      // 4. Seed 3 real staff members: 1 OWNER, 1 OPERATOR, 1 MEMBER
      const u1 = User.create({
        email: Email.create('owner@damas.ir').unwrap(),
        passwordHash: PasswordHash.create('$2b$10$abcdef...fakehash').unwrap(),
        displayName: 'Master Goldsmith',
      }).unwrap();
      await userRepo.save(u1);
      const m1 = TenantMembership.create({ tenantId, userId: u1.id, role: 'OWNER' }).unwrap();
      await membershipRepo.save(m1);

      const u2 = User.create({
        email: Email.create('operator@damas.ir').unwrap(),
        passwordHash: PasswordHash.create('$2b$10$abcdef...fakehash').unwrap(),
        displayName: 'Bazaar Floor Operator',
      }).unwrap();
      await userRepo.save(u2);
      const m2 = TenantMembership.create({ tenantId, userId: u2.id, role: 'OPERATOR' }).unwrap();
      await membershipRepo.save(m2);

      const u3 = User.create({
        email: Email.create('apprentice@damas.ir').unwrap(),
        passwordHash: PasswordHash.create('$2b$10$abcdef...fakehash').unwrap(),
        displayName: 'Apprentice Jeweler',
      }).unwrap();
      await userRepo.save(u3);
      const m3 = TenantMembership.create({ tenantId, userId: u3.id, role: 'MEMBER' }).unwrap();
      await membershipRepo.save(m3);

      // 5. Query overview
      const overviewRes = await sellerOsService.getOperationalOverview(ws.id, tenantId);
      expect(overviewRes.isOk).toBe(true);
      const overview = overviewRes.unwrap();

      // Verify exact counts with zero fake KPIs
      expect(overview.workspaceId).toBe(ws.id);
      expect(overview.tenantId).toBe(tenantId);
      expect(overview.sellerProfile.displayName).toBe('Damas Persian Jewelry');
      expect(overview.store?.name).toBe('Grand Bazaar Showroom');

      // Real Inventory counts
      expect(overview.inventorySummary).toEqual({
        totalItems: 3,
        availableItems: 2,
        reservedItems: 1,
        inTransitItems: 0,
        damagedItems: 0,
        lostItems: 0,
        soldItems: 0,
      });

      // Real Listing counts
      expect(overview.listingSummary).toEqual({
        totalListings: 2,
        activeListings: 1,
        pausedListings: 0,
        draftListings: 1,
        archivedListings: 0,
      });

      // Real Staff counts
      expect(overview.staffSummary).toEqual({
        totalMembers: 3,
        activeMembers: 3,
        operatorsCount: 1,
      });
    });
  });

  describe('Staff Management Operations', () => {
    it('lists staff members and updates role to OPERATOR', async () => {
      const user = User.create({
        email: Email.create('staff1@damas.ir').unwrap(),
        passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
        displayName: 'Staff One',
      }).unwrap();
      await userRepo.save(user);

      // Add staff member as MEMBER
      const addRes = await sellerOsService.addStaffMember(tenantId, user.id, 'MEMBER');
      expect(addRes.isOk).toBe(true);
      const membership = addRes.unwrap();
      expect(membership.role).toBe('MEMBER');

      // List staff
      const listRes = await sellerOsService.listStaff(tenantId);
      expect(listRes.isOk).toBe(true);
      expect(listRes.unwrap().length).toBe(1);
      expect(listRes.unwrap()[0].user?.displayName).toBe('Staff One');
      expect(listRes.unwrap()[0].role).toBe('MEMBER');

      // Elevate to OPERATOR
      const updRes = await sellerOsService.updateStaffRole(tenantId, membership.id, 'OPERATOR');
      expect(updRes.isOk).toBe(true);
      expect(updRes.unwrap().role).toBe('OPERATOR');

      // Suspend staff member
      const suspRes = await sellerOsService.updateStaffStatus(tenantId, membership.id, 'SUSPENDED');
      expect(suspRes.isOk).toBe(true);
      expect(suspRes.unwrap().status).toBe('SUSPENDED');
      expect(suspRes.unwrap().isActive()).toBe(false);
    });

    it('rejects adding inactive user to staff', async () => {
      const inactiveUser = User.create({
        email: Email.create('inactive@damas.ir').unwrap(),
        passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
        displayName: 'Inactive User',
      }).unwrap();
      inactiveUser.suspend();
      await userRepo.save(inactiveUser);

      const addRes = await sellerOsService.addStaffMember(tenantId, inactiveUser.id, 'OPERATOR');
      expect(addRes.isErr).toBe(true);
      expect((addRes as any).error.code).toBe('UNPROCESSABLE_ENTITY');
      expect((addRes as any).error.message).toContain('is not active');
    });
  });

  describe('Inventory & Listing Operations Integration', () => {
    it('transfers an inventory item and records movement history', async () => {
      const ws = (
        await sellerOsService.createWorkspace({
          tenantId,
          sellerProfileId,
          storeId,
          name: 'Transfer Workspace',
        })
      ).unwrap();

      const item = InventoryItem.intake({
        tenantId,
        storeId,
        productVariantId: sampleVariantId,
        sku: SKU.create('SKU-MOVE-01').unwrap(),
        serialNumber: 'SN-MOVE-01',
        locationId: locVault.id,
        grossWeight: Weight.fromGrams('10').unwrap(),
        goldWeight: Weight.fromGrams('10').unwrap(),
        purity: GoldPurity.K24,
        actor: ActorReference.system(),
      }).unwrap().item;
      await itemRepo.save(item);

      // Transfer from Vault to Showroom via Seller OS
      const transRes = await sellerOsService.transferInventoryItem({
        tenantId,
        workspaceId: ws.id,
        itemId: item.id,
        toLocationId: locShowroom.id,
        reference: 'DISP-TRANS-01',
        reason: 'Move to display showcase',
      });

      expect(transRes.isOk).toBe(true);
      expect(transRes.unwrap().item.locationId).toBe(locShowroom.id);
      expect(transRes.unwrap().movement.movementType).toBe('TRANSFER');
      expect(transRes.unwrap().movement.fromLocationId).toBe(locVault.id);
      expect(transRes.unwrap().movement.toLocationId).toBe(locShowroom.id);

      // Verify persisted item location
      const reloaded = await itemRepo.findById(item.id, tenantId);
      expect(reloaded?.locationId).toBe(locShowroom.id);
    });

    it('blocks inventory transfer when workspace is SUSPENDED', async () => {
      const ws = (
        await sellerOsService.createWorkspace({
          tenantId,
          sellerProfileId,
          storeId,
          name: 'Suspended Workspace Test',
        })
      ).unwrap();

      ws.suspend();
      await workspaceRepo.save(ws);

      const item = InventoryItem.intake({
        tenantId,
        storeId,
        productVariantId: sampleVariantId,
        sku: SKU.create('SKU-SUSP-01').unwrap(),
        serialNumber: 'SN-SUSP-01',
        locationId: locVault.id,
        grossWeight: Weight.fromGrams('10').unwrap(),
        goldWeight: Weight.fromGrams('10').unwrap(),
        purity: GoldPurity.K24,
        actor: ActorReference.system(),
      }).unwrap().item;
      await itemRepo.save(item);

      const transRes = await sellerOsService.transferInventoryItem({
        tenantId,
        workspaceId: ws.id,
        itemId: item.id,
        toLocationId: locShowroom.id,
      });

      expect(transRes.isErr).toBe(true);
      expect((transRes as any).error.code).toBe('WORKSPACE_SUSPENDED');
    });

    it('blocks inventory transfer when item belongs to a different store within same tenant', async () => {
      // Workspace is bound to storeId (store_damas_bazaar)
      const ws = (
        await sellerOsService.createWorkspace({
          tenantId,
          sellerProfileId,
          storeId,
          name: 'Store Bound Workspace',
        })
      ).unwrap();

      // Create a second store
      const otherStoreId = createEntityId<StoreId>('store_tabriz_branch');
      const otherStore = Store.create({
        id: otherStoreId,
        tenantId,
        name: 'Tabriz Branch',
        code: 'TBZ-01',
      }).unwrap();
      await storeRepo.save(tenantId, otherStore);

      // Item belongs to otherStoreId
      const otherStoreItem = InventoryItem.intake({
        tenantId,
        storeId: otherStoreId,
        productVariantId: sampleVariantId,
        sku: SKU.create('SKU-OTHER-01').unwrap(),
        serialNumber: 'SN-OTHER-01',
        locationId: locVault.id,
        grossWeight: Weight.fromGrams('10').unwrap(),
        goldWeight: Weight.fromGrams('10').unwrap(),
        purity: GoldPurity.K24,
        actor: ActorReference.system(),
      }).unwrap().item;
      await itemRepo.save(otherStoreItem);

      const transRes = await sellerOsService.transferInventoryItem({
        tenantId,
        workspaceId: ws.id,
        itemId: otherStoreItem.id,
        toLocationId: locShowroom.id,
      });

      expect(transRes.isErr).toBe(true);
      expect((transRes as any).error.code).toBe('FORBIDDEN');
      expect((transRes as any).error.message).toContain('does not belong to the store assigned to this workspace');
    });

    it('enforces Unit of Work atomicity during transfer failure (failure injection)', async () => {
      const ws = (
        await sellerOsService.createWorkspace({
          tenantId,
          sellerProfileId,
          storeId,
          name: 'Atomic Transfer Workspace',
        })
      ).unwrap();

      const item = InventoryItem.intake({
        tenantId,
        storeId,
        productVariantId: sampleVariantId,
        sku: SKU.create('SKU-FAIL-01').unwrap(),
        serialNumber: 'SN-FAIL-01',
        locationId: locVault.id,
        grossWeight: Weight.fromGrams('10').unwrap(),
        goldWeight: Weight.fromGrams('10').unwrap(),
        purity: GoldPurity.K24,
        actor: ActorReference.system(),
      }).unwrap().item;
      await itemRepo.save(item);

      // Inject simulated failure during movement recording
      uow.setSimulateFailureDuringMovement(true);

      await expect(
        sellerOsService.transferInventoryItem({
          tenantId,
          workspaceId: ws.id,
          itemId: item.id,
          toLocationId: locShowroom.id,
        })
      ).rejects.toThrow('Simulated database error during InventoryMovement recording');

      // Reset failure injection
      uow.setSimulateFailureDuringMovement(false);

      // Invariant: Item location was rolled back / remains untouched in vault
      const persistedItem = await itemRepo.findById(item.id, tenantId);
      expect(persistedItem?.locationId).toBe(locVault.id);

      // Invariant: Movement was NOT persisted
      const movements = await moveRepo.listByItemId(item.id, tenantId);
      expect(movements.filter((m) => m.movementType === 'TRANSFER')).toHaveLength(0);
    });
  });
});
