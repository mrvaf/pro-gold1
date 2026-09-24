import { describe, expect, it } from 'vitest';
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
  createEntityId,
  ActorReference,
  type TenantId,
} from '@v-gold/core';
import {
  InMemoryProductRepository,
  InMemoryProductVariantRepository,
  InMemoryInventoryLocationRepository,
  InMemoryInventoryItemRepository,
  InMemoryInventoryMovementRepository,
} from '@v-gold/database';

describe('Stage 6: Catalog & Inventory Multi-Tenant Isolation & IDOR Security', () => {
  const tenantA = createEntityId<TenantId>('tenant_alpha_jewelers');
  const tenantB = createEntityId<TenantId>('tenant_beta_goldsmiths');
  const actorA = ActorReference.user('user_alpha').unwrap();
  const actorB = ActorReference.user('user_beta').unwrap();

  it('strictly denies cross-tenant access to Catalog Products', async () => {
    const productRepo = new InMemoryProductRepository();

    const productA = Product.create({
      tenantId: tenantA,
      name: 'Alpha Exclusive Ring',
      productType: 'RING',
      actor: actorA,
    }).unwrap();
    await productRepo.save(productA);

    // Tenant A queries -> found
    const fetchA = await productRepo.findById(productA.id, tenantA);
    expect(fetchA).not.toBeNull();
    expect(fetchA?.name).toBe('Alpha Exclusive Ring');

    // Tenant B queries Tenant A's product -> null (IDOR denied)
    const fetchB = await productRepo.findById(productA.id, tenantB);
    expect(fetchB).toBeNull();

    // Listing by tenant strictly isolates
    const listB = await productRepo.listByTenant(tenantB);
    expect(listB.length).toBe(0);
  });

  it('strictly denies cross-tenant access to Product Variants', async () => {
    const variantRepo = new InMemoryProductVariantRepository();
    const productA = Product.create({
      tenantId: tenantA,
      name: 'Alpha Ring',
      productType: 'RING',
    }).unwrap();

    const metal = MaterialSpecification.gold(
      GoldPurity.K18,
      Weight.fromGrams('5.0').unwrap()
    ).unwrap();
    const spec = JewelrySpecification.create({
      jewelryType: 'RING',
      metal,
      grossWeight: Weight.fromGrams('5.0').unwrap(),
    }).unwrap();

    const variantA = ProductVariant.create({
      productId: productA.id,
      tenantId: tenantA,
      sku: SKU.create('ALPHA-VAR-01').unwrap(),
      name: 'Variant Alpha',
      specification: spec,
      actor: actorA,
    }).unwrap();
    await variantRepo.save(variantA);

    // Tenant B queries variantA -> null
    const crossFetch = await variantRepo.findById(variantA.id, tenantB);
    expect(crossFetch).toBeNull();

    // Tenant B queries by SKU -> null
    const skuFetchB = await variantRepo.findBySku('ALPHA-VAR-01', tenantB);
    expect(skuFetchB).toBeNull();
  });

  it('strictly denies cross-tenant access to Inventory Locations', async () => {
    const locRepo = new InMemoryInventoryLocationRepository();

    const locA = InventoryLocation.create({
      tenantId: tenantA,
      name: 'Alpha Private Vault',
      code: 'VAULT_01',
      type: 'VAULT',
      actor: actorA,
    }).unwrap();
    await locRepo.save(locA);

    // Tenant B cannot access Tenant A's vault
    const crossLoc = await locRepo.findById(locA.id, tenantB);
    expect(crossLoc).toBeNull();

    const codeLocB = await locRepo.findByCode('VAULT_01', tenantB);
    expect(codeLocB).toBeNull();

    // But Tenant B CAN create their own VAULT_01 without collision (tenant-scoped code uniqueness)
    const locB = InventoryLocation.create({
      tenantId: tenantB,
      name: 'Beta Private Vault',
      code: 'VAULT_01',
      type: 'VAULT',
      actor: actorB,
    }).unwrap();
    await locRepo.save(locB);

    const codeLocBFound = await locRepo.findByCode('VAULT_01', tenantB);
    expect(codeLocBFound).not.toBeNull();
    expect(codeLocBFound?.name).toBe('Beta Private Vault');
  });

  it('strictly denies cross-tenant access to Inventory Items', async () => {
    const itemRepo = new InMemoryInventoryItemRepository();
    const locA = InventoryLocation.create({
      tenantId: tenantA,
      name: 'Alpha Vault',
      code: 'ALPH_VLT',
      type: 'VAULT',
    }).unwrap();

    const { item } = InventoryItem.intake({
      tenantId: tenantA,
      productVariantId: createEntityId('var_alpha_01'),
      sku: SKU.create('ITM-ALPH-01').unwrap(),
      serialNumber: 'SN-ALPHA-777',
      locationId: locA.id,
      grossWeight: Weight.fromGrams('10.0').unwrap(),
      goldWeight: Weight.fromGrams('10.0').unwrap(),
      purity: GoldPurity.K18,
      actor: actorA,
    }).unwrap();

    await itemRepo.save(item);

    // Cross lookup by ID
    const crossFetch = await itemRepo.findById(item.id, tenantB);
    expect(crossFetch).toBeNull();

    // Cross lookup by Serial
    const crossSerial = await itemRepo.findBySerialNumber('SN-ALPHA-777', tenantB);
    expect(crossSerial).toBeNull();

    // Tenant B list is empty
    const listB = await itemRepo.listByTenant(tenantB);
    expect(listB.length).toBe(0);
  });

  it('strictly isolates append-only movements between tenants', async () => {
    const movRepo = new InMemoryInventoryMovementRepository();

    const movA = InventoryMovement.record({
      tenantId: tenantA,
      inventoryItemId: createEntityId('item_alpha_1'),
      movementType: 'INTAKE',
      fromStatus: 'AVAILABLE',
      toStatus: 'AVAILABLE',
      actor: actorA,
      reference: 'ALPHA-INTAKE-01',
    }).unwrap();

    const movB = InventoryMovement.record({
      tenantId: tenantB,
      inventoryItemId: createEntityId('item_beta_1'),
      movementType: 'INTAKE',
      fromStatus: 'AVAILABLE',
      toStatus: 'AVAILABLE',
      actor: actorB,
      reference: 'BETA-INTAKE-01',
    }).unwrap();

    await movRepo.record(movA);
    await movRepo.record(movB);

    // Tenant A only sees movA
    const movementsA = await movRepo.listByTenant(tenantA);
    expect(movementsA.length).toBe(1);
    expect(movementsA[0].id).toBe(movA.id);

    // Tenant B only sees movB
    const movementsB = await movRepo.listByTenant(tenantB);
    expect(movementsB.length).toBe(1);
    expect(movementsB[0].id).toBe(movB.id);

    // Cross findById returns null
    const crossMov = await movRepo.findById(movA.id, tenantB);
    expect(crossMov).toBeNull();
  });
});
