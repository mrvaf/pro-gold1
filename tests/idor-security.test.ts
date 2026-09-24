import { describe, expect, it } from 'vitest';
import {
  Tenant,
  Store,
  User,
  TenantMembership,
  Email,
  PasswordHash,
  createEntityId,
  type TenantId,
  type StoreId,
  type UserId,
  AuthorizationService,
} from '@v-gold/core';
import {
  InMemoryTenantRepository,
  InMemoryStoreRepository,
  InMemoryTenantMembershipRepository,
} from '@v-gold/database';

describe('IDOR & Cross-Tenant Boundary Security', () => {
  it('strictly denies cross-tenant resource access and manipulation', async () => {
    const tenantRepo = new InMemoryTenantRepository();
    const storeRepo = new InMemoryStoreRepository();
    const membershipRepo = new InMemoryTenantMembershipRepository();
    const authService = new AuthorizationService(membershipRepo);

    // 1. Create Tenant A & Owner A
    const tenantA = Tenant.create({ name: 'Alpha Gold Guild', slug: 'alpha-gold' }).unwrap();
    const userA = User.create({
      email: Email.create('owner-a@alpha.ir').unwrap(),
      displayName: 'Owner Alpha',
      passwordHash: PasswordHash.create('scrypt$N=16384,r=8,p=1$1234567890abcdef$0987654321fedcba').unwrap(),
    }).unwrap();
    const membershipA = TenantMembership.create({
      tenantId: tenantA.id,
      userId: userA.id,
      role: 'OWNER',
    }).unwrap();

    await tenantRepo.save(tenantA);
    await membershipRepo.save(membershipA);

    // 2. Create Tenant B & Owner B
    const tenantB = Tenant.create({ name: 'Beta Jewelry House', slug: 'beta-jewelry' }).unwrap();
    const userB = User.create({
      email: Email.create('owner-b@beta.ir').unwrap(),
      displayName: 'Owner Beta',
      passwordHash: PasswordHash.create('scrypt$N=16384,r=8,p=1$abcdef1234567890$fedcba0987654321').unwrap(),
    }).unwrap();
    const membershipB = TenantMembership.create({
      tenantId: tenantB.id,
      userId: userB.id,
      role: 'OWNER',
    }).unwrap();

    await tenantRepo.save(tenantB);
    await membershipRepo.save(membershipB);

    // 3. Create Store in Tenant B
    const storeB = Store.create({
      tenantId: tenantB.id,
      name: 'Beta Private Vault',
      code: 'VAULT_01',
    }).unwrap();
    await storeRepo.save(tenantB.id, storeB);

    // TEST 1: User A is OWNER in Tenant A, but has ZERO permissions in Tenant B
    expect(await authService.can(userA.id, tenantA.id, 'tenant.read')).toBe(true);
    expect(await authService.can(userA.id, tenantA.id, 'tenant.update')).toBe(true);
    expect(await authService.can(userA.id, tenantA.id, 'tenant.members.manage')).toBe(true);

    // IDOR ATTEMPT: User A attempts to check permissions in Tenant B
    expect(await authService.can(userA.id, tenantB.id, 'tenant.read')).toBe(false);
    expect(await authService.can(userA.id, tenantB.id, 'tenant.update')).toBe(false);
    expect(await authService.can(userA.id, tenantB.id, 'tenant.members.manage')).toBe(false);

    // TEST 2: Querying store data under Tenant A returns nothing for Tenant B's store
    const storeLookupUnderTenantA = await storeRepo.findById(tenantA.id, storeB.id);
    expect(storeLookupUnderTenantA).toBeNull();

    // TEST 3: Tenant A cannot see Tenant B's stores in listing
    const storesUnderTenantA = await storeRepo.findAllByTenant(tenantA.id);
    expect(storesUnderTenantA.some((s) => s.id === storeB.id)).toBe(false);

    // TEST 4: User A attempting to save or modify a Store belonging to Tenant B under Tenant A
    const maliciousStore = Store.create({
      id: storeB.id,
      tenantId: tenantB.id, // Store has tenantId = B
      name: 'Compromised Name',
      code: 'VAULT_01',
    }).unwrap();

    // Trying to save Store with tenantB under tenantA context must throw mismatch error
    await expect(storeRepo.save(tenantA.id, maliciousStore)).rejects.toThrow();
  });
});
