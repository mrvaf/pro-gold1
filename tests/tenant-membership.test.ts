import { describe, expect, it } from 'vitest';
import {
  TenantMembership,
  createEntityId,
  type TenantId,
  type UserId,
  ActorReference,
} from '@v-gold/core';
import { InMemoryTenantMembershipRepository } from '@v-gold/database';

describe('TenantMembership Domain Entity & Repository', () => {
  const tenantId = createEntityId<TenantId>('tenant-main');
  const userId = createEntityId<UserId>('user-101');
  const actor = ActorReference.user('admin-root').unwrap();

  it('creates active TenantMembership and supports role changes', () => {
    const membership = TenantMembership.create({
      tenantId,
      userId,
      role: 'MEMBER',
      actor,
    }).unwrap();

    expect(membership.tenantId).toBe(tenantId);
    expect(membership.userId).toBe(userId);
    expect(membership.role).toBe('MEMBER');
    expect(membership.isActive()).toBe(true);
    expect(membership.audit.createdBy?.actorId).toBe('admin-root');

    // Upgrade to ADMIN
    membership.changeRole('ADMIN', actor);
    expect(membership.role).toBe('ADMIN');
    expect(membership.can('tenant.members.manage')).toBe(true);
  });

  it('rejects creation with empty tenantId or userId', () => {
    // createEntityId throws on empty string
    expect(() => createEntityId<TenantId>('')).toThrow('Entity ID cannot be empty');
    expect(() => createEntityId<UserId>('')).toThrow('Entity ID cannot be empty');

    // TenantMembership.create rejects empty parameters
    expect(
      TenantMembership.create({
        tenantId: '' as any,
        userId,
        role: 'MEMBER',
      }).isErr
    ).toBe(true);

    expect(
      TenantMembership.create({
        tenantId,
        userId: '' as any,
        role: 'MEMBER',
      }).isErr
    ).toBe(true);
  });

  it('queries memberships by user and tenant via repository', async () => {
    const repo = new InMemoryTenantMembershipRepository();
    const t1 = createEntityId<TenantId>('tenant-1');
    const t2 = createEntityId<TenantId>('tenant-2');
    const u1 = createEntityId<UserId>('user-1');

    const m1 = TenantMembership.create({ tenantId: t1, userId: u1, role: 'OWNER' }).unwrap();
    const m2 = TenantMembership.create({ tenantId: t2, userId: u1, role: 'MEMBER' }).unwrap();

    await repo.save(m1);
    await repo.save(m2);

    expect(await repo.findByUserAndTenant(u1, t1)).not.toBeNull();
    expect(await repo.findByUserAndTenant(u1, t2)).not.toBeNull();
    expect(await repo.findByUserAndTenant(u1, createEntityId<TenantId>('tenant-nonexistent'))).toBeNull();

    const userMemberships = await repo.findAllByUser(u1);
    expect(userMemberships).toHaveLength(2);

    const t1Memberships = await repo.findAllByTenant(t1);
    expect(t1Memberships).toHaveLength(1);
  });
});
