import type { SellerWorkspace, SellerWorkspaceId } from '../domain/seller-os/seller-workspace.js';
import type { TenantId } from '../domain/tenant/tenant.js';
import type { SellerProfileId } from '../domain/marketplace/seller-profile.js';
import type { WorkspaceStatus } from '../domain/seller-os/workspace-status.js';

export interface SellerWorkspaceFilter {
  status?: WorkspaceStatus | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface SellerWorkspaceRepositoryPort {
  save(workspace: SellerWorkspace): Promise<void>;
  findById(id: SellerWorkspaceId, tenantId?: TenantId): Promise<SellerWorkspace | null>;
  findBySellerProfileId(sellerProfileId: SellerProfileId, tenantId: TenantId): Promise<SellerWorkspace | null>;
  listByTenant(tenantId: TenantId, filter?: SellerWorkspaceFilter): Promise<SellerWorkspace[]>;
  count(tenantId?: TenantId): Promise<number>;
}
