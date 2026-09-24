import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  Product,
  ProductVariant,
  InventoryLocation,
  InventoryItem,
  SKU,
  Weight,
  GoldPurity,
  MaterialSpecification,
  JewelrySpecification,
  GemstoneSpecification,
  GemstoneCaratWeight,
  WEIGHT_CONVERSION_CONSTANTS,
  createEntityId,
  ActorReference,
  Store,
  type TenantId,
  type StoreId,
  type ProductVariantId,
  type InventoryLocationId,
  ForbiddenError,
  ValidationError,
  BusinessRuleViolationError,
} from '@v-gold/core';
import {
  InMemoryProductRepository,
  InMemoryProductVariantRepository,
  InMemoryInventoryLocationRepository,
  InMemoryInventoryItemRepository,
  InMemoryInventoryMovementRepository,
  InMemoryStoreRepository,
  InMemoryInventoryUnitOfWork,
} from '@v-gold/database';
import { CatalogService } from '../apps/web/lib/catalog/catalog-service.js';
import { InventoryService } from '../apps/web/lib/inventory/inventory-service.js';
import { Decimal } from 'decimal.js';

describe('Stage 6 Critical Corrections & Specification Invariants', () => {
  const tenantA = createEntityId<TenantId>('tenant_alpha_guild');
  const tenantB = createEntityId<TenantId>('tenant_beta_guild');

  const actorA = ActorReference.user('user_alpha').unwrap();

  // Reusable metal spec for testing
  const metal18K = MaterialSpecification.gold(
    GoldPurity.K18,
    Weight.fromGrams('10.000000').unwrap()
  ).unwrap();

  describe('1. Store / Tenant Ownership Integrity', () => {
    it('rejects product creation when storeId belongs to a different tenant', async () => {
      const productRepo = new InMemoryProductRepository();
      const variantRepo = new InMemoryProductVariantRepository();
      const storeRepo = new InMemoryStoreRepository();
      const catalogService = new CatalogService(productRepo, variantRepo, storeRepo);

      // Store belongs to Tenant B
      const storeB = Store.create({
        tenantId: tenantB,
        name: 'Beta Store Front',
        code: 'BETA_STR_01',
      }).unwrap();
      await storeRepo.save(tenantB, storeB);

      // Tenant A attempts to create a product referencing Tenant B's store
      const res = await catalogService.createProduct({
        tenantId: tenantA,
        storeId: storeB.id,
        name: 'Alpha Ring Model',
        productType: 'RING',
      });

      expect(res.isErr).toBe(true);
      if (!res.isOk) {
        expect(res.error).toBeInstanceOf(ForbiddenError);
        expect(res.error.message).toContain('does not belong to tenant');
      } else {
        expect.unreachable();
      }
    });

    it('rejects location creation when storeId belongs to a different tenant', async () => {
      const locRepo = new InMemoryInventoryLocationRepository();
      const itemRepo = new InMemoryInventoryItemRepository();
      const movRepo = new InMemoryInventoryMovementRepository();
      const varRepo = new InMemoryProductVariantRepository();
      const storeRepo = new InMemoryStoreRepository();
      const uow = new InMemoryInventoryUnitOfWork(itemRepo, movRepo);
      const inventoryService = new InventoryService(locRepo, itemRepo, movRepo, varRepo, uow, storeRepo);

      const storeB = Store.create({
        tenantId: tenantB,
        name: 'Beta Store',
        code: 'BETA_LOC_STR',
      }).unwrap();
      await storeRepo.save(tenantB, storeB);

      // Tenant A attempts to create a location with Tenant B's store
      const res = await inventoryService.createLocation({
        tenantId: tenantA,
        storeId: storeB.id,
        name: 'Alpha Showcase',
        code: 'SHOWCASE_01',
        type: 'DISPLAY',
      });

      expect(res.isErr).toBe(true);
      if (!res.isOk) {
        expect(res.error).toBeInstanceOf(ForbiddenError);
      } else {
        expect.unreachable();
      }
    });

    it('rejects item intake when item storeId contradicts location storeId', async () => {
      const locRepo = new InMemoryInventoryLocationRepository();
      const itemRepo = new InMemoryInventoryItemRepository();
      const movRepo = new InMemoryInventoryMovementRepository();
      const varRepo = new InMemoryProductVariantRepository();
      const storeRepo = new InMemoryStoreRepository();
      const uow = new InMemoryInventoryUnitOfWork(itemRepo, movRepo);
      const inventoryService = new InventoryService(locRepo, itemRepo, movRepo, varRepo, uow, storeRepo);

      // Two stores belonging to Tenant A
      const storeA1 = Store.create({ tenantId: tenantA, name: 'Store 1', code: 'STR_01' }).unwrap();
      const storeA2 = Store.create({ tenantId: tenantA, name: 'Store 2', code: 'STR_02' }).unwrap();
      await storeRepo.save(tenantA, storeA1);
      await storeRepo.save(tenantA, storeA2);

      // Location belongs to storeA1
      const locA1 = InventoryLocation.create({
        tenantId: tenantA,
        storeId: storeA1.id,
        name: 'Vault Store 1',
        code: 'VLT_STR1',
        type: 'VAULT',
      }).unwrap();
      await locRepo.save(locA1);

      // Variant
      const spec = JewelrySpecification.create({
        jewelryType: 'RING',
        metal: metal18K,
        grossWeight: Weight.fromGrams('10.0').unwrap(),
      }).unwrap();

      const variant = ProductVariant.create({
        productId: createEntityId('prod_test'),
        tenantId: tenantA,
        sku: SKU.create('RNG-TEST-01').unwrap(),
        name: 'Test Ring',
        specification: spec,
      }).unwrap();
      await varRepo.save(variant);

      // Attempt to intake item into locA1 (which is storeA1) but specifying storeA2
      const res = await inventoryService.intakeItem({
        tenantId: tenantA,
        storeId: storeA2.id, // Mismatch with locA1.storeId!
        productVariantId: variant.id,
        locationId: locA1.id,
        grossWeightGrams: '10.0',
        goldWeightGrams: '10.0',
        purityFineness: '750',
      });

      expect(res.isErr).toBe(true);
      if (!res.isOk) {
        expect(res.error).toBeInstanceOf(BusinessRuleViolationError);
        expect(res.error.message).toContain('Store mismatch');
      } else {
        expect.unreachable();
      }
    });

    it('automatically inherits location storeId when item storeId is omitted during intake', async () => {
      const locRepo = new InMemoryInventoryLocationRepository();
      const itemRepo = new InMemoryInventoryItemRepository();
      const movRepo = new InMemoryInventoryMovementRepository();
      const varRepo = new InMemoryProductVariantRepository();
      const storeRepo = new InMemoryStoreRepository();
      const uow = new InMemoryInventoryUnitOfWork(itemRepo, movRepo);
      const inventoryService = new InventoryService(locRepo, itemRepo, movRepo, varRepo, uow, storeRepo);

      const storeA1 = Store.create({ tenantId: tenantA, name: 'Store 1', code: 'STR_INH' }).unwrap();
      await storeRepo.save(tenantA, storeA1);

      const locA1 = InventoryLocation.create({
        tenantId: tenantA,
        storeId: storeA1.id,
        name: 'Vault Store 1',
        code: 'VLT_INH',
        type: 'VAULT',
      }).unwrap();
      await locRepo.save(locA1);

      const spec = JewelrySpecification.create({
        jewelryType: 'RING',
        metal: metal18K,
        grossWeight: Weight.fromGrams('10.0').unwrap(),
      }).unwrap();

      const variant = ProductVariant.create({
        productId: createEntityId('prod_test_inh'),
        tenantId: tenantA,
        sku: SKU.create('RNG-INH-01').unwrap(),
        name: 'Inherit Test Ring',
        specification: spec,
      }).unwrap();
      await varRepo.save(variant);

      // Intake without storeId
      const res = await inventoryService.intakeItem({
        tenantId: tenantA,
        productVariantId: variant.id,
        locationId: locA1.id,
        grossWeightGrams: '10.0',
        goldWeightGrams: '10.0',
        purityFineness: '750',
      });

      expect(res.isOk).toBe(true);
      expect(res.unwrap().item.storeId).toBe(storeA1.id);
    });
  });

  describe('2. Inventory SKU Anti-Drift Invariant (Option A - Derived Snapshot)', () => {
    it('rejects intake when caller supplies a SKU that differs from the authoritative variant SKU', async () => {
      const locRepo = new InMemoryInventoryLocationRepository();
      const itemRepo = new InMemoryInventoryItemRepository();
      const movRepo = new InMemoryInventoryMovementRepository();
      const varRepo = new InMemoryProductVariantRepository();
      const uow = new InMemoryInventoryUnitOfWork(itemRepo, movRepo);
      const inventoryService = new InventoryService(locRepo, itemRepo, movRepo, varRepo, uow);

      const loc = InventoryLocation.create({
        tenantId: tenantA,
        name: 'Main Vault',
        code: 'MAIN_VLT_DRIFT',
        type: 'VAULT',
      }).unwrap();
      await locRepo.save(loc);

      const spec = JewelrySpecification.create({
        jewelryType: 'RING',
        metal: metal18K,
        grossWeight: Weight.fromGrams('10.0').unwrap(),
      }).unwrap();

      const variant = ProductVariant.create({
        productId: createEntityId('prod_drift_test'),
        tenantId: tenantA,
        sku: SKU.create('AUTHO-SKU-18K-01').unwrap(),
        name: 'Authoritative Ring',
        specification: spec,
      }).unwrap();
      await varRepo.save(variant);

      // Caller attempts to pass a drifting SKU 'DRIFT-SKU-99'
      const res = await inventoryService.intakeItem({
        tenantId: tenantA,
        productVariantId: variant.id,
        locationId: loc.id,
        sku: 'DRIFT-SKU-99', // Mismatched!
        grossWeightGrams: '10.0',
        goldWeightGrams: '10.0',
        purityFineness: '750',
      });

      expect(res.isErr).toBe(true);
      if (!res.isOk) {
        expect(res.error).toBeInstanceOf(ValidationError);
        expect(res.error.message).toContain('SKU mismatch');
        expect(res.error.message).toContain('AUTHO-SKU-18K-01');
      } else {
        expect.unreachable();
      }
    });

    it('authoritatively derives item SKU from variant when sku is omitted in intake', async () => {
      const locRepo = new InMemoryInventoryLocationRepository();
      const itemRepo = new InMemoryInventoryItemRepository();
      const movRepo = new InMemoryInventoryMovementRepository();
      const varRepo = new InMemoryProductVariantRepository();
      const uow = new InMemoryInventoryUnitOfWork(itemRepo, movRepo);
      const inventoryService = new InventoryService(locRepo, itemRepo, movRepo, varRepo, uow);

      const loc = InventoryLocation.create({
        tenantId: tenantA,
        name: 'Main Vault',
        code: 'MAIN_VLT_AUTO',
        type: 'VAULT',
      }).unwrap();
      await locRepo.save(loc);

      const spec = JewelrySpecification.create({
        jewelryType: 'RING',
        metal: metal18K,
        grossWeight: Weight.fromGrams('10.0').unwrap(),
      }).unwrap();

      const variant = ProductVariant.create({
        productId: createEntityId('prod_auto_test'),
        tenantId: tenantA,
        sku: SKU.create('DERIVED-SKU-001').unwrap(),
        name: 'Derived Ring',
        specification: spec,
      }).unwrap();
      await varRepo.save(variant);

      // Intake with sku omitted
      const res = await inventoryService.intakeItem({
        tenantId: tenantA,
        productVariantId: variant.id,
        locationId: loc.id,
        // sku omitted
        grossWeightGrams: '10.0',
        goldWeightGrams: '10.0',
        purityFineness: '750',
      });

      expect(res.isOk).toBe(true);
      const { item } = res.unwrap();
      expect(item.sku.value).toBe('DERIVED-SKU-001');
    });
  });

  describe('3. Transaction-Safe Unit of Work & Rollback Verification', () => {
    it('rolls back item persistence if movement recording fails during intake', async () => {
      const locRepo = new InMemoryInventoryLocationRepository();
      const itemRepo = new InMemoryInventoryItemRepository();
      const movRepo = new InMemoryInventoryMovementRepository();
      const varRepo = new InMemoryProductVariantRepository();
      const uow = new InMemoryInventoryUnitOfWork(itemRepo, movRepo);
      const inventoryService = new InventoryService(locRepo, itemRepo, movRepo, varRepo, uow);

      const loc = InventoryLocation.create({
        tenantId: tenantA,
        name: 'Vault',
        code: 'VLT_ROLLBACK',
        type: 'VAULT',
      }).unwrap();
      await locRepo.save(loc);

      const spec = JewelrySpecification.create({
        jewelryType: 'RING',
        metal: metal18K,
        grossWeight: Weight.fromGrams('10.0').unwrap(),
      }).unwrap();

      const variant = ProductVariant.create({
        productId: createEntityId('prod_uow_test'),
        tenantId: tenantA,
        sku: SKU.create('UOW-TEST-01').unwrap(),
        name: 'UoW Ring',
        specification: spec,
      }).unwrap();
      await varRepo.save(variant);

      // INJECT FAILURE: Simulate failure during movement persistence
      uow.setSimulateFailureDuringMovement(true);

      await expect(
        inventoryService.intakeItem({
          tenantId: tenantA,
          productVariantId: variant.id,
          locationId: loc.id,
          serialNumber: 'SN-ROLLBACK-TEST',
          grossWeightGrams: '10.0',
          goldWeightGrams: '10.0',
          purityFineness: '750',
        })
      ).rejects.toThrow('Simulated database error during InventoryMovement recording');

      // CRITICAL ASSERTION: The item must NOT remain committed in itemRepo!
      const itemsInTenant = await itemRepo.listByTenant(tenantA);
      expect(itemsInTenant.length).toBe(0);

      const movementsInTenant = await movRepo.listByTenant(tenantA);
      expect(movementsInTenant.length).toBe(0);
    });

    it('rolls back status mutation if movement recording fails during state transition', async () => {
      const locRepo = new InMemoryInventoryLocationRepository();
      const itemRepo = new InMemoryInventoryItemRepository();
      const movRepo = new InMemoryInventoryMovementRepository();
      const varRepo = new InMemoryProductVariantRepository();
      const uow = new InMemoryInventoryUnitOfWork(itemRepo, movRepo);
      const inventoryService = new InventoryService(locRepo, itemRepo, movRepo, varRepo, uow);

      const loc = InventoryLocation.create({
        tenantId: tenantA,
        name: 'Vault',
        code: 'VLT_TRANS_RB',
        type: 'VAULT',
      }).unwrap();
      await locRepo.save(loc);

      const spec = JewelrySpecification.create({
        jewelryType: 'RING',
        metal: metal18K,
        grossWeight: Weight.fromGrams('10.0').unwrap(),
      }).unwrap();

      const variant = ProductVariant.create({
        productId: createEntityId('prod_trans_rb'),
        tenantId: tenantA,
        sku: SKU.create('UOW-TRANS-01').unwrap(),
        name: 'UoW Trans Ring',
        specification: spec,
      }).unwrap();
      await varRepo.save(variant);

      // Normal intake succeeds
      const { item } = (
        await inventoryService.intakeItem({
          tenantId: tenantA,
          productVariantId: variant.id,
          locationId: loc.id,
          serialNumber: 'SN-TRANS-RB',
          grossWeightGrams: '10.0',
          goldWeightGrams: '10.0',
          purityFineness: '750',
        })
      ).unwrap();

      expect(item.status).toBe('AVAILABLE');

      // INJECT FAILURE during status transition
      uow.setSimulateFailureDuringMovement(true);

      await expect(
        inventoryService.transitionStatus({
          itemId: item.id,
          tenantId: tenantA,
          targetStatus: 'RESERVED',
        })
      ).rejects.toThrow('Simulated database error during InventoryMovement recording');

      // CRITICAL ASSERTION: Item status must have rolled back to AVAILABLE!
      const persistedItem = await itemRepo.findById(item.id, tenantA);
      expect(persistedItem?.status).toBe('AVAILABLE');
    });
  });

  describe('4. Database Serial Uniqueness & Migration 0008 Inspection', () => {
    it('verifies migration 0008 exists and specifies composite store FKs and partial unique serial index', () => {
      const migrationPath = path.resolve(
        __dirname,
        '../packages/database/src/migrations/0008_catalog_inventory_integrity.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sql = fs.readFileSync(migrationPath, 'utf-8');

      // Composite store constraint
      expect(sql).toContain('ALTER TABLE "stores" ADD CONSTRAINT "stores_id_tenant_id_uniq" UNIQUE ("id", "tenant_id")');

      // Composite store foreign keys
      expect(sql).toContain('FOREIGN KEY ("store_id", "tenant_id")');
      expect(sql).toContain('REFERENCES "stores"("id", "tenant_id")');

      // Partial unique index on serial_number
      expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_tenant_serial_uniq"');
      expect(sql).toContain('WHERE "serial_number" IS NOT NULL');
    });
  });

  describe('5. IN_TRANSIT Lifecycle Semantics', () => {
    it('handles startTransfer -> IN_TRANSIT and completeTransfer -> AVAILABLE lifecycle', () => {
      const loc1 = createEntityId<InventoryLocationId>('loc_origin');
      const loc2 = createEntityId<InventoryLocationId>('loc_destination');

      const item = InventoryItem.intake({
        tenantId: tenantA,
        productVariantId: createEntityId('var_transit_test'),
        sku: SKU.create('TRN-18K-01').unwrap(),
        locationId: loc1,
        grossWeight: Weight.fromGrams('10.0').unwrap(),
        goldWeight: Weight.fromGrams('10.0').unwrap(),
        purity: GoldPurity.K18,
        actor: actorA,
      }).unwrap().item;

      expect(item.status).toBe('AVAILABLE');
      expect(item.locationId).toBe(loc1);

      // 1. Dispatch into transit: AVAILABLE -> IN_TRANSIT
      const startRes = item.startTransfer(loc2, actorA, 'WAYBILL-001', 'Armored van transfer');
      expect(startRes.isOk).toBe(true);
      const startMov = startRes.unwrap();

      expect(item.status).toBe('IN_TRANSIT');
      expect(startMov.movementType).toBe('TRANSFER');
      expect(startMov.fromStatus).toBe('AVAILABLE');
      expect(startMov.toStatus).toBe('IN_TRANSIT');
      expect(startMov.fromLocationId).toBe(loc1);
      expect(startMov.toLocationId).toBe(loc2);

      // Invariant: Cannot mark item as SOLD while IN_TRANSIT
      const illegalSale = item.markAsSold(actorA);
      expect(illegalSale.isErr).toBe(true);

      // 2. Check-in at destination: IN_TRANSIT -> AVAILABLE
      const completeRes = item.completeTransfer(loc2, actorA, 'RECEPTION-001', 'Received at branch');
      expect(completeRes.isOk).toBe(true);
      const completeMov = completeRes.unwrap();

      expect(item.status).toBe('AVAILABLE');
      expect(item.locationId).toBe(loc2);
      expect(completeMov.fromStatus).toBe('IN_TRANSIT');
      expect(completeMov.toStatus).toBe('AVAILABLE');
    });
  });

  describe('6. Weight Conversion Constant Reuse', () => {
    it('strictly reuses WEIGHT_CONVERSION_CONSTANTS.CARATS_PER_GRAM in GemstoneCaratWeight', () => {
      const caratVal = '10.00';
      const caratWeight = GemstoneCaratWeight.fromCarats(caratVal).unwrap();

      // 10 carats / 5 carats_per_gram = 2.0 grams
      const physicalWeight = caratWeight.toPhysicalWeight();
      const expectedGrams = new Decimal(caratVal).dividedBy(WEIGHT_CONVERSION_CONSTANTS.CARATS_PER_GRAM);

      expect(physicalWeight.grams.equals(expectedGrams)).toBe(true);
      expect(physicalWeight.grams.toString()).toBe('2');
    });
  });

  describe('7. Physical Mass Invariant without Tolerance Drift', () => {
    it('accepts exact physical mass: grossWeight = netGoldWeight + gemstoneMass', () => {
      const gold = Weight.fromGrams('10.000000').unwrap();
      const metal = MaterialSpecification.gold(GoldPurity.K18, gold).unwrap();

      // 2.50 carats = 0.500000 grams
      const stone = GemstoneSpecification.create({
        gemstoneType: 'DIAMOND',
        carats: '2.50',
      }).unwrap();

      // Exactly 10.500000g
      const exactGross = Weight.fromGrams('10.500000').unwrap();

      const spec = JewelrySpecification.create({
        jewelryType: 'RING',
        metal,
        grossWeight: exactGross,
        gemstones: [stone],
      });

      expect(spec.isOk).toBe(true);
      expect(spec.unwrap().grossWeight.grams.toString()).toBe('10.5');
    });

    it('strictly rejects when gross weight is even marginally less than the exact sum of parts', () => {
      const gold = Weight.fromGrams('10.000000').unwrap();
      const metal = MaterialSpecification.gold(GoldPurity.K18, gold).unwrap();

      // 2.50 carats = 0.500000 grams -> total expected = 10.500000g
      const stone = GemstoneSpecification.create({
        gemstoneType: 'DIAMOND',
        carats: '2.50',
      }).unwrap();

      // Deficit by 0.000050g (10.499950g)
      const subGross = Weight.fromGrams('10.499950').unwrap();

      const spec = JewelrySpecification.create({
        jewelryType: 'RING',
        metal,
        grossWeight: subGross,
        gemstones: [stone],
      });

      expect(spec.isErr).toBe(true);
      if (!spec.isOk) {
        expect(spec.error).toBeInstanceOf(ValidationError);
        expect(spec.error.message).toContain('Gross weight (10.49995g) is less than combined metal (10g) and gemstone mass (0.5g, total 10.5g)');
      } else {
        expect.unreachable();
      }
    });
  });
});
