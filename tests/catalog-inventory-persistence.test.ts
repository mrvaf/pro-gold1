import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  productsTable,
  productVariantsTable,
  inventoryLocationsTable,
  inventoryItemsTable,
  inventoryMovementsTable,
  toDatabaseProduct,
  toDomainProduct,
  toDatabaseProductVariant,
  toDomainProductVariant,
  toDatabaseInventoryLocation,
  toDomainInventoryLocation,
  toDatabaseInventoryItem,
  toDomainInventoryItem,
  toDatabaseInventoryMovement,
  toDomainInventoryMovement,
} from '@v-gold/database';
import {
  Product,
  ProductVariant,
  InventoryLocation,
  InventoryItem,
  InventoryMovement,
  SKU,
  Weight,
  GoldPurity,
  MaterialSpecification,
  JewelrySpecification,
  GemstoneSpecification,
  createEntityId,
  ActorReference,
  type TenantId,
  type InventoryItemId,
  type InventoryLocationId,
} from '@v-gold/core';
import { Decimal } from 'decimal.js';

describe('Stage 6: Catalog & Inventory Persistence, Schema & Migration Tests', () => {
  const tenantId = createEntityId<TenantId>('tenant_pers_test');
  const actor = ActorReference.user('user_pers_test').unwrap();

  describe('Drizzle Table Schema Constraints', () => {
    it('validates productsTable constraints and indexes', () => {
      const cols = getTableColumns(productsTable);
      const config = getTableConfig(productsTable);

      expect(cols.id.primary).toBe(true);
      expect(cols.tenantId.notNull).toBe(true);
      expect(cols.name.notNull).toBe(true);
      expect(cols.productType.notNull).toBe(true);
      expect(cols.status.notNull).toBe(true);

      const indexNames = config.indexes.map((idx) => idx.config.name);
      expect(indexNames).toContain('products_tenant_status_idx');
      expect(indexNames).toContain('products_store_idx');
    });

    it('validates productVariantsTable unique tenant+SKU index and columns', () => {
      const cols = getTableColumns(productVariantsTable);
      const config = getTableConfig(productVariantsTable);

      expect(cols.id.primary).toBe(true);
      expect(cols.productId.notNull).toBe(true);
      expect(cols.tenantId.notNull).toBe(true);
      expect(cols.sku.notNull).toBe(true);
      expect(cols.goldWeightGrams.notNull).toBe(true);
      expect(cols.grossWeightGrams.notNull).toBe(true);

      const uniqueIdx = config.indexes.find(
        (idx) => idx.config.name === 'product_variants_tenant_sku_uniq'
      );
      expect(uniqueIdx).toBeDefined();
      expect(uniqueIdx?.config.unique).toBe(true);
    });

    it('validates inventoryLocationsTable unique tenant+code constraint', () => {
      const cols = getTableColumns(inventoryLocationsTable);
      const config = getTableConfig(inventoryLocationsTable);

      expect(cols.id.primary).toBe(true);
      expect(cols.tenantId.notNull).toBe(true);
      expect(cols.code.notNull).toBe(true);

      const uniqueCodeIdx = config.indexes.find(
        (idx) => idx.config.name === 'inventory_locations_tenant_code_uniq'
      );
      expect(uniqueCodeIdx).toBeDefined();
      expect(uniqueCodeIdx?.config.unique).toBe(true);
    });

    it('validates inventoryItemsTable columns and numeric precisions', () => {
      const cols = getTableColumns(inventoryItemsTable);
      expect(cols.id.primary).toBe(true);
      expect(cols.tenantId.notNull).toBe(true);
      expect(cols.productVariantId.notNull).toBe(true);
      expect(cols.locationId.notNull).toBe(true);
      expect(cols.status.notNull).toBe(true);
      expect(cols.quantity.notNull).toBe(true);
      expect(cols.grossWeightGrams.notNull).toBe(true);
      expect(cols.goldWeightGrams.notNull).toBe(true);
    });

    it('validates inventoryMovementsTable audit columns', () => {
      const cols = getTableColumns(inventoryMovementsTable);
      expect(cols.id.primary).toBe(true);
      expect(cols.tenantId.notNull).toBe(true);
      expect(cols.inventoryItemId.notNull).toBe(true);
      expect(cols.movementType.notNull).toBe(true);
      expect(cols.occurredAt.notNull).toBe(true);
      expect(cols.actorId.notNull).toBe(true);
      expect(cols.actorType.notNull).toBe(true);
    });
  });

  describe('Domain <-> Database Mapper Roundtrips', () => {
    it('performs lossless roundtrip for Product entity', () => {
      const original = Product.create({
        tenantId,
        name: 'Solitaire Diamond Ring Model A',
        description: 'Classic 6-prong solitaire',
        productType: 'RING',
        actor,
      }).unwrap();

      const dbRecord = toDatabaseProduct(original);
      const reconstituted = toDomainProduct(dbRecord as any);

      expect(reconstituted.id).toBe(original.id);
      expect(reconstituted.tenantId).toBe(original.tenantId);
      expect(reconstituted.name).toBe(original.name);
      expect(reconstituted.description).toBe(original.description);
      expect(reconstituted.productType).toBe(original.productType);
      expect(reconstituted.status).toBe(original.status);
    });

    it('performs lossless roundtrip for ProductVariant with gemstones metadata', () => {
      const metal = MaterialSpecification.gold(
        GoldPurity.K18,
        Weight.fromGrams('4.800000').unwrap()
      ).unwrap();

      const diamond = GemstoneSpecification.create({
        gemstoneType: 'DIAMOND',
        carats: '1.00',
        count: 1,
        color: 'F',
        clarity: 'VVS2',
        cut: 'ROUND',
        certificateNumber: 'GIA-123456',
      }).unwrap();

      const spec = JewelrySpecification.create({
        jewelryType: 'RING',
        metal,
        grossWeight: Weight.fromGrams('5.000000').unwrap(), // 4.8g gold + 0.2g diamond (1ct)
        gemstones: [diamond],
      }).unwrap();

      const original = ProductVariant.create({
        productId: createEntityId('prod_parent_01'),
        tenantId,
        sku: SKU.create('SOL-18K-DIA-01').unwrap(),
        name: 'Solitaire 18K - Size 52',
        specification: spec,
        actor,
      }).unwrap();

      const dbRecord = toDatabaseProductVariant(original);
      const reconstituted = toDomainProductVariant(dbRecord as any);

      expect(reconstituted.id).toBe(original.id);
      expect(reconstituted.productId).toBe(original.productId);
      expect(reconstituted.sku.value).toBe('SOL-18K-DIA-01');
      expect(reconstituted.specification.metal.purityFineness.toString()).toBe('750');
      expect(reconstituted.specification.grossWeight.grams.toString()).toBe('5');
      expect(reconstituted.specification.gemstones.length).toBe(1);
      expect(reconstituted.specification.gemstones[0].certificateNumber).toBe('GIA-123456');
    });

    it('performs lossless roundtrip for InventoryLocation', () => {
      const original = InventoryLocation.create({
        tenantId,
        name: 'Showroom Showcase 3',
        code: 'DISP_SHOWCASE_03',
        type: 'DISPLAY',
        actor,
      }).unwrap();

      const dbRecord = toDatabaseInventoryLocation(original);
      const reconstituted = toDomainInventoryLocation(dbRecord as any);

      expect(reconstituted.id).toBe(original.id);
      expect(reconstituted.code).toBe('DISP_SHOWCASE_03');
      expect(reconstituted.type).toBe('DISPLAY');
      expect(reconstituted.status).toBe('ACTIVE');
    });

    it('performs lossless roundtrip for InventoryItem', () => {
      const { item: original } = InventoryItem.intake({
        tenantId,
        productVariantId: createEntityId('var_test_01'),
        sku: SKU.create('ITEM-SKU-99').unwrap(),
        serialNumber: 'SERIAL-9988-11',
        locationId: createEntityId('loc_vault_01'),
        grossWeight: Weight.fromGrams('12.345678').unwrap(),
        goldWeight: Weight.fromGrams('12.000000').unwrap(),
        purity: GoldPurity.K18,
        actor,
      }).unwrap();

      const dbRecord = toDatabaseInventoryItem(original);
      const reconstituted = toDomainInventoryItem(dbRecord as any);

      expect(reconstituted.id).toBe(original.id);
      expect(reconstituted.serialNumber).toBe('SERIAL-9988-11');
      expect(reconstituted.grossWeight.grams.toString()).toBe('12.345678');
      expect(reconstituted.goldWeight.grams.toString()).toBe('12');
      expect(reconstituted.status).toBe('AVAILABLE');
    });

    it('performs lossless roundtrip for InventoryMovement', () => {
      const original = InventoryMovement.record({
        tenantId,
        inventoryItemId: createEntityId<InventoryItemId>('item_move_01'),
        movementType: 'TRANSFER',
        fromLocationId: createEntityId<InventoryLocationId>('loc_vault'),
        toLocationId: createEntityId<InventoryLocationId>('loc_display'),
        fromStatus: 'AVAILABLE',
        toStatus: 'AVAILABLE',
        quantity: new Decimal('1.0000'),
        actor,
        reference: 'DISP-TRANSFER-01',
        notes: 'Relocated for window exhibition',
      }).unwrap();

      const dbRecord = toDatabaseInventoryMovement(original);
      const reconstituted = toDomainInventoryMovement(dbRecord as any);

      expect(reconstituted.id).toBe(original.id);
      expect(reconstituted.movementType).toBe('TRANSFER');
      expect(reconstituted.fromLocationId).toBe('loc_vault');
      expect(reconstituted.toLocationId).toBe('loc_display');
      expect(reconstituted.quantity.toString()).toBe('1');
      expect(reconstituted.reference).toBe('DISP-TRANSFER-01');
      expect(reconstituted.notes).toBe('Relocated for window exhibition');
    });
  });

  describe('Migration 0007 DDL Invariants', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../packages/database/src/migrations/0007_catalog_inventory_foundation.sql'
    );

    it('ensures migration 0007 exists and contains all required table definitions and indexes', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf-8');

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS "products"');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS "product_variants"');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS "inventory_locations"');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS "inventory_items"');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS "inventory_movements"');

      // Unique indexes
      expect(sql).toContain('product_variants_tenant_sku_uniq');
      expect(sql).toContain('inventory_locations_tenant_code_uniq');

      // Cascade / Restrict foreign keys
      expect(sql).toContain('ON DELETE CASCADE');
      expect(sql).toContain('ON DELETE RESTRICT');

      // High precision numerics
      expect(sql).toContain('NUMERIC(16, 6)');
      expect(sql).toContain('NUMERIC(16, 4)');
      expect(sql).toContain('NUMERIC(6, 4)');
    });
  });
});
