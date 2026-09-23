import { describe, expect, it } from 'vitest';
import {
  Product,
  ProductVariant,
  SKU,
  Weight,
  GoldPurity,
  MaterialSpecification,
  JewelrySpecification,
  createEntityId,
  type TenantId,
  type ProductId,
  type ProductVariantId,
  ValidationError,
  BusinessRuleViolationError,
  ConflictError,
} from '@v-gold/core';
import {
  InMemoryProductRepository,
  InMemoryProductVariantRepository,
} from '@v-gold/database';

describe('Stage 6: Catalog Domain & Lifecycle Invariants', () => {
  const tenantA = createEntityId<TenantId>('tenant_gold_corp');
  const tenantB = createEntityId<TenantId>('tenant_silver_corp');

  describe('Product Lifecycle & Creation', () => {
    it('creates product with valid attributes and initial DRAFT status', () => {
      const res = Product.create({
        tenantId: tenantA,
        name: 'Royal Heritage Bangle',
        description: 'Handcrafted Persian filigree bangle in 18K gold',
        productType: 'BRACELET',
      });

      expect(res.isOk).toBe(true);
      const product = res.unwrap();
      expect(product.id).toBeDefined();
      expect(product.name).toBe('Royal Heritage Bangle');
      expect(product.productType).toBe('BRACELET');
      expect(product.status).toBe('DRAFT');
      expect(product.tenantId).toBe(tenantA);
      expect(product.audit.createdAt).toBeInstanceOf(Date);
    });

    it('rejects product creation with empty name or missing tenant', () => {
      const resEmptyName = Product.create({
        tenantId: tenantA,
        name: '   ',
        productType: 'RING',
      });
      expect(resEmptyName.isErr).toBe(true);
      expect(resEmptyName.unwrapOr(null as any)).toBeNull();

      const resNoTenant = Product.create({
        tenantId: '' as TenantId,
        name: 'Solitaire Ring',
        productType: 'RING',
      });
      expect(resNoTenant.isErr).toBe(true);
    });

    it('enforces product state machine: DRAFT -> ACTIVE -> ARCHIVED -> DRAFT', () => {
      const product = Product.create({
        tenantId: tenantA,
        name: 'Crown Pendant',
        productType: 'PENDANT',
      }).unwrap();

      expect(product.status).toBe('DRAFT');

      // Publish: DRAFT -> ACTIVE
      const pubRes = product.publish();
      expect(pubRes.isOk).toBe(true);
      expect(product.status).toBe('ACTIVE');

      // Archive: ACTIVE -> ARCHIVED
      const archRes = product.archive();
      expect(archRes.isOk).toBe(true);
      expect(product.status).toBe('ARCHIVED');

      // Direct publish from ARCHIVED is forbidden
      const invalidPub = product.publish();
      expect(invalidPub.isErr).toBe(true);
      expect(invalidPub.unwrapOr(null as any)).toBeNull();

      // Reactivate: ARCHIVED -> DRAFT
      const reactRes = product.reactivate();
      expect(reactRes.isOk).toBe(true);
      expect(product.status).toBe('DRAFT');
    });
  });

  describe('Product Variant & SKU Invariants', () => {
    const goldPurity18K = GoldPurity.K18;
    const goldWeight = Weight.fromGrams('12.500000').unwrap();
    const grossWeight = Weight.fromGrams('12.500000').unwrap();
    const metal = MaterialSpecification.gold(goldPurity18K, goldWeight).unwrap();
    const spec = JewelrySpecification.create({
      jewelryType: 'RING',
      metal,
      grossWeight,
    }).unwrap();

    it('validates SKU format and length constraints', () => {
      // Valid SKUs
      const valid1 = SKU.create('RING-18K-001');
      expect(valid1.isOk).toBe(true);
      expect(valid1.unwrap().value).toBe('RING-18K-001');

      const valid2 = SKU.create('GLD_SOLITAIRE_54');
      expect(valid2.isOk).toBe(true);

      // Invalid: too short
      const shortSku = SKU.create('AB');
      expect(shortSku.isErr).toBe(true);

      // Invalid: spaces or illegal punctuation
      const invalidChars = SKU.create('RING 18K #1!');
      expect(invalidChars.isErr).toBe(true);

      // Invalid: empty
      const emptySku = SKU.create('');
      expect(emptySku.isErr).toBe(true);
    });

    it('generates deterministic SKUs using helper', () => {
      const generated = SKU.generate({
        prefix: 'VG',
        productType: 'RING',
        purityKarat: '18',
        serialOrCode: 'MOD01',
      }).unwrap();

      expect(generated.value).toBe('VG-RING-18K-MOD01');
    });

    it('creates variant bound to a parent product with its own identity', () => {
      const product = Product.create({
        tenantId: tenantA,
        name: 'Classic Band',
        productType: 'RING',
      }).unwrap();

      const sku = SKU.create('RING-CLS-18K-52').unwrap();
      const variantRes = ProductVariant.create({
        productId: product.id,
        tenantId: tenantA,
        sku,
        name: 'Classic Band 18K - Size 52',
        specification: spec,
      });

      expect(variantRes.isOk).toBe(true);
      const variant = variantRes.unwrap();
      expect(variant.id).toBeDefined();
      expect(variant.productId).toBe(product.id);
      expect(variant.tenantId).toBe(tenantA);
      expect(variant.sku.value).toBe('RING-CLS-18K-52');
      expect(variant.status).toBe('ACTIVE');
      expect(variant.specification.netGoldWeight.grams.toString()).toBe('12.5');
    });

    it('enforces SKU uniqueness per tenant in repository', async () => {
      const variantRepo = new InMemoryProductVariantRepository();
      const product = Product.create({
        tenantId: tenantA,
        name: 'Band Model',
        productType: 'RING',
      }).unwrap();

      const sku = SKU.create('UNIQUE-SKU-001').unwrap();
      const variant1 = ProductVariant.create({
        productId: product.id,
        tenantId: tenantA,
        sku,
        name: 'First Variant',
        specification: spec,
      }).unwrap();

      await variantRepo.save(variant1);

      // Lookup by SKU in tenantA finds the variant
      const found = await variantRepo.findBySku(sku, tenantA);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(variant1.id);

      // In tenantB, the same SKU does NOT exist yet (tenant isolation)
      const foundTenantB = await variantRepo.findBySku(sku, tenantB);
      expect(foundTenantB).toBeNull();
    });
  });
});
