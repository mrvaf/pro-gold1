import { describe, expect, it } from 'vitest';
import {
  TenantMembership,
  AuthorizationService,
  createEntityId,
  type TenantId,
  type UserId,
  hasPermission,
  ROLE_PERMISSIONS,
} from '@v-gold/core';
import { InMemoryTenantMembershipRepository } from '@v-gold/database';

describe('IAM Roles, Permissions & Authorization Service', () => {
  it('enforces deterministic role-to-permission mapping', () => {
    // OWNER has all permissions
    expect(hasPermission('OWNER', 'tenant.read')).toBe(true);
    expect(hasPermission('OWNER', 'tenant.update')).toBe(true);
    expect(hasPermission('OWNER', 'tenant.members.read')).toBe(true);
    expect(hasPermission('OWNER', 'tenant.members.manage')).toBe(true);

    // ADMIN has read and member management, but cannot update tenant root settings
    expect(hasPermission('ADMIN', 'tenant.read')).toBe(true);
    expect(hasPermission('ADMIN', 'tenant.update')).toBe(false);
    expect(hasPermission('ADMIN', 'tenant.members.read')).toBe(true);
    expect(hasPermission('ADMIN', 'tenant.members.manage')).toBe(true);

    // MEMBER has read only
    expect(hasPermission('MEMBER', 'tenant.read')).toBe(true);
    expect(hasPermission('MEMBER', 'tenant.update')).toBe(false);
    expect(hasPermission('MEMBER', 'tenant.members.read')).toBe(false);
    expect(hasPermission('MEMBER', 'tenant.members.manage')).toBe(false);
  });

  it('authorizes permissions through AuthorizationService within tenant boundaries', async () => {
    const membershipRepo = new InMemoryTenantMembershipRepository();
    const authService = new AuthorizationService(membershipRepo);

    const tenantA = createEntityId<TenantId>('tenant-a');
    const tenantB = createEntityId<TenantId>('tenant-b');
    const userA = createEntityId<UserId>('user-a');

    // User A is OWNER in Tenant A
    const membershipA = TenantMembership.create({
      tenantId: tenantA,
      userId: userA,
      role: 'OWNER',
    }).unwrap();
    await membershipRepo.save(membershipA);

    // User A can update Tenant A
    expect(await authService.can(userA, tenantA, 'tenant.update')).toBe(true);
    expect(await authService.can(userA, tenantA, 'tenant.members.manage')).toBe(true);

    // CRUCIAL SECURITY INVARIANT:
    // User A has ZERO permissions in Tenant B!
    expect(await authService.can(userA, tenantB, 'tenant.read')).toBe(false);
    expect(await authService.can(userA, tenantB, 'tenant.update')).toBe(false);
    expect(await authService.can(userA, tenantB, 'tenant.members.manage')).toBe(false);
  });

  it('denies permissions if tenant membership is suspended or revoked', async () => {
    const membershipRepo = new InMemoryTenantMembershipRepository();
    const authService = new AuthorizationService(membershipRepo);

    const tenant = createEntityId<TenantId>('tenant-corp');
    const user = createEntityId<UserId>('user-member');

    const membership = TenantMembership.create({
      tenantId: tenant,
      userId: user,
      role: 'OWNER',
    }).unwrap();
    await membershipRepo.save(membership);

    expect(await authService.can(user, tenant, 'tenant.read')).toBe(true);

    // Suspend membership
    membership.suspend();
    await membershipRepo.save(membership);
    expect(await authService.can(user, tenant, 'tenant.read')).toBe(false);

    // Revoke membership
    membership.revoke();
    await membershipRepo.save(membership);
    expect(await authService.can(user, tenant, 'tenant.read')).toBe(false);
  });
});
