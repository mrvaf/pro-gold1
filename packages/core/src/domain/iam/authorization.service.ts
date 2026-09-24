import type { TenantId } from '../tenant/tenant.js';
import type { UserId } from './user.js';
import type { Permission } from './permissions.js';
import type { TenantMembershipRepositoryPort } from '../../ports/tenant-membership.repository.port.js';

/**
 * Domain Authorization Service.
 * Centralized authorization authority in V-GOLD.
 * Evaluates whether an authenticated User has a specific Permission within a specific Tenant.
 */
export class AuthorizationService {
  constructor(private readonly membershipRepo: TenantMembershipRepositoryPort) {}

  async can(userId: UserId, tenantId: TenantId, permission: Permission): Promise<boolean> {
    const membership = await this.membershipRepo.findByUserAndTenant(userId, tenantId);
    if (!membership || !membership.isActive()) {
      return false;
    }

    return membership.can(permission);
  }

  async getRole(userId: UserId, tenantId: TenantId) {
    const membership = await this.membershipRepo.findByUserAndTenant(userId, tenantId);
    if (!membership || !membership.isActive()) {
      return null;
    }
    return membership.role;
  }
}
