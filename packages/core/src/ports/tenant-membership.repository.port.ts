import type { TenantId } from '../domain/tenant/tenant.js';
import type { UserId } from '../domain/iam/user.js';
import type { TenantMembership, MembershipId } from '../domain/iam/tenant-membership.js';

export interface TenantMembershipRepositoryPort {
  findById(id: MembershipId): Promise<TenantMembership | null>;
  findByUserAndTenant(userId: UserId, tenantId: TenantId): Promise<TenantMembership | null>;
  findAllByUser(userId: UserId): Promise<readonly TenantMembership[]>;
  findAllByTenant(tenantId: TenantId): Promise<readonly TenantMembership[]>;
  save(membership: TenantMembership): Promise<void>;
  delete(id: MembershipId): Promise<void>;
}
