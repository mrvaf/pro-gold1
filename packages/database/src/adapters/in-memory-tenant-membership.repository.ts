import type {
  TenantMembershipRepositoryPort,
  TenantMembership,
  MembershipId,
  TenantId,
  UserId,
} from '@v-gold/core';
import { InMemoryRepository } from '../in-memory-store.js';

export class InMemoryTenantMembershipRepository
  extends InMemoryRepository<TenantMembership, MembershipId>
  implements TenantMembershipRepositoryPort
{
  async findByUserAndTenant(userId: UserId, tenantId: TenantId): Promise<TenantMembership | null> {
    for (const membership of this.items.values()) {
      if (membership.userId === userId && membership.tenantId === tenantId) {
        return membership;
      }
    }
    return null;
  }

  async findAllByUser(userId: UserId): Promise<readonly TenantMembership[]> {
    const results: TenantMembership[] = [];
    for (const membership of this.items.values()) {
      if (membership.userId === userId) {
        results.push(membership);
      }
    }
    return results;
  }

  async findAllByTenant(tenantId: TenantId): Promise<readonly TenantMembership[]> {
    const results: TenantMembership[] = [];
    for (const membership of this.items.values()) {
      if (membership.tenantId === tenantId) {
        results.push(membership);
      }
    }
    return results;
  }
}
