import { describe, expect, it } from 'vitest';
import {
  Tenant,
  Store,
  createEntityId,
  type TenantId,
  type StoreId,
} from '@v-gold/core';
import {
  InMemoryTenantRepository,
  InMemoryStoreRepository,
} from '@v-gold/database';

describe('Tenant & Store Repositories (Tenant Isolation)', () => {
  it('manages Tenant entities via InMemoryTenantRepository', async () => {
    const repo = new InMemoryTenantRepository();
    const tenant1 = Tenant.create({ name: 'Tenant One', slug: 'tenant-one' }).unwrap();
    const tenant2 = Tenant.create({ name: 'Tenant Two', slug: 'tenant-two' }).unwrap();

    await repo.save(tenant1);
    await repo.save(tenant2);

    expect(await repo.findById(tenant1.id)).not.toBeNull();
    expect(await repo.findBySlug('tenant-one')).not.toBeNull();
    expect(await repo.findBySlug('non-existent')).toBeNull();

    const all = await repo.findAll();
    expect(all.length).toBe(2);

    await repo.delete(tenant1.id);
    expect(await repo.findById(tenant1.id)).toBeNull();
    expect(await repo.findAll()).toHaveLength(1);
  });

  it('guarantees that Tenant A cannot access or mutate Tenant B stores', async () => {
    const storeRepo = new InMemoryStoreRepository();
    const tenantA = createEntityId<TenantId>('tenant-alpha');
    const tenantB = createEntityId<TenantId>('tenant-beta');

    const storeA1 = Store.create({
      tenantId: tenantA,
      name: 'Alpha Store 1',
      code: 'ALPHA_01',
    }).unwrap();

    const storeA2 = Store.create({
      tenantId: tenantA,
      name: 'Alpha Store 2',
      code: 'ALPHA_02',
    }).unwrap();

    const storeB1 = Store.create({
      tenantId: tenantB,
      name: 'Beta Store 1',
      code: 'BETA_01',
    }).unwrap();

    // Persist stores under their respective tenants
    await storeRepo.save(tenantA, storeA1);
    await storeRepo.save(tenantA, storeA2);
    await storeRepo.save(tenantB, storeB1);

    // Verify Tenant A can see its own stores
    const foundA1 = await storeRepo.findById(tenantA, storeA1.id);
    expect(foundA1?.name).toBe('Alpha Store 1');
    const allA = await storeRepo.findAllByTenant(tenantA);
    expect(allA).toHaveLength(2);

    // TENANT ISOLATION INVARIANT:
    // Tenant B CANNOT find Tenant A's store by ID
    const crossAccessById = await storeRepo.findById(tenantB, storeA1.id);
    expect(crossAccessById).toBeNull();

    // Tenant B CANNOT find Tenant A's store by Code
    const crossAccessByCode = await storeRepo.findByCode(tenantB, 'ALPHA_01');
    expect(crossAccessByCode).toBeNull();

    // Tenant B cannot see Tenant A stores in listing
    const allB = await storeRepo.findAllByTenant(tenantB);
    expect(allB).toHaveLength(1);
    expect(allB[0]?.name).toBe('Beta Store 1');

    // Tenant B cannot delete Tenant A's store
    await storeRepo.delete(tenantB, storeA1.id);
    // Tenant A's store must still exist!
    expect(await storeRepo.findById(tenantA, storeA1.id)).not.toBeNull();
  });
});
